package com.ibm.consulting.sim.ai.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.domain.AiValidationException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AssessmentFeedbackParserTest {

    private final AssessmentFeedbackParser parser = new AssessmentFeedbackParser(new ObjectMapper());

    @Test
    void parsesTheCoachingSummaryAndEvidenceLists() {
        var feedback = parser.parse("""
                {"feedbackSummary":"You addressed the client's operating concern.",
                 "strengths":["Asked a focused question","Used the financial signal"],
                 "improvementAreas":["Confirm who owns the next step"]}
                """);

        assertThat(feedback.feedbackSummary()).isEqualTo("You addressed the client's operating concern.");
        assertThat(feedback.strengths()).containsExactly("Asked a focused question", "Used the financial signal");
        assertThat(feedback.improvementAreas()).containsExactly("Confirm who owns the next step");
    }

    @Test
    void rejectsMalformedJson() {
        assertThatThrownBy(() -> parser.parse("{invalid"))
                .isInstanceOf(AiValidationException.class)
                .hasMessageContaining("not valid JSON");
    }

    @Test
    void rejectsMissingNullAndBlankSummary() {
        for (String response : new String[]{"{}", "{\"feedbackSummary\":null}", "{\"feedbackSummary\":\" \"}"}) {
            assertThatThrownBy(() -> parser.parse(response))
                    .isInstanceOf(AiValidationException.class)
                    .hasMessageContaining("feedbackSummary");
        }
    }

    @Test
    void allowsAUsefulSummaryWithoutOptionalLists() {
        var feedback = parser.parse("{\"feedbackSummary\":\"Confirm the next step with the client.\"}");

        assertThat(feedback.strengths()).isEmpty();
        assertThat(feedback.improvementAreas()).isEmpty();
    }
}
