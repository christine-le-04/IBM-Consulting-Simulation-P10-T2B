/**
 * The manager's default line per screen, used when the screen has not set a
 * live one from its own state. Selected from game state, never generated.
 */
import type { ClientDecisionOutcome } from '@/api/types'
import type { MeetingVariant, OutreachVariant } from '../state/protoStore'
import type { ScreenId } from '../state/stages'
import { BEHAVIOUR } from '../data/engagementFlow'
import { useProto } from '../state/protoStore'
import { SCREEN_PHASE } from '../state/stages'

interface LineContext {
  outreach: OutreachVariant
  meeting: MeetingVariant
  decision: ClientDecisionOutcome
}

export function defaultManagerLine(screen: ScreenId, context: LineContext): string | null {
  switch (screen) {
    case 'LEAD':
      return 'Pick the person you will write to. Your research should tell you who can actually say yes.'
    case 'OUTREACH':
      return {
        FIRST_CONTACT: 'One reason she should care, one small ask. Use something you found about them, not what IBM does.',
        REPLY: 'She did not say no. She told you exactly what would earn the meeting — answer that, and only that.',
        BRIEF_REQUESTED: 'Answer her three requirements in order. One page — she will not read two.',
        MEETING_SECURED: 'Thirty minutes, questions not slides. Go and plan what you need to learn from her.',
        REJECTED: 'A no is information. Read why she declined, then change one thing — not everything.',
        EXHAUSTED: 'Three emails is where a real client stops reading. Take the lessons below into the next lead.',
      }[context.outreach]
    case 'MEETING':
      return {
        IN_PROGRESS: BEHAVIOUR.nextBestAction,
        READY_TO_CLOSE: 'She is ready to wrap up. Confirm one next step, with a date and an owner.',
        AI_ERROR: 'Nothing is lost — the connection dropped. Try again when you are ready.',
        PASSED: 'Good meeting. Write down what she told you before you draft a single line of the proposal.',
        FAILED: 'That one got away from you. Read the debrief before you try again — it is short.',
        NO_RETRIES: 'Three tries is enough to learn from. Go back to your plan — the questions are where it went wrong.',
        TERMINATED: 'She ended it early. Read why before you retry.',
      }[context.meeting]
    case 'DECISION':
      return context.decision === 'REVISION_REQUESTED'
        ? 'She asked for a revision, not a rejection. Read what she said about November before anything else.'
        : context.decision === 'REJECTED'
          ? 'It did not land. Read her reasons now, while you still remember what you were thinking.'
          : 'You won the work. Read her conditions — they are the first thing she will check.'
    case 'ASSESSMENT':
      return 'This is where the numbers live. Read the two things to work on; they are what I would coach you on.'
    default:
      return null
  }
}

/** The manager's current line: a screen's live line, else its default. */
export function useManagerLine(): string | null {
  const screen = useProto((s) => s.screen)
  const liveLine = useProto((s) => s.liveLine)
  const outreach = useProto((s) => s.outreachVariant)
  const meeting = useProto((s) => s.meetingVariant)
  const decision = useProto((s) => s.decisionOutcome)
  return liveLine ?? defaultManagerLine(screen, { outreach, meeting, decision })
}

/** True while the step brief is open — the manager's line then lives inside it. */
export function useBriefOpen(): boolean {
  const screen = useProto((s) => s.screen)
  const briefDismissed = useProto((s) => s.briefDismissed)
  return Boolean(SCREEN_PHASE[screen]) && !briefDismissed[screen]
}
