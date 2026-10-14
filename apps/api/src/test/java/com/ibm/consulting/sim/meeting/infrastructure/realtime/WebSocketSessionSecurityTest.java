package com.ibm.consulting.sim.meeting.infrastructure.realtime;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.AccessTokenRevocationStore;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class WebSocketSessionSecurityTest {
    private static final String SECRET = "test-secret-with-at-least-thirty-two-bytes";
    private final UserRepository users = mock(UserRepository.class);
    private final AccessTokenRevocationStore revocations = mock(AccessTokenRevocationStore.class);
    private final JwtTokenProvider tokens = spy(new JwtTokenProvider(SECRET, 60000, revocations));
    private final WebSocketSessionSecurity security = new WebSocketSessionSecurity(tokens, users);
    private final StompAuthChannelInterceptor inbound = new StompAuthChannelInterceptor(security);
    private final WebSocketSession session = mock(WebSocketSession.class);
    private final MessageChannel channel = mock(MessageChannel.class);
    private final User user = User.create("learner@example.test", "original-hash", "Learner", UserRole.LEARNER);
    private WebSocketHandler transport;
    private String token;

    @BeforeEach
    void openTransport() throws Exception {
        when(session.getId()).thenReturn("session-1");
        when(users.findById(user.getId())).thenReturn(Optional.of(user));
        transport = security.decorate(mock(WebSocketHandler.class));
        transport.afterConnectionEstablished(session);
        token = tokens.generateToken(user);
    }

    @Test
    void validConnectSetsPrincipalAndDeliversEvents() throws Exception {
        Message<byte[]> connect = connectFrame(token);
        assertThat(inbound.preSend(connect, channel)).isSameAs(connect);
        Authentication authentication = (Authentication) StompHeaderAccessor.wrap(connect).getUser();
        assertThat(authentication.getPrincipal()).isSameAs(user);
        Message<byte[]> event = outboundEvent();
        assertThat(security.preSend(event, channel)).isSameAs(event);
        security.closeInvalidSessions();
        verify(session, never()).close(any());
    }

    @ParameterizedTest
    @EnumSource(value = StompCommand.class, names = {"SEND", "SUBSCRIBE"})
    void credentialChangesRejectFurtherInboundFrames(StompCommand command) throws Exception {
        inbound.preSend(connectFrame(token), channel);
        user.changePasswordHash("new-hash");

        assertThatThrownBy(() -> inbound.preSend(frame(command), channel))
                .isInstanceOf(MessagingException.class).hasMessage("Socket authentication no longer valid");
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void passwordResetStopsOutboundEventsWithoutAnotherClientMessage() throws Exception {
        inbound.preSend(connectFrame(token), channel);
        user.changePasswordHash("new-hash");
        assertThat(security.preSend(outboundEvent(), channel)).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void idleDeactivatedSessionIsClosed() throws Exception {
        inbound.preSend(connectFrame(token), channel);
        user.deactivate();
        security.closeInvalidSessions();
        assertThat(security.preSend(outboundEvent(), channel)).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void idleDeletedSessionIsClosed() throws Exception {
        inbound.preSend(connectFrame(token), channel);
        when(users.findById(user.getId())).thenReturn(Optional.empty());
        security.closeInvalidSessions();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void expiryAfterConnectClosesIdleSessionAndDropsEvents() throws Exception {
        inbound.preSend(connectFrame(token), channel);
        doThrow(new ExpiredJwtException(null, null, "expired")).when(tokens).extractUserId(token);
        security.closeInvalidSessions();
        assertThat(security.preSend(outboundEvent(), channel)).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void genuinelyExpiredJwtCannotConnect() throws Exception {
        String expired = new JwtTokenProvider(SECRET, -60000, revocations).generateToken(user);
        assertThatThrownBy(() -> inbound.preSend(connectFrame(expired), channel))
                .isInstanceOf(MessagingException.class).hasMessage("Socket authentication no longer valid");
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "not-a-token"})
    void missingAndInvalidJwtCannotConnect(String suppliedToken) throws Exception {
        assertThatThrownBy(() -> inbound.preSend(connectFrame(suppliedToken), channel))
                .isInstanceOf(MessagingException.class).hasMessage("Socket authentication no longer valid");
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void expiredCredentialsBlockOutboundBeforeIdleSweep() throws Exception {
        inbound.preSend(connectFrame(token), channel);
        doThrow(new ExpiredJwtException(null, null, "expired")).when(tokens).extractUserId(token);
        assertThat(security.preSend(outboundEvent(), channel)).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void repositoryOutageFailsClosedWithoutLeakingError() throws Exception {
        inbound.preSend(connectFrame(token), channel);
        when(users.findById(user.getId())).thenThrow(new IllegalStateException("sensitive database detail"));
        assertThat(security.preSend(outboundEvent(), channel)).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void roleIsRefreshedOnSubsequentFrames() {
        inbound.preSend(connectFrame(token), channel);
        user.changeRole(UserRole.REVIEWER);
        Message<byte[]> send = frame(StompCommand.SEND);
        inbound.preSend(send, channel);
        Authentication authentication = (Authentication) StompHeaderAccessor.wrap(send).getUser();
        assertThat(authentication.getAuthorities()).extracting("authority").containsExactly("ROLE_REVIEWER");
    }

    @Test
    void unauthenticatedSessionCannotSendOrReceivePrivateEvents() throws Exception {
        assertThatThrownBy(() -> inbound.preSend(frame(StompCommand.SEND), channel))
                .isInstanceOf(MessagingException.class);
        assertThat(security.preSend(outboundEvent(), channel)).isNull();
        verify(session).close(CloseStatus.POLICY_VIOLATION);
    }

    @Test
    void normalDisconnectRemovesCredentials() throws Exception {
        inbound.preSend(connectFrame(token), channel);
        transport.afterConnectionClosed(session, CloseStatus.NORMAL);
        assertThatThrownBy(() -> security.authenticate("session-1"))
                .isInstanceOf(MessagingException.class).hasMessage("Authentication required");
        security.closeInvalidSessions();
        verify(session, never()).close(any());
    }

    @Test
    void failedTransportSetupDoesNotRetainSession() throws Exception {
        WebSocketHandler handler = mock(WebSocketHandler.class);
        doThrow(new IllegalStateException("setup failed")).when(handler).afterConnectionEstablished(session);
        transport.afterConnectionClosed(session, CloseStatus.NORMAL);
        assertThatThrownBy(() -> security.decorate(handler).afterConnectionEstablished(session))
                .isInstanceOf(IllegalStateException.class);
        assertThatThrownBy(() -> security.authenticate("session-1"))
                .isInstanceOf(MessagingException.class).hasMessage("Authentication required");
    }

    private Message<byte[]> connectFrame(String suppliedToken) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.CONNECT);
        accessor.setSessionId("session-1");
        if (suppliedToken != null) accessor.setNativeHeader("Authorization", "Bearer " + suppliedToken);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<byte[]> frame(StompCommand command) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setSessionId("session-1");
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }

    private Message<byte[]> outboundEvent() {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        accessor.setSessionId("session-1");
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
