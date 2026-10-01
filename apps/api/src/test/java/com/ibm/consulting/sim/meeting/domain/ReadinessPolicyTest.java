package com.ibm.consulting.sim.meeting.domain;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class ReadinessPolicyTest {

    @Test
    void scoresZeroForEmptyPreparation() {
        int score = ReadinessPolicy.calculate(null, List.of(), List.of());
        assertThat(score).isZero();
    }

    @Test
    void objectiveContributesTwentyPoints() {
        int score = ReadinessPolicy.calculate("Understand budget constraints", List.of(), List.of());
        assertThat(score).isEqualTo(20);
    }

    @Test
    void agendaItemsCapAtMaxCredit() {
        List<String> agenda = List.of("Introduction", "Discovery details", "Project scope", "Budget planning", "Project timeline", "Next steps");
        int score = ReadinessPolicy.calculate(null, agenda, List.of());
        // 6 items * 10 credit each = 60, capped at MAX_AGENDA_CREDIT (40)
        assertThat(score).isEqualTo(40);
    }

    @Test
    void discoveryQuestionsCapAtMaxCredit() {
        List<String> questions = List.of("What is your budget?", "Who is the decision maker?", "What is the timeline?", "What are your priorities?", "What are the key challenges?", "What does success look like?");
        int score = ReadinessPolicy.calculate(null, List.of(), questions);
        // 6 items * 8 credit each = 48, capped at MAX_QUESTION_CREDIT (40)
        assertThat(score).isEqualTo(40);
    }

    @Test
    void blankItemsAreNotCountedTowardCredit() {
        int score = ReadinessPolicy.calculate("  ", List.of("", "  "), List.of(""));
        assertThat(score).isZero();
    }

    @Test
    void fullyPreparedMeetingReachesReadyThreshold() {
        int score = ReadinessPolicy.calculate(
                "Confirm scope and budget",
                List.of("Introduction", "Discovery", "Project scope", "Next steps"),
                List.of("What is your budget?", "Who is the decision maker?", "What is the timeline?"));
        assertThat(score).isGreaterThanOrEqualTo(ReadinessPolicy.READY_THRESHOLD);
    }

    @Test
    void scoreNeverExceedsOneHundred() {
        List<String> manyItems = List.of("a", "b", "c", "d", "e", "f", "g", "h", "i", "j");
        int score = ReadinessPolicy.calculate("Objective", manyItems, manyItems);
        assertThat(score).isLessThanOrEqualTo(100);
    }
}
