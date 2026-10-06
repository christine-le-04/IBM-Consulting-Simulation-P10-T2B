package com.ibm.consulting.sim.scenario.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioAssignment;
import com.ibm.consulting.sim.scenario.domain.ScenarioAssignmentRepository;
import com.ibm.consulting.sim.scenario.domain.ScenarioCatalogQuery;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import com.ibm.consulting.sim.shared.infrastructure.observability.AuditLogger;

class ScenarioAssignmentServiceTest {

    private final ScenarioAssignmentRepository assignments = mock(ScenarioAssignmentRepository.class);
    private final ScenarioRepository scenarios = mock(ScenarioRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private ScenarioAssignmentService service;

    private final Scenario scenario = Scenario.create("Retail turnaround", "Retail", "Description", 3);
    private final User alice = User.create("alice@example.com", "hash", "Alice", UserRole.LEARNER);
    private final User bob = User.create("bob@example.com", "hash", "Bob", UserRole.LEARNER);
    private final User author = User.create("author@example.com", "hash", "Author", UserRole.SCENARIO_AUTHOR);

    @BeforeEach
    void setUp() {
        service = new ScenarioAssignmentService(assignments, scenarios, users, mock(AuditLogger.class));
        when(scenarios.findLineageIdById(scenario.getId())).thenReturn(Optional.of(scenario.getScenarioLineageId()));
        for (User user : List.of(alice, bob, author)) {
            when(users.findById(user.getId())).thenReturn(Optional.of(user));
        }
    }

    @Test
    @SuppressWarnings("unchecked")
    void replaceAssignsNewConsultantsAndUnassignsOmittedOnes() {
        ScenarioAssignment aliceAssignment = ScenarioAssignment.assign(scenario.getScenarioLineageId(), alice.getId(), null);
        when(assignments.findByLineageId(scenario.getScenarioLineageId())).thenReturn(List.of(aliceAssignment));

        service.replaceAssignments(scenario.getId(), List.of(bob.getId()), author.getId());

        ArgumentCaptor<Collection<ScenarioAssignment>> removed = ArgumentCaptor.forClass(Collection.class);
        verify(assignments).deleteAll(removed.capture());
        assertThat(removed.getValue()).extracting(ScenarioAssignment::getUserId).containsExactly(alice.getId());

        ArgumentCaptor<Collection<ScenarioAssignment>> added = ArgumentCaptor.forClass(Collection.class);
        verify(assignments).saveAll(added.capture());
        assertThat(new ArrayList<>(added.getValue())).singleElement().satisfies(assignment -> {
            assertThat(assignment.getUserId()).isEqualTo(bob.getId());
            assertThat(assignment.getScenarioLineageId()).isEqualTo(scenario.getScenarioLineageId());
            assertThat(assignment.getAssignedBy()).isEqualTo(author.getId());
        });
    }

    @Test
    void unchangedSelectionWritesNothing() {
        when(assignments.findByLineageId(scenario.getScenarioLineageId()))
                .thenReturn(List.of(ScenarioAssignment.assign(scenario.getScenarioLineageId(), alice.getId(), null)));

        service.replaceAssignments(scenario.getId(), List.of(alice.getId(), alice.getId()), author.getId());

        verify(assignments, never()).deleteAll(anyCollection());
        verify(assignments, never()).saveAll(anyCollection());
    }

    @Test
    void onlyLearnerAccountsCanBeAssigned() {
        assertThatThrownBy(() -> service.replaceAssignments(scenario.getId(), List.of(author.getId()), null))
                .isInstanceOf(ScenarioAssignmentService.InvalidAssigneeException.class);
        verify(assignments, never()).saveAll(any());
    }

    @Test
    void unknownUsersAndScenariosAreRejected() {
        UUID ghost = UUID.randomUUID();
        when(users.findById(ghost)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.replaceAssignments(scenario.getId(), List.of(ghost), null))
                .isInstanceOf(NotFoundException.class);

        UUID missingScenario = UUID.randomUUID();
        when(scenarios.findLineageIdById(missingScenario)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.assignments(missingScenario)).isInstanceOf(NotFoundException.class);
    }

    @Test
    void consultantsNeedAnAssignmentToStartButStaffDoNot() {
        when(assignments.existsByLineageIdAndUserId(scenario.getScenarioLineageId(), alice.getId())).thenReturn(true);
        when(assignments.existsByLineageIdAndUserId(scenario.getScenarioLineageId(), bob.getId())).thenReturn(false);

        assertThat(service.canStart(alice.getId(), scenario)).isTrue();
        assertThat(service.canStart(bob.getId(), scenario)).isFalse();
        assertThat(service.canStart(author.getId(), scenario)).isTrue();
        assertThat(service.canStart(UUID.randomUUID(), scenario)).isFalse();
    }

    @Test
    void onlyConsultantCataloguesAreFiltered() {
        assertThat(service.catalogueAssigneeFor(alice)).isEqualTo(alice.getId());
        assertThat(service.catalogueAssigneeFor(author)).isNull();
    }

    @Test
    void catalogueCacheKeysAreSeparatedPerConsultant() {
        ScenarioCatalogQuery base = new ScenarioCatalogQuery(null, null, null, 0, 9);
        assertThat(base.forAssignee(alice.getId()).cacheKey())
                .isNotEqualTo(base.forAssignee(bob.getId()).cacheKey())
                .isNotEqualTo(base.cacheKey());
        assertThat(base.forAssignee(null)).isEqualTo(base);
    }
}
