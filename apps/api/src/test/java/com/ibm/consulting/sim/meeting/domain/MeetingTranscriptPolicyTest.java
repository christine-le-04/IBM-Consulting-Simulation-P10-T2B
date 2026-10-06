package com.ibm.consulting.sim.meeting.domain;

import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;

class MeetingTranscriptPolicyTest {
    @Test
    void removesTheFailedExchangeWithoutRemovingRealClientClarification() {
        UUID meetingId = UUID.randomUUID();
        ConversationTurn failedQuestion = ConversationTurn.learnerTurn(meetingId, 1, "My proposal");
        ConversationTurn fallback = ConversationTurn.personaTurn(meetingId, 2,
                "Sorry, could you repeat that? I want to make sure I understand you correctly.", "");
        ConversationTurn question = ConversationTurn.learnerTurn(meetingId, 3, "Who owns delivery?");
        ConversationTurn answer = ConversationTurn.personaTurn(meetingId, 4, "Could you clarify the delivery scope?", "");
        assertThat(MeetingTranscriptPolicy.usableTurns(List.of(failedQuestion, fallback, question, answer)))
                .containsExactly(question, answer);
        assertThat(MeetingTranscriptPolicy.isProviderFallback(answer)).isFalse();
    }
}
