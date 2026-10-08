package com.ibm.consulting.sim.meeting.domain;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

import com.ibm.consulting.sim.ai.domain.PersonaStateDelta;

/**
 * Retest R7: a turn's quality must not contradict the behaviours shown with it.
 * Scenario vocabulary ("duty hours", "standby crews") is not in the generic cue
 * list, so these messages only qualify through the AI's verified behaviours.
 */
class MeetingTurnQualityConsistencyTest {

    private static final String SCENARIO_QUESTION =
            "How many of the winter cancellations happened because crews ran out of legal duty hours?";
    private static final PersonaStateDelta MODEST_AI_DELTA = new PersonaStateDelta(4, 4, 4);

    private static MeetingBehaviourAssessment assess(String message, List<String> behaviours) {
        return MeetingTurnProgressionPolicy.assess(MODEST_AI_DELTA, message, behaviours,
                "Go on.", List.of(), List.of());
    }

    @Test
    void aFocusedScenarioQuestionUsingEvidenceIsNotLowSignal() {
        var assessment = assess(SCENARIO_QUESTION, List.of("asks_focused_question", "uses_disclosed_evidence"));

        assertThat(assessment.quality()).isEqualTo("FOCUSED_DISCOVERY");
        assertThat(assessment.relationshipDelta().trust()).isPositive();
        assertThat(assessment.relationshipDelta().interest()).isPositive();
        assertThat(assessment.explanation()).doesNotContain("needs a more specific");
    }

    @Test
    void twoKindsOfGroundingInASubstantiveTurnAreGroundedDiscovery() {
        var assessment = assess(
                "Your standby crews at the northern base were used up by noon on most delay days, so which base should we start with?",
                List.of("uses_disclosed_evidence", "directly_addresses_concern", "asks_focused_question"));

        assertThat(assessment.quality()).isEqualTo("GROUNDED_DISCOVERY");
    }

    @Test
    void synonymsForTheSameGroundingCountOnce() {
        var assessment = assess(
                "Your standby crews at the northern base were used up by noon on most delay days, so which base should we start with?",
                List.of("uses_disclosed_evidence", "uses_client_fact", "asks_focused_question"));

        assertThat(assessment.quality()).isEqualTo("FOCUSED_DISCOVERY");
    }

    @Test
    void withoutAiBehavioursTheSameMessageStaysLowSignal() {
        var assessment = assess(SCENARIO_QUESTION, List.of());

        assertThat(assessment.quality()).isEqualTo("LOW_SIGNAL");
        assertThat(assessment.relationshipDelta()).isEqualTo(PersonaStateDelta.zero());
    }

    @Test
    void aBriefTurnStaysLowSignalButIsToldItWasOnTrack() {
        var assessment = assess("Which base is worst for cancellations?", List.of("asks_focused_question"));

        assertThat(assessment.quality()).isEqualTo("LOW_SIGNAL");
        assertThat(assessment.explanation()).contains("on the right track");
    }

    @Test
    void aFocusedQuestionLabelOnlyCountsForAnActualQuestion() {
        var statement = assess("Winter cancellations happened when crews ran out of legal duty hours.",
                List.of("asks_focused_question"));

        assertThat(statement.quality()).isEqualTo("LOW_SIGNAL");
    }

    @Test
    void aNegativeLabelStillWinsOverPositiveOnes() {
        var assessment = MeetingTurnProgressionPolicy.assess(MODEST_AI_DELTA, SCENARIO_QUESTION,
                List.of("asks_focused_question", "uses_disclosed_evidence", "evasive"),
                "Go on.", List.of(), List.of("First question?", "Second question?"));

        assertThat(assessment.quality()).isEqualTo("EVASIVE");
        assertThat(assessment.relationshipDelta().trust()).isNegative();
    }
}
