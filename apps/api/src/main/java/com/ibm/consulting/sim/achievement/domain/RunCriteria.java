package com.ibm.consulting.sim.achievement.domain;

import java.util.List;
import java.util.Set;

/**
 * Requirements a single run must meet together, for "a run that…" conditions
 * (e.g. won, on HARD, Relationship Building 80+, meeting passed first time).
 * Every field is optional, but at least one must be set. Checking them on the
 * same run is the point: separate conditions combined with AND could be met
 * by different runs.
 */
public record RunCriteria(
        Boolean won,
        Integer minOverallScore,
        String competencyName,
        Integer minCompetencyScore,
        Integer minEveryCompetencyScore,
        String minDifficulty,
        List<String> firstAttemptStages,
        Boolean notARetry,
        Integer maxHours) {

    public static final List<String> DIFFICULTIES = List.of("EASY", "MEDIUM", "HARD");
    public static final Set<String> STAGES = Set.of("OUTREACH", "MEETING", "PROPOSAL");

    public RunCriteria {
        firstAttemptStages = firstAttemptStages == null ? List.of() : List.copyOf(firstAttemptStages);
        competencyName = competencyName == null || competencyName.isBlank() ? null : competencyName.trim();
        if (!Boolean.TRUE.equals(won) && minOverallScore == null && minCompetencyScore == null
                && minEveryCompetencyScore == null && minDifficulty == null && firstAttemptStages.isEmpty()
                && !Boolean.TRUE.equals(notARetry) && maxHours == null) {
            throw new IllegalArgumentException("a run condition needs at least one requirement");
        }
        requireScore(minOverallScore, "minOverallScore");
        requireScore(minCompetencyScore, "minCompetencyScore");
        requireScore(minEveryCompetencyScore, "minEveryCompetencyScore");
        if ((competencyName == null) != (minCompetencyScore == null)) {
            throw new IllegalArgumentException("competencyName and minCompetencyScore must be set together");
        }
        if (minDifficulty != null && !DIFFICULTIES.contains(minDifficulty)) {
            throw new IllegalArgumentException("minDifficulty must be one of " + DIFFICULTIES);
        }
        if (!STAGES.containsAll(firstAttemptStages)) {
            throw new IllegalArgumentException("firstAttemptStages may only contain " + STAGES);
        }
        if (maxHours != null && maxHours < 1) {
            throw new IllegalArgumentException("maxHours must be at least 1");
        }
    }

    /** Whether this run meets every requirement that is set. Unknown data never counts as met. */
    public boolean matches(RunRecord run) {
        if (Boolean.TRUE.equals(won) && !run.won()) return false;
        if (minOverallScore != null && run.overallScore() < minOverallScore) return false;
        if (competencyName != null && run.competencyScores().getOrDefault(competencyName, 0) < minCompetencyScore) {
            return false;
        }
        if (minEveryCompetencyScore != null && (run.competencyScores().isEmpty()
                || run.competencyScores().values().stream().anyMatch(score -> score < minEveryCompetencyScore))) {
            return false;
        }
        if (minDifficulty != null
                && DIFFICULTIES.indexOf(run.difficulty()) < DIFFICULTIES.indexOf(minDifficulty)) {
            return false;
        }
        for (String stage : firstAttemptStages) {
            if (!Integer.valueOf(1).equals(run.stageAttempts().get(stage))) return false;
        }
        if (Boolean.TRUE.equals(notARetry) && run.retry()) return false;
        if (maxHours != null && (run.duration() == null || run.duration().toMinutes() > maxHours * 60L)) {
            return false;
        }
        return true;
    }

    private static void requireScore(Integer score, String field) {
        if (score != null && (score < 0 || score > 100)) {
            throw new IllegalArgumentException(field + " must be between 0 and 100");
        }
    }
}
