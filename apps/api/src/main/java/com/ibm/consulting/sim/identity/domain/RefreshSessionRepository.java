package com.ibm.consulting.sim.identity.domain;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface RefreshSessionRepository {
    RefreshSession saveAndFlush(RefreshSession session);
    Optional<UUID> findUserIdById(UUID id);
    Optional<RefreshSession> findByIdForUpdate(UUID id);
    boolean isActive(UUID id, UUID userId, Instant now);
    void recordUsedSecret(UUID sessionId, String hash);
    boolean wasUsedSecret(UUID sessionId, String hash);
    void deleteExpired(Instant cutoff);
}
