package com.ibm.consulting.sim.identity.infrastructure;

import com.ibm.consulting.sim.identity.domain.RefreshSession;
import com.ibm.consulting.sim.identity.domain.RefreshSessionRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

interface SpringDataRefreshSessionRepository extends JpaRepository<RefreshSession, UUID> {
    @Query("select session.userId from RefreshSession session where session.id = :id")
    Optional<UUID> findUserIdById(@Param("id") UUID id);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select session from RefreshSession session where session.id = :id")
    Optional<RefreshSession> findByIdForUpdate(@Param("id") UUID id);
    @Query("select count(session) > 0 from RefreshSession session where session.id = :id and session.userId = :userId and session.revokedAt is null and session.expiresAt > :now")
    boolean isActive(@Param("id") UUID id, @Param("userId") UUID userId, @Param("now") Instant now);
    @Modifying
    @Query(value = "INSERT INTO refresh_session_used_secrets (session_id, secret_hash) VALUES (:sessionId, :hash) ON CONFLICT DO NOTHING", nativeQuery = true)
    void recordUsedSecret(@Param("sessionId") UUID sessionId, @Param("hash") String hash);
    @Query(value = "SELECT EXISTS (SELECT 1 FROM refresh_session_used_secrets WHERE session_id = :sessionId AND secret_hash = :hash)", nativeQuery = true)
    boolean wasUsedSecret(@Param("sessionId") UUID sessionId, @Param("hash") String hash);
    @Modifying
    @Query("delete from RefreshSession session where session.expiresAt < :cutoff")
    void deleteExpired(@Param("cutoff") Instant cutoff);
}

@Repository
class JpaRefreshSessionRepository implements RefreshSessionRepository {
    private final SpringDataRefreshSessionRepository repository;
    JpaRefreshSessionRepository(SpringDataRefreshSessionRepository repository) { this.repository = repository; }
    @Override public RefreshSession saveAndFlush(RefreshSession session) { return repository.saveAndFlush(session); }
    @Override public Optional<UUID> findUserIdById(UUID id) { return repository.findUserIdById(id); }
    @Override public Optional<RefreshSession> findByIdForUpdate(UUID id) { return repository.findByIdForUpdate(id); }
    @Override public boolean isActive(UUID id, UUID userId, Instant now) { return repository.isActive(id, userId, now); }
    @Override public void recordUsedSecret(UUID id, String hash) { repository.recordUsedSecret(id, hash); }
    @Override public boolean wasUsedSecret(UUID id, String hash) { return repository.wasUsedSecret(id, hash); }
    @Override public void deleteExpired(Instant cutoff) { repository.deleteExpired(cutoff); }
}
