package com.ibm.consulting.sim.proposal.application;

import com.ibm.consulting.sim.proposal.domain.*;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class ProposalValidationEngineTest {

    private static final ProposalSource EVIDENCE = new ProposalSource(
            "evidence:1", "E-01 Operational impact", "RESEARCH_EVIDENCE",
            "Manual reconciliation is creating audit delays and operational risk.", "HIGH");

    @Test
    void reportsAllCompletenessFindingsForTheBlankStudioDraft() {
        ProposalDraftContent empty = new ProposalDraftContent("", "", List.of(""), BigDecimal.ZERO,
                8, "UNCONFIRMED", "Consultant estimate",
                List.of(new ProposalBusinessOutcome("", "", "")),
                List.of(new ProposalMilestone("", "")),
                List.of(new ProposalRisk("", "MEDIUM", "")), List.of(""), List.of());

        List<ProposalValidationIssue> issues = ProposalValidationEngine.validate(empty, List.of());

        assertThat(issues).extracting(ProposalValidationIssue::code).containsExactly(
                "PROBLEM_REQUIRED", "SOLUTION_REQUIRED", "OUTCOME_REQUIRED", "RISK_COVERAGE",
                "TIMELINE_DETAIL", "ASSUMPTIONS", "EVIDENCE_REQUIRED");
        assertThat(issues).filteredOn(issue -> issue.code().equals("RISK_COVERAGE")
                || issue.code().equals("TIMELINE_DETAIL")).allMatch(issue -> issue.severity().equals("WARNING"));
    }

    @Test
    void requiresTraceableEvidenceBeforeSubmission() {
        ProposalDraftContent draft = draft(List.of());

        List<ProposalValidationIssue> issues = ProposalValidationEngine.validate(draft, List.of(EVIDENCE));

        assertThat(issues).anyMatch(issue -> issue.code().equals("EVIDENCE_REQUIRED")
                && issue.severity().equals("BLOCKING"));
    }

    @Test
    void recognisesGroundedProposalWithLinkedSource() {
        ProposalDraftContent draft = draft(List.of(new ProposalEvidenceLink("PROBLEM", "evidence:1")));

        List<ProposalValidationIssue> issues = ProposalValidationEngine.validate(draft, List.of(EVIDENCE));

        assertThat(issues).noneMatch(issue -> issue.severity().equals("BLOCKING"));
        assertThat(ProposalValidationEngine.evidenceScore(draft, List.of(EVIDENCE))).isEqualTo(100);
    }

    private ProposalDraftContent draft(List<ProposalEvidenceLink> evidenceLinks) {
        return new ProposalDraftContent(
                "Manual reconciliation is causing audit delays and operational risk across the network.",
                "Run a controlled integration pilot with early validation and a rollback plan.",
                List.of("Integration pilot"), BigDecimal.valueOf(150_000), 8,
                "MEDIUM", "Consultant estimate",
                List.of(new ProposalBusinessOutcome("Reduce reconciliation effort", "Hours per case", "30% reduction")),
                List.of(new ProposalMilestone("Workflow mapping", "Week 1-2")),
                List.of(new ProposalRisk("Legacy integration", "HIGH", "Validate adapters before pilot")),
                List.of("Client SMEs are available for validation"), evidenceLinks);
    }
}
