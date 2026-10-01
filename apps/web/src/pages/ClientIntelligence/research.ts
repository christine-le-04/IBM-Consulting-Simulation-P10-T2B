/**
 * Research vocabulary shared by the desk: the four research areas, trust as a
 * word (never a relevance percentage, SRS FR-14), and the outreach readiness
 * checklist in words.
 */
import type { ConfidenceLevel, EvidenceType, ResearchArtifact, ResearchGateStatus, ResearchSourceDeck } from '@/api/types'
import type { ReadinessItem } from '@/components/shell/shellStore'

export type ResearchArea = Exclude<EvidenceType, 'HYPOTHESIS' | 'MARKET_TREND' | 'OTHER'>

export const RESEARCH_AREAS: { type: ResearchArea; label: string; prompt: string }[] = [
  { type: 'COMPANY_NEWS', label: 'Company News', prompt: 'Uncover relevant public signals and business pressure.' },
  { type: 'STAKEHOLDER_PROFILE', label: 'Stakeholder Research', prompt: 'Identify decision makers, priorities and influence.' },
  { type: 'FINANCIAL_SIGNAL', label: 'Financial Signals', prompt: 'Uncover commercial and funding indicators.' },
  { type: 'TECHNOLOGY_INDICATOR', label: 'Technology Research', prompt: 'Understand systems, architecture constraints and readiness.' },
]

export const TRUST_LABEL: Record<ConfidenceLevel, string> = { HIGH: 'High trust', MEDIUM: 'Medium trust', LOW: 'Low trust' }

/** Every source in the deck, one list, in research-area order. */
export function deckSources(deck: ResearchSourceDeck | undefined): ResearchArtifact[] {
  if (!deck) return []
  return RESEARCH_AREAS.flatMap((area) => deck.sourcesByType[area.type] ?? [])
}

/**
 * The outreach readiness conditions, in words only. Research confidence is
 * left out: it follows from the four below.
 */
export function readinessFor(gate: ResearchGateStatus | undefined): ReadinessItem[] {
  return [
    { label: 'Attach at least two pieces of evidence', done: Boolean(gate && gate.evidenceCount >= gate.requiredEvidenceCount) },
    { label: 'Attach stakeholder evidence', done: Boolean(gate?.hasStakeholderEvidence) },
    { label: 'Evidence must cover at least two different areas', done: Boolean(gate && gate.coverageCount >= gate.requiredCoverageCount) },
    { label: 'Create a grounded hypothesis with sufficient evidence cited', done: Boolean(gate?.groundedHypothesis) },
  ]
}
