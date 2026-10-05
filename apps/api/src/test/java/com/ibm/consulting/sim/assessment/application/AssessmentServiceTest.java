package com.ibm.consulting.sim.assessment.application;

import com.ibm.consulting.sim.achievement.application.AchievementEvaluationService;
import com.ibm.consulting.sim.assessment.domain.Assessment;
import com.ibm.consulting.sim.assessment.domain.AssessmentRepository;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.meeting.domain.MeetingRepository;
import com.ibm.consulting.sim.meeting.domain.PersonaStateRepository;
import com.ibm.consulting.sim.outreach.domain.OutreachRepository;
import com.ibm.consulting.sim.outreach.domain.OutreachAttempt;
import com.ibm.consulting.sim.outreach.domain.OutreachOutcome;
import com.ibm.consulting.sim.outreach.domain.OutreachNextAction;
import com.ibm.consulting.sim.proposal.domain.Proposal;
import com.ibm.consulting.sim.proposal.domain.ProposalDecision;
import com.ibm.consulting.sim.proposal.domain.ProposalRepository;
import com.ibm.consulting.sim.scenario.domain.Scenario;
import com.ibm.consulting.sim.scenario.domain.ScenarioRepository;
import com.ibm.consulting.sim.shared.domain.NotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssessmentServiceTest {

    @Mock EngagementRepository engagementRepository;
    @Mock MeetingRepository meetingRepository;
    @Mock OutreachRepository outreachRepository;
    @Mock PersonaStateRepository personaStateRepository;
    @Mock ProposalRepository proposalRepository;
    @Mock ScenarioRepository scenarioRepository;
    @Mock AchievementEvaluationService achievementEvaluationService;
    @Mock ApplicationEventPublisher eventPublisher;

    private final InMemoryAssessmentRepository assessmentRepository = new InMemoryAssessmentRepository();
    private AssessmentService service;

    @BeforeEach
    void setUp() {
        service = new AssessmentService(assessmentRepository, engagementRepository, meetingRepository, new ObjectMapper(),
                outreachRepository, personaStateRepository, proposalRepository, scenarioRepository,
                achievementEvaluationService, eventPublisher);
    }

    @Test
    void generateFromClientDecisionCreatesScoresAndCompletesLifecycleOnce() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);

        AssessmentResponse response = service.generate(data.engagement().getId(), data.userId());

        assertThat(assessmentRepository.saveCount).isEqualTo(1);
        assertThat(response.competencyScores()).hasSize(3);
        assertThat(data.engagement().getState()).isEqualTo(EngagementState.COMPLETED);
        assertThat(data.engagement().getCompletedAt()).isNotNull();
        assertThat(data.engagement().getEvents())
                .filteredOn(event -> event.getState() == EngagementState.REVIEW
                        || event.getState() == EngagementState.COMPLETED)
                .extracting(event -> event.getState())
                .containsExactly(EngagementState.REVIEW, EngagementState.COMPLETED);
        verify(achievementEvaluationService).evaluateForUser(data.userId());
        verify(eventPublisher).publishEvent(any(AssessmentGeneratedEvent.class));
    }

    @Test
    void repeatedGenerateReturnsStoredAssessmentWithoutRepeatingBusinessSideEffects() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);

        AssessmentResponse first = service.generate(data.engagement().getId(), data.userId());
        AssessmentResponse replay = service.generate(data.engagement().getId(), data.userId());

        assertThat(replay.id()).isEqualTo(first.id());
        assertThat(assessmentRepository.saveCount).isEqualTo(1);
        assertThat(data.engagement().getState()).isEqualTo(EngagementState.COMPLETED);
        assertThat(data.engagement().getEvents())
                .filteredOn(event -> event.getState() == EngagementState.REVIEW)
                .hasSize(1);
        assertThat(data.engagement().getEvents())
                .filteredOn(event -> event.getState() == EngagementState.COMPLETED)
                .hasSize(1);
        verify(achievementEvaluationService, times(1)).evaluateForUser(data.userId());
        verify(eventPublisher, times(1)).publishEvent(any(AssessmentGeneratedEvent.class));
    }

    @Test
    void generateBeforeClientDecisionIsRejectedWithoutPersistenceOrLifecycleChange() {
        TestData data = engagementIn(EngagementState.PREPARING);
        stubOwnedForUpdate(data);

        assertThatThrownBy(() -> service.generate(data.engagement().getId(), data.userId()))
                .isInstanceOf(AssessmentService.AssessmentNotAvailableException.class);

        assertThat(assessmentRepository.assessment).isEmpty();
        assertThat(data.engagement().getState()).isEqualTo(EngagementState.PREPARING);
        verify(achievementEvaluationService, never()).evaluateForUser(any());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
        verify(engagementRepository, never()).save(any());
    }

    @Test
    void aLostProposalWithAttemptsRemainingCannotFinalizeTheEngagement() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        var proposal = org.mockito.Mockito.mock(com.ibm.consulting.sim.proposal.domain.Proposal.class);
        when(proposal.isRevisionAvailable()).thenReturn(true);
        when(proposalRepository.findByEngagementId(data.engagement().getId())).thenReturn(Optional.of(proposal));
        assertThatThrownBy(() -> service.generate(data.engagement().getId(), data.userId()))
                .isInstanceOf(AssessmentService.AssessmentNotAvailableException.class);
        assertThat(data.engagement().getState()).isEqualTo(EngagementState.CLIENT_DECISION);
        assertThat(assessmentRepository.saveCount).isZero();
    }

    @Test
    void anExhaustedLostProposalCanGenerateTheFinalReview() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);
        var proposal = org.mockito.Mockito.mock(com.ibm.consulting.sim.proposal.domain.Proposal.class);
        when(proposal.getDecision()).thenReturn(com.ibm.consulting.sim.proposal.domain.ProposalDecision.LOST);
        when(proposalRepository.findByEngagementId(data.engagement().getId())).thenReturn(Optional.of(proposal));
        AssessmentResponse review = service.generate(data.engagement().getId(), data.userId());
        assertThat(review.outcome()).isEqualTo("REJECTED");
        assertThat(data.engagement().getState()).isEqualTo(EngagementState.COMPLETED);
    }

    @Test
    void anotherUserCannotGenerateOrReadTheAssessment() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        UUID otherUserId = UUID.randomUUID();
        when(engagementRepository.findByIdAndUserIdForUpdate(data.engagement().getId(), otherUserId))
                .thenReturn(Optional.empty());
        when(engagementRepository.findByIdAndUserId(data.engagement().getId(), otherUserId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.generate(data.engagement().getId(), otherUserId))
                .isInstanceOf(NotFoundException.class);
        assertThatThrownBy(() -> service.get(data.engagement().getId(), otherUserId))
                .isInstanceOf(NotFoundException.class);
        assertThat(assessmentRepository.assessment).isEmpty();
        assertThat(data.engagement().getState()).isEqualTo(EngagementState.CLIENT_DECISION);
        verify(achievementEvaluationService, never()).evaluateForUser(any());
    }

    @Test
    void outreachScoreKeepsBestResolvedAttemptAcrossContactsAndCheckpointRounds() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);
        OutreachAttempt first = resolvedOutreach(data, 1, 80);
        first.assignContact(UUID.randomUUID(), 1);
        OutreachAttempt second = resolvedOutreach(data, 2, 40);
        second.assignContact(UUID.randomUUID(), 2);
        when(outreachRepository.findByEngagementId(data.engagement().getId())).thenReturn(List.of(first, second));

        AssessmentResponse response = service.generate(data.engagement().getId(), data.userId());

        // Checkpoint resets preserve the better earlier score.
        assertThat(score(response, "Outreach Effectiveness")).isEqualTo(80);
        assertThat(first.getScorePersonalisation()).isEqualTo(80);
        assertThat(second.getScorePersonalisation()).isEqualTo(40);
    }

    @Test
    void unresolvedOutreachDoesNotDiluteTheResolvedAttemptScore() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);
        OutreachAttempt pending = OutreachAttempt.create(data.engagement().getId(), 2, "Follow-up", "Pending email");
        when(outreachRepository.findByEngagementId(data.engagement().getId()))
                .thenReturn(List.of(resolvedOutreach(data, 1, 80), pending));

        AssessmentResponse response = service.generate(data.engagement().getId(), data.userId());

        assertThat(score(response, "Outreach Effectiveness")).isEqualTo(80);
        assertThat(pending.getScorePersonalisation()).isNull();
    }

    @Test
    void finalProposalUsesTheLearnerPerformanceScoreWhenAvailable() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);
        Proposal proposal = mock(Proposal.class);
        when(proposal.getDecision()).thenReturn(ProposalDecision.WON);
        when(proposal.getLearnerPerformanceScore()).thenReturn(72);
        when(proposalRepository.findByEngagementId(data.engagement().getId())).thenReturn(Optional.of(proposal));

        AssessmentResponse response = service.generate(data.engagement().getId(), data.userId());

        assertThat(score(response, "Solution Alignment")).isEqualTo(72);
    }

    @Test
    void historicProposalFallsBackToItsPersistedAlignmentScore() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);
        Proposal proposal = mock(Proposal.class);
        when(proposal.getDecision()).thenReturn(ProposalDecision.WON);
        when(proposal.getLearnerPerformanceScore()).thenReturn(null);
        when(proposal.getAlignmentScore()).thenReturn(64);
        when(proposalRepository.findByEngagementId(data.engagement().getId())).thenReturn(Optional.of(proposal));

        AssessmentResponse response = service.generate(data.engagement().getId(), data.userId());

        assertThat(score(response, "Solution Alignment")).isEqualTo(64);
    }

    @Test
    void aPendingClientDecisionCannotCreateScoresOrCompleteTheEngagement() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        Proposal proposal = mock(Proposal.class);
        when(proposal.getDecision()).thenReturn(ProposalDecision.PENDING);
        when(proposalRepository.findByEngagementId(data.engagement().getId())).thenReturn(Optional.of(proposal));

        assertThatThrownBy(() -> service.generate(data.engagement().getId(), data.userId()))
                .isInstanceOf(AssessmentService.AssessmentNotAvailableException.class);

        assertThat(assessmentRepository.saveCount).isZero();
        assertThat(data.engagement().getState()).isEqualTo(EngagementState.CLIENT_DECISION);
        verify(outreachRepository, never()).findByEngagementId(any());
        verify(eventPublisher, never()).publishEvent(any(Object.class));
    }

    @Test
    void aStoredAssessmentIsNotRecomputedWhenLaterScoringInputsChange() {
        TestData data = engagementIn(EngagementState.CLIENT_DECISION);
        stubOwnedForUpdate(data);
        stubScoringInputs(data);
        java.util.ArrayList<OutreachAttempt> attempts = new java.util.ArrayList<>();
        attempts.add(resolvedOutreach(data, 1, 80));
        when(outreachRepository.findByEngagementId(data.engagement().getId())).thenReturn(attempts);
        AssessmentResponse first = service.generate(data.engagement().getId(), data.userId());
        attempts.add(resolvedOutreach(data, 2, 20));

        AssessmentResponse replay = service.generate(data.engagement().getId(), data.userId());

        assertThat(score(replay, "Outreach Effectiveness")).isEqualTo(80);
        assertThat(replay.competencyScores()).isEqualTo(first.competencyScores());
        assertThat(replay.generatedAt()).isEqualTo(first.generatedAt());
        verify(outreachRepository, times(1)).findByEngagementId(data.engagement().getId());
        assertThat(assessmentRepository.saveCount).isEqualTo(1);
    }

    private OutreachAttempt resolvedOutreach(TestData data, int attemptNumber, int score) {
        OutreachAttempt attempt = OutreachAttempt.create(data.engagement().getId(), attemptNumber, "Subject", "Email body");
        attempt.resolve("Please revise", OutreachOutcome.REJECTED, OutreachNextAction.SEND_FOLLOW_UP,
                score, score, score, score);
        return attempt;
    }

    private int score(AssessmentResponse response, String competencyName) {
        return response.competencyScores().stream().filter(score -> score.name().equals(competencyName))
                .findFirst().orElseThrow().score();
    }

    private void stubOwnedForUpdate(TestData data) {
        when(engagementRepository.findByIdAndUserIdForUpdate(data.engagement().getId(), data.userId()))
                .thenReturn(Optional.of(data.engagement()));
    }

    private void stubScoringInputs(TestData data) {
        when(meetingRepository.findAllByEngagementIdOrderByCreatedAtAsc(data.engagement().getId())).thenReturn(List.of());
        when(outreachRepository.findByEngagementId(data.engagement().getId())).thenReturn(List.of());
        when(personaStateRepository.findByEngagementId(data.engagement().getId())).thenReturn(Optional.empty());
        when(proposalRepository.findByEngagementId(data.engagement().getId())).thenReturn(Optional.empty());
        when(scenarioRepository.findById(data.scenario().getId())).thenReturn(Optional.of(data.scenario()));
    }

    private TestData engagementIn(EngagementState targetState) {
        UUID userId = UUID.randomUUID();
        Scenario scenario = Scenario.create("Assessment", "Technology", "Scenario", 3);
        Engagement engagement = Engagement.start(userId, scenario.getId(), UUID.randomUUID());
        engagement.selectLead(UUID.randomUUID());
        if (targetState == EngagementState.PREPARING) {
            engagement.transitionTo(EngagementState.HYPOTHESIS_READY, "Hypothesis ready");
            engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
            engagement.transitionTo(EngagementState.MEETING_SECURED, "Meeting secured");
            engagement.transitionTo(EngagementState.PREPARING, "Preparation complete");
            return new TestData(userId, engagement, scenario);
        }
        engagement.transitionTo(EngagementState.HYPOTHESIS_READY, "Hypothesis ready");
        engagement.transitionTo(EngagementState.OUTREACHING, "Outreach started");
        engagement.transitionTo(EngagementState.MEETING_SECURED, "Meeting secured");
        engagement.transitionTo(EngagementState.PREPARING, "Preparation complete");
        engagement.transitionTo(EngagementState.IN_MEETING, "Meeting started");
        engagement.transitionTo(EngagementState.DISCOVERY_COMPLETE, "Discovery complete");
        engagement.transitionTo(EngagementState.PROPOSAL_DRAFT, "Proposal drafted");
        engagement.transitionTo(EngagementState.PROPOSAL_SUBMITTED, "Proposal submitted");
        engagement.transitionTo(EngagementState.CLIENT_DECISION, "Client decided");
        return new TestData(userId, engagement, scenario);
    }

    private static final class InMemoryAssessmentRepository implements AssessmentRepository {
        private Optional<Assessment> assessment = Optional.empty();
        private int saveCount;

        @Override public Assessment save(Assessment assessment) {
            this.assessment = Optional.of(assessment);
            saveCount++;
            return assessment;
        }

        @Override public Optional<Assessment> findByEngagementId(UUID engagementId) {
            return assessment.filter(candidate -> engagementId.equals(candidate.getEngagementId()));
        }

        @Override public List<Assessment> findAllByEngagementIdIn(List<UUID> engagementIds) {
            return assessment.filter(candidate -> engagementIds.contains(candidate.getEngagementId())).stream().toList();
        }
    }

    private record TestData(UUID userId, Engagement engagement, Scenario scenario) {}
}
