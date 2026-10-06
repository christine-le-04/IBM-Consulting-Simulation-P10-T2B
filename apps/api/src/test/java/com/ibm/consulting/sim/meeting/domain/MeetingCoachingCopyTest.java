package com.ibm.consulting.sim.meeting.domain;

import com.ibm.consulting.sim.ai.domain.PersonaStateDelta;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class MeetingCoachingCopyTest {
    @Test
    void explainsCreditedActionsWithoutInternalCodesOrPolicyTerms() {
        var assessment = MeetingTurnProgressionPolicy.assess(new PersonaStateDelta(10, 10, 0),
                "The current workflow constraint needs a read-only pilot with a clear owner and a measurable outcome.",
                List.of("directly_addresses_concern", "grounded_recommendation"),
                "That addresses our delivery concern.", List.of());
        assertThat(assessment.explanation()).contains("client's concern", "recommendation")
                .doesNotContain("directly_addresses_concern", "grounded_recommendation", "policy", "Simulation Director");
    }
}
