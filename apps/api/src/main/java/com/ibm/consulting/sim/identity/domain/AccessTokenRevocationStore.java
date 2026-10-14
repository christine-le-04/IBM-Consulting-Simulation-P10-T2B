package com.ibm.consulting.sim.identity.domain;

import java.time.Instant;

/** Shared durable revocations; only SHA-256 digests are stored, never bearer tokens. */
public interface AccessTokenRevocationStore {
    boolean isRevoked(String tokenHash);
    void revoke(String tokenHash, Instant expiresAt);
}
