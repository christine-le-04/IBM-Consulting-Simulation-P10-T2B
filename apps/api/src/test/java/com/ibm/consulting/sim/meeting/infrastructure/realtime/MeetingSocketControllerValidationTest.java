package com.ibm.consulting.sim.meeting.infrastructure.realtime;

import com.ibm.consulting.sim.meeting.application.MeetingRequestLimits;
import com.ibm.consulting.sim.meeting.application.MeetingService;
import com.ibm.consulting.sim.meeting.application.GuidedMeetingResponseService;
import com.ibm.consulting.sim.ai.domain.AiProviderException;
import com.ibm.consulting.sim.identity.domain.User;
import com.ibm.consulting.sim.identity.domain.UserRole;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;

import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

import static org.assertj.core.api.Assertions.assertThat;

class MeetingSocketControllerValidationTest {

    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

    @Test
    void providerOutageReturnsAnActionableCodeWithoutLeakingUpstreamErrors() {
        MeetingService service = mock(MeetingService.class);
        SimpMessagingTemplate messaging = mock(SimpMessagingTemplate.class);
        ExecutorService executor = mock(ExecutorService.class);
        doAnswer(invocation -> { ((Runnable) invocation.getArgument(0)).run(); return null; })
                .when(executor).execute(any(Runnable.class));
        UUID meetingId = UUID.randomUUID();
        User user = User.create("test@example.com", "hash", "Learner", UserRole.LEARNER);
        when(service.sendMessage(meetingId, user.getId(), "question", "request-1"))
                .thenThrow(new AiProviderException("Internal upstream provider details"));
        MeetingSocketController controller = new MeetingSocketController(service,
                mock(GuidedMeetingResponseService.class), messaging, executor);

        controller.sendMessage(meetingId, new MeetingSocketController.MeetingMessage("question", "request-1"),
                new UsernamePasswordAuthenticationToken(user, null));

        verify(messaging).convertAndSend("/topic/meetings/" + meetingId,
                new MeetingSocketController.SocketEvent("turn.error", Map.of("code", "AI_REPLY_UNAVAILABLE",
                        "message", "The client could not reply just now. Your turn was not recorded. Please try again.")));
    }

    @Test
    void stompPayloadAppliesTheSameMessageAndIdLimitsAsHttp() {
        var valid = new MeetingSocketController.MeetingMessage(
                "m".repeat(MeetingRequestLimits.MESSAGE_MAX_LENGTH),
                "i".repeat(MeetingRequestLimits.MESSAGE_ID_MAX_LENGTH));
        var oversizedMessage = new MeetingSocketController.MeetingMessage(
                "m".repeat(MeetingRequestLimits.MESSAGE_MAX_LENGTH + 1), "message-1");
        var oversizedId = new MeetingSocketController.MeetingMessage(
                "valid", "i".repeat(MeetingRequestLimits.MESSAGE_ID_MAX_LENGTH + 1));

        assertThat(validator.validate(valid)).isEmpty();
        assertThat(validator.validate(oversizedMessage))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("message");
        assertThat(validator.validate(oversizedId))
                .extracting(violation -> violation.getPropertyPath().toString())
                .containsExactly("messageId");
    }
}
