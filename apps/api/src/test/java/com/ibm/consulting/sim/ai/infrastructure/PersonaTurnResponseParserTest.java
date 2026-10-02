package com.ibm.consulting.sim.ai.infrastructure;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ibm.consulting.sim.ai.domain.AiValidationException;
import com.ibm.consulting.sim.ai.domain.PersonaStateDelta;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PersonaTurnResponseParserTest {

    private final PersonaTurnResponseParser parser = new PersonaTurnResponseParser(
            new ObjectMapper(), Set.of("budget_signal"));

    @Test
    void parsesValidStructuredTurn() {
        var turn = parser.parse(validTurn());

        assertThat(turn.spokenResponse()).isEqualTo("The board reviews funding next quarter.");
        assertThat(turn.stateDelta()).isEqualTo(new PersonaStateDelta(3, 2, -1));
        assertThat(turn.factsDisclosed()).containsExactly("budget_signal");
        assertThat(turn.detectedLearnerBehaviours()).containsExactly("asks_focused_question");
        assertThat(turn.meetingSignals()).containsExactly("client_concern_raised");
        assertThat(turn.objectionRaised()).isEqualTo("We need a lower-risk approach.");
        assertThat(turn.safety().allowed()).isTrue();
        assertThat(turn.safety().reason()).isNull();
        assertThat(turn.guidedResponseOptions()).containsExactly("What would reduce that risk?");
    }

    @Test
    void rejectsMalformedJson() {
        assertThatThrownBy(() -> parser.parse("{invalid"))
                .isInstanceOf(AiValidationException.class)
                .hasMessageContaining("not valid JSON");
    }

    @Test
    void rejectsMarkdownWrappedJsonInsteadOfTreatingItAsAClientReply() {
        assertThatThrownBy(() -> parser.parse("```json\n" + validTurn() + "\n```"))
                .isInstanceOf(AiValidationException.class)
                .hasMessageContaining("not valid JSON");
    }

    @Test
    void rejectsJsonValuesThatAreNotStructuredTurns() {
        for (String response : new String[]{"[]", "true", "42", "\"A plain reply\"", "null"}) {
            assertThatThrownBy(() -> parser.parse(response))
                    .isInstanceOf(AiValidationException.class)
                    .hasMessageContaining("spokenResponse");
        }
    }

    @Test
    void rejectsAMixedDisclosureListWhenAnyFactIsNotAllowed() {
        assertThatThrownBy(() -> parser.parse(validTurn().replace("[\"budget_signal\"]",
                "[\"budget_signal\",\"unearned_hidden_fact\"]")))
                .isInstanceOf(AiValidationException.class)
                .hasMessageContaining("Unknown fact identifier disclosed: unearned_hidden_fact");
    }

    @Test
    void rejectsMissingBlankAndNonTextualReply() {
        for (String reply : new String[]{"{}", "{\"spokenResponse\":\" \"}", "{\"spokenResponse\":42}"}) {
            assertThatThrownBy(() -> parser.parse(reply))
                    .isInstanceOf(AiValidationException.class)
                    .hasMessageContaining("spokenResponse");
        }
    }

    @Test
    void rejectsMissingAndNullStateDelta() {
        for (String delta : new String[]{"", ",\"stateDelta\":null"}) {
            assertThatThrownBy(() -> parser.parse("{\"spokenResponse\":\"Please explain the scope.\"" + delta + "}"))
                    .isInstanceOf(AiValidationException.class)
                    .hasMessageContaining("stateDelta");
        }
    }

    @Test
    void rejectsFactIdentifiersOutsideTheAllowedSet() {
        assertThatThrownBy(() -> parser.parse(validTurn().replace("budget_signal", "unearned_hidden_fact")))
                .isInstanceOf(AiValidationException.class)
                .hasMessageContaining("Unknown fact identifier disclosed: unearned_hidden_fact");
    }

    @Test
    void clampsRelationshipChangesBeforeReturningTheTurn() {
        var turn = parser.parse(validTurn().replace("\"trust\":3,\"interest\":2,\"patience\":-1",
                "\"trust\":200,\"interest\":-200,\"patience\":10"));

        assertThat(turn.stateDelta()).isEqualTo(new PersonaStateDelta(10, -10, 10));
    }

    @Test
    void parsesAnExplicitSafetyRejection() {
        var turn = parser.parse(validTurn().replace("\"allowed\":true,\"reason\":null",
                "\"allowed\":false,\"reason\":\"Unprofessional conduct\""));

        assertThat(turn.safety().allowed()).isFalse();
        assertThat(turn.safety().reason()).isEqualTo("Unprofessional conduct");
    }

    @Test
    void keepsOptionalDialogueFieldsEmptyWhenTheyAreAbsent() {
        var turn = parser.parse("""
                {"spokenResponse":"Please explain the scope.","stateDelta":{"trust":0,"interest":0,"patience":0},
                 "safety":{"allowed":true,"reason":null}}
                """);

        assertThat(turn.factsDisclosed()).isEmpty();
        assertThat(turn.detectedLearnerBehaviours()).isEmpty();
        assertThat(turn.meetingSignals()).isEmpty();
        assertThat(turn.guidedResponseOptions()).isEmpty();
        assertThat(turn.objectionRaised()).isNull();
    }

    private String validTurn() {
        return """
                {"spokenResponse":"The board reviews funding next quarter.",
                 "stateDelta":{"trust":3,"interest":2,"patience":-1},
                 "factsDisclosed":["budget_signal"],
                 "detectedLearnerBehaviours":["asks_focused_question"],
                 "meetingSignals":["client_concern_raised"],
                 "objectionRaised":"We need a lower-risk approach.",
                 "safety":{"allowed":true,"reason":null},
                 "guidedResponseOptions":["What would reduce that risk?"]}
                """;
    }
}
