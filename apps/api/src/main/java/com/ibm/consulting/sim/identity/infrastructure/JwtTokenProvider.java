package com.ibm.consulting.sim.identity.infrastructure;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.AccessTokenRevocationStore;
import com.ibm.consulting.sim.identity.domain.RefreshSessionRepository;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.Mac;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;
import java.time.Instant;

@Component
public class JwtTokenProvider {

    private static final String CREDENTIAL_FINGERPRINT_CLAIM = "credentialFingerprint";

    private final SecretKey key;
    private final long expiryMs;
    private final AccessTokenRevocationStore revocations;
    private final RefreshSessionRepository refreshSessions;

    public JwtTokenProvider(
            String secret, long expiryMs, AccessTokenRevocationStore revocations) {
        this(secret, expiryMs, revocations, null);
    }

    @Autowired
    public JwtTokenProvider(
            @Value("${app.jwt.secret}") String secret,
            @Value("${app.jwt.expiry-ms}") long expiryMs,
            AccessTokenRevocationStore revocations, RefreshSessionRepository refreshSessions) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiryMs = Math.min(expiryMs, 900_000L);
        this.revocations = revocations;
        this.refreshSessions = refreshSessions;
    }

    public String generateToken(User user) {
        return generateToken(user, null);
    }

    public String generateToken(User user, UUID sessionId) {
        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(user.getId().toString())
                .claim("email", user.getEmail())
                .claim("role", user.getRole().name())
                .claim("sid", sessionId == null ? null : sessionId.toString())
                .claim(CREDENTIAL_FINGERPRINT_CLAIM, credentialFingerprint(user))
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiryMs))
                .signWith(key)
                .compact();
    }

    public Claims parseToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        if (claims.getIssuedAt() == null || claims.getExpiration() == null
                || claims.getExpiration().getTime() <= claims.getIssuedAt().getTime()
                || claims.getExpiration().getTime() - claims.getIssuedAt().getTime() > 900_000L
                || claims.getIssuedAt().getTime() > System.currentTimeMillis() + 30_000L) {
            throw new JwtException("Invalid access token lifetime");
        }
        return claims;
    }

    public boolean isValid(String token) {
        try {
            parseToken(token);
            return true;
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(parseToken(token).getSubject());
    }

    /** Rejects an otherwise-valid JWT when the account credential has changed. */
    public boolean isValidForUser(String token, User user) {
        try {
            Claims claims = parseToken(token);
            String tokenFingerprint = claims.get(CREDENTIAL_FINGERPRINT_CLAIM, String.class);
            return user.getId().toString().equals(claims.getSubject())
                    && tokenFingerprint != null
                    && MessageDigest.isEqual(
                            tokenFingerprint.getBytes(StandardCharsets.UTF_8),
                            credentialFingerprint(user).getBytes(StandardCharsets.UTF_8))
                    && !revocations.isRevoked(tokenHash(token))
                    && isSessionActive(claims, user);
        } catch (JwtException | IllegalArgumentException exception) {
            return false;
        }
    }

    private boolean isSessionActive(Claims claims, User user) {
        String sessionId = claims.get("sid", String.class);
        // Existing API clients may use bearer-only tokens. Browser tokens are
        // always bound to a session; missing infrastructure must fail closed.
        return sessionId == null || (refreshSessions != null
                && refreshSessions.isActive(UUID.fromString(sessionId), user.getId(), Instant.now()));
    }

    /** A revoked token stays rejected across API instances and application restarts. */
    public void revokeToken(String token) {
        try {
            Claims claims = parseToken(token);
            revocations.revoke(tokenHash(token), claims.getExpiration().toInstant());
        } catch (ExpiredJwtException ignored) {
            // If expiry raced with logout, the token is already unusable.
        }
    }

    private String tokenHash(String token) {
        try {
            // Hash the signed header/payload, excluding signature serialization.
            // Equivalent base64url encodings of a valid signature must not let
            // a revoked token bypass the denylist. The random jti separates logins.
            String signedContent = token.substring(0, token.lastIndexOf('.'));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(signedContent.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 must be available", exception);
        }
    }

    public String credentialFingerprint(User user) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            byte[] fingerprint = mac.doFinal(user.getPasswordHash().getBytes(StandardCharsets.UTF_8));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(fingerprint);
        } catch (GeneralSecurityException exception) {
            throw new IllegalStateException("HMAC-SHA-256 must be available in this JVM", exception);
        }
    }
}
