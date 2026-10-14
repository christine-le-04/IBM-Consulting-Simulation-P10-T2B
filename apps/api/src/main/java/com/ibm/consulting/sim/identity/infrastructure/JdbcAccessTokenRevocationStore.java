package com.ibm.consulting.sim.identity.infrastructure;

import com.ibm.consulting.sim.identity.domain.AccessTokenRevocationStore;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Repository;

import java.sql.Timestamp;
import java.time.Instant;

@Repository
public class JdbcAccessTokenRevocationStore implements AccessTokenRevocationStore {
    private final JdbcTemplate jdbc;

    public JdbcAccessTokenRevocationStore(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean isRevoked(String tokenHash) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                SELECT EXISTS (SELECT 1 FROM revoked_access_tokens
                WHERE token_hash = ?)
                """, Boolean.class, tokenHash));
    }

    @Override
    public void revoke(String tokenHash, Instant expiresAt) {
        jdbc.update("""
                INSERT INTO revoked_access_tokens (token_hash, expires_at) VALUES (?, ?)
                ON CONFLICT (token_hash) DO NOTHING
                """, tokenHash, Timestamp.from(expiresAt));
    }

    @Scheduled(initialDelay = 3600000, fixedDelay = 3600000)
    public void deleteExpiredRevocations() {
        // JWT validation owns expiry. Keep revocations for an extra five minutes
        // to tolerate modest clock skew between API instances and the database.
        jdbc.update("DELETE FROM revoked_access_tokens WHERE expires_at <= ?",
                Timestamp.from(Instant.now().minusSeconds(300)));
    }
}
