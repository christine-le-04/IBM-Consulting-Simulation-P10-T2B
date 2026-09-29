/**
 * One scenario, played end to end (SRS §2: "one scenario with one AI client").
 * Shapes are the real API types, so these fixtures double as a contract check.
 */
import type {
  AchievementSummary,
  Engagement,
  LeadSummary,
  PersonaSummary,
  PortfolioSummary,
  ScenarioSummary,
} from '@/api/types'
import { CATALOGUE_ROWS } from './catalogue'

export const LEARNER_NAME = 'Vince Tran'

export const PERSONA: PersonaSummary = {
  id: 'persona-sarah',
  name: 'Sarah Chen',
  jobTitle: 'Chief Operating Officer',
  organisation: 'MediCare Regional Hospital Network',
  communicationStyle: 'Direct, impatient with abstraction, asks about cost to clinical teams in the first ninety days.',
  visibleConcerns: 'Front-line capacity through the autumn regulatory review.',
}

export const SECOND_PERSONA: PersonaSummary = {
  id: 'persona-alan',
  name: 'Dr Alan Whitfield',
  jobTitle: 'Clinical Director',
  organisation: 'MediCare Regional Hospital Network',
  communicationStyle: 'Warm, anecdotal, frustrated by duplicate data entry on the wards.',
  visibleConcerns: 'Nursing time lost to re-entering patient details.',
}

export const SCENARIO: ScenarioSummary = {
  id: 'scn-medicare',
  title: 'Clinical systems integration for a regional hospital network',
  industry: 'Healthcare',
  description:
    'A twelve-site hospital network re-enters patient data across three record systems. The COO calls integration the biggest drag on clinical time, but capital is flat.',
  difficulty: 3,
  version: 4,
  status: 'PUBLISHED',
  personas: [PERSONA, SECOND_PERSONA],
  rubricWeights: { research: 0.25, outreach: 0.15, meeting: 0.3, proposal: 0.3 },
  difficultyProfile: { informationAmbiguity: 3, stakeholderComplexity: 4, commercialPressure: 4 },
  briefing: {
    consultantRole: 'Associate Consultant, IBM Consulting — Health',
    objective:
      'Find the problem the client will actually fund, earn a discovery meeting, and propose a first step they can approve.',
    successCriteria: [
      'Name the stakeholder who can approve spend above the divisional threshold',
      'Ground the hypothesis in at least two research areas',
      'Leave the meeting with an agreed next step',
    ],
    simulatedDays: 21,
    businessSituation: 'Twelve hospitals formed through mergers, running three patient record systems with limited interoperability.',
    observableSymptom: 'Nursing staff re-enter the same patient details up to three times during a single admission.',
    consultingMandate: 'Diagnose where integration effort would release the most clinical time, within a flat capital budget.',
    unknownsToValidate: [
      'Who owns the budget for a fix',
      'Whether the regulator review changes the timeline',
      'How much clinical time is really lost',
    ],
  },
}

export const LEADS: LeadSummary[] = [
  {
    id: 'lead-medicare',
    companyName: 'MediCare Regional Hospital Network',
    industry: 'Healthcare',
    publicDescription: 'Twelve-site regional network formed through three mergers since 2014. Reported record-keeping findings at its last service review.',
    difficulty: 'MEDIUM',
    signals: [
      { id: 's1', label: 'clinical systems review postponed twice', category: 'NEWS' },
      { id: 's2', label: 'IT budget flat for three years', category: 'FINANCIAL' },
      { id: 's3', label: 'regulator review due in autumn', category: 'REGULATORY' },
    ],
  },
  {
    id: 'lead-northgate',
    companyName: 'Northgate Community Health Trust',
    industry: 'Healthcare',
    publicDescription: 'Community services provider covering 1.2m residents. New chief executive announced a digital strategy refresh.',
    difficulty: 'EASY',
    signals: [
      { id: 's4', label: 'new chief executive', category: 'LEADERSHIP' },
      { id: 's5', label: 'digital strategy refresh', category: 'STRATEGY' },
    ],
  },
  {
    id: 'lead-bayside',
    companyName: 'Bayside Private Hospitals',
    industry: 'Healthcare',
    publicDescription: 'Private group of four hospitals. Recently acquired by an investment fund seeking operating-cost reductions.',
    difficulty: 'HARD',
    signals: [
      { id: 's6', label: 'new private-equity owner', category: 'OWNERSHIP' },
      { id: 's7', label: 'cost reduction target', category: 'FINANCIAL' },
      { id: 's8', label: 'two senior departures', category: 'LEADERSHIP' },
    ],
  },
]

export const ENGAGEMENT: Engagement = {
  id: 'eng-medicare',
  userId: 'user-vince',
  scenarioId: SCENARIO.id,
  personaId: PERSONA.id,
  state: 'OUTREACHING',
  selectedLeadId: 'lead-medicare',
  createdAt: '2026-09-21T09:14:00Z',
  completedAt: null,
  events: [],
  scenarioTitle: SCENARIO.title,
  scenarioIndustry: 'Healthcare',
  leadCompanyName: 'MediCare Regional Hospital Network',
  phase: 'OUTREACH',
  phaseLabel: 'Make contact',
  progressPercent: 30,
  nextAction: 'Reply to Sarah Chen with the capability brief she asked for.',
  evidenceCount: 4,
  daysElapsed: 6,
  meetingId: 'mtg-1',
}

/** Other runs the hub has to list — including one that needs a meeting retry. */
export const OTHER_ENGAGEMENTS: Engagement[] = [
  {
    ...ENGAGEMENT,
    id: 'eng-harbour',
    scenarioId: 'scn-harbour',
    state: 'PROPOSAL_SUBMITTED',
    scenarioTitle: 'Port logistics visibility for a freight operator',
    scenarioIndustry: 'Transport & Logistics',
    leadCompanyName: 'Harbourline Freight',
    phase: 'OUTCOME',
    phaseLabel: 'Their decision',
    progressPercent: 80,
    nextAction: 'Wait for Harbourline to decide on your proposal.',
    createdAt: '2026-09-12T10:00:00Z',
  },
  {
    ...ENGAGEMENT,
    id: 'eng-kestrel',
    scenarioId: 'scn-kestrel',
    state: 'MEETING_FAILED',
    scenarioTitle: 'Claims automation for a mid-size insurer',
    scenarioIndustry: 'Insurance',
    leadCompanyName: 'Kestrel Mutual',
    phase: 'LIVE_MEETING',
    phaseLabel: 'The meeting',
    progressPercent: 50,
    nextAction: 'Read the debrief, then retry the meeting (1 retry left).',
    createdAt: '2026-09-18T15:20:00Z',
  },
]

export const CATALOGUE: ScenarioSummary[] = [
  SCENARIO,
  ...CATALOGUE_ROWS.map((row, index) => ({
    ...SCENARIO,
    id: `scn-${index}`,
    title: row.title,
    industry: row.industry,
    description: row.description,
    difficulty: row.difficulty,
    personas: [PERSONA],
  })),
]

export const CATALOGUE_INDUSTRIES = CATALOGUE.map((scenario) => scenario.industry).sort()
export const CATALOGUE_TOTAL = 2148

export const PORTFOLIO: PortfolioSummary = {
  totalEngagements: 6,
  completedEngagements: 3,
  contractsWon: 2,
  contractsLost: 1,
  averageOverallScore: 71,
  competencyTrends: [
    { competencyName: 'Research & Discovery', points: [
      { engagementId: 'a', generatedAt: '2026-08-20T00:00:00Z', score: 58 },
      { engagementId: 'b', generatedAt: '2026-09-02T00:00:00Z', score: 74 },
      { engagementId: 'c', generatedAt: '2026-09-15T00:00:00Z', score: 86 },
    ] },
    { competencyName: 'Outreach', points: [
      { engagementId: 'a', generatedAt: '2026-08-20T00:00:00Z', score: 41 },
      { engagementId: 'b', generatedAt: '2026-09-02T00:00:00Z', score: 38 },
      { engagementId: 'c', generatedAt: '2026-09-15T00:00:00Z', score: 52 },
    ] },
    { competencyName: 'Relationship', points: [
      { engagementId: 'a', generatedAt: '2026-08-20T00:00:00Z', score: 70 },
      { engagementId: 'b', generatedAt: '2026-09-02T00:00:00Z', score: 79 },
      { engagementId: 'c', generatedAt: '2026-09-15T00:00:00Z', score: 84 },
    ] },
    { competencyName: 'Solution alignment', points: [
      { engagementId: 'a', generatedAt: '2026-08-20T00:00:00Z', score: 62 },
      { engagementId: 'b', generatedAt: '2026-09-02T00:00:00Z', score: 66 },
      { engagementId: 'c', generatedAt: '2026-09-15T00:00:00Z', score: 78 },
    ] },
  ],
  completedEngagementsHistory: [
    { engagementId: 'a', scenarioId: 'x', scenarioTitle: 'Warehouse slotting for an online retailer', industry: 'Retail & Logistics', outcome: 'REJECTED', overallScore: 58, completedAt: '2026-08-20T00:00:00Z' },
    { engagementId: 'b', scenarioId: 'y', scenarioTitle: 'Field-service scheduling for a water utility', industry: 'Energy & Utilities', outcome: 'PILOT_APPROVED', overallScore: 72, completedAt: '2026-09-02T00:00:00Z' },
    { engagementId: 'c', scenarioId: 'z', scenarioTitle: 'Loan origination for a building society', industry: 'Financial Services', outcome: 'PROPOSAL_ACCEPTED', overallScore: 83, completedAt: '2026-09-15T00:00:00Z' },
  ],
}

export const ACHIEVEMENTS: AchievementSummary[] = [
  { id: 'ach-1', name: 'First contract', description: 'Win your first client contract.', iconKey: 'trophy', unlocked: true, unlockedAt: '2026-09-02T00:00:00Z', progressPercent: 100 },
  { id: 'ach-2', name: 'Three industries', description: 'Complete engagements in three different industries.', iconKey: 'globe', unlocked: true, unlockedAt: '2026-09-15T00:00:00Z', progressPercent: 100 },
  { id: 'ach-3', name: 'Trusted adviser', description: 'Score 85 or higher in Relationship.', iconKey: 'handshake', unlocked: false, unlockedAt: null, progressPercent: 84 },
  { id: 'ach-4', name: 'Closer', description: 'Win five contracts.', iconKey: 'star', unlocked: false, unlockedAt: null, progressPercent: 40 },
]
