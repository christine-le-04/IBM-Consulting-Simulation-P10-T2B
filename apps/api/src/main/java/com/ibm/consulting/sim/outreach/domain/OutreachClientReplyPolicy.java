package com.ibm.consulting.sim.outreach.domain;

import com.ibm.consulting.sim.ai.domain.OutreachEvaluationResult;

/** Keeps the client reply consistent with the engine's final outreach outcome. */
public final class OutreachClientReplyPolicy {

    private OutreachClientReplyPolicy() {}

    public static String replyFor(OutreachOutcome outcome, OutreachEvaluationResult evaluation) {
        if (outcome == OutreachOutcome.ACCEPTED) {
            return "Thank you for outlining your approach. I am happy to arrange an introductory meeting "
                    + "to discuss our priorities and whether your recommendation is a good fit. "
                    + "Please send a couple of times that work for you.";
        }
        if (outcome.name().equalsIgnoreCase(evaluation.outcome())) {
            return evaluation.clientReply();
        }
        return switch (outcome) {
            case FOLLOW_UP_REQUIRED -> "Before I can agree to a meeting, please send more detail on how "
                    + "your approach addresses our business priorities and what we would cover in the call.";
            case REJECTED -> "Thank you for reaching out. I am not prepared to arrange a meeting "
                    + "based on this proposal.";
            case ACCEPTED -> throw new IllegalStateException("Accepted outreach already has a meeting reply");
            case PENDING -> throw new IllegalStateException("Pending outreach has no resolved client reply");
        };
    }
}
