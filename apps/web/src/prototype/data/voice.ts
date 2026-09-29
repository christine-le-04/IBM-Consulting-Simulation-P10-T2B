/**
 * Option C's grafted voice: the manager speaks the "what is missing" line, and
 * the client's state is described, never scored (FR-14).
 *
 * Every line below is selected from game state the backend has already
 * computed — gate status, outreach outcome, prep readiness, persona values.
 * Nothing is generated freely, so the manager can never become the score
 * (AI-04, design doc §6.3).
 */
import type { PersonaState } from '@/api/types'
import type { OutreachVariant } from '../state/protoStore'

/** One name and a role anyone understands: the person who guides you. */
export const MANAGER = { name: 'Dana', role: 'your mentor' }

export type CueTone = 'warm' | 'neutral' | 'watch' | 'risk' | 'unmet'

export interface ClientCue {
  tone: CueTone
  text: string
}

/** Before the meeting there is no persona state. The cue says what she knows
 *  of you instead of pretending to measure a relationship that has not begun. */
export function preMeetingCue(outreach: OutreachVariant | 'NOT_SENT'): ClientCue {
  switch (outreach) {
    case 'NOT_SENT':
    case 'FIRST_CONTACT':
      return { tone: 'unmet', text: 'Has not heard of you yet. She will judge you on the first email.' }
    case 'REPLY':
    case 'BRIEF_REQUESTED':
      return { tone: 'neutral', text: 'Interested enough to reply — but wants proof before she gives up her team’s time.' }
    case 'MEETING_SECURED':
      return { tone: 'warm', text: 'Agreed to 30 minutes. Expects questions, not slides.' }
    case 'REJECTED':
      return { tone: 'watch', text: 'Said no to the first email — it read like a pitch, not like it was about her.' }
    case 'EXHAUSTED':
      return { tone: 'risk', text: 'Has stopped replying.' }
  }
}

/** Threshold matches Meeting.meetingThreshold, so the cue and the gate agree. */
export function meetingCue(state: Pick<PersonaState, 'trust' | 'interest' | 'patience'>, threshold = 70): ClientCue {
  if (state.patience < 50) return { tone: 'risk', text: 'Checking the time. She has given you a lot of it already — keep the next answer short.' }
  if (state.trust < 50) return { tone: 'risk', text: 'Sceptical. She wants specifics before she believes you.' }
  if (state.interest < 55) return { tone: 'watch', text: 'Polite, but nothing you have said yet lands on a problem she owns.' }
  if (state.trust >= threshold && state.interest >= threshold && state.patience >= threshold) {
    return { tone: 'warm', text: 'Engaged — leaning in and giving you detail she did not have to.' }
  }
  return { tone: 'neutral', text: 'Listening, but reserving judgement. Protective of her teams’ time.' }
}
