package com.ibm.consulting.sim.assessment.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.assessment.domain.CompetencyScore;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementState;
import com.ibm.consulting.sim.meeting.domain.*;
import com.ibm.consulting.sim.outreach.domain.*;
import com.ibm.consulting.sim.proposal.domain.Proposal;
import com.ibm.consulting.sim.proposal.domain.ProposalDecision;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class StageScoreCalculatorTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void outreachResetKeepsBestScoreAndSeparatesCurrentCycleFromLifetimeAttempts() {
        Engagement e = engagement();
        OutreachAttempt best = outreach(e, 90, 1);
        e.startNewOutreachRound();
        OutreachAttempt later = outreach(e, 40, 2);
        OutreachAttempt pending = OutreachAttempt.create(e.getId(), 3, "Subject", "Pending");
        CompetencyScore result = scores(e, List.of(best, later, pending), List.of(), null).getFirst();
        assertThat(result.getScore()).isEqualTo(90);
        assertThat(result.getAttemptCount()).isEqualTo(2);
        assertThat(result.getCurrentCycleAttempts()).isEqualTo(1);
        assertThat(result.getCheckpointResets()).isEqualTo(1);
        assertThat(result.getScoreHistoryComplete()).isTrue();
    }

    @Test
    void meetingResetKeepsEarlierBestAcrossMultipleCyclesAndCountsCompletedAttemptsOnly() {
        Engagement e = engagement();
        toMeeting(e);
        resetMeeting(e, 3);
        resetMeeting(e, 6);
        List<Meeting> attempts = List.of(meeting(e, 80), meeting(e, 40), meeting(e, 30),
                meeting(e, 50), meeting(e, 20), meeting(e, 10), meeting(e, 60),
                Meeting.start(e.getId(), e.getPersonaId()));
        CompetencyScore result = scores(e, List.of(), attempts, null).get(1);
        assertThat(result.getScore()).isEqualTo(80);
        assertThat(result.getAttemptCount()).isEqualTo(7);
        assertThat(result.getCurrentCycleAttempts()).isEqualTo(1);
        assertThat(result.getCheckpointResets()).isEqualTo(2);
        assertThat(result.getScoreHistoryComplete()).isTrue();
    }

    @Test
    void proposalUsesBestHistoricalSubmissionRatherThanLatestScore() {
        Engagement e = engagement();
        Proposal proposal = mock(Proposal.class);
        when(proposal.getSubmissionCount()).thenReturn(3);
        when(proposal.getLearnerPerformanceScore()).thenReturn(40);
        when(proposal.getSubmissionHistory()).thenReturn(List.of(
                "{\"decision\":{\"learnerPerformanceScore\":85}}",
                "{\"decision\":{\"learnerPerformanceScore\":55}}",
                "{\"decision\":{\"learnerPerformanceScore\":40}}"));
        CompetencyScore result = scores(e, List.of(), List.of(), proposal).get(2);
        assertThat(result.getScore()).isEqualTo(85);
        assertThat(result.getAttemptCount()).isEqualTo(3);
        assertThat(result.getCurrentCycleAttempts()).isEqualTo(3);
        assertThat(result.getCheckpointResets()).isZero();
        assertThat(result.getScoreHistoryComplete()).isTrue();
    }

    @Test
    void incompleteLegacyHistoryIsDisclosedWithoutInventingEarlierScores() {
        Engagement e = engagement();
        Meeting old = Meeting.start(e.getId(), e.getPersonaId());
        old.complete(MeetingCompletionOutcome.FAILED, "Feedback", List.of());
        Proposal proposal = mock(Proposal.class);
        when(proposal.getSubmissionCount()).thenReturn(3);
        when(proposal.getAlignmentScore()).thenReturn(64);
        when(proposal.getLearnerPerformanceScore()).thenReturn(null);
        when(proposal.getSubmissionHistory()).thenReturn(List.of("bad JSON", "{\"decision\":{}}"));
        var results = StageScoreCalculator.score(e, List.of(), List.of(old),
                PersonaState.initial(e.getId()), proposal, mapper);
        assertThat(results.get(1).getScore()).isEqualTo(50);
        assertThat(results.get(1).getAttemptCount()).isEqualTo(1);
        assertThat(results.get(2).getScore()).isEqualTo(64);
        assertThat(results.get(2).getScoreHistoryComplete()).isFalse();
        Meeting newer = meeting(e, 70);
        var withOlderMissing = scores(e, List.of(), List.of(old, newer), null).get(1);
        assertThat(withOlderMissing.getScore()).isEqualTo(70);
        assertThat(withOlderMissing.getScoreHistoryComplete()).isFalse();
    }

    @Test
    void freshEngagementHasThreeUnscoredStagesWithNoAttemptsAndNoResearchScore() {
        var results = scores(engagement(), List.of(), List.of(), null);
        assertThat(results).extracting(CompetencyScore::getStage).containsExactly("OUTREACH", "MEETING", "PROPOSAL");
        assertThat(results).extracting(CompetencyScore::getScore).containsExactly(0, 0, 0);
        assertThat(results).extracting(CompetencyScore::getAttemptCount).containsExactly(0, 0, 0);
    }

    private List<CompetencyScore> scores(Engagement e, List<OutreachAttempt> outreach,
                                         List<Meeting> meetings, Proposal proposal) {
        return StageScoreCalculator.score(e, outreach, meetings, null, proposal, mapper);
    }

    private Engagement engagement() {
        Engagement e = Engagement.start(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
        e.selectLead(UUID.randomUUID());
        e.transitionTo(EngagementState.HYPOTHESIS_READY, "Research checkpoint");
        e.transitionTo(EngagementState.OUTREACHING, "Email");
        return e;
    }

    private void toMeeting(Engagement e) {
        e.transitionTo(EngagementState.MEETING_SECURED, "Booked");
        e.transitionTo(EngagementState.PREPARING, "Prepared");
        e.transitionTo(EngagementState.IN_MEETING, "Started");
    }

    private void resetMeeting(Engagement e, int baseline) {
        e.transitionTo(EngagementState.MEETING_FAILED, "Failed");
        e.returnToMeetingPreparation(baseline);
        e.transitionTo(EngagementState.PREPARING, "Prepared");
        e.transitionTo(EngagementState.IN_MEETING, "Restarted");
    }

    private OutreachAttempt outreach(Engagement e, int score, int round) {
        OutreachAttempt a = OutreachAttempt.create(e.getId(), 1, "Subject", "Body");
        a.assignContact(UUID.randomUUID(), round);
        a.resolve("Revise", OutreachOutcome.REJECTED, OutreachNextAction.SEND_FOLLOW_UP,
                score, score, score, score);
        return a;
    }

    private Meeting meeting(Engagement e, int score) {
        PersonaState state = mock(PersonaState.class);
        when(state.getTrust()).thenReturn(score);
        when(state.getInterest()).thenReturn(score);
        when(state.getPatience()).thenReturn(score);
        Meeting m = Meeting.start(e.getId(), e.getPersonaId());
        m.complete(MeetingCompletionOutcome.FAILED, "Feedback", List.of());
        m.snapshotPerformance(state);
        return m;
    }
}
