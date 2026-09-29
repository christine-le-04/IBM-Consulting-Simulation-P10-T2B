/**
 * The mentor's voice and the client cue.
 *
 * The client's state is described, never scored (SRS FR-14): trust, interest
 * and patience still drive the simulation underneath, but the learner reads a
 * sentence, not three numbers. Every line is selected from state the backend
 * has already computed — nothing is generated, so the mentor can never become
 * the score.
 */
import type { Engagement, OutreachAttempt, PersonaState } from '@/api/types'
import { phaseIndex } from '@/lifecycle/phases'

/** One name and a role anyone understands: the person who guides you. */
export const MENTOR = { name: 'Dana', role: 'your mentor' }

export type CueTone = 'warm' | 'neutral' | 'watch' | 'risk' | 'unmet'

export interface ClientCue {
  tone: CueTone
  text: string
}

/** Matches the live meeting's gate, so the cue and the gate agree. */
const RELATIONSHIP_THRESHOLD = 70

export function meetingCue(state: Pick<PersonaState, 'trust' | 'interest' | 'patience'>): ClientCue {
  if (state.patience < 50) return { tone: 'risk', text: 'Checking the time. They have given you a lot of it already — keep the next answer short.' }
  if (state.trust < 50) return { tone: 'risk', text: 'Sceptical. They want specifics before they believe you.' }
  if (state.interest < 55) return { tone: 'watch', text: 'Polite, but nothing you have said yet lands on a problem they own.' }
  if (state.trust >= RELATIONSHIP_THRESHOLD && state.interest >= RELATIONSHIP_THRESHOLD && state.patience >= RELATIONSHIP_THRESHOLD) {
    return { tone: 'warm', text: 'Engaged — leaning in and giving you detail they did not have to.' }
  }
  return { tone: 'neutral', text: 'Listening, but reserving judgement.' }
}

/** Before the meeting there is no persona state. The cue says what the client
 *  knows of you instead of pretending to measure a relationship not yet begun. */
export function outreachCue(latest: OutreachAttempt | undefined): ClientCue {
  if (!latest) return { tone: 'unmet', text: 'Has not heard of you yet. The first email is how they will judge you.' }
  switch (latest.outcome) {
    case 'ACCEPTED':
      return { tone: 'warm', text: 'Agreed to meet. Expects questions, not slides.' }
    case 'FOLLOW_UP_REQUIRED':
      return { tone: 'neutral', text: 'Interested enough to reply — but wants proof before giving up their time.' }
    case 'REJECTED':
      return { tone: 'watch', text: 'Said no to your last email. Read why before you write again.' }
    default:
      return { tone: 'unmet', text: 'Has your email and has not replied yet.' }
  }
}

export function clientCue(engagement: Engagement, latestOutreach: OutreachAttempt | undefined, persona: PersonaState | undefined): ClientCue {
  if (engagement.state === 'MEETING_FAILED') return { tone: 'risk', text: 'Left the meeting unconvinced.' }
  const index = phaseIndex(engagement.phase)
  if (index < phaseIndex('OUTREACH')) return { tone: 'unmet', text: 'You have not contacted anyone yet. Nobody there knows you.' }
  if (index === phaseIndex('OUTREACH')) return outreachCue(latestOutreach)
  if (persona) return meetingCue(persona)
  return { tone: 'warm', text: 'Agreed to meet. Expects questions, not slides.' }
}
