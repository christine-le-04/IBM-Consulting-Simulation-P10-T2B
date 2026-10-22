package com.ibm.consulting.sim.admin.application;

import java.util.List;
import java.util.Map;

/** Aggregated results for one group of learner runs, either one scenario or the whole platform. */
public record CohortAnalytics(
        String scenarioId,
        String scenarioTitle,
        int learnerCount,
        int runCount,
        int completedCount,
        int meetingFailedCount,
        Integer averageScore,
        Map<String, Integer> stateCounts,
        List<CompetencyAverage> competencies,
        List<RecurringFeedback> commonImprovementAreas) {

    /** Average for one competency across assessed runs; weakest first. */
    public record CompetencyAverage(String name, int averageScore, int belowTargetCount, int assessedCount) {
    }

    /** Improvement advice given to more than one run in the cohort. */
    public record RecurringFeedback(String text, int runCount) {
    }

    public record Response(int targetScore, CohortAnalytics overall, List<CohortAnalytics> scenarios) {
    }
}
