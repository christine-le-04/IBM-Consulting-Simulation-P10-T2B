package com.ibm.consulting.sim.meeting.infrastructure.realtime;

import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRepository;
import com.ibm.consulting.sim.identity.infrastructure.JwtTokenProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Tracks transport sessions so invalid credentials close even idle subscriptions. */
@Component
public class WebSocketSessionSecurity implements WebSocketHandlerDecoratorFactory, ChannelInterceptor {
    private static final Logger log = LoggerFactory.getLogger(WebSocketSessionSecurity.class);
    private final Map<String, SessionCredentials> sessions = new ConcurrentHashMap<>();
    private final JwtTokenProvider tokens;
    private final UserRepository users;

    public WebSocketSessionSecurity(JwtTokenProvider tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    User connect(String sessionId, String token) {
        SessionCredentials credentials = requireSession(sessionId);
        if (credentials.token != null) {
            close(sessionId, credentials);
            throw new MessagingException("Session already authenticated");
        }
        User user = validate(sessionId, credentials, token);
        credentials.token = token;
        return user;
    }

    User authenticate(String sessionId) {
        SessionCredentials credentials = requireSession(sessionId);
        return validate(sessionId, credentials, credentials.token);
    }

    private SessionCredentials requireSession(String sessionId) {
        SessionCredentials credentials = sessionId == null ? null : sessions.get(sessionId);
        if (credentials == null) throw new MessagingException("Authentication required");
        return credentials;
    }

    private User validate(String sessionId, SessionCredentials credentials, String token) {
        try {
            if (token == null) throw new IllegalArgumentException("Missing credentials");
            return users.findById(tokens.extractUserId(token))
                    .filter(User::isActive)
                    .filter(User::isEmailVerified)
                    .filter(user -> tokens.isValidForUser(token, user))
                    .orElseThrow(() -> new IllegalArgumentException("Invalid credentials"));
        } catch (RuntimeException exception) {
            // Fail closed on repository outages too. Never expose or log JWT parser
            // exceptions: their messages may contain sensitive token claims.
            close(sessionId, credentials);
            throw new MessagingException("Socket authentication no longer valid");
        }
    }

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        if (SimpMessageHeaderAccessor.getMessageType(message.getHeaders()) == SimpMessageType.MESSAGE) {
            try {
                authenticate(SimpMessageHeaderAccessor.getSessionId(message.getHeaders()));
            } catch (MessagingException exception) {
                return null; // Drop private outbound events after revocation.
            }
        }
        return message;
    }

    @Scheduled(fixedDelay = 5000)
    public void closeInvalidSessions() {
        sessions.forEach((sessionId, credentials) -> {
            if (credentials.token == null) return; // CONNECT authentication handles these.
            try {
                authenticate(sessionId);
            } catch (MessagingException ignored) {
                // authenticate already removed and closed the invalid session.
            }
        });
    }

    private void close(String sessionId, SessionCredentials credentials) {
        sessions.remove(sessionId, credentials);
        try {
            credentials.session.close(CloseStatus.POLICY_VIOLATION);
        } catch (IOException exception) {
            log.warn("Could not close invalid WebSocket session {}", sessionId);
        }
    }

    @Override
    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
                sessions.put(session.getId(), new SessionCredentials(session));
                try {
                    super.afterConnectionEstablished(session);
                } catch (Exception exception) {
                    sessions.remove(session.getId());
                    throw exception;
                }
            }

            @Override
            public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) throws Exception {
                sessions.remove(session.getId());
                super.afterConnectionClosed(session, status);
            }
        };
    }

    private static final class SessionCredentials {
        private final WebSocketSession session;
        private volatile String token;

        private SessionCredentials(WebSocketSession session) {
            this.session = session;
        }
    }
}
