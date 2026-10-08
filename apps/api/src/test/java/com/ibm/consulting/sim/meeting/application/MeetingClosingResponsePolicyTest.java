package com.ibm.consulting.sim.meeting.application;

import com.ibm.consulting.sim.ai.domain.PersonaTurnResponse;
import com.ibm.consulting.sim.ai.domain.PersonaStateDelta;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class MeetingClosingResponsePolicyTest {
    @Test
    void removesPrematureGoodbyeAndClosingSignalsWithoutLosingDisclosedFacts() {
        PersonaTurnResponse response = new PersonaTurnResponse("I'll see you on Friday.",
                List.of("asks_focused_question"), PersonaStateDelta.zero(), List.of("Budget is constrained"),
                null, List.of("client_ready_to_close", "client_committed_next_step", "client_validated_value"),
                new PersonaTurnResponse.SafetyCheck(true, null));
        PersonaTurnResponse open = MeetingClosingResponsePolicy.keepOpen(response);
        assertThat(open.spokenResponse()).doesNotContain("Friday").contains("Before we wrap up");
        assertThat(open.meetingSignals()).containsExactly("client_validated_value");
        assertThat(open.factsDisclosed()).containsExactly("Budget is constrained");
    }

    @Test
    void preservesOrdinaryDiscoveryResponse() {
        PersonaTurnResponse response = PersonaTurnResponse.safeFallback("Our main priority is delivery.");
        assertThat(MeetingClosingResponsePolicy.keepOpen(response)).isSameAs(response);
    }

    @Test
    void catchesGoodbyeEvenWhenProviderOmitsClosingSignal() {
        PersonaTurnResponse response = PersonaTurnResponse.safeFallback("I'll see you on Friday.");
        assertThat(MeetingClosingResponsePolicy.keepOpen(response).spokenResponse()).doesNotContain("Friday");
    }
}
