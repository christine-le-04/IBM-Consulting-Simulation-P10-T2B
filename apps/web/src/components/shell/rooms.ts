/**
 * The office floor: six rooms, each holding one or more lifecycle phases.
 * The room is where the learner is; the phase is what they are doing there.
 */
import type { EngagementPhase } from '@/api/types'
import { PHASE_ORDER, phaseIndex } from '@/lifecycle/phases'

export interface Room {
  id: 'RESEARCH' | 'MAIL' | 'PREP' | 'MEETING' | 'PROPOSAL' | 'REVIEW'
  name: string
  blurb: string
  phases: EngagementPhase[]
}

export const ROOMS: Room[] = [
  { id: 'RESEARCH', name: 'Research room', blurb: 'Research the company, then choose who to contact', phases: ['LEAD', 'CLIENT_INTELLIGENCE'] },
  { id: 'MAIL', name: 'Mail desk', blurb: 'Earn a meeting by email', phases: ['OUTREACH'] },
  { id: 'PREP', name: 'Prep room', blurb: 'Objective, agenda, questions', phases: ['MEETING_PREPARATION'] },
  { id: 'MEETING', name: 'Meeting room', blurb: 'Thirty minutes with the client', phases: ['LIVE_MEETING', 'MEETING_REVIEW'] },
  { id: 'PROPOSAL', name: 'Proposal studio', blurb: 'Write it, submit it, hear back', phases: ['PROPOSAL', 'OUTCOME'] },
  { id: 'REVIEW', name: 'Review room', blurb: 'Your assessment and portfolio', phases: ['REVIEW', 'COMPLETED'] },
]

/**
 * Phases that have a page of their own, in lifecycle order. Debrief and the
 * client's decision are read on other pages, so they are never a row.
 */
export const PAGE_PHASES: EngagementPhase[] = PHASE_ORDER.filter(
  (phase) => phase !== 'MEETING_REVIEW' && phase !== 'OUTCOME',
)

export function roomIndex(phase: EngagementPhase): number {
  return ROOMS.findIndex((room) => room.phases.includes(phase))
}

/** A room's pages in lifecycle order, so a reordered lifecycle reorders them. */
export function roomPages(room: Room): EngagementPhase[] {
  return PAGE_PHASES.filter((phase) => room.phases.includes(phase))
}

export function isPhaseReached(phase: EngagementPhase, reached: EngagementPhase): boolean {
  return phase === 'COMPLETED' || phaseIndex(phase) <= phaseIndex(reached)
}
