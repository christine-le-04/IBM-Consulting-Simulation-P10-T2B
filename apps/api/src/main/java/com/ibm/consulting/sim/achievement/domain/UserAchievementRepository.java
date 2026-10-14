package com.ibm.consulting.sim.achievement.domain;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface UserAchievementRepository {
    UserAchievement save(UserAchievement userAchievement);
    List<UserAchievement> findByUserId(UUID userId);
    boolean existsByUserIdAndAchievementId(UUID userId, UUID achievementId);
    boolean insertIfAbsent(UUID userId, UUID achievementId, Instant unlockedAt);

    /** As above, recording the run whose completion unlocked it (null when retroactive). */
    default boolean insertIfAbsent(UUID userId, UUID achievementId, Instant unlockedAt, UUID unlockedByEngagementId) {
        return insertIfAbsent(userId, achievementId, unlockedAt);
    }
}
