import type { ProposalDraftRequest } from '@/api/hooks/useProposal'

const filled = (value: string) => value.trim().length > 0

/** Mirrors the backend completeness checks; server-only findings remain until resubmission. */
export function remainingProposalViolations(violations: Record<string, string>, draft: ProposalDraftRequest) {
  const resolved: Record<string, boolean> = {
    PROBLEM_REQUIRED: draft.problemStatement.trim().length >= 20,
    SOLUTION_REQUIRED: draft.solutionStrategy.trim().length >= 20 && draft.components.some(filled),
    OUTCOME_REQUIRED: draft.businessOutcomes.some((row) => filled(row.outcome) || filled(row.metric) || filled(row.target)),
    RISK_COVERAGE: draft.risks.some((row) => filled(row.risk) || filled(row.mitigation)),
    TIMELINE_DETAIL: draft.milestones.some((row) => filled(row.phase) || filled(row.duration)),
    ASSUMPTIONS: draft.assumptions.some(filled),
    EVIDENCE_REQUIRED: draft.evidenceLinks.length > 0,
  }
  return Object.fromEntries(Object.entries(violations).filter(([field]) => !resolved[field]))
}
