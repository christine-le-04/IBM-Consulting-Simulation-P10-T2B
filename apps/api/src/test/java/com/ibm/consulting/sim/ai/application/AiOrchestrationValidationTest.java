package com.ibm.consulting.sim.ai.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.domain.AiModelGateway;
import com.ibm.consulting.sim.ai.domain.AiProviderException;
import com.ibm.consulting.sim.ai.domain.AiTraceStatus;
import com.ibm.consulting.sim.ai.infrastructure.PersonaTurnResponseParser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.mockito.ArgumentCaptor;

import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AiOrchestrationValidationTest {

    private final AiModelGateway gateway = mock(AiModelGateway.class);
    private final AiTraceRecorder traces = mock(AiTraceRecorder.class);
    private final PersonaTurnResponseParser parser = new PersonaTurnResponseParser(
            new ObjectMapper(), Set.of("budget_signal"));

    @Test
    @SuppressWarnings("unchecked")
    void longerMeetingBudgetDoesNotChangeOutreachBudget() {
        ObjectProvider<AiProviderRouter> routers = mock(ObjectProvider.class);
        AiProviderRouter router = mock(AiProviderRouter.class);
        when(routers.getIfAvailable()).thenReturn(router);
        when(router.<String>completeFirstValid(anyString(), anyString(), any(), anyLong()))
                .thenReturn(new AiValidatedResponse<>("reply", "gemini-free"));
        try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
            AiOrchestrationService service = new AiOrchestrationService(gateway, routers, traces, executor,
                    1_000, 2_000, 6_000, 1_000, 1_000, "model");
            service.execute("persona_dialogue", UUID.randomUUID(), "prompt", 1, raw -> raw, () -> "fallback");
            service.execute("outreach_evaluation", UUID.randomUUID(), "prompt", 1, raw -> raw, () -> "fallback");

            ArgumentCaptor<Long> meetingBudget = ArgumentCaptor.forClass(Long.class);
            ArgumentCaptor<Long> outreachBudget = ArgumentCaptor.forClass(Long.class);
            verify(router).completeFirstValid(eq("persona_dialogue"), anyString(), any(), meetingBudget.capture());
            verify(router).completeFirstValid(eq("outreach_evaluation"), anyString(), any(), outreachBudget.capture());
            assertThat(meetingBudget.getValue()).isBetween(2_001L, 6_000L);
            assertThat(outreachBudget.getValue()).isBetween(1L, 2_000L);
        }
    }

    @Test
    void repairsMalformedOutputBeforeReturningAValidatedTurn() {
        when(gateway.complete(anyString(), anyString())).thenReturn("{invalid", validTurn());
        UUID engagementId = UUID.randomUUID();
        try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
            var result = service(executor).execute("persona_dialogue", engagementId, "prompt", 2,
                    parser, () -> { throw new AssertionError("A valid repair must not use the fallback"); });

            assertThat(result.spokenResponse()).isEqualTo("Please explain the scope.");
            verify(gateway).complete(eq("persona_dialogue"), contains("Your previous response was invalid"));
            verify(traces).record(eq("persona_dialogue"), eq(engagementId), eq("model"), eq(2),
                    anyLong(), eq(AiTraceStatus.REPAIRED), any());
        }
    }

    @Test
    void rejectsAnUnsupportedFactEvenWhenTheRepairIsValidJson() {
        String unsupported = validTurn().replace("\"factsDisclosed\":[]", "\"factsDisclosed\":[\"unearned_hidden_fact\"]");
        when(gateway.complete(anyString(), anyString())).thenReturn(unsupported);
        UUID engagementId = UUID.randomUUID();
        try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
            assertThatThrownBy(() -> service(executor).execute("persona_dialogue", engagementId, "prompt", 2,
                    parser, () -> { throw new AiProviderException("No valid client reply; retry the exchange"); }))
                    .isInstanceOf(AiProviderException.class)
                    .hasMessage("No valid client reply; retry the exchange");

            verify(gateway, times(2)).complete(eq("persona_dialogue"), anyString());
            verify(traces).record(eq("persona_dialogue"), eq(engagementId), eq("model"), eq(2),
                    anyLong(), eq(AiTraceStatus.FALLBACK), contains("Unknown fact identifier"));
        }
    }

    @Test
    void preservesTheCallerRetryErrorWhenTheProviderIsUnavailable() {
        when(gateway.complete(anyString(), anyString())).thenThrow(new AiProviderException("unavailable"));
        AiProviderException retryError = new AiProviderException("No progress was saved; retry the exchange");
        try (ExecutorService executor = Executors.newSingleThreadExecutor()) {
            assertThatThrownBy(() -> service(executor).execute("persona_dialogue", UUID.randomUUID(), "prompt", 2,
                    parser, () -> { throw retryError; }))
                    .isSameAs(retryError);

            verify(gateway).complete(eq("persona_dialogue"), eq("prompt"));
        }
    }

    private String validTurn() {
        return """
                {"spokenResponse":"Please explain the scope.","stateDelta":{"trust":0,"interest":0,"patience":0},
                 "factsDisclosed":[],"safety":{"allowed":true,"reason":null}}
                """;
    }

    @SuppressWarnings("unchecked")
    private AiOrchestrationService service(ExecutorService executor) {
        ObjectProvider<AiProviderRouter> routers = mock(ObjectProvider.class);
        when(routers.getIfAvailable()).thenReturn(null);
        return new AiOrchestrationService(gateway, routers, traces, executor,
                5_000, 5_000, 5_000, 5_000, 5_000, "model");
    }
}
