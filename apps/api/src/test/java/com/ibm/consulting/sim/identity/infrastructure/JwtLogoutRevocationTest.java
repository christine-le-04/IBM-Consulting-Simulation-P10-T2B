package com.ibm.consulting.sim.identity.infrastructure;

import com.ibm.consulting.sim.identity.domain.AccessTokenRevocationStore;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.meeting.infrastructure.realtime.WebSocketSessionSecurity;
import io.jsonwebtoken.JwtException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import com.ibm.consulting.sim.meeting.infrastructure.realtime.StompAuthChannelInterceptor;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class JwtLogoutRevocationTest {
    private static final String SECRET = "test-secret-with-at-least-thirty-two-bytes";
    private final Map<String, Instant> revoked = new HashMap<>();
    private final AccessTokenRevocationStore store = new AccessTokenRevocationStore() {
        public boolean isRevoked(String hash) { return revoked.containsKey(hash); }
        public void revoke(String hash, Instant expiry) { revoked.putIfAbsent(hash, expiry); }
    };
    private final JwtTokenProvider tokens = new JwtTokenProvider(SECRET, 60000, store);
    private final User user = User.create("learner@example.test", "hash", "Learner", UserRole.LEARNER);

    @AfterEach
    void clearContext() { SecurityContextHolder.clearContext(); }

    @Test
    void revokesOnlyTheLoggedOutTokenAndStoresOnlyItsDigest() {
        String loggedOut = tokens.generateToken(user);
        String otherLogin = tokens.generateToken(user);
        assertThat(loggedOut).isNotEqualTo(otherLogin);
        assertThat(tokens.isValidForUser(loggedOut, user)).isTrue();

        tokens.revokeToken(loggedOut);
        tokens.revokeToken(loggedOut);

        assertThat(tokens.isValidForUser(loggedOut, user)).isFalse();
        assertThat(tokens.isValidForUser(otherLogin, user)).isTrue();
        assertThat(revoked).hasSize(1);
        assertThat(revoked.keySet()).allMatch(hash -> hash.matches("[0-9a-f]{64}"));
        assertThat(revoked.values()).containsExactly(tokens.parseToken(loggedOut).getExpiration().toInstant());
        assertThat(new JwtTokenProvider(SECRET, 60000, store).isValidForUser(loggedOut, user)).isFalse();
    }

    @Test
    void revokedTokenCannotAuthenticateHttpRequests() throws Exception {
        UserRepository users = mock(UserRepository.class);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        String token = tokens.generateToken(user);
        tokens.revokeToken(token);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        AtomicBoolean authenticated = new AtomicBoolean();
        new JwtAuthenticationFilter(tokens, users).doFilter(request, new MockHttpServletResponse(),
                (ignoredRequest, ignoredResponse) -> authenticated.set(SecurityContextHolder.getContext().getAuthentication() != null));
        assertThat(authenticated).isFalse();
    }

    @Test
    void equivalentSignatureEncodingCannotBypassRevocation() {
        String token = tokens.generateToken(user);
        String alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
        int finalDigit = alphabet.indexOf(token.charAt(token.length() - 1));
        String alternate = token.substring(0, token.length() - 1) + alphabet.charAt(finalDigit ^ 1);
        // HS256's final base64url digit has unused bits; both encodings decode
        // to the same signature and are accepted by the JWT parser.
        assertThat(tokens.isValidForUser(alternate, user)).isTrue();
        tokens.revokeToken(token);
        assertThat(tokens.isValidForUser(alternate, user)).isFalse();
    }

    @Test
    void logoutClosesExistingSocketAndBlocksPrivateEvents() throws Exception {
        UserRepository users = mock(UserRepository.class);
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        WebSocketSessionSecurity sockets = new WebSocketSessionSecurity(tokens, users);
        WebSocketSession session = mock(WebSocketSession.class);
        when(session.getId()).thenReturn("session-1");
        sockets.decorate(mock(WebSocketHandler.class)).afterConnectionEstablished(session);
        String token = tokens.generateToken(user);
        StompHeaderAccessor connect = StompHeaderAccessor.create(StompCommand.CONNECT);
        connect.setSessionId("session-1");
        connect.setNativeHeader("Authorization", "Bearer " + token);
        connect.setLeaveMutable(true);
        new StompAuthChannelInterceptor(sockets).preSend(
                MessageBuilder.createMessage(new byte[0], connect.getMessageHeaders()), mock(MessageChannel.class));

        tokens.revokeToken(token);
        SimpMessageHeaderAccessor outgoing = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        outgoing.setSessionId("session-1");
        Message<byte[]> event = MessageBuilder.createMessage(new byte[0], outgoing.getMessageHeaders());
        assertThat(sockets.preSend(event, mock(MessageChannel.class))).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void invalidAndExpiredTokensDoNotCreateRevocations() {
        assertThatThrownBy(() -> tokens.revokeToken("not-a-jwt")).isInstanceOf(JwtException.class);
        String expired = new JwtTokenProvider(SECRET, -60000, store).generateToken(user);
        tokens.revokeToken(expired);
        assertThat(revoked).isEmpty();
    }

    @Test
    void storeOutageCannotGrantAccess() {
        AccessTokenRevocationStore unavailable = mock(AccessTokenRevocationStore.class);
        when(unavailable.isRevoked(anyString())).thenThrow(new IllegalStateException("database unavailable"));
        JwtTokenProvider guarded = new JwtTokenProvider(SECRET, 60000, unavailable);
        assertThatThrownBy(() -> guarded.isValidForUser(tokens.generateToken(user), user))
                .isInstanceOf(IllegalStateException.class);
    }
}
