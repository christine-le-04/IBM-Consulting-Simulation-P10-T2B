package com.ibm.consulting.sim.achievement.application;

import com.ibm.consulting.sim.achievement.domain.Achievement;
import com.ibm.consulting.sim.achievement.domain.UserAchievement;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Learner-facing view of one achievement: definition, unlock state and progress.
 *
 * <p>{@code scope} is GENERIC or EXCLUSIVE. For an Exclusive badge,
 * {@code scenarioTitle} is its scenario's live title and {@code available} is
 * false while that scenario is archived (it cannot be newly earned, and an earned
 * one is shown shaded). {@code unlockedByEngagementId} is the run whose
 * completion unlocked it, so the Review screen can announce it.
 */
public record AchievementSummary(
        UUID id,
        String name,
        String description,
        String iconKey,
        boolean unlocked,
        Instant unlockedAt,
        double progressPercent,
        String scope,
        String scenarioTitle,
        boolean available,
        UUID unlockedByEngagementId) {

    public AchievementSummary {
        description = Objects.requireNonNullElse(description, "");
        iconKey = Objects.requireNonNullElse(iconKey, "");
        scope = Objects.requireNonNullElse(scope, AchievementScope.GENERIC);
    }

    public static AchievementSummary locked(Achievement a, double progressPercent, String scenarioTitle,
                                            boolean available) {
        return new AchievementSummary(a.getId(), a.getName(), a.getDescription(), a.getIconKey(),
                false, null, progressPercent, scope(a), scenarioTitle, available, null);
    }

    public static AchievementSummary unlocked(Achievement a, UserAchievement unlock, String scenarioTitle,
                                              boolean available) {
        return new AchievementSummary(a.getId(), a.getName(), a.getDescription(), a.getIconKey(),
                true, unlock.getUnlockedAt(), 100.0, scope(a), scenarioTitle, available,
                unlock.getUnlockedByEngagementId());
    }

    private static String scope(Achievement a) {
        return a.isExclusive() ? AchievementScope.EXCLUSIVE : AchievementScope.GENERIC;
    }
}
