package com.ibm.consulting.sim.admin.application;

import java.time.Instant;

/** One learner run as shown to administrators on the learner progress page. */
public record LearnerProgressEntry(
        String engagementId,
        String userId,
        String displayName,
        String email,
        String scenarioId,
        String scenarioTitle,
        String state,
        Integer overallScore,
        Instant lastActivityAt,
        Instant completedAt) {
}
