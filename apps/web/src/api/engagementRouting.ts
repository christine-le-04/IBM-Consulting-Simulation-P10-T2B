import type { Engagement, EngagementPhase } from '@/api/types'
import { getChosenContact } from '@/store/contactSelectionStore'

/**
 * Maps an engagement's current phase to the workspace route the learner
 * should land on when they click "Continue" — the single source of truth
 * for phase → route navigation, replacing ad-hoc hardcoded links.
 *
 * Each engagement always resumes exactly where it left off instead of
 * always routing back to Lead Pipeline (the earlier bug: continuing an
 * engagement that had already selected a lead sent the learner back to
 * "Investigate Lead", which then failed because a lead was already locked in).
 */
export function resolveEngagementRoute(engagement: Engagement): string {
  const base = `/dashboard/engagements/${engagement.id}`
  if (engagement.state === 'MEETING_FAILED') {
    return engagement.meetingId ? `${base}/meetings/${engagement.meetingId}` : `${base}/leads`
  }


  switch (engagement.phase) {
    case 'LEAD':
      return `${base}/leads`
    case 'CLIENT_INTELLIGENCE':
      // Research finished (HYPOTHESIS_READY): choose a contact, then write.
      if (engagement.state === 'HYPOTHESIS_READY') {
        return getChosenContact(engagement.id) ? `${base}/outreach` : `${base}/contact`
      }
      return `${base}/intelligence`
    case 'OUTREACH':
      return `${base}/outreach`
    case 'MEETING_PREPARATION':
      return `${base}/preparation`
    case 'LIVE_MEETING':
      // Falls back to preparation if the meeting id hasn't been enriched yet —
      // still correct, since MeetingPreparationPage lets the learner resume
      // into the live meeting from there.
      return engagement.meetingId ? `${base}/meetings/${engagement.meetingId}` : `${base}/preparation`
    case 'MEETING_REVIEW':
      // Previously fell through to `default` and sent the learner back to the
      // Lead Pipeline — to the start of an engagement they were two-thirds
      // of the way through.
      return `${base}/assessment`
    case 'PROPOSAL':
      return `${base}/proposal`
    case 'OUTCOME':
    case 'REVIEW':
    case 'COMPLETED':
      return `${base}/assessment`
    default:
      return `${base}/leads`
  }
}

/**
 * The page for one phase of an engagement — what the office map and the room
 * buttons open. Earlier phases stay reachable, so a learner can walk back.
 * Debrief and the client's decision have no page of their own: the debrief is
 * read on the assessment, and the decision is shown in the proposal studio.
 */
export function phaseRoute(engagement: Engagement, phase: EngagementPhase): string {
  const base = `/dashboard/engagements/${engagement.id}`
  switch (phase) {
    case 'LEAD':
      return `${base}/leads`
    case 'CLIENT_INTELLIGENCE':
      return `${base}/intelligence`
    case 'OUTREACH':
      return `${base}/outreach`
    case 'MEETING_PREPARATION':
      return `${base}/preparation`
    case 'LIVE_MEETING':
      return engagement.meetingId ? `${base}/meetings/${engagement.meetingId}` : `${base}/preparation`
    case 'PROPOSAL':
    case 'OUTCOME':
      return `${base}/proposal`
    case 'MEETING_REVIEW':
    case 'REVIEW':
      return `${base}/assessment`
    case 'COMPLETED':
      return '/dashboard/portfolio'
  }
}
