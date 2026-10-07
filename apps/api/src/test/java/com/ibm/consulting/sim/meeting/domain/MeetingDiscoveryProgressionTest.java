package com.ibm.consulting.sim.meeting.domain;

import com.ibm.consulting.sim.ai.domain.PersonaStateDelta;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.assertThat;

class MeetingDiscoveryProgressionTest {
    @Test
    void threeDistinctOpeningDiscoveryQuestionsAreNotEvasive() {
        List<String> questions = List.of(
                "What are your main priorities?",
                "Which current workflow constraints cause the greatest operational impact for your team?",
                "How do you measure success and which metrics matter most to stakeholders?");
        for (int i = 0; i < questions.size(); i++) {
            var assessment = MeetingTurnProgressionPolicy.assess(new PersonaStateDelta(-6, -5, -6),
                    questions.get(i), List.of("evasive", "does_not_answer"), "Explain your solution.",
                    List.of(), questions.subList(0, i));
            assertThat(assessment.quality()).isIn("FOCUSED_DISCOVERY", "GROUNDED_DISCOVERY");
            assertThat(assessment.relationshipDelta().trust()).isGreaterThanOrEqualTo(0);
            assertThat(assessment.relationshipDelta().patience()).isGreaterThanOrEqualTo(0);
            assertThat(assessment.verifiedBehaviours()).doesNotContain("evasive", "does_not_answer");
        }
    }

    @Test
    void explicitRefusalAndRepeatedQuestionsStillReceivePenalties() {
        String question = "What are your main priorities and the business outcomes you want to achieve?";
        var repeated = MeetingTurnProgressionPolicy.assess(PersonaStateDelta.zero(), question,
                List.of("evasive"), "", List.of(), List.of(question));
        assertThat(repeated.relationshipDelta().patience()).isNegative();
        var refusal = MeetingTurnProgressionPolicy.assess(PersonaStateDelta.zero(),
                "I cannot help with your current workflow constraints, what are your priorities?",
                List.of("evasive"), "", List.of(), List.of());
        assertThat(refusal.quality()).isEqualTo("EVASIVE");
    }

    @Test
    void laterEvasionAndUnsupportedClaimsRemainPenalized() {
        String question = "What are your main priorities and the business outcomes you want to achieve?";
        var later = MeetingTurnProgressionPolicy.assess(PersonaStateDelta.zero(), question,
                List.of("evasive"), "", List.of(), List.of("one", "two", "three"));
        assertThat(later.quality()).isEqualTo("EVASIVE");
        var unsupported = MeetingTurnProgressionPolicy.assess(PersonaStateDelta.zero(), question,
                List.of("unsupported_claim"), "", List.of(), List.of());
        assertThat(unsupported.quality()).isEqualTo("EVASIVE");
    }
}
