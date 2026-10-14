package com.ibm.consulting.sim.identity.domain;

import com.ibm.consulting.sim.shared.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "refresh_sessions")
public class RefreshSession extends BaseEntity {
    @Column(nullable = false, updatable = false)
    private UUID userId;
    @Column(nullable = false)
    private String secretHash;
    private String previousSecretHash;
    private Instant previousValidUntil;
    @Column(nullable = false, updatable = false)
    private String credentialFingerprint;
    @Column(nullable = false, updatable = false)
    private Instant expiresAt;
    private Instant revokedAt;

    protected RefreshSession() {}

    public static RefreshSession issue(UUID userId, String hash, String fingerprint, Instant expiresAt) {
        RefreshSession session = new RefreshSession();
        session.userId = userId;
        session.secretHash = hash;
        session.credentialFingerprint = fingerprint;
        session.expiresAt = expiresAt;
        return session;
    }

    public boolean isActiveAt(Instant now) { return revokedAt == null && expiresAt.isAfter(now); }
    public void revoke(Instant now) { revokedAt = now; }
    public void rotate(String hash, Instant now) {
        previousSecretHash = secretHash;
        // A concurrent tab may already have sent the previous cookie. It gets
        // access only, without another rotation or overwriting the new cookie.
        previousValidUntil = now.plusSeconds(5);
        secretHash = hash;
    }
    public UUID getUserId() { return userId; }
    public String getSecretHash() { return secretHash; }
    public String getPreviousSecretHash() { return previousSecretHash; }
    public Instant getPreviousValidUntil() { return previousValidUntil; }
    public String getCredentialFingerprint() { return credentialFingerprint; }
    public Instant getExpiresAt() { return expiresAt; }
}
