package com.ibm.consulting.sim.outreach.domain;

import com.ibm.consulting.sim.ai.domain.OutreachEvaluationResult;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OutreachClientReplyPolicyTest {

    @Test
    void acceptedOutcomeExplicitlyAgreesEvenWhenProviderDefersTheCall() {
        for (String suggestedOutcome : new String[]{"FOLLOW_UP_REQUIRED", "ACCEPTED", "REJECTED"}) {
            OutreachEvaluationResult evaluation = evaluation(
                    "I can't commit to a call just yet. Send more information and I'll think about setting a time.",
                    suggestedOutcome);
            assertThat(OutreachClientReplyPolicy.replyFor(OutreachOutcome.ACCEPTED, evaluation))
                    .contains("happy to arrange an introductory meeting")
                    .doesNotContain("can't commit", "think about setting a time");
        }
    }

    @Test
    void belowGateReplyDoesNotPromiseTheMeetingTheProviderSuggested() {
        String reply = OutreachClientReplyPolicy.replyFor(OutreachOutcome.FOLLOW_UP_REQUIRED,
                evaluation("Happy to meet next week.", "ACCEPTED"));
        assertThat(reply).contains("Before I can agree to a meeting").doesNotContain("Happy to meet");
        assertThat(OutreachRequestPolicy.nextActionFor(OutreachOutcome.FOLLOW_UP_REQUIRED, reply))
                .isEqualTo(OutreachNextAction.SEND_FOLLOW_UP);
    }

    @Test
    void alignedFollowUpKeepsTheSpecificCapabilityBriefRequest() {
        String reply = "Please send a one-page capability brief with case examples before I consider a call.";
        assertThat(OutreachClientReplyPolicy.replyFor(OutreachOutcome.FOLLOW_UP_REQUIRED,
                evaluation(reply, "FOLLOW_UP_REQUIRED"))).isEqualTo(reply);
        assertThat(OutreachRequestPolicy.nextActionFor(OutreachOutcome.FOLLOW_UP_REQUIRED, reply))
                .isEqualTo(OutreachNextAction.SUBMIT_CAPABILITY_BRIEF);
    }

    @Test
    void alignedRejectionKeepsTheClientExplanation() {
        String reply = "We are not considering this work at present.";
        assertThat(OutreachClientReplyPolicy.replyFor(OutreachOutcome.REJECTED,
                evaluation(reply, "REJECTED"))).isEqualTo(reply);
    }

    private OutreachEvaluationResult evaluation(String reply, String outcome) {
        return new OutreachEvaluationResult(reply, outcome, 80, 80, 80, 80, 0, 0);
    }
}
