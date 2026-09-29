import type { ResearchEvidence } from '@/api/types'

export function evidenceCode(sequenceNo: number) {
  return `E-${String(sequenceNo).padStart(2, '0')}`
}

/** Evidence the learner can build on: findings, not hypotheses or contradicted items. */
export function usableEvidence(evidence: ResearchEvidence[] | undefined): ResearchEvidence[] {
  return (evidence ?? [])
    .filter((item) => item.evidenceType !== 'HYPOTHESIS' && item.verificationStatus !== 'CONTRADICTED')
    .sort((a, b) => b.sequenceNo - a.sequenceNo)
}

/** The learner's latest problem hypothesis, if any. */
export function currentHypothesis(evidence: ResearchEvidence[] | undefined): ResearchEvidence | undefined {
  return (evidence ?? [])
    .filter((item) => item.evidenceType === 'HYPOTHESIS')
    .sort((a, b) => b.sequenceNo - a.sequenceNo)[0]
}
