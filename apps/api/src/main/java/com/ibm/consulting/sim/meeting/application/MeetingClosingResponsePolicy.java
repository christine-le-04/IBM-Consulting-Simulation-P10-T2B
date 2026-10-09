package com.ibm.consulting.sim.meeting.application;

import com.ibm.consulting.sim.ai.domain.PersonaTurnResponse;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Enforces the simulation engine's closing decision when a dialogue provider
 * tries to close too early or prolong a passed meeting.
 */
final class MeetingClosingResponsePolicy {

    private static final Pattern GOODBYE = Pattern.compile(
            "\\b(goodbye|good bye|see you (on|next|tomorrow|soon)|ending (this|the) meeting)\\b",
            Pattern.CASE_INSENSITIVE);

    private static final String CLOSING_RESPONSE = "That gives me enough confidence to take the agreed next step forward. "
            + "Please send the concise summary we discussed, and I will coordinate the follow-up with the right people. "
            + "Thank you for the conversation; I look forward to reconnecting next week.";

    private MeetingClosingResponsePolicy() {
    }

    static PersonaTurnResponse keepOpen(PersonaTurnResponse response) {
        if (response.meetingSignals().stream().noneMatch(signal ->
                signal.equals("client_ready_to_close") || signal.equals("client_committed_next_step"))
                && !GOODBYE.matcher(response.spokenResponse()).find()) {
            return response;
        }
        return new PersonaTurnResponse(
                "Before we wrap up, let's clarify the priorities, constraints and success measures for the next step. "
                        + "What would you like to confirm with me?",
                response.detectedLearnerBehaviours(), response.stateDelta(), response.factsDisclosed(),
                response.objectionRaised(), response.meetingSignals().stream()
                        .filter(signal -> !signal.equals("client_ready_to_close")
                                && !signal.equals("client_committed_next_step")).toList(),
                response.safety(), response.guidedResponseOptions());
    }

    static PersonaTurnResponse conclude(PersonaTurnResponse response) {
        LinkedHashSet<String> signals = new LinkedHashSet<>(response.meetingSignals());
        signals.remove("client_concern_raised");
        signals.add("client_committed_next_step");
        signals.add("client_ready_to_close");

        return new PersonaTurnResponse(
                CLOSING_RESPONSE,
                response.detectedLearnerBehaviours(),
                response.stateDelta(),
                response.factsDisclosed(),
                null,
                List.copyOf(signals),
                response.safety(),
                List.of());
    }

    static PersonaTurnResponse endWithoutAgreement(PersonaTurnResponse response, boolean timeLimitReached) {
        String closing = timeLimitReached
                ? "We have reached the end of our time today. I need clearer agreement on the priorities, constraints "
                        + "and success measures before we can move forward. Thank you for the conversation."
                : "I do not have enough confidence to continue this discussion today. Let's pause here. "
                        + "We can revisit this when the outstanding concerns have been addressed.";
        return new PersonaTurnResponse(closing, response.detectedLearnerBehaviours(), response.stateDelta(),
                response.factsDisclosed(), null, response.meetingSignals().stream()
                        .filter(signal -> !signal.equals("client_ready_to_close")
                                && !signal.equals("client_committed_next_step")
                                && !signal.equals("client_concern_raised")).toList(),
                response.safety(), List.of());
    }
}
