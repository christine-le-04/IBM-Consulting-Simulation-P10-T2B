package com.ibm.consulting.sim.meeting.domain;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/** Keeps provider failures in the audit transcript, but out of evidence and coaching. */
public final class MeetingTranscriptPolicy {
    private static final String LEGACY_PROVIDER_FALLBACK =
            "Sorry, could you repeat that? I want to make sure I understand you correctly.";

    private MeetingTranscriptPolicy() {}

    public static boolean isProviderFallback(ConversationTurn turn) {
        return turn.getActor() == ConversationActor.PERSONA
                && (LEGACY_PROVIDER_FALLBACK.equals(turn.getContent().trim())
                || (turn.getSignals() != null && List.of(turn.getSignals().split(",")).contains("provider_fallback")));
    }

    public static List<ConversationTurn> usableTurns(List<ConversationTurn> turns) {
        Set<Integer> failedSequences = turns.stream().filter(MeetingTranscriptPolicy::isProviderFallback)
                .flatMap(turn -> java.util.stream.Stream.of(turn.getSequence(), turn.getSequence() - 1))
                .collect(Collectors.toSet());
        return turns.stream().filter(turn -> !failedSequences.contains(turn.getSequence())).toList();
    }
}
