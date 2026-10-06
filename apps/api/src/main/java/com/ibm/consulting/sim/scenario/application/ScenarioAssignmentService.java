package com.ibm.consulting.sim.scenario.application;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioAssignment;
import com.ibm.consulting.sim.scenario.domain.ScenarioAssignmentRepository;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.domain.DomainException;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static com.ibm.consulting.sim.shared.config.CacheConfig.ADMIN_PLATFORM_OVERVIEW_CACHE;
import static com.ibm.consulting.sim.shared.config.CacheConfig.SCENARIOS_CACHE;
import static com.ibm.consulting.sim.shared.config.CacheConfig.SCENARIO_CATALOG_CACHE;
import static com.ibm.consulting.sim.shared.config.CacheConfig.SCENARIO_CATALOG_FACETS_CACHE;

/**
 * Who may see and start a scenario. A Live scenario is shown only to the
 * consultants (LEARNER accounts) assigned to it. Authors and administrators
 * see every Live scenario so they can preview the learner experience.
 */
@Service
public class ScenarioAssignmentService implements ScenarioAccessPolicy {

    private final ScenarioAssignmentRepository assignmentRepository;
    private final ScenarioRepository scenarioRepository;
    private final UserRepository userRepository;
    private final AuditLogger auditLogger;

    public ScenarioAssignmentService(ScenarioAssignmentRepository assignmentRepository,
                                     ScenarioRepository scenarioRepository,
                                     UserRepository userRepository,
                                     AuditLogger auditLogger) {
        this.assignmentRepository = assignmentRepository;
        this.scenarioRepository = scenarioRepository;
        this.userRepository = userRepository;
        this.auditLogger = auditLogger;
    }

    /** Admin capability: the consultants assigned to this scenario's lineage. */
    @Transactional(readOnly = true)
    public ScenarioAssignmentView assignments(UUID scenarioId) {
        UUID lineageId = lineageOf(scenarioId);
        List<ScenarioAssignmentView.Assignee> assignees = assignmentRepository.findByLineageId(lineageId).stream()
                .map(assignment -> userRepository.findById(assignment.getUserId()))
                .flatMap(Optional::stream)
                .map(ScenarioAssignmentView.Assignee::from)
                .sorted(Comparator.comparing(ScenarioAssignmentView.Assignee::displayName, String.CASE_INSENSITIVE_ORDER))
                .toList();
        return new ScenarioAssignmentView(scenarioId, lineageId, assignees);
    }

    /**
     * Admin capability: replace the full set of assigned consultants. Users
     * missing from the list are unassigned; new users are assigned.
     */
    @Transactional
    @Caching(evict = {
            @CacheEvict(cacheNames = SCENARIOS_CACHE, allEntries = true),
            @CacheEvict(cacheNames = SCENARIO_CATALOG_CACHE, allEntries = true),
            @CacheEvict(cacheNames = SCENARIO_CATALOG_FACETS_CACHE, allEntries = true),
            @CacheEvict(cacheNames = ADMIN_PLATFORM_OVERVIEW_CACHE, allEntries = true)
    })
    public ScenarioAssignmentView replaceAssignments(UUID scenarioId, List<UUID> userIds, UUID assignedBy) {
        UUID lineageId = lineageOf(scenarioId);
        Set<UUID> requested = new LinkedHashSet<>(userIds == null ? List.of() : userIds);
        for (UUID userId : requested) {
            User user = userRepository.findById(userId).orElseThrow(() -> new NotFoundException("User", userId));
            if (user.getRole() != UserRole.LEARNER) throw new InvalidAssigneeException(user);
        }

        List<ScenarioAssignment> current = assignmentRepository.findByLineageId(lineageId);
        Set<UUID> currentUserIds = current.stream().map(ScenarioAssignment::getUserId).collect(Collectors.toSet());

        List<ScenarioAssignment> removed = current.stream()
                .filter(assignment -> !requested.contains(assignment.getUserId()))
                .toList();
        List<ScenarioAssignment> added = requested.stream()
                .filter(userId -> !currentUserIds.contains(userId))
                .map(userId -> ScenarioAssignment.assign(lineageId, userId, assignedBy))
                .toList();

        if (!removed.isEmpty()) assignmentRepository.deleteAll(removed);
        if (!added.isEmpty()) assignmentRepository.saveAll(added);

        auditLogger.recordAdmin(AuditAction.ADMIN_SCENARIO_ASSIGNMENTS_UPDATED, "SCENARIO", lineageId.toString(),
                "assigned " + added.size() + ", unassigned " + removed.size());
        return assignments(scenarioId);
    }

    /**
     * The assignment filter for the learner catalogue: the viewer's own id for
     * consultants, or null (no filter) for authors and administrators.
     */
    public UUID catalogueAssigneeFor(User viewer) {
        return isConsultant(viewer) ? viewer.getId() : null;
    }

    /** Engagement guard: consultants may only start scenarios they are assigned to. */
    @Override
    @Transactional(readOnly = true)
    public boolean canStart(UUID userId, Scenario scenario) {
        return userRepository.findById(userId)
                .map(user -> !isConsultant(user)
                        || assignmentRepository.existsByLineageIdAndUserId(scenario.getScenarioLineageId(), userId))
                .orElse(false);
    }

    private static boolean isConsultant(User user) {
        return user != null && user.getRole() == UserRole.LEARNER;
    }

    private UUID lineageOf(UUID scenarioId) {
        return scenarioRepository.findLineageIdById(scenarioId)
                .orElseThrow(() -> new NotFoundException("Scenario", scenarioId));
    }

    public static class InvalidAssigneeException extends DomainException {
        public InvalidAssigneeException(User user) {
            super("Only consultant (learner) accounts can be assigned to a scenario. "
                    + user.getDisplayName() + " is " + user.getRole() + ".");
        }
    }
}
