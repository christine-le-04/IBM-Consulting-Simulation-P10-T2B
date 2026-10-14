package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class LearnerProgressServiceTest {
    private final EngagementRepository engagements = mock(EngagementRepository.class);
    private final AssessmentRepository assessments = mock(AssessmentRepository.class);
    private final ScenarioRepository scenarios = mock(ScenarioRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final LearnerProgressService service = new LearnerProgressService(engagements, assessments, scenarios, users);

    private final UUID userId = UUID.randomUUID();
    private final UUID scenarioId = UUID.randomUUID();

    private Engagement engagement(EngagementState state, Instant updatedAt, Instant completedAt) {
        Engagement engagement = mock(Engagement.class);
        when(engagement.getId()).thenReturn(UUID.randomUUID());
        when(engagement.getUserId()).thenReturn(userId);
        when(engagement.getScenarioId()).thenReturn(scenarioId);
        when(engagement.getState()).thenReturn(state);
        when(engagement.getUpdatedAt()).thenReturn(updatedAt);
        when(engagement.getCompletedAt()).thenReturn(completedAt);
        return engagement;
    }

    @Test
    void returnsEachRunWithLearnerScenarioAndScoreNewestFirst() {
        Engagement older = engagement(EngagementState.COMPLETED, Instant.parse("2026-10-10T00:00:00Z"), Instant.parse("2026-10-10T00:00:00Z"));
        Engagement newer = engagement(EngagementState.OUTREACHING, Instant.parse("2026-10-12T00:00:00Z"), null);
        User user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        when(user.getDisplayName()).thenReturn("Ana Lee");
        when(user.getEmail()).thenReturn("ana@example.com");
        Scenario scenario = mock(Scenario.class);
        when(scenario.getId()).thenReturn(scenarioId);
        when(scenario.getTitle()).thenReturn("AeroVector Aviation");
        UUID olderId = older.getId();
        Assessment assessment = mock(Assessment.class);
        when(assessment.getEngagementId()).thenReturn(olderId);
        when(assessment.getOverallScore()).thenReturn(82);
        when(engagements.findAll()).thenReturn(List.of(older, newer));
        when(assessments.findAllByEngagementIdIn(anyList())).thenReturn(List.of(assessment));
        when(scenarios.findByIdIn(anyList())).thenReturn(List.of(scenario));
        when(users.findAll()).thenReturn(List.of(user));

        List<LearnerProgressEntry> progress = service.getProgress();

        assertThat(progress).extracting(LearnerProgressEntry::state).containsExactly("OUTREACHING", "COMPLETED");
        assertThat(progress.get(0).overallScore()).isNull();
        assertThat(progress.get(1).overallScore()).isEqualTo(82);
        assertThat(progress.get(1).displayName()).isEqualTo("Ana Lee");
        assertThat(progress.get(1).scenarioTitle()).isEqualTo("AeroVector Aviation");
    }

    @Test
    void labelsRunsWhoseLearnerOrScenarioNoLongerExists() {
        Engagement orphan = engagement(EngagementState.PREPARING, Instant.parse("2026-10-12T00:00:00Z"), null);
        when(engagements.findAll()).thenReturn(List.of(orphan));
        when(assessments.findAllByEngagementIdIn(anyList())).thenReturn(List.of());
        when(scenarios.findByIdIn(anyList())).thenReturn(List.of());
        when(users.findAll()).thenReturn(List.of());

        LearnerProgressEntry entry = service.getProgress().get(0);

        assertThat(entry.displayName()).isEqualTo("Removed learner");
        assertThat(entry.scenarioTitle()).isEqualTo("Retired scenario");
    }

    @Test
    void skipsLookupsWhenThereAreNoRuns() {
        when(engagements.findAll()).thenReturn(List.of());

        assertThat(service.getProgress()).isEmpty();
        verify(users, never()).findAll();
    }
}
