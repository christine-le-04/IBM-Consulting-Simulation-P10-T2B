import { describe, expect, it } from 'vitest'
import { createEmptyProposalDraft } from './proposalDraftService'
import { proposalViolationLocation, remainingProposalViolations } from './proposalValidationService'

const completeness = {
  PROBLEM_REQUIRED: 'Problem', SOLUTION_REQUIRED: 'Solution', OUTCOME_REQUIRED: 'Outcome',
  RISK_COVERAGE: 'Risks', TIMELINE_DETAIL: 'Milestones', ASSUMPTIONS: 'Assumptions', EVIDENCE_REQUIRED: 'Evidence',
}

describe('proposal validation after edits', () => {
  it('locates completeness and nested field findings without hiding unknown findings', () => {
    expect(proposalViolationLocation('SOLUTION_REQUIRED')).toEqual({ field: 'solutionStrategy', section: 'PROBLEM' })
    expect(proposalViolationLocation('risks[1].severity')).toEqual({ field: 'risks', section: 'RISKS' })
    expect(proposalViolationLocation('budget')).toEqual({ field: 'budget', section: 'OUTCOMES' })
    expect(proposalViolationLocation('INVALID_EVIDENCE_LINK')).toEqual({ field: 'evidenceLinks', section: 'ASSUMPTIONS' })
    expect(proposalViolationLocation('FUTURE_RULE')).toBeNull()
  })
  it('retains all findings for a blank draft or a single character', () => {
    const draft = createEmptyProposalDraft()
    expect(remainingProposalViolations(completeness, draft)).toEqual(completeness)
    expect(remainingProposalViolations(completeness, { ...draft, problemStatement: '.' })).toEqual(completeness)
  })

  it('checks the trimmed minimum length and restores the finding if the field becomes invalid again', () => {
    const draft = createEmptyProposalDraft()
    const errors = { PROBLEM_REQUIRED: 'Problem', SOLUTION_REQUIRED: 'Solution' }
    expect(remainingProposalViolations(errors, { ...draft, problemStatement: ' '.repeat(20) })).toEqual(errors)
    expect(remainingProposalViolations(errors, { ...draft, problemStatement: 'a'.repeat(19) })).toEqual(errors)
    expect(remainingProposalViolations(errors, { ...draft, problemStatement: 'a'.repeat(20) }))
      .toEqual({ SOLUTION_REQUIRED: 'Solution' })
    expect(remainingProposalViolations(errors, { ...draft, problemStatement: '' })).toEqual(errors)
  })

  it('requires both a sufficient solution description and a meaningful component', () => {
    const draft = { ...createEmptyProposalDraft(), solutionStrategy: 'a'.repeat(20), components: [' '] }
    const errors = { SOLUTION_REQUIRED: 'Solution' }
    expect(remainingProposalViolations(errors, draft)).toEqual(errors)
    expect(remainingProposalViolations(errors, { ...draft, solutionStrategy: '.', components: ['Pilot'] })).toEqual(errors)
    expect(remainingProposalViolations(errors, { ...draft, components: ['Pilot'] })).toEqual({})
  })

  it('keeps empty default rows invalid and clears completeness findings only for meaningful content', () => {
    const draft = createEmptyProposalDraft()
    expect(remainingProposalViolations(completeness, {
      ...draft, problemStatement: 'a'.repeat(20), solutionStrategy: 'a'.repeat(20), components: ['Pilot'],
      businessOutcomes: [{ outcome: '', metric: 'Downtime', target: '' }],
      risks: [{ risk: '', severity: 'MEDIUM', mitigation: 'Pilot first' }],
      milestones: [{ phase: 'Pilot', duration: '' }], assumptions: ['Budget approval'],
      evidenceLinks: [{ section: 'PROBLEM', sourceId: 'source-1' }],
    })).toEqual({})
  })

  it('retains server-only, unknown and nested field findings even when content changes', () => {
    const errors = {
      INVALID_EVIDENCE_LINK: 'Invalid source', DIFFICULTY_EVIDENCE_COVERAGE: 'Coverage',
      UNSUPPORTED_CLAIM: 'Check claims', 'risks[0].severity': 'Invalid severity', FUTURE_RULE: 'New rule',
    }
    expect(remainingProposalViolations(errors, {
      ...createEmptyProposalDraft(), evidenceLinks: [{ section: 'PROBLEM', sourceId: 'source-1' }],
      risks: [{ risk: 'Delay', severity: 'MEDIUM', mitigation: 'Pilot first' }],
    })).toEqual(errors)
  })
})
