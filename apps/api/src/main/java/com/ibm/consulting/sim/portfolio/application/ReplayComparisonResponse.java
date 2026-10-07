package com.ibm.consulting.sim.portfolio.application;

import java.util.List;
import java.util.UUID;
import com.ibm.consulting.sim.scenario.domain.DifficultyLevel;

/**
 * Side-by-side comparison of two of a learner's completed engagements, used by the
 * Portfolio "replay comparison" view to show how competency scores changed between
 * two attempts (e.g. same scenario replayed, or two different personas/industries).
 */
public record ReplayComparisonResponse(EngagementSnapshot engagementA, EngagementSnapshot engagementB) {

    public record EngagementSnapshot(
            UUID engagementId,
            String scenarioTitle,
            String personaName,
            DifficultyLevel difficulty,
            String outcome,
            int overallScore,
            List<CompetencyScoreView> competencyScores) {}

    public record CompetencyScoreView(String competencyName, int score, String evidenceNote) {}
}
