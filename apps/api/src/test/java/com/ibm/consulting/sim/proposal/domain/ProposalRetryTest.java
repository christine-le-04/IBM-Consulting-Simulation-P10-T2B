package com.ibm.consulting.sim.proposal.domain;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import static org.assertj.core.api.Assertions.*;

class ProposalRetryTest {
    @Test
    void winningAnySubmissionEndsRevisionEligibility() {
        ProposalDraftContent draft = new ProposalDraftContent("Problem", "Solution", List.of(),
                BigDecimal.ONE, 1, "LOW", "", List.of(), List.of(), List.of(), List.of(), List.of());
        Proposal proposal = Proposal.draft(UUID.randomUUID(), draft);
        proposal.submit();
        proposal.resolve(new ProposalDecisionSnapshot(ClientDecisionOutcome.REVISION_REQUESTED, 60, 60, 60,
                List.of(), List.of(), List.of(), "Needs revision"), "Please revise");
        assertThat(proposal.getDecision()).isEqualTo(ProposalDecision.LOST);
        assertThat(proposal.isRevisionAvailable()).isTrue();
        proposal.reopenForRevision();
        proposal.submit();
        proposal.resolve(new ProposalDecisionSnapshot(ClientDecisionOutcome.PROPOSAL_ACCEPTED, 75, 75, 75,
                List.of(), List.of(), List.of(), "Accepted"), "Accepted");
        assertThat(proposal.getDecision()).isEqualTo(ProposalDecision.WON);
        assertThat(proposal.getSubmissionCount()).isEqualTo(2);
        assertThat(proposal.isRevisionAvailable()).isFalse();
        assertThatThrownBy(proposal::reopenForRevision).isInstanceOf(IllegalStateException.class);
    }
}
