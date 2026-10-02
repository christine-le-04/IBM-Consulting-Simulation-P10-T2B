package com.ibm.consulting.sim.ai.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.domain.AiValidationException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class OutreachEvaluationParserTest {

    private final OutreachEvaluationParser parser = new OutreachEvaluationParser(new ObjectMapper());

    @Test
    void parsesScoresAndRelationshipChangesForEachSupportedOutcome() {
        for (String outcome : new String[]{"ACCEPTED", "FOLLOW_UP_REQUIRED", "REJECTED"}) {
            var result = parser.parse(validEvaluation(outcome));

            assertThat(result.clientReply()).isEqualTo("Please send a comparable example.");
            assertThat(result.outcome()).isEqualTo(outcome);
            assertThat(result.personalisation()).isEqualTo(80);
            assertThat(result.relevance()).isEqualTo(70);
            assertThat(result.clarity()).isEqualTo(60);
            assertThat(result.callToAction()).isEqualTo(90);
            assertThat(result.trustDelta()).isEqualTo(3);
            assertThat(result.interestDelta()).isEqualTo(-2);
        }
    }

    @Test
    void rejectsMalformedJson() {
        assertThatThrownBy(() -> parser.parse("{invalid"))
                .isInstanceOf(AiValidationException.class)
                .hasMessageContaining("not valid JSON");
    }

    @Test
    void rejectsMissingAndBlankRequiredFields() {
        for (String response : new String[]{"{}", "{\"clientReply\":\"Reply\"}",
                "{\"outcome\":\"ACCEPTED\"}", "{\"clientReply\":\" \",\"outcome\":\"ACCEPTED\"}"}) {
            assertThatThrownBy(() -> parser.parse(response))
                    .isInstanceOf(AiValidationException.class)
                    .hasMessageContaining("clientReply/outcome");
        }
    }

    @Test
    void rejectsUnsupportedOutcomes() {
        assertThatThrownBy(() -> parser.parse(validEvaluation("WON")))
                .isInstanceOf(AiValidationException.class)
                .hasMessageContaining("Unknown outcome value: WON");
    }

    @Test
    void clampsScoresToTheSupportedRange() {
        var result = parser.parse(validEvaluation("REJECTED")
                .replace("\"personalisation\":80", "\"personalisation\":-1")
                .replace("\"relevance\":70", "\"relevance\":101")
                .replace("\"clarity\":60", "\"clarity\":0")
                .replace("\"callToAction\":90", "\"callToAction\":100"));

        assertThat(result.personalisation()).isZero();
        assertThat(result.relevance()).isEqualTo(100);
        assertThat(result.clarity()).isZero();
        assertThat(result.callToAction()).isEqualTo(100);
    }

    private String validEvaluation(String outcome) {
        return """
                {"clientReply":"Please send a comparable example.","outcome":"%s",
                 "scores":{"personalisation":80,"relevance":70,"clarity":60,"callToAction":90},
                 "relationshipStateDelta":{"trust":3,"interest":-2}}
                """.formatted(outcome);
    }
}
