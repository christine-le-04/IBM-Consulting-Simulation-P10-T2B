/**
 * The six stages the SRS defines (§2 Scope), and which screen belongs to which.
 *
 * The backend keeps its ten-phase enum; this is only how the learner sees it.
 * Four phases (Debrief, Their decision, Your review, Portfolio) never had a
 * screen of their own, so a ten-step stepper promised places that did not exist
 * (design doc §1.2, §6.2). The hub draws six rooms, one per SRS stage.
 */
import type { EngagementPhase } from '@/api/types'

export type ScreenId =
  | 'LANDING'
  | 'HUB'
  | 'LEAD'
  | 'RESEARCH'
  | 'OUTREACH'
  | 'PREPARE'
  | 'MEETING'
  | 'PROPOSAL'
  | 'DECISION'
  | 'ASSESSMENT'
  | 'PORTFOLIO'

export type StageId = 'FIND_LEAD' | 'OUTREACH' | 'MEETING_PREP' | 'MEETING' | 'PROPOSAL' | 'REVIEW'

export interface Stage {
  id: StageId
  /** SRS stage name. */
  label: string
  /** The room on the office floor. */
  room: string
  screens: ScreenId[]
}

export const STAGES: readonly Stage[] = [
  { id: 'FIND_LEAD', label: 'Research and choose a client', room: 'Research room', screens: ['RESEARCH', 'LEAD'] },
  { id: 'OUTREACH', label: 'Cold outreach', room: 'Mail desk', screens: ['OUTREACH'] },
  { id: 'MEETING_PREP', label: 'Meeting prep', room: 'Prep room', screens: ['PREPARE'] },
  { id: 'MEETING', label: 'Client meeting', room: 'Meeting room', screens: ['MEETING'] },
  { id: 'PROPOSAL', label: 'Proposal and close', room: 'Proposal studio', screens: ['PROPOSAL', 'DECISION'] },
  { id: 'REVIEW', label: 'Review and portfolio', room: 'Review room', screens: ['ASSESSMENT', 'PORTFOLIO'] },
]

/** The engagement screens in play order. HUB and PORTFOLIO sit outside it. */
export const SCREEN_ORDER: readonly ScreenId[] = [
  'RESEARCH',
  'LEAD',
  'OUTREACH',
  'PREPARE',
  'MEETING',
  'PROPOSAL',
  'DECISION',
  'ASSESSMENT',
]

/** The backend phase each screen renders, so titles come from PHASE_LABEL. */
export const SCREEN_PHASE: Record<ScreenId, EngagementPhase | null> = {
  LANDING: null,
  HUB: null,
  LEAD: 'LEAD',
  RESEARCH: 'CLIENT_INTELLIGENCE',
  OUTREACH: 'OUTREACH',
  PREPARE: 'MEETING_PREPARATION',
  MEETING: 'LIVE_MEETING',
  PROPOSAL: 'PROPOSAL',
  DECISION: 'OUTCOME',
  ASSESSMENT: 'REVIEW',
  PORTFOLIO: 'COMPLETED',
}

export const SCREEN_LABEL: Record<ScreenId, string> = {
  LANDING: 'Landing page',
  HUB: 'Office',
  LEAD: 'Choose a client',
  RESEARCH: 'Research the client',
  OUTREACH: 'Make contact',
  PREPARE: 'Prepare',
  MEETING: 'The meeting',
  PROPOSAL: 'Proposal',
  DECISION: 'Their decision',
  ASSESSMENT: 'Your review',
  PORTFOLIO: 'Portfolio',
}

export function stageOf(screen: ScreenId): Stage | null {
  return STAGES.find((stage) => stage.screens.includes(screen)) ?? null
}

export function stageIndex(screen: ScreenId): number {
  const stage = stageOf(screen)
  return stage ? STAGES.indexOf(stage) : -1
}

export function screenIndex(screen: ScreenId): number {
  return SCREEN_ORDER.indexOf(screen)
}

export function isEngagementScreen(screen: ScreenId): boolean {
  return screen !== 'LANDING' && screen !== 'HUB' && screen !== 'PORTFOLIO'
}
