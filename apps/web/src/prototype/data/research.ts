/**
 * The research source deck (GET /research-source-deck), lead intelligence
 * (GET /lead-intelligence) and the evidence already on the board.
 *
 * FR-05 asks for incomplete or irrelevant material on purpose, so the deck
 * keeps a low-trust vendor document and a distractor alongside the good ones.
 */
import type {
  EvidenceType,
  LeadIntelligence,
  ResearchArtifact,
  ResearchEvidence,
  ResearchGateStatus,
  ResearchSourceBlock,
} from '@/api/types'

let blockId = 0
function fact(content: string, type: ResearchSourceBlock['type'] = 'PARAGRAPH', attribution: string | null = null): ResearchSourceBlock {
  blockId += 1
  return { id: `b${blockId}`, type, content, attribution, factIds: [], corpusChunkIds: [], selectable: true, purpose: 'FACT' }
}

export const SOURCES: ResearchArtifact[] = [
  {
    id: 'src-news-1',
    title: 'Regional network delays clinical systems review as winter pressures mount',
    sourceType: 'Health Service Journal',
    summary: 'MediCare has pushed its clinical data review into the second half of the year, and staff describe entering the same details three times per admission.',
    evidenceType: 'COMPANY_NEWS',
    confidence: 'MEDIUM',
    origin: 'SCENARIO_CURATED',
    publishedOn: '14 March 2026',
    relevanceScore: 86,
    allowedFactKeys: [],
    correlatesWithEvidence: [],
    relevanceRationale: '',
    blocks: [
      fact('MediCare Regional Hospital Network has postponed a planned review of its clinical data systems until the second half of the year, citing sustained emergency admissions across its twelve sites.'),
      fact('Internal scheduling documents seen by this publication show that the review, originally due in February, has been moved twice.'),
      fact('Staff at two of the larger sites describe having to re-enter patient details into three separate systems during a single admission.'),
      fact('“Integration is the single biggest drag on clinical time we have.”', 'QUOTE', 'Sarah Chen, Chief Operating Officer, speaking at a regional health forum'),
      fact('Chen declined to commit to a timetable. A regulatory service review of the network is scheduled for the autumn.'),
      fact('Analysts note that the network’s IT budget has been flat for three consecutive years while patient volume has risen by an estimated eleven per cent over the same period.'),
      fact('11% — estimated rise in patient volume over three years', 'METRIC'),
      fact('A spokesperson said the network “remains committed to digital improvement within existing resources”.'),
      fact('Nurses at the Ashford site, photographed during the evening handover.', 'CAPTION'),
    ],
  },
  {
    id: 'src-news-2',
    title: 'Autumn service review confirmed for regional networks',
    sourceType: 'Regulator bulletin',
    summary: 'The regulator confirms MediCare is assessed in the autumn window, with a focus on record-keeping and data reliability.',
    evidenceType: 'COMPANY_NEWS',
    confidence: 'HIGH',
    origin: 'SCENARIO_CURATED',
    publishedOn: '2 April 2026',
    relevanceScore: 72,
    allowedFactKeys: [],
    correlatesWithEvidence: [],
    relevanceRationale: '',
    blocks: [
      fact('The regulator has confirmed this year’s service review schedule, with regional hospital networks including MediCare due to be assessed in the autumn window.'),
      fact('Reviews will examine clinical record-keeping and the reliability of reported activity data.'),
      fact('Networks must submit supporting documentation eight weeks before their assessment date.'),
      fact('8 weeks — documentation lead time before assessment', 'METRIC'),
      fact('The bulletin does not name any network with outstanding findings.'),
      fact('Previous cycles saw three networks given improvement notices on data quality.'),
    ],
  },
  {
    id: 'src-fin-1',
    title: 'Filed accounts — margin down, maintenance up',
    sourceType: 'Companies House filing · audited',
    summary: 'Revenue grew slightly but operating margin fell to 1.8%. IT capital is flat; legacy maintenance is rising.',
    evidenceType: 'FINANCIAL_SIGNAL',
    confidence: 'HIGH',
    origin: 'SCENARIO_CURATED',
    publishedOn: '30 June 2026',
    relevanceScore: 91,
    allowedFactKeys: [],
    correlatesWithEvidence: [],
    relevanceRationale: '',
    blocks: [
      fact('Revenue for the year was £412m against £406m the year before, but operating margin fell from 3.1 per cent to 1.8 per cent.'),
      fact('1.8% — operating margin, down from 3.1%', 'METRIC'),
      fact('IT capital expenditure was held at £6.1m for the third consecutive year.'),
      fact('The recurring maintenance line rose to £4.4m; a note attributes part of the growth to “support for legacy platforms retained beyond planned replacement”.'),
      fact('No integration programme appears anywhere in the capital plan.'),
      fact('Any such work would have to be funded from within existing divisional budgets, or argued as a new case against a margin that is already thin.'),
    ],
  },
  {
    id: 'src-stake-1',
    title: 'Sarah Chen — Chief Operating Officer',
    sourceType: 'Professional profile · verified',
    summary: 'Four years as COO; sits on the capital committee and can approve spend above the divisional threshold.',
    evidenceType: 'STAKEHOLDER_PROFILE',
    confidence: 'HIGH',
    origin: 'SCENARIO_CURATED',
    publishedOn: '1 September 2026',
    relevanceScore: 94,
    allowedFactKeys: [],
    correlatesWithEvidence: [],
    relevanceRationale: '',
    blocks: [
      fact('Sarah Chen has held the chief operating officer post for four years, having joined from a mid-size acute trust where she led a patient-flow programme.'),
      fact('That programme reportedly reduced admission-to-bed time by nineteen per cent.'),
      fact('She sits on the capital committee and is one of two executives who can approve spend above the divisional threshold without board escalation.'),
      fact('Colleagues describe her as direct and impatient with abstraction, quick to ask what a proposal will cost clinical teams in the first ninety days.'),
      fact('“Vendors sell the destination and leave you the journey.”', 'QUOTE', 'Sarah Chen, NHS Providers conference, 2025'),
      fact('Her stated priority this year is protecting front-line capacity through the autumn regulatory review.'),
    ],
  },
  {
    id: 'src-stake-2',
    title: 'Clinical director voices frustration at duplicate data entry',
    sourceType: 'Conference panel transcript',
    summary: 'Dr Alan Whitfield describes nurses entering details three times, but holds no budget for a fix.',
    evidenceType: 'STAKEHOLDER_PROFILE',
    confidence: 'MEDIUM',
    origin: 'SCENARIO_CURATED',
    publishedOn: '19 March 2026',
    relevanceScore: 68,
    allowedFactKeys: [],
    correlatesWithEvidence: [],
    relevanceRationale: '',
    blocks: [
      fact('Speaking on a panel about digital maturity, clinical director Dr Alan Whitfield described nursing staff entering the same patient details “more than once, sometimes three times” during a single admission.'),
      fact('He estimated the overhead at a meaningful share of each shift but gave no measured figure, calling it “what everyone on the ward already knows”.'),
      fact('He noted he does not hold the budget for a fix.'),
      fact('He pointed to the chief operating officer as the person who would need to sponsor one.'),
    ],
  },
  {
    id: 'src-tech-1',
    title: 'Three patient record systems across twelve sites',
    sourceType: 'Vendor case study · unverified',
    summary: 'A supplier-authored case study claims three record systems inherited from mergers, with a stalled pilot interface.',
    evidenceType: 'TECHNOLOGY_INDICATOR',
    confidence: 'LOW',
    origin: 'AI_SYNTHESIZED',
    publishedOn: '8 May 2025',
    relevanceScore: 44,
    allowedFactKeys: [],
    correlatesWithEvidence: [],
    relevanceRationale: '',
    blocks: [
      fact('A vendor case study, published by a supplier and not independently confirmed, states that the network operates three distinct patient record systems inherited from earlier mergers.'),
      fact('It describes interoperability between them as limited.'),
      fact('The same document claims a pilot interface was built between two of the systems but was never extended to the third.'),
      fact('3 — patient record systems claimed across twelve sites', 'METRIC'),
      fact('The supplier names itself as the pilot’s delivery partner.'),
      fact('Treat the specifics with caution: this is marketing material and its figures have not been corroborated elsewhere.'),
    ],
  },
]

export const SOURCES_BY_TYPE: Partial<Record<EvidenceType, ResearchArtifact[]>> = SOURCES.reduce(
  (byType, source) => ({ ...byType, [source.evidenceType]: [...(byType[source.evidenceType] ?? []), source] }),
  {} as Partial<Record<EvidenceType, ResearchArtifact[]>>,
)

/** Research areas, exactly as ClientIntelligencePage offers them. */
export const RESEARCH_AREAS: { type: EvidenceType; label: string; prompt: string }[] = [
  { type: 'COMPANY_NEWS', label: 'Company News', prompt: 'Uncover relevant public signals and business pressure.' },
  { type: 'STAKEHOLDER_PROFILE', label: 'Stakeholder Research', prompt: 'Identify decision makers, priorities and influence.' },
  { type: 'FINANCIAL_SIGNAL', label: 'Financial Signals', prompt: 'Uncover commercial and funding indicators.' },
  { type: 'TECHNOLOGY_INDICATOR', label: 'Technology Research', prompt: 'Understand systems, architecture constraints and readiness.' },
]

export const SEED_EVIDENCE: ResearchEvidence[] = [
  {
    id: 'ev-1', engagementId: 'eng-medicare', sequenceNo: 1,
    note: 'Staff at two of the larger sites describe having to re-enter patient details into three separate systems during a single admission.\n\nConsulting takeaway: The pain is clinical time, not IT cost — that is the language to use with the COO.',
    hypothesis: null, evidenceType: 'COMPANY_NEWS', sourceUrl: null,
    sourceTitle: 'Regional network delays clinical systems review as winter pressures mount',
    origin: 'SCENARIO_CURATED', verificationStatus: 'CORROBORATED', occurredOn: '14 March 2026',
    confidence: 'MEDIUM', relevanceScore: 86, reasoningLane: 'SYMPTOM', supportingEvidenceIds: [], createdAt: '2026-09-22T10:00:00Z',
  },
  {
    id: 'ev-2', engagementId: 'eng-medicare', sequenceNo: 2,
    note: 'IT capital expenditure was held at £6.1m for the third consecutive year.\n\nConsulting takeaway: A large upfront programme will not clear; a staged or divisionally funded case might.',
    hypothesis: null, evidenceType: 'FINANCIAL_SIGNAL', sourceUrl: null,
    sourceTitle: 'Filed accounts — margin down, maintenance up',
    origin: 'SCENARIO_CURATED', verificationStatus: 'VERIFIED', occurredOn: '30 June 2026',
    confidence: 'HIGH', relevanceScore: 91, reasoningLane: 'STAKEHOLDER_CONSTRAINT', supportingEvidenceIds: [], createdAt: '2026-09-22T10:20:00Z',
  },
]

/**
 * Mirrors the backend ResearchReadinessPolicy closely enough to drive the
 * strip line and the Notes gate. The real numbers come from GET /research-readiness.
 */
export function gateFor(evidence: ResearchEvidence[]): ResearchGateStatus {
  const items = evidence.filter((item) => item.evidenceType !== 'HYPOTHESIS')
  const hypotheses = evidence.filter((item) => item.evidenceType === 'HYPOTHESIS')
  const areas = new Set(items.map((item) => item.evidenceType))
  const grounded = hypotheses.some((item) => item.supportingEvidenceIds.length >= 2)
  const stakeholder = items.some((item) => item.evidenceType === 'STAKEHOLDER_PROFILE')
  const confidencePercent = Math.min(100, items.length * 14 + areas.size * 8 + (grounded ? 12 : 0))
  const ready = items.length >= 2 && stakeholder && areas.size >= 2 && grounded && confidencePercent >= 40
  const coaching = !stakeholder
    ? ['You have not identified who could approve this. Read the stakeholder material before writing a hypothesis.']
    : areas.size < 2
      ? ['All your evidence comes from one area. Look somewhere else before you commit to a view.']
      : !hypotheses.length
        ? ['You have enough to form a view. Write the hypothesis and cite what supports it.']
        : !grounded
          ? ['Your hypothesis cites fewer than two pieces of evidence. Link what supports it.']
          : ['You have enough to go on. Choose who to contact when you are ready.']
  return {
    researchCompleted: false,
    evidenceCount: items.length,
    requiredEvidenceCount: 2,
    hasStakeholderEvidence: stakeholder,
    hasHypothesis: hypotheses.length > 0,
    confidencePercent,
    requiredConfidencePercent: 40,
    ready,
    coverageCount: areas.size,
    requiredCoverageCount: 2,
    groundedHypothesis: grounded,
    reliabilityScore: 0,
    verificationScore: 0,
    relevanceScore: 0,
    coaching,
  }
}

/** Revealed as evidence accumulates (reveal rules, admin-authored). */
export function intelligenceFor(evidence: ResearchEvidence[]): LeadIntelligence {
  const has = (type: EvidenceType) => evidence.filter((item) => item.evidenceType === type).map((item) => item.sequenceNo)
  const stake = has('STAKEHOLDER_PROFILE')
  const fin = has('FINANCIAL_SIGNAL')
  const tech = has('TECHNOLOGY_INDICATOR')
  const news = has('COMPANY_NEWS')
  return {
    leadId: 'lead-medicare',
    companyName: 'MediCare Regional Hospital Network',
    industry: 'Healthcare',
    evidenceCount: evidence.length,
    confidenceLabel: evidence.length >= 4 ? 'HIGH' : evidence.length >= 2 ? 'MEDIUM' : 'LOW',
    confidenceScore: 0,
    confidenceFactors: [],
    decisionMaker: { value: stake.length ? 'Sarah Chen, Chief Operating Officer' : null, supportingEvidence: stake },
    budgetSignal: { value: fin.length ? 'Capital flat three years; fund from divisional budget or stage it' : null, supportingEvidence: fin },
    painSeverity: { value: news.length ? 'High — duplicate entry up to three times per admission' : null, supportingEvidence: news },
    technologyStack: { value: tech.length ? 'Three record systems (unverified vendor claim)' : null, supportingEvidence: tech },
    potentialValueRange: { value: fin.length && stake.length ? '£0.6m – £1.4m first phase' : null, supportingEvidence: [...fin, ...stake] },
  }
}

export interface ReadinessItem {
  label: string
  done: boolean
}

/**
 * The outreach readiness conditions, in words only (FR-14): no counts, no
 * percentages. Confidence is left out — it follows from the four below.
 */
export function readinessFor(gate: ResearchGateStatus): ReadinessItem[] {
  return [
    { label: 'At least two pieces of evidence', done: gate.evidenceCount >= gate.requiredEvidenceCount },
    { label: 'You know who makes the decision', done: gate.hasStakeholderEvidence },
    { label: 'Evidence from two different areas', done: gate.coverageCount >= gate.requiredCoverageCount },
    { label: 'Your hypothesis cites its evidence', done: gate.groundedHypothesis },
  ]
}
