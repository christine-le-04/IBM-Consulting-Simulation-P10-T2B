package com.ibm.consulting.sim.achievement.domain;

import java.time.Duration;
import java.util.Map;

/**
 * One completed, assessed run, as single-run achievement conditions see it.
 *
 * @param competencyScores score per competency name
 * @param stageAttempts    attempts per stage (OUTREACH, MEETING, PROPOSAL); missing for older runs
 * @param difficulty       EASY, MEDIUM or HARD
 * @param retry            whether the run was a retry of an earlier one
 * @param duration         start to finish; null when unknown
 */
public record RunRecord(
        boolean won,
        int overallScore,
        Map<String, Integer> competencyScores,
        Map<String, Integer> stageAttempts,
        String difficulty,
        boolean retry,
        Duration duration) {

    public RunRecord {
        competencyScores = competencyScores == null ? Map.of() : Map.copyOf(competencyScores);
        stageAttempts = stageAttempts == null ? Map.of() : Map.copyOf(stageAttempts);
    }
}
