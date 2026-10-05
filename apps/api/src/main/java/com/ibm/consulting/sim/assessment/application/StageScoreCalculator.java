package com.ibm.consulting.sim.assessment.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.assessment.domain.CompetencyScore;
import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.meeting.domain.Meeting;
import com.ibm.consulting.sim.meeting.domain.MeetingStatus;
import com.ibm.consulting.sim.meeting.domain.PersonaState;
import com.ibm.consulting.sim.outreach.domain.OutreachAttempt;
import com.ibm.consulting.sim.proposal.domain.Proposal;

import java.util.List;

/** Computes best scores from durable attempts; a checkpoint resets its budget, never its history. */
final class StageScoreCalculator {
    private StageScoreCalculator() {}

    static List<CompetencyScore> score(Engagement engagement, List<OutreachAttempt> outreach,
                                       List<Meeting> meetings, PersonaState latestState,
                                       Proposal proposal, ObjectMapper mapper) {
        List<OutreachAttempt> resolved = outreach.stream().filter(a -> a.getOutcome() != null
                && a.getOutcome() != com.ibm.consulting.sim.outreach.domain.OutreachOutcome.PENDING).toList();
        List<OutreachAttempt> scored = resolved.stream().filter(StageScoreCalculator::hasOutreachScore).toList();
        int outreachBest = scored.stream().mapToInt(a -> (a.getScorePersonalisation() + a.getScoreRelevance()
                + a.getScoreClarity() + a.getScoreCallToAction()) / 4).max().orElse(0);
        CompetencyScore outreachScore = CompetencyScore.stage("Outreach Effectiveness", "OUTREACH",
                outreachBest, resolved.size(), (int) resolved.stream()
                        .filter(a -> a.getOutreachRound() == engagement.getOutreachRound()).count(),
                Math.max(0, engagement.getOutreachRound() - 1), resolved.size() == scored.size());

        int meetingBest = 0;
        int completedCount = 0;
        int currentCount = 0;
        boolean completeMeetingHistory = true;
        for (int i = 0; i < meetings.size(); i++) {
            Meeting meeting = meetings.get(i);
            if (meeting.getStatus() != MeetingStatus.COMPLETED) continue;
            completedCount++;
            if (i >= engagement.getMeetingRetryBaseline()) currentCount++;
            Integer snapshot = meeting.getPerformanceScore();
            // Compatibility: only the latest meeting still owns the current relationship state.
            if (snapshot == null && i == meetings.size() - 1 && latestState != null) {
                snapshot = (latestState.getTrust() + latestState.getInterest() + latestState.getPatience()) / 3;
            }
            if (snapshot == null) completeMeetingHistory = false;
            else meetingBest = Math.max(meetingBest, snapshot);
        }
        int meetingResets = (int) engagement.getEvents().stream()
                .filter(e -> e.getDescription().equals("Meeting retries exhausted; revise preparation before trying again"))
                .count();
        CompetencyScore meetingScore = CompetencyScore.stage("Relationship Building", "MEETING",
                meetingBest, completedCount, currentCount, meetingResets, completeMeetingHistory);

        int proposalBest = 0;
        int proposalCount = 0;
        int savedProposalScores = 0;
        if (proposal != null) {
            proposalCount = Math.max(proposal.getSubmissionCount(), proposal.getSubmissionHistory().size());
            if (proposalCount == 0 && proposal.getDecision() != null
                    && proposal.getDecision() != com.ibm.consulting.sim.proposal.domain.ProposalDecision.PENDING) {
                proposalCount = 1; // Pre-retry proposals did not persist submission counts.
            }
            if (proposalCount > 0) {
                proposalBest = proposal.getLearnerPerformanceScore() != null
                        ? proposal.getLearnerPerformanceScore() : proposal.getAlignmentScore();
            }
            for (String snapshot : proposal.getSubmissionHistory()) {
                try {
                    var decision = mapper.readTree(snapshot).path("decision");
                    var score = decision.hasNonNull("learnerPerformanceScore")
                            ? decision.path("learnerPerformanceScore") : decision.path("decisionScore");
                    if (score.isIntegralNumber() && score.asInt() >= 0 && score.asInt() <= 100) {
                        savedProposalScores++;
                        proposalBest = Math.max(proposalBest, score.asInt());
                    }
                } catch (JsonProcessingException ignored) {
                    // Preserve the latest score and disclose incomplete historical coverage.
                }
            }
        }
        CompetencyScore proposalScore = CompetencyScore.stage("Solution Alignment", "PROPOSAL",
                proposalBest, proposalCount, proposalCount, 0,
                proposalCount <= 1 || savedProposalScores >= proposalCount);
        return List.of(outreachScore, meetingScore, proposalScore);
    }

    private static boolean hasOutreachScore(OutreachAttempt a) {
        return a.getScorePersonalisation() != null && a.getScoreRelevance() != null
                && a.getScoreClarity() != null && a.getScoreCallToAction() != null;
    }
}
