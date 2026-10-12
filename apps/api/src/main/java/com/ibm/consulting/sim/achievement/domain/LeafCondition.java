package com.ibm.consulting.sim.achievement.domain;

/**
 * A single measurable threshold check, e.g. "at least 3 engagements won" or
 * "Relationship Building competency score of at least 80". {@code competencyName}
 * is only meaningful (and required) for {@link ConditionType#MIN_COMPETENCY_SCORE}.
 */
public record LeafCondition(ConditionType type, String competencyName, double threshold, RunCriteria run)
        implements AchievementCondition {

    public LeafCondition(ConditionType type, String competencyName, double threshold) {
        this(type, competencyName, threshold, null);
    }

    public LeafCondition {
        if (type == null) {
            throw new IllegalArgumentException("type is required for leaf conditions");
        }
        if (!Double.isFinite(threshold) || threshold < 0) {
            throw new IllegalArgumentException("threshold must be a finite non-negative number");
        }
        if (type.hasPercentageThreshold() && threshold > 100) {
            throw new IllegalArgumentException("score and percentage thresholds cannot exceed 100");
        }
        if (type == ConditionType.MIN_COMPETENCY_SCORE && (competencyName == null || competencyName.isBlank())) {
            throw new IllegalArgumentException("competencyName is required for MIN_COMPETENCY_SCORE conditions");
        }
        if ((type == ConditionType.MIN_RUNS_MATCHING) != (run != null)) {
            throw new IllegalArgumentException("run criteria are required for MIN_RUNS_MATCHING, and only for it");
        }
        if (type == ConditionType.MIN_RUNS_MATCHING && threshold < 1) {
            throw new IllegalArgumentException("at least one matching run is required");
        }
        competencyName = competencyName == null ? null : competencyName.trim();
    }
}
