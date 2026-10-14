package com.ibm.consulting.sim.meeting.infrastructure.realtime;

import com.ibm.consulting.sim.engagement.domain.EngagementRepository;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.meeting.domain.MeetingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.MessagingException;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Authorizes STOMP subscriptions and sends against explicit meeting destinations:
 * a meeting's live turn events (persona replies, relationship-state deltas) are
 * only ever pushed to the learner who owns that meeting's engagement, not to
 * anyone who happens to know or guess the meeting's UUID. Runs after
 * {@link StompAuthChannelInterceptor}, which attaches the session's {@link User}
 * principal that this check relies on.
 */
@Component
public class MeetingSubscriptionInterceptor implements ChannelInterceptor {

    private static final Logger log = LoggerFactory.getLogger(MeetingSubscriptionInterceptor.class);
    private static final String UUID_PATTERN = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";
    private static final Pattern MEETING_TOPIC = Pattern.compile("^/topic/meetings/" + UUID_PATTERN + "$");
    private static final Pattern MEETING_SEND = Pattern.compile("^/app/meetings/" + UUID_PATTERN + "/send$");

    private final MeetingRepository meetingRepository;
    private final EngagementRepository engagementRepository;

    public MeetingSubscriptionInterceptor(MeetingRepository meetingRepository,
                                           EngagementRepository engagementRepository) {
        this.meetingRepository = meetingRepository;
        this.engagementRepository = engagementRepository;
    }

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            throw new MessagingException("Missing STOMP headers");
        }
        StompCommand command = accessor.getCommand();
        if (command != StompCommand.SUBSCRIBE && command != StompCommand.SEND) {
            return message;
        }
        // Deny unknown destinations. In particular, the broker supports wildcard
        // subscriptions and direct SENDs to /topic, neither of which may bypass
        // the per-meeting ownership boundary.
        Pattern allowedDestination = command == StompCommand.SUBSCRIBE ? MEETING_TOPIC : MEETING_SEND;
        String destination = accessor.getDestination();
        Matcher matcher = destination != null ? allowedDestination.matcher(destination) : null;
        if (matcher == null || !matcher.matches()) {
            throw new MessagingException("Destination not allowed");
        }
        Principal principal = accessor.getUser();
        if (!(principal instanceof org.springframework.security.core.Authentication auth)
                || !auth.isAuthenticated()
                || !(auth.getPrincipal() instanceof User user)) {
            throw new MessagingException("Authentication required");
        }
        UUID meetingId = UUID.fromString(matcher.group(1));
        boolean owns = meetingRepository.findById(meetingId)
                .flatMap(meeting -> engagementRepository.findByIdAndUserId(meeting.getEngagementId(), user.getId()))
                .isPresent();
        if (!owns) {
            log.warn("User {} attempted {} for meeting {} they do not own", user.getId(), command, meetingId);
            throw new MessagingException("Not authorized for this meeting");
        }
        return message;
    }
}
