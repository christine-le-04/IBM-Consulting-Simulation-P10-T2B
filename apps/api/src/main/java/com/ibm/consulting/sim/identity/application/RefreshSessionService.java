package com.ibm.consulting.sim.identity.application;

import com.ibm.consulting.sim.identity.domain.RefreshSession;
import com.ibm.consulting.sim.identity.domain.RefreshSessionRepository;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.UUID;

@Service
@EnableConfigurationProperties(RefreshSessionProperties.class)
public class RefreshSessionService {
    private final RefreshSessionRepository sessions;
    private final UserRepository users;
    private final CredentialTokenService credentials;
    private final JwtTokenProvider tokens;
    private final RefreshSessionProperties properties;

    public RefreshSessionService(RefreshSessionRepository sessions, UserRepository users,
            CredentialTokenService credentials, JwtTokenProvider tokens, RefreshSessionProperties properties) {
        if (properties.getLifetime().isNegative() || properties.getLifetime().isZero()
                || properties.getLifetime().compareTo(java.time.Duration.ofDays(30)) > 0) {
            throw new IllegalArgumentException("Refresh session lifetime must be between zero and 30 days");
        }
        this.sessions = sessions;
        this.users = users;
        this.credentials = credentials;
        this.tokens = tokens;
        this.properties = properties;
    }

    @Transactional
    public IssuedSession open(TokenResponse authentication) {
        UUID userId = tokens.extractUserId(authentication.accessToken());
        User user = users.findByIdForUpdate(userId).filter(User::isActive).filter(User::isEmailVerified).orElseThrow(this::invalid);
        if (!tokens.isValidForUser(authentication.accessToken(), user)) throw invalid();
        var issued = credentials.issue();
        RefreshSession session = RefreshSession.issue(userId, issued.hash(), tokens.credentialFingerprint(user),
                Instant.now().plus(properties.getLifetime()));
        sessions.saveAndFlush(session);
        return response(user, session, session.getId() + "." + issued.secret());
    }

    // A replay must persist its revocation even though the request returns 401.
    @Transactional(noRollbackFor = BadCredentialsException.class)
    public IssuedSession refresh(String cookie) {
        var parsed = parse(cookie);
        UUID sessionId = UUID.fromString(parsed.selector());
        UUID userId = sessions.findUserIdById(sessionId).orElseThrow(this::invalid);
        // Same lock order as password reset: user first, credential second.
        User user = users.findByIdForUpdate(userId).orElseThrow(this::invalid);
        RefreshSession session = sessions.findByIdForUpdate(sessionId).orElseThrow(this::invalid);
        Instant now = Instant.now();
        if (!session.getUserId().equals(userId) || !session.isActiveAt(now)
                || !user.isActive() || !user.isEmailVerified()
                || !MessageDigest.isEqual(session.getCredentialFingerprint().getBytes(StandardCharsets.UTF_8),
                    tokens.credentialFingerprint(user).getBytes(StandardCharsets.UTF_8))) {
            session.revoke(now);
            sessions.saveAndFlush(session);
            throw invalid();
        }
        if (credentials.matches(session.getSecretHash(), parsed.secret())) {
            var replacement = credentials.issue();
            sessions.recordUsedSecret(session.getId(), session.getSecretHash());
            session.rotate(replacement.hash(), now);
            sessions.saveAndFlush(session);
            return response(user, session, session.getId() + "." + replacement.secret());
        }
        if (session.getPreviousSecretHash() != null && credentials.matches(session.getPreviousSecretHash(), parsed.secret())) {
            if (session.getPreviousValidUntil().isAfter(now)) {
                return response(user, session, null);
            }
        }
        if ((session.getPreviousSecretHash() != null && credentials.matches(session.getPreviousSecretHash(), parsed.secret()))
                || sessions.wasUsedSecret(sessionId, credentials.hash(parsed.secret()))) {
            session.revoke(now);
            sessions.saveAndFlush(session);
        }
        throw invalid();
    }

    @Transactional
    public boolean logout(String accessToken, String cookie) {
        var claims = tokens.parseToken(accessToken);
        String sessionId = claims.get("sid", String.class);
        boolean clearCookie = false;
        if (sessionId != null) {
            UUID userId = UUID.fromString(claims.getSubject());
            users.findByIdForUpdate(userId).orElseThrow(this::invalid);
            RefreshSession session = sessions.findByIdForUpdate(UUID.fromString(sessionId)).orElseThrow(this::invalid);
            if (!session.getUserId().equals(userId)) throw invalid();
            session.revoke(Instant.now());
            sessions.saveAndFlush(session);
            try {
                var parsed = parse(cookie);
                clearCookie = parsed.selector().equals(sessionId)
                        && (credentials.matches(session.getSecretHash(), parsed.secret())
                            || (session.getPreviousSecretHash() != null
                                && credentials.matches(session.getPreviousSecretHash(), parsed.secret())));
            } catch (BadCredentialsException ignored) {
                // A different tab may have logged into another session. Do not
                // delete that session's cookie when an older bearer logs out.
            }
        }
        tokens.revokeToken(accessToken);
        return clearCookie;
    }

    @Scheduled(initialDelay = 3600000, fixedDelay = 3600000)
    @Transactional
    public void deleteExpiredSessions() {
        sessions.deleteExpired(Instant.now().minusSeconds(300));
    }

    private CredentialTokenService.ParsedCredential parse(String cookie) {
        if (cookie == null || !cookie.matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.[A-Za-z0-9_-]{43}")) throw invalid();
        return credentials.parse(cookie);
    }

    private IssuedSession response(User user, RefreshSession session, String refreshCookie) {
        String access = tokens.generateToken(user, session.getId());
        return new IssuedSession(new TokenResponse(access, user.getId().toString(), user.getDisplayName(),
                user.getRole().name(), user.requiresOnboarding(), session.getId().toString(),
                tokens.parseToken(access).getExpiration().getTime()), refreshCookie, session.getExpiresAt());
    }

    private BadCredentialsException invalid() { return new BadCredentialsException("Authentication required"); }

    public record IssuedSession(TokenResponse access, String refreshCookie, Instant expiresAt) {}
}
