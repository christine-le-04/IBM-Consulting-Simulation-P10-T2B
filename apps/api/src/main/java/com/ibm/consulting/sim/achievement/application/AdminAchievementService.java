package com.ibm.consulting.sim.achievement.application;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.ibm.consulting.sim.achievement.domain.Achievement;
import com.ibm.consulting.sim.achievement.domain.AchievementRepository;
import com.ibm.consulting.sim.achievement.domain.ConditionType;
import com.ibm.consulting.sim.achievement.infrastructure.AchievementRuleCodec;
import com.ibm.consulting.sim.assessment.domain.Competencies;
import com.ibm.consulting.sim.shared.domain.DomainException;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditAction;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;

/**
 * Administrative CRUD for achievement definitions (create/update rule tree,
 * activate/deactivate). Restricted at the controller layer to {@code ADMINISTRATOR}.
 *
 * <p>An achievement is Generic (counts every scenario) or Exclusive to one
 * scenario lineage. Whenever an achievement is published or its rule or scope
 * changes, learners whose past runs already satisfy it are awarded it.
 */
@Service
public class AdminAchievementService {

    private final AchievementRepository achievementRepository;
    private final AchievementRuleMapper ruleMapper;
    private final AchievementRuleCodec ruleCodec;
    private final AuditLogger auditLogger;
    private final AchievementEvaluationService evaluationService;
    private final ScenarioLineageLookup scenarioLineageLookup;

    public AdminAchievementService(AchievementRepository achievementRepository,
                                    AchievementRuleMapper ruleMapper,
                                    AchievementRuleCodec ruleCodec,
                                    AuditLogger auditLogger,
                                    AchievementEvaluationService evaluationService,
                                    ScenarioLineageLookup scenarioLineageLookup) {
        this.achievementRepository = achievementRepository;
        this.ruleMapper = ruleMapper;
        this.ruleCodec = ruleCodec;
        this.auditLogger = auditLogger;
        this.evaluationService = evaluationService;
        this.scenarioLineageLookup = scenarioLineageLookup;
    }

    @Transactional(readOnly = true)
    public List<AchievementAdminView> listAll() {
        return achievementRepository.findAll().stream().map(this::toAdminView).toList();
    }

    @Transactional
    public AchievementAdminView create(UpsertAchievementRequest request) {
        validate(request);
        String ruleJson = ruleCodec.encode(request.rule());
        Achievement achievement = Achievement.create(request.name(), request.description(), request.iconKey(), ruleJson);
        applyScope(achievement, request.scenarioId());
        achievementRepository.save(achievement);
        auditLogger.recordAdmin(AuditAction.ADMIN_ACHIEVEMENT_CREATED, "ACHIEVEMENT", achievement.getId().toString());
        evaluationService.backfill(achievement);
        return toAdminView(achievement);
    }

    @Transactional
    public AchievementAdminView update(UUID id, UpsertAchievementRequest request) {
        Achievement achievement = findAchievement(id);
        validate(request);
        achievement.updateDetails(request.name(), request.description(), request.iconKey());
        achievement.updateRule(ruleCodec.encode(request.rule()));
        applyScope(achievement, request.scenarioId());
        achievementRepository.save(achievement);
        auditLogger.recordAdmin(AuditAction.ADMIN_ACHIEVEMENT_UPDATED, "ACHIEVEMENT", achievement.getId().toString());
        evaluationService.backfill(achievement);
        return toAdminView(achievement);
    }

    @Transactional
    public AchievementAdminView setActive(UUID id, boolean active) {
        Achievement achievement = findAchievement(id);
        if (active) {
            achievement.activate();
        } else {
            achievement.deactivate();
        }
        achievementRepository.save(achievement);
        auditLogger.recordAdmin(active ? AuditAction.ADMIN_ACHIEVEMENT_REACTIVATED : AuditAction.ADMIN_ACHIEVEMENT_DEACTIVATED, "ACHIEVEMENT", achievement.getId().toString());
        if (active) evaluationService.backfill(achievement);
        return toAdminView(achievement);
    }

    /**
     * Rule shape (domain invariants), competency names an assessment actually
     * scores, and conditions that fit the scope: career-wide measures (distinct
     * scenarios, win rate) mean nothing for an Exclusive badge.
     */
    private void validate(UpsertAchievementRequest request) {
        validate(request.rule(), request.scenarioId());
    }

    private void validate(ConditionNode rule, UUID scenarioId) {
        ruleMapper.toDomain(rule);
        List<String> unknown = new ArrayList<>();
        List<ConditionType> outOfScope = new ArrayList<>();
        inspect(rule, scenarioId != null, unknown, outOfScope);
        if (!unknown.isEmpty()) {
            throw new InvalidAchievementException("Unknown competency " + String.join(", ", unknown)
                    + ". Use one of: " + String.join(", ", Competencies.ALL) + ".");
        }
        if (!outOfScope.isEmpty()) {
            throw new InvalidAchievementException("An Exclusive badge can't use " + outOfScope.stream()
                    .distinct().map(ConditionType::name).collect(java.util.stream.Collectors.joining(", "))
                    + ": these measure progress across every scenario.");
        }
    }

    private static void inspect(ConditionNode node, boolean exclusive, List<String> unknown,
                                List<ConditionType> outOfScope) {
        if (node == null) return;
        if (node.kind() == ConditionNode.Kind.GROUP && node.children() != null) {
            node.children().forEach(child -> inspect(child, exclusive, unknown, outOfScope));
            return;
        }
        if (node.type() == null) return;
        if (exclusive && node.type().isGenericOnly()) outOfScope.add(node.type());
        String competency = node.type() == ConditionType.MIN_COMPETENCY_SCORE ? node.competencyName()
                : node.run() != null ? node.run().competencyName() : null;
        boolean required = node.type() == ConditionType.MIN_COMPETENCY_SCORE;
        if ((required || competency != null) && !Competencies.ALL.contains(competency)) {
            unknown.add("\"" + competency + "\"");
        }
    }

    /**
     * Who would earn a draft achievement now. Validated like a save, evaluated on a
     * transient copy: nothing is stored or awarded.
     */
    @Transactional(readOnly = true)
    public AchievementPreview preview(PreviewAchievementRequest request, UUID existingAchievementId) {
        validate(request.rule(), request.scenarioId());
        Achievement draft = Achievement.create("Preview", "", "", ruleCodec.encode(request.rule()));
        applyScope(draft, request.scenarioId());
        return evaluationService.preview(draft, existingAchievementId);
    }

    /** Null scenarioId makes the achievement Generic; otherwise Exclusive to that scenario's lineage. */
    private void applyScope(Achievement achievement, UUID scenarioId) {
        if (scenarioId == null) {
            achievement.makeGeneric();
            return;
        }
        UUID lineage = scenarioLineageLookup.lineageOf(scenarioId)
                .orElseThrow(() -> new NotFoundException("Scenario", scenarioId));
        String title = scenarioLineageLookup.current(lineage)
                .map(ScenarioLineageLookup.CurrentRevision::title)
                .orElse(null);
        achievement.assignToScenario(lineage, title);
    }

    private Achievement findAchievement(UUID id) {
        return achievementRepository.findById(id).orElseThrow(() -> new NotFoundException("Achievement", id));
    }

    private AchievementAdminView toAdminView(Achievement achievement) {
        ScenarioLineageLookup.CurrentRevision scenario = achievement.isExclusive()
                ? scenarioLineageLookup.current(achievement.getScenarioLineageId()).orElse(null)
                : null;
        return AchievementAdminView.from(achievement, ruleCodec.decode(achievement.getRuleJson()), scenario);
    }

    public static class InvalidAchievementException extends DomainException {
        public InvalidAchievementException(String message) {
            super(message);
        }
    }
}
