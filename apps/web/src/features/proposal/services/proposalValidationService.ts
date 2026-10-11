import type { ProposalDraftRequest } from '@/api/hooks/useProposal'
import type { ProposalSection } from './proposalDraftService'

const FIELD_SECTIONS: Record<string, ProposalSection> = {
  problemStatement: 'PROBLEM', solutionStrategy: 'PROBLEM', components: 'PROBLEM',
  businessOutcomes: 'OUTCOMES', budget: 'OUTCOMES', budgetConfidence: 'OUTCOMES', budgetSource: 'OUTCOMES',
  timelineWeeks: 'TIMELINE', milestones: 'TIMELINE', risks: 'RISKS',
  assumptions: 'ASSUMPTIONS', evidenceLinks: 'ASSUMPTIONS',
}

const ISSUE_FIELDS: Record<string, string> = {
  PROBLEM_REQUIRED: 'problemStatement', SOLUTION_REQUIRED: 'solutionStrategy', OUTCOME_REQUIRED: 'businessOutcomes',
  RISK_COVERAGE: 'risks', TIMELINE_DETAIL: 'milestones', ASSUMPTIONS: 'assumptions',
  EVIDENCE_REQUIRED: 'evidenceLinks', INVALID_EVIDENCE_LINK: 'evidenceLinks',
  DIFFICULTY_EVIDENCE_COVERAGE: 'evidenceLinks', UNSUPPORTED_CLAIM: 'evidenceLinks',
}

/** Both completeness codes and nested request fields lead to the relevant editor section. */
export function proposalViolationLocation(code: string) {
  const field = ISSUE_FIELDS[code] ?? code.split(/[.\[]/)[0]
  const section = FIELD_SECTIONS[field]
  return section ? { field, section } : null
}

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
