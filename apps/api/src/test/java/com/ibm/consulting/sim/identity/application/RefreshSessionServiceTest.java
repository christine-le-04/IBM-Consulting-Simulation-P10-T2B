package com.ibm.consulting.sim.identity.application;

import com.ibm.consulting.sim.identity.domain.AccessTokenRevocationStore;
import com.ibm.consulting.sim.identity.domain.RefreshSession;
import com.ibm.consulting.sim.identity.domain.RefreshSessionRepository;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.util.Date;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class RefreshSessionServiceTest {
    private static final String SECRET = "test-secret-with-at-least-thirty-two-bytes";
    private final RefreshSessionRepository repository = mock(RefreshSessionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CredentialTokenService credentials = new CredentialTokenService();
    private final JwtTokenProvider tokens = new JwtTokenProvider(SECRET, 86400000,
            mock(AccessTokenRevocationStore.class), repository);
    private final RefreshSessionService service = new RefreshSessionService(repository, users, credentials, tokens, new RefreshSessionProperties());
    private final Map<UUID, RefreshSession> rows = new HashMap<>();
    private final Map<UUID, java.util.Set<String>> usedSecrets = new HashMap<>();
    private final User user = User.create("learner@example.test", "hash", "Learner", UserRole.LEARNER);

    @BeforeEach
    void setup() {
        doAnswer(invocation -> {
            usedSecrets.computeIfAbsent(invocation.getArgument(0), ignored -> new java.util.HashSet<>()).add(invocation.getArgument(1));
            return null;
        }).when(repository).recordUsedSecret(any(), anyString());
        when(repository.wasUsedSecret(any(), anyString())).thenAnswer(invocation ->
                usedSecrets.getOrDefault(invocation.getArgument(0), java.util.Set.of()).contains(invocation.getArgument(1)));
        when(users.findByIdForUpdate(user.getId())).thenReturn(Optional.of(user));
        when(repository.saveAndFlush(any())).thenAnswer(invocation -> {
            RefreshSession session = invocation.getArgument(0);
            rows.put(session.getId(), session);
            return session;
        });
        when(repository.findUserIdById(any())).thenAnswer(invocation -> Optional.ofNullable(rows.get(invocation.getArgument(0))).map(RefreshSession::getUserId));
        when(repository.findByIdForUpdate(any())).thenAnswer(invocation -> Optional.ofNullable(rows.get(invocation.getArgument(0))));
        when(repository.isActive(any(), any(), any())).thenAnswer(invocation -> {
            RefreshSession session = rows.get(invocation.getArgument(0));
            return session != null && session.getUserId().equals(invocation.getArgument(1)) && session.isActiveAt(invocation.getArgument(2));
        });
    }

    private RefreshSessionService.IssuedSession open() {
        return service.open(new TokenResponse(tokens.generateToken(user), user.getId().toString(), "Learner", "LEARNER", false));
    }

    @Test
    void browserAccessIsShortLivedAndRefreshCredentialsAreStoredOnlyAsHashes() {
        Instant beforeSignIn = Instant.now();
        var issued = open();
        var claims = tokens.parseToken(issued.access().accessToken());
        assertThat(claims.getExpiration().getTime() - claims.getIssuedAt().getTime()).isLessThanOrEqualTo(900000);
        assertThat(claims.get("sid", String.class)).isEqualTo(issued.access().sessionId());
        assertThat(tokens.isValidForUser(issued.access().accessToken(), user)).isTrue();
        RefreshSession row = rows.get(UUID.fromString(issued.access().sessionId()));
        assertThat(row.getSecretHash()).isNotEqualTo(issued.refreshCookie());
        assertThat(row.getSecretHash()).doesNotContain(credentials.parse(issued.refreshCookie()).secret());
        assertThat(issued.expiresAt()).isBetween(
                beforeSignIn.plus(java.time.Duration.ofHours(8)),
                Instant.now().plus(java.time.Duration.ofHours(8)));
    }

    @Test
    void previouslyIssuedLongLivedTokensCannotKeepTheirOld24HourWindow() {
        String legacy = Jwts.builder().subject(user.getId().toString()).issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 86400000))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8))).compact();
        assertThatThrownBy(() -> tokens.parseToken(legacy)).isInstanceOf(JwtException.class)
                .hasMessage("Invalid access token lifetime");
    }

    @Test
    void rotationKeepsTheSessionAndAbsoluteExpiryButReplacesTheSecret() {
        var original = open();
        var renewed = service.refresh(original.refreshCookie());
        assertThat(renewed.access().sessionId()).isEqualTo(original.access().sessionId());
        assertThat(renewed.refreshCookie()).isNotEqualTo(original.refreshCookie());
        assertThat(renewed.expiresAt()).isEqualTo(original.expiresAt());
        assertThat(tokens.isValidForUser(renewed.access().accessToken(), user)).isTrue();
    }

    @Test
    void oneConcurrentRefreshDoesNotRotateOrOverwriteTheNewCookie() {
        var original = open();
        var first = service.refresh(original.refreshCookie());
        var concurrent = service.refresh(original.refreshCookie());
        assertThat(concurrent.refreshCookie()).isNull();
        assertThat(service.refresh(first.refreshCookie()).refreshCookie()).isNotNull();
    }

    @Test
    void replayOutsideGraceRevokesTheSessionAndItsAccessTokens() {
        var original = open();
        RefreshSession row = rows.get(UUID.fromString(original.access().sessionId()));
        row.rotate(credentials.issue().hash(), Instant.now().minusSeconds(10));
        assertThatThrownBy(() -> service.refresh(original.refreshCookie())).isInstanceOf(BadCredentialsException.class);
        assertThat(tokens.isValidForUser(original.access().accessToken(), user)).isFalse();
        verify(repository, times(2)).saveAndFlush(row);
    }

    @Test
    void replayOfAnOlderCredentialStillRevokesTheSessionAfterMultipleRotations() {
        var original = open();
        var first = service.refresh(original.refreshCookie());
        var second = service.refresh(first.refreshCookie());
        assertThatThrownBy(() -> service.refresh(original.refreshCookie())).isInstanceOf(BadCredentialsException.class);
        assertThat(tokens.isValidForUser(second.access().accessToken(), user)).isFalse();
    }

    @Test
    void passwordResetPreventsSessionRestoration() {
        var original = open();
        user.changePasswordHash("replacement-hash");
        assertThatThrownBy(() -> service.refresh(original.refreshCookie())).isInstanceOf(BadCredentialsException.class);
        assertThat(tokens.isValidForUser(original.access().accessToken(), user)).isFalse();
    }

    @Test
    void deactivationAndDeletionPreventRestoration() {
        var original = open();
        user.deactivate();
        assertThatThrownBy(() -> service.refresh(original.refreshCookie())).isInstanceOf(BadCredentialsException.class);
        when(users.findByIdForUpdate(user.getId())).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.refresh(original.refreshCookie())).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void logoutRevokesEveryAccessTokenInThatSessionButPreservesIndependentLogins() {
        var original = open();
        var renewed = service.refresh(original.refreshCookie());
        var independent = open();
        assertThat(service.logout(renewed.access().accessToken(), renewed.refreshCookie())).isTrue();
        assertThat(tokens.isValidForUser(original.access().accessToken(), user)).isFalse();
        assertThat(tokens.isValidForUser(renewed.access().accessToken(), user)).isFalse();
        assertThat(tokens.isValidForUser(independent.access().accessToken(), user)).isTrue();
        assertThatThrownBy(() -> service.refresh(renewed.refreshCookie())).isInstanceOf(BadCredentialsException.class);
    }

    @Test
    void staleTabLogoutDoesNotClearAnotherSessionsCookie() {
        var original = open();
        var independent = open();
        assertThat(service.logout(original.access().accessToken(), independent.refreshCookie())).isFalse();
        assertThat(tokens.isValidForUser(independent.access().accessToken(), user)).isTrue();
    }

    @Test
    void guessedSecretCannotRevokeOrRefreshTheSession() {
        var original = open();
        String guessed = original.access().sessionId() + "." + credentials.issue().secret();
        assertThatThrownBy(() -> service.refresh(guessed)).isInstanceOf(BadCredentialsException.class);
        assertThat(tokens.isValidForUser(original.access().accessToken(), user)).isTrue();
    }

    @Test
    void expiredAndMalformedCredentialsAreRejected() {
        var credential = credentials.issue();
        var expired = RefreshSession.issue(user.getId(), credential.hash(), tokens.credentialFingerprint(user), Instant.now().minusSeconds(60));
        rows.put(expired.getId(), expired);
        assertThatThrownBy(() -> service.refresh(expired.getId() + "." + credential.secret())).isInstanceOf(BadCredentialsException.class);
        for (String malformed : new String[] {"", "not-a-cookie", "../secret", UUID.randomUUID() + ".short"}) {
            assertThatThrownBy(() -> service.refresh(malformed)).isInstanceOf(BadCredentialsException.class);
        }
        assertThatThrownBy(() -> service.refresh(null)).isInstanceOf(BadCredentialsException.class);
    }
}
