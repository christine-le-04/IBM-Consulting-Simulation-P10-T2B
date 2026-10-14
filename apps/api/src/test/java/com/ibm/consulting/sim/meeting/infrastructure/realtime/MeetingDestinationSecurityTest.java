package com.ibm.consulting.sim.meeting.infrastructure.realtime;

import com.ibm.consulting.sim.engagement.domain.Engagement;
import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import com.ibm.consulting.sim.meeting.domain.Meeting;
import com.ibm.consulting.sim.meeting.domain.MeetingRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.security.Principal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

class MeetingDestinationSecurityTest {
    private final MeetingRepository meetings = mock(MeetingRepository.class);
    private final EngagementRepository engagements = mock(EngagementRepository.class);
    private final MessageChannel channel = mock(MessageChannel.class);
    private final MeetingSubscriptionInterceptor interceptor = new MeetingSubscriptionInterceptor(meetings, engagements);
    private final User user = User.create("learner@example.test", "hash", "Learner", UserRole.LEARNER);
    private final UUID meetingId = UUID.randomUUID();
    private final UUID engagementId = UUID.randomUUID();

    @ParameterizedTest
    @EnumSource(value = StompCommand.class, names = {"SUBSCRIBE", "SEND"})
    void ownerCanSubscribeAndSend(StompCommand command) {
        when(meetings.findById(meetingId)).thenReturn(Optional.of(Meeting.start(engagementId, UUID.randomUUID())));
        when(engagements.findByIdAndUserId(engagementId, user.getId()))
                .thenReturn(Optional.of(Engagement.start(user.getId(), UUID.randomUUID(), UUID.randomUUID())));
        Message<byte[]> message = frame(command, destination(command), authenticated());

        assertThat(interceptor.preSend(message, channel)).isSameAs(message);
        verify(engagements).findByIdAndUserId(engagementId, user.getId());
    }

    @ParameterizedTest
    @EnumSource(value = StompCommand.class, names = {"SUBSCRIBE", "SEND"})
    void anotherUserCannotSubscribeOrSend(StompCommand command) {
        when(meetings.findById(meetingId)).thenReturn(Optional.of(Meeting.start(engagementId, UUID.randomUUID())));

        assertThatThrownBy(() -> interceptor.preSend(frame(command, destination(command), authenticated()), channel))
                .isInstanceOf(MessagingException.class).hasMessageContaining("Not authorized");
        verify(engagements).findByIdAndUserId(engagementId, user.getId());
    }

    @ParameterizedTest
    @EnumSource(value = StompCommand.class, names = {"SUBSCRIBE", "SEND"})
    void missingMeetingIsDenied(StompCommand command) {
        assertThatThrownBy(() -> interceptor.preSend(frame(command, destination(command), authenticated()), channel))
                .isInstanceOf(MessagingException.class).hasMessageContaining("Not authorized");
        verifyNoInteractions(engagements);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"/topic/meetings/*", "/topic/meetings/**", "/topic/**", "/topic/meetings/{id}",
            "/topic/meetings/not-a-uuid", "/topic/meetings/------------------------------------",
            "/topic/meetings/00000000-0000-0000-0000-000000000000/extra", "/app/meetings/test/send", "/user/queue/errors"})
    void unknownAndWildcardSubscriptionsAreDenied(String destination) {
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.SUBSCRIBE, destination, authenticated()), channel))
                .isInstanceOf(MessagingException.class).hasMessageContaining("Destination not allowed");
        verifyNoInteractions(meetings, engagements);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"/topic/meetings/00000000-0000-0000-0000-000000000000", "/topic/meetings/*",
            "/app/meetings/*/send", "/app/meetings/not-a-uuid/send", "/app/unknown", "/user/queue/errors"})
    void directBrokerPublishingAndUnknownSendsAreDenied(String destination) {
        assertThatThrownBy(() -> interceptor.preSend(frame(StompCommand.SEND, destination, authenticated()), channel))
                .isInstanceOf(MessagingException.class).hasMessageContaining("Destination not allowed");
        verifyNoInteractions(meetings, engagements);
    }

    @ParameterizedTest
    @EnumSource(value = StompCommand.class, names = {"SUBSCRIBE", "SEND"})
    void unauthenticatedFramesAreDenied(StompCommand command) {
        assertThatThrownBy(() -> interceptor.preSend(frame(command, destination(command), null), channel))
                .isInstanceOf(MessagingException.class).hasMessageContaining("Authentication required");
        var unauthenticated = new UsernamePasswordAuthenticationToken(user, null);
        assertThatThrownBy(() -> interceptor.preSend(frame(command, destination(command), unauthenticated), channel))
                .isInstanceOf(MessagingException.class).hasMessageContaining("Authentication required");
        verifyNoInteractions(meetings, engagements);
    }

    @ParameterizedTest
    @EnumSource(value = StompCommand.class, names = {"CONNECT", "DISCONNECT", "UNSUBSCRIBE"})
    void lifecycleFramesStillPassThrough(StompCommand command) {
        Message<byte[]> message = frame(command, null, null);
        assertThat(interceptor.preSend(message, channel)).isSameAs(message);
        verifyNoInteractions(meetings, engagements);
    }

    @Test
    void missingStompHeadersAreDenied() {
        assertThatThrownBy(() -> interceptor.preSend(MessageBuilder.withPayload(new byte[0]).build(), channel))
                .isInstanceOf(MessagingException.class).hasMessageContaining("Missing STOMP headers");
    }

    private Principal authenticated() {
        return new UsernamePasswordAuthenticationToken(user, null, List.of(new SimpleGrantedAuthority("ROLE_LEARNER")));
    }

    private String destination(StompCommand command) {
        return command == StompCommand.SUBSCRIBE ? "/topic/meetings/" + meetingId : "/app/meetings/" + meetingId + "/send";
    }

    private Message<byte[]> frame(StompCommand command, String destination, Principal principal) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(command);
        accessor.setDestination(destination);
        accessor.setUser(principal);
        accessor.setLeaveMutable(true);
        return MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
    }
}
