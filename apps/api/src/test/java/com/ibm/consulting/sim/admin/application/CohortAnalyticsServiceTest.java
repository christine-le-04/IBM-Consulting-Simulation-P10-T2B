package com.ibm.consulting.sim.admin.application;

import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.assessment.domain.CompetencyScore;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
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

class CohortAnalyticsServiceTest {
    private final EngagementRepository engagements = mock(EngagementRepository.class);
    private final AssessmentRepository assessments = mock(AssessmentRepository.class);
    private final ScenarioRepository scenarios = mock(ScenarioRepository.class);
    private final CohortAnalyticsService service = new CohortAnalyticsService(engagements, assessments, scenarios);

    private final UUID aero = UUID.randomUUID();
    private final UUID retail = UUID.randomUUID();

    private Engagement run(UUID scenarioId, UUID userId, EngagementState state) {
        Engagement engagement = mock(Engagement.class);
        when(engagement.getId()).thenReturn(UUID.randomUUID());
        when(engagement.getUserId()).thenReturn(userId);
        when(engagement.getScenarioId()).thenReturn(scenarioId);
        when(engagement.getState()).thenReturn(state);
        when(engagement.getCompletedAt()).thenReturn(state == EngagementState.COMPLETED ? Instant.parse("2026-10-15T00:00:00Z") : null);
        return engagement;
    }

    private Assessment assessment(Engagement run, int overall, int research, int alignment, List<String> improvementAreas) {
        UUID engagementId = run.getId();
        Assessment assessment = mock(Assessment.class);
        when(assessment.getEngagementId()).thenReturn(engagementId);
        when(assessment.getOverallScore()).thenReturn(overall);
        when(assessment.getCompetencyScores()).thenReturn(List.of(
                new CompetencyScore("Research & Discovery", research, ""),
                new CompetencyScore("Solution Alignment", alignment, "")));
        when(assessment.getImprovementAreas()).thenReturn(improvementAreas);
        return assessment;
    }

    private Scenario scenario(UUID id, String title) {
        Scenario scenario = mock(Scenario.class);
        when(scenario.getId()).thenReturn(id);
        when(scenario.getTitle()).thenReturn(title);
        return scenario;
    }

    @Test
    void summarisesEachScenarioAndTheWholeCohort() {
        UUID ana = UUID.randomUUID();
        UUID ben = UUID.randomUUID();
        Engagement anaDone = run(aero, ana, EngagementState.COMPLETED);
        Engagement benDone = run(aero, ben, EngagementState.COMPLETED);
        Engagement benFailed = run(aero, ben, EngagementState.MEETING_FAILED);
        Engagement anaRetail = run(retail, ana, EngagementState.OUTREACHING);
        List<Engagement> runs = List.of(anaDone, benDone, benFailed, anaRetail);
        when(engagements.findAll()).thenReturn(runs);
        List<Assessment> scored = List.of(
                assessment(anaDone, 80, 90, 60, List.of("Probe budget earlier.", "Quantify the benefits")),
                assessment(benDone, 71, 80, 66, List.of("probe budget earlier", "Name a next step")));
        List<Scenario> titles = List.of(scenario(aero, "AeroVector Aviation"), scenario(retail, "Northwind Retail"));
        when(assessments.findAllByEngagementIdIn(anyList())).thenReturn(scored);
        when(scenarios.findByIdIn(anyList())).thenReturn(titles);

        CohortAnalytics.Response response = service.getCohorts();

        assertThat(response.targetScore()).isEqualTo(70);
        CohortAnalytics overall = response.overall();
        assertThat(overall.runCount()).isEqualTo(4);
        assertThat(overall.learnerCount()).isEqualTo(2);
        assertThat(overall.completedCount()).isEqualTo(2);
        assertThat(overall.meetingFailedCount()).isEqualTo(1);
        assertThat(overall.averageScore()).isEqualTo(76);
        assertThat(overall.stateCounts()).containsEntry("COMPLETED", 2).containsEntry("OUTREACHING", 1);

        CohortAnalytics aeroCohort = response.scenarios().get(0);
        assertThat(aeroCohort.scenarioTitle()).isEqualTo("AeroVector Aviation");
        assertThat(aeroCohort.competencies()).extracting(CohortAnalytics.CompetencyAverage::name)
                .containsExactly("Solution Alignment", "Research & Discovery");
        assertThat(aeroCohort.competencies().get(0)).isEqualTo(new CohortAnalytics.CompetencyAverage("Solution Alignment", 63, 2, 2));
        assertThat(aeroCohort.commonImprovementAreas()).containsExactly(new CohortAnalytics.RecurringFeedback("Probe budget earlier.", 2));

        CohortAnalytics retailCohort = response.scenarios().get(1);
        assertThat(retailCohort.averageScore()).isNull();
        assertThat(retailCohort.competencies()).isEmpty();
    }

    @Test
    void returnsAnEmptyCohortWithoutLookupsWhenThereAreNoRuns() {
        when(engagements.findAll()).thenReturn(List.of());

        CohortAnalytics.Response response = service.getCohorts();

        assertThat(response.overall().runCount()).isZero();
        assertThat(response.scenarios()).isEmpty();
        verify(assessments, never()).findAllByEngagementIdIn(anyList());
    }
}
