package com.ibm.consulting.sim.assessment.domain;

import java.util.List;

/**
 * Deterministic competency scoring engine (§5.1, §5.2 — AI must not own final scoring
 * authority). Pure domain logic operating only on primitives already persisted by
 * other modules, so results are reproducible and independent of any AI call.
 */
public final class AssessmentEngine {

    private AssessmentEngine() {}

    public static int overall(List<CompetencyScore> scores) {
        return overall(scores, java.util.Map.of());
    }

    /**
     * Weighted overall score. {@code weights} maps competency name → weight percent;
     * weights for research are ignored because research is feedback-only. Remaining
     * weights are normalised across the scored stages. Empty or unrelated weights
     * fall back to an equal-weight average.
     */
    public static int overall(List<CompetencyScore> scores, java.util.Map<String, Integer> weights) {
        if (scores.isEmpty()) {
            return 0;
        }
        if (weights == null || weights.isEmpty()) {
            return (int) Math.round(scores.stream().mapToInt(CompetencyScore::getScore).average().orElse(0));
        }
        double weightedSum = 0;
        double totalWeight = 0;
        for (CompetencyScore score : scores) {
            int weight = weights.getOrDefault(score.getCompetencyName(), 0);
            weightedSum += score.getScore() * weight;
            totalWeight += weight;
        }
        if (totalWeight == 0) {
            return (int) Math.round(scores.stream().mapToInt(CompetencyScore::getScore).average().orElse(0));
        }
        return (int) Math.round(weightedSum / totalWeight);
    }
}
