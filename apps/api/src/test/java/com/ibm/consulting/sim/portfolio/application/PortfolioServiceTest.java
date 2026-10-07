package com.ibm.consulting.sim.portfolio.application;

import com.fasterxml.jackson.databind.ObjectMapper;

import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.scenario.domain.PersonaRepository;
import com.ibm.consulting.sim.scenario.domain.Persona;
import com.ibm.consulting.sim.scenario.domain.DifficultyLevel;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PortfolioServiceTest {

    @Test
    void onlyTerminallyCompletedEngagementsAppearInHistoryAndMetrics() {
        UUID userId = UUID.randomUUID();
        UUID scenarioId = UUID.randomUUID();
        Engagement clientDecision = engagementInState(scenarioId, EngagementState.CLIENT_DECISION);
        Engagement review = engagementInState(scenarioId, EngagementState.REVIEW);
        Engagement completed = engagementInState(scenarioId, EngagementState.COMPLETED);
        when(completed.getDifficultyProfileSnapshot()).thenReturn("{\"level\":\"HARD\"}");
        Engagement failed = engagementInState(scenarioId, EngagementState.MEETING_FAILED);
        EngagementRepository engagements = mock(EngagementRepository.class);
        AssessmentRepository assessments = mock(AssessmentRepository.class);
        ScenarioRepository scenarios = mock(ScenarioRepository.class);
        when(engagements.findByUserId(userId)).thenReturn(List.of(clientDecision, review, completed, failed));
        when(assessments.findAllByEngagementIdIn(List.of(completed.getId()))).thenReturn(List.of());
        when(scenarios.findById(scenarioId))
                .thenReturn(Optional.of(Scenario.create("Scenario", "Retail", "Description", 3)));

        PortfolioSummaryResponse summary = new PortfolioService(engagements, assessments, scenarios,
                mock(PersonaRepository.class), new ObjectMapper()).getSummary(userId);

        assertThat(summary.totalEngagements()).isEqualTo(4);
        assertThat(summary.completedEngagements()).isEqualTo(1);
        assertThat(summary.inProgressEngagements()).isEqualTo(2);
        assertThat(summary.failedEngagements()).isEqualTo(1);
        assertThat(summary.averageOverallScore()).isNull();
        assertThat(summary.completedEngagementsHistory().getFirst().overallScore()).isNull();
        assertThat(summary.completedEngagementsHistory().getFirst().outcome()).isEqualTo("ASSESSMENT_PENDING");
        assertThat(summary.completedEngagementsHistory().getFirst().difficulty()).isEqualTo(DifficultyLevel.HARD);
        assertThat(summary.completedEngagementsHistory())
                .extracting(PortfolioSummaryResponse.CompletedEngagementView::engagementId)
                .containsExactly(completed.getId());
    }

    @Test
    void aRecordedZeroScoreIsIncludedWhileMissingAssessmentsAreExcludedFromTheAverage() {
        UUID userId = UUID.randomUUID();
        UUID scenarioId = UUID.randomUUID();
        Engagement zero = engagementInState(scenarioId, EngagementState.COMPLETED);
        Engagement scored = engagementInState(scenarioId, EngagementState.COMPLETED);
        Engagement pending = engagementInState(scenarioId, EngagementState.COMPLETED);
        EngagementRepository engagements = mock(EngagementRepository.class);
        AssessmentRepository assessments = mock(AssessmentRepository.class);
        ScenarioRepository scenarios = mock(ScenarioRepository.class);
        UUID zeroId = zero.getId();
        UUID scoredId = scored.getId();
        Assessment zeroAssessment = mock(Assessment.class);
        when(zeroAssessment.getEngagementId()).thenReturn(zeroId);
        when(zeroAssessment.getOutcome()).thenReturn("REJECTED");
        Assessment scoredAssessment = mock(Assessment.class);
        when(scoredAssessment.getEngagementId()).thenReturn(scoredId);
        when(scoredAssessment.getOverallScore()).thenReturn(80);
        when(scoredAssessment.getOutcome()).thenReturn("PROPOSAL_ACCEPTED");
        when(engagements.findByUserId(userId)).thenReturn(List.of(zero, scored, pending));
        when(assessments.findAllByEngagementIdIn(List.of(zero.getId(), scored.getId(), pending.getId())))
                .thenReturn(List.of(zeroAssessment, scoredAssessment));
        when(scenarios.findById(scenarioId))
                .thenReturn(Optional.of(Scenario.create("Scenario", "Retail", "Description", 3)));

        PortfolioSummaryResponse summary = new PortfolioService(engagements, assessments, scenarios,
                mock(PersonaRepository.class), new ObjectMapper()).getSummary(userId);

        assertThat(summary.averageOverallScore()).isEqualTo(40.0);
        assertThat(summary.completedEngagementsHistory()).extracting(PortfolioSummaryResponse.CompletedEngagementView::overallScore)
                .containsExactly(0, 80, null);
        assertThat(summary.contractsWon()).isEqualTo(1);
        assertThat(summary.contractsLost()).isEqualTo(1);
        assertThat(summary.completedEngagementsHistory()).allSatisfy(item -> assertThat(item.difficulty()).isNull());
    }

    @Test
    void comparisonUsesRecordedDifficultyAndToleratesInvalidLegacySnapshots() {
        UUID userId = UUID.randomUUID();
        UUID scenarioId = UUID.randomUUID();
        Engagement recorded = engagementInState(scenarioId, EngagementState.COMPLETED);
        Engagement legacy = engagementInState(scenarioId, EngagementState.COMPLETED);
        when(recorded.getDifficultyProfileSnapshot()).thenReturn("{\"level\":\"EASY\"}");
        when(legacy.getDifficultyProfileSnapshot()).thenReturn("invalid-json");
        EngagementRepository engagements = mock(EngagementRepository.class);
        AssessmentRepository assessments = mock(AssessmentRepository.class);
        ScenarioRepository scenarios = mock(ScenarioRepository.class);
        PersonaRepository personas = mock(PersonaRepository.class);
        when(engagements.findByIdAndUserId(recorded.getId(), userId)).thenReturn(Optional.of(recorded));
        when(engagements.findByIdAndUserId(legacy.getId(), userId)).thenReturn(Optional.of(legacy));
        when(assessments.findByEngagementId(recorded.getId())).thenReturn(Optional.of(mock(Assessment.class)));
        when(assessments.findByEngagementId(legacy.getId())).thenReturn(Optional.of(mock(Assessment.class)));
        when(scenarios.findById(scenarioId)).thenReturn(Optional.of(Scenario.create("Scenario", "Retail", "Description", 5)));
        Persona persona = mock(Persona.class);
        when(persona.getName()).thenReturn("Client");
        when(personas.findById(null)).thenReturn(Optional.of(persona));

        var comparison = new PortfolioService(engagements, assessments, scenarios, personas, new ObjectMapper())
                .compare(userId, recorded.getId(), legacy.getId());

        assertThat(comparison.engagementA().difficulty()).isEqualTo(DifficultyLevel.EASY);
        assertThat(comparison.engagementB().difficulty()).isNull();
    }

    private Engagement engagementInState(UUID scenarioId, EngagementState target) {
        Engagement engagement = mock(Engagement.class);
        when(engagement.getId()).thenReturn(UUID.randomUUID());
        when(engagement.getScenarioId()).thenReturn(scenarioId);
        when(engagement.getState()).thenReturn(target);
        return engagement;
    }
}
