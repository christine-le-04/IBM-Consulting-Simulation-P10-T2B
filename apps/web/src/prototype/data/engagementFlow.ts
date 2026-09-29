/**
 * Fixtures for the steps after research: outreach, meeting prep, the meeting,
 * the proposal, the client decision and the assessment. Real API shapes only.
 */
import type {
  Assessment,
  CapabilityBrief,
  ConversationTurn,
  Meeting,
  MeetingBehaviourFeedback,
  MeetingPreparation,
  MeetingResponseOptions,
  OutreachAttempt,
  Proposal,
  ProposalChallenge,
  ProposalReview,
  ProposalSource,
} from '@/api/types'

// ─── Outreach ───────────────────────────────────────────────────────────────

export const FIRST_ATTEMPT: OutreachAttempt = {
  id: 'out-1',
  engagementId: 'eng-medicare',
  attemptNumber: 1,
  subject: 'Clinical time lost to re-entry at MediCare',
  body:
    'Dear Ms Chen,\n\nI read your remarks at the regional health forum that integration is “the single biggest drag on clinical time”. Staff at two of your larger sites describe entering the same patient details three times per admission.\n\nWith capital flat, I think there is a way to release nursing time without a large upfront programme. Would a 20-minute call next Tuesday or Wednesday be useful?\n\nKind regards,\nVince Tran\nAssociate Consultant, IBM Consulting',
  clientReply:
    'Thank you — you have clearly read up on us, which is more than most. Before I give my team’s time to a meeting I need to see that you have done this somewhere like us. Send me a one-page capability brief: what you did, how you phased it, and what it cost the clinical teams while it was happening.',
  outcome: 'FOLLOW_UP_REQUIRED',
  scorePersonalisation: 82,
  scoreRelevance: 76,
  scoreClarity: 71,
  scoreCallToAction: 88,
  nextAction: 'SUBMIT_CAPABILITY_BRIEF',
  requestTitle: 'Capability brief requested',
  requestSummary: 'Sarah wants one page of proof before she commits her team’s time.',
  requestRequirements: [
    'A comparable healthcare example with a measured outcome',
    'How the work was phased and controlled',
    'The cost to clinical teams during delivery',
  ],
  coachingHint: 'She did not say no. She told you exactly what would earn the meeting — answer that, and only that.',
  createdAt: '2026-09-24T08:42:00Z',
}

export const DRAFT_BRIEF: CapabilityBrief = {
  id: 'brief-1',
  engagementId: 'eng-medicare',
  relevantExperience:
    'IBM Consulting has integrated patient administration and clinical record systems for two NHS acute trusts of similar size, including one formed through merger.',
  approach: '',
  caseExample: '',
  clientFit: '',
  clientReply: null,
  outcome: 'PENDING',
  scoreClientFit: null,
  scoreIndustryRelevance: null,
  scoreEvidenceQuality: null,
  scoreClarity: null,
  scoreCredibility: null,
  updatedAt: '2026-09-25T09:00:00Z',
}

export const ACCEPTED_REPLY =
  'This is useful, and the phasing answers my main worry. I can give you 30 minutes on Thursday at 10:00 with me. Please come with questions, not slides.'

// ─── Meeting preparation ────────────────────────────────────────────────────

export const PREPARATION: MeetingPreparation = {
  id: 'prep-1',
  engagementId: 'eng-medicare',
  objective: 'Validate where duplicate entry costs the most clinical time, and agree a low-risk first step Sarah can fund from divisional budget.',
  agenda: ['Confirm what Sarah wants from the hour', 'Where re-entry hurts most, by site'],
  discoveryQuestions: [
    'Which admission pathway loses the most nursing time today?',
    'What would you need to see before the autumn review to call this a success?',
  ],
  readinessScore: 56,
  ready: false,
}


// ─── The meeting ────────────────────────────────────────────────────────────

const turn = (sequence: number, actor: ConversationTurn['actor'], content: string): ConversationTurn => ({
  id: `t${sequence}`, meetingId: 'mtg-1', actor, content, sequence, signals: null, createdAt: '2026-10-02T10:00:00Z',
})

export const TRANSCRIPT: ConversationTurn[] = [
  turn(1, 'PERSONA', 'Thanks for coming. You said you had questions — go ahead.'),
  turn(2, 'LEARNER', 'Thank you for the time. Before anything else — what would make this half hour worth it for you?'),
  turn(3, 'PERSONA', 'Honestly? A clear view of where we lose the most nursing time, and something I could start before the regulator arrives that does not need a capital bid.'),
  turn(4, 'LEARNER', 'Which admission pathway loses the most time today?'),
  turn(5, 'PERSONA', 'Emergency admissions, by a distance. A patient can be registered in A&E, again on the ward, and again in the pharmacy system. The ward re-entry is the one the nurses hate. But I have heard “we can fix that” from three vendors. Why is your version different?'),
]

export const RESPONSE_OPTIONS: MeetingResponseOptions = {
  interactionMode: 'GUIDED',
  sourceSequence: 5,
  available: true,
  unavailableReason: null,
  options: [
    'You are right to be sceptical. Rather than a fix, could we measure the ward re-entry at one site for two weeks, so you have a number before the review?',
    'Our platform integrates all three systems out of the box, so the re-entry problem disappears within six months.',
    'Could you tell me more about the three vendors and what went wrong with each of them?',
  ],
}

export const READY_TO_CLOSE_OPTIONS: MeetingResponseOptions = {
  ...RESPONSE_OPTIONS,
  sourceSequence: 9,
  options: [
    'So we agree: a two-week measurement at Ashford, starting on the 13th, with the ward sisters. I will send the plan by Friday.',
    'Great — I will draft a full integration proposal and send it over next month.',
    'Shall we set up another meeting to discuss the options in more detail?',
  ],
}

export const BEHAVIOUR: MeetingBehaviourFeedback = {
  quality: 'STRONG_DISCOVERY',
  trustDelta: 6,
  interestDelta: 4,
  patienceDelta: -2,
  verifiedBehaviours: ['asked_open_question', 'referenced_client_priority'],
  explanation: 'You asked what would make the time worthwhile before pitching anything. She told you her real criteria: a number, before the regulator, without a capital bid.',
  nextBestAction: 'She has just challenged you. Acknowledge the scepticism, then offer something small she can verify.',
}

export const DISCLOSED_FACTS = ['emergency_admissions_worst_pathway', 'no_capital_bid_before_review']

export const MEETING: Meeting = {
  id: 'mtg-1',
  engagementId: 'eng-medicare',
  personaId: 'persona-sarah',
  status: 'IN_PROGRESS',
  interactionMode: 'GUIDED',
  meetingThreshold: 70,
  completedAt: null,
  transcriptStorageReference: null,
  completionOutcome: null,
  debriefFeedback: null,
  debriefTips: [],
  terminationReason: null,
  terminationMessage: null,
  meetingRetryAvailable: true,
  meetingRetriesRemaining: 2,
  behaviourLedger: [BEHAVIOUR],
}

export const PASSED_DEBRIEF = {
  feedback: 'You kept the conversation on Sarah’s criteria and left with a dated, owned next step. You spent one turn defending the firm when a question would have served you better.',
  tips: [
    'When a client challenges you, ask what the previous vendors missed before offering your answer.',
    'Name the clinical director early — he feels the pain even though he holds no budget.',
  ],
}

export const FAILED_DEBRIEF = {
  feedback: 'Sarah lost patience when the conversation moved to a platform pitch before she had agreed there was a problem worth funding.',
  tips: [
    'Stay on discovery until the client names the outcome they would pay for.',
    'Answer the question she asked before introducing your own.',
  ],
}

export const TERMINATION = {
  reason: 'RELATIONSHIP_THRESHOLD_BREACH' as const,
  message: 'Sarah ended the meeting early. Her patience ran out after two answers that did not address what she asked.',
  retryGuidance: [
    'Answer the client’s question in your first sentence.',
    'Offer one small, verifiable step instead of a platform claim.',
  ],
}

// ─── Proposal ───────────────────────────────────────────────────────────────

export const PROPOSAL_SOURCES: ProposalSource[] = [
  { id: 'ev-1', label: 'E-01 · Staff re-enter details three times', type: 'RESEARCH_EVIDENCE', content: 'Staff at two larger sites re-enter patient details into three systems per admission.', reliability: 'Corroborated' },
  { id: 'ev-2', label: 'E-02 · IT capital flat three years', type: 'RESEARCH_EVIDENCE', content: 'IT capital held at £6.1m; no integration programme in the capital plan.', reliability: 'Verified' },
  { id: 'ev-3', label: 'E-03 · Sarah can approve above threshold', type: 'RESEARCH_EVIDENCE', content: 'COO sits on the capital committee; can approve above the divisional threshold.', reliability: 'Verified' },
  { id: 'meeting:emergency', label: 'Emergency admissions are the worst pathway', type: 'MEETING_DISCOVERY', content: 'Disclosed in the meeting: A&E, ward and pharmacy each register the patient again.', reliability: 'Client stated' },
  { id: 'meeting:nocapital', label: 'No capital bid before the review', type: 'MEETING_DISCOVERY', content: 'Disclosed in the meeting: anything before autumn must avoid a capital bid.', reliability: 'Client stated' },
  { id: 'ev-4', label: 'E-04 · Regulator reviews record-keeping', type: 'RESEARCH_EVIDENCE', content: 'Autumn review examines clinical record-keeping and data reliability.', reliability: 'Verified' },
]

export const PROPOSAL_REVIEW: ProposalReview = {
  readyToSubmit: false,
  validationIssues: [
    { severity: 'BLOCKING', code: 'RISK_MISSING_MITIGATION', message: 'The ward-staff availability risk has no mitigation.', section: 'RISKS' },
    { severity: 'WARNING', code: 'BUDGET_UNGROUNDED', message: 'The budget is not linked to any evidence.', section: 'OUTCOMES' },
  ],
  clientAlignment: [],
  problemDefinitionScore: 81,
  evidenceGroundingScore: 74,
  clientAlignmentScore: 79,
  commercialLogicScore: 58,
  riskCoverageScore: 49,
  feasibilityScore: 70,
  executiveFeedback: 'The problem is framed in Sarah’s words and the pilot respects her capital constraint. The commercial case is thin: she will ask what happens after week two.',
  improvementActions: ['Add a mitigation for ward-staff availability during winter pressures.'],
}

export const PROPOSAL_CHALLENGE: ProposalChallenge = {
  concerns: ['“If the measurement shows a smaller problem than Alan thinks, what have I paid for?”'],
}

export const SUBMITTED_PROPOSAL: Proposal = {
  id: 'prop-1',
  engagementId: 'eng-medicare',
  status: 'SUBMITTED',
  problemStatement: 'Emergency admissions register the same patient up to three times, costing ward nurses time the network cannot spare before the autumn review.',
  solutionStrategy: 'Measure ward re-entry at Ashford for two weeks, then remove the worst duplicate step with a narrow interface — funded from divisional budget.',
  components: ['Two-week time-and-motion measurement', 'Single-step interface pilot'],
  budget: '185000',
  timelineWeeks: 10,
  budgetConfidence: 'MEDIUM',
  budgetSource: 'Consultant estimate from comparable trust',
  businessOutcomes: [],
  milestones: [],
  risks: [],
  assumptions: [],
  evidenceLinks: [],
  alignmentScore: 78,
  decision: 'PENDING',
  decisionRationale: 'The measurement phase is well aligned with the COO’s constraint, but the interface pilot lacks a mitigation for ward-staff availability in winter.',
  clientResponse:
    'Vince — thank you. The measurement at Ashford is exactly the kind of first step I can defend, and I appreciated that you did not ask for a capital bid. I am not yet comfortable with the interface pilot running in November: my ward sisters will not have the time, and your plan does not say what happens if they cannot release staff. Revise that part and come back to me; I would like to get the measurement started this month.',
  clientDecisionOutcome: 'REVISION_REQUESTED',
  decisionConfidence: 59,
  learnerPerformanceScore: 78,
  decisionDimensions: [
    { dimension: 'Relationship', score: 84, interpretation: 'Sarah trusts your reading of her constraints.' },
    { dimension: 'Facts discovered', score: 72, interpretation: 'You found the worst pathway; you did not learn the pharmacy system’s role.' },
    { dimension: 'Proposal fit', score: 61, interpretation: 'The first phase fits; the second ignores winter staffing.' },
  ],
  decisionInsights: [
    { category: 'STRENGTH', detail: 'The first phase needs no capital bid — you listened.' },
    { category: 'STRENGTH', detail: 'Every claim in the problem statement traces to evidence.' },
    { category: 'CONDITION', detail: 'Start the Ashford measurement this month.' },
    { category: 'CONCERN', detail: 'No plan for ward-staff availability in November.' },
    { category: 'CONCERN', detail: 'Budget basis is a consultant estimate only.' },
  ],
  evidenceImpacts: [
    { claim: 'Nurses re-enter details up to three times', supportLevel: 'WELL_SUPPORTED', explanation: 'Corroborated by the press report, the clinical director and the meeting.' },
    { claim: 'The pilot can run in November', supportLevel: 'UNSUPPORTED', explanation: 'Nothing you collected shows ward staff can be released in winter.' },
    { claim: '£185k is within divisional authority', supportLevel: 'PARTIALLY_SUPPORTED', explanation: 'You know she can approve above threshold, but not the threshold itself.' },
  ],
  submittedAt: '2026-10-06T16:00:00Z',
}

export const DECISION_EXPLANATION =
  'The decision weighted proposal fit most heavily. Your relationship and discovery were strong enough to keep the door open; the unmitigated winter-staffing risk is what turned an approval into a revision request.'
export const COUNTERFACTUAL =
  'Had the plan shown how the pilot would pause if ward staff could not be released — or moved it to January — the same evidence would most likely have produced a pilot approval.'

// ─── Assessment ─────────────────────────────────────────────────────────────

export const ASSESSMENT: Assessment = {
  id: 'asm-1',
  engagementId: 'eng-medicare',
  competencyScores: [
    { name: 'Research & Discovery', score: 86, evidenceNote: 'Grounded your hypothesis in three areas and found the COO’s approval authority before outreach.' },
    { name: 'Outreach', score: 64, evidenceNote: 'The first email earned a request, not a meeting; the capability brief closed the gap.' },
    { name: 'Relationship', score: 84, evidenceNote: 'Trust rose through the meeting; one pitch-style answer cost patience.' },
    { name: 'Solution alignment', score: 71, evidenceNote: 'Phase one fitted her constraint; phase two ignored winter staffing.' },
    { name: 'Commercial reasoning', score: 58, evidenceNote: 'Budget rested on an estimate with no evidence linked to it.' },
  ],
  overallScore: 73,
  outcome: 'REVISION_REQUESTED',
  feedbackSummary:
    'You read the client well and kept every step grounded in what you had found. The engagement stalled where the plan met reality: you did not test whether ward staff could be released in winter. That is one question in the meeting, and it would have changed the decision.',
  strengths: [
    'Asked what would make the meeting worthwhile before pitching anything.',
    'Answered the capability-brief request precisely instead of re-sending the pitch.',
    'Framed the problem in the client’s own words.',
  ],
  improvementAreas: [
    'Test delivery assumptions in the meeting, not in the proposal.',
    'Link the budget to evidence, or say plainly that it is an estimate.',
  ],
  coachingPending: false,
  generatedAt: '2026-10-06T16:05:00Z',
}

// ─── Outreach sad paths (up to 3 attempts, OutreachService.MAX_ATTEMPTS) ────

export const DECLINED_ATTEMPTS: OutreachAttempt[] = [
  {
    ...FIRST_ATTEMPT,
    id: 'out-r1',
    subject: 'IBM Consulting — digital transformation services',
    body: 'Dear Sarah,\n\nIBM Consulting helps healthcare organisations modernise their technology estate end to end. We would love to present our capabilities to your leadership team.\n\nCould we book an hour next week?\n\nBest regards,\nVince Tran',
    clientReply: 'Thank you, but we are not looking for a general capabilities presentation at the moment.',
    outcome: 'REJECTED',
    nextAction: 'SEND_FOLLOW_UP',
    requestTitle: null,
    requestSummary: null,
    requestRequirements: [],
    coachingHint: 'The email was about IBM, not about MediCare. Lead with one thing you found about them.',
  },
  {
    ...FIRST_ATTEMPT,
    id: 'out-r2',
    attemptNumber: 2,
    subject: 'Following up on digital transformation',
    body: 'Hi Sarah,\n\nJust following up on my last email. Our platform integrates all your systems and could save significant cost. Would you have time for a demo?\n\nVince',
    clientReply: 'As I said, this is not a priority for us right now.',
    outcome: 'REJECTED',
    nextAction: 'SEND_FOLLOW_UP',
    requestTitle: null,
    requestSummary: null,
    requestRequirements: [],
    coachingHint: '“Save significant cost” is a claim with nothing behind it. Use a number or a fact you researched.',
  },
  {
    ...FIRST_ATTEMPT,
    id: 'out-r3',
    attemptNumber: 3,
    subject: 'One last idea for MediCare',
    body: 'Hi Sarah,\n\nI understand you are busy. I think integration could really help your nurses. Could we talk for an hour this week?\n\nVince',
    clientReply: null,
    outcome: 'REJECTED',
    nextAction: 'NONE',
    requestTitle: null,
    requestSummary: null,
    requestRequirements: [],
    coachingHint: 'An hour is a big ask from a COO who has said no twice. Ask for something small and specific.',
  },
]

/** The ledger entry behind a failed meeting: a pitch before the problem was agreed. */
export const FAILED_BEHAVIOUR: MeetingBehaviourFeedback = {
  quality: 'PREMATURE_RECOMMENDATION',
  trustDelta: -6,
  interestDelta: -4,
  patienceDelta: -8,
  verifiedBehaviours: ['unsupported_claim', 'does_not_answer'],
  explanation: 'She asked why your version was different. You answered with a platform claim she had heard from three vendors, before she had agreed there was a problem worth funding.',
  nextBestAction: 'Answer the question she asked, then offer one small step she can verify.',
}
