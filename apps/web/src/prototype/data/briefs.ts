/**
 * Brief overrides for the team's revised flow (28 Sep): scenario → research →
 * choose client (the person to contact) → outreach, with research and meeting
 * prep as feedback-only steps. PHASE_BRIEF still describes the old order and
 * the old locks; these replace it for the affected steps until it is updated.
 */
import type { ScreenId } from '../state/stages'

export interface Brief {
  goal: string
  done: string
  next: string
}

export const BRIEF_OVERRIDE: Partial<Record<ScreenId, Brief>> = {
  RESEARCH: {
    goal: 'Find out what is really going on at MediCare, and who could act on it.',
    done: 'When you have a view you can defend. Nothing is locked — your evidence carries into every step after this.',
    next: 'You choose the person at MediCare to write to.',
  },
  LEAD: {
    goal: 'Choose the one person at MediCare you will contact.',
    done: 'You have picked a contact.',
    next: 'The mail desk opens so you can write to them.',
  },
  PREPARE: {
    goal: 'Set an objective, an agenda, and the questions that will actually reveal something.',
    done: 'When you are ready. Nothing locks the meeting — this plan is what you will lean on in it.',
    next: 'The meeting room opens. The client is waiting.',
  },
}
