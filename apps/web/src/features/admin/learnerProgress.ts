import type { EngagementState, LearnerProgressEntry } from '@/api/types'

export const LEARNER_STAGES = ['Research', 'Outreach', 'Preparation', 'Meeting', 'Proposal', 'Review'] as const
export type LearnerStage = typeof LEARNER_STAGES[number]
export type LearnerStatus = 'IN_PROGRESS' | 'STUCK' | 'COMPLETED' | 'MEETING_FAILED'

export const LEARNER_STATUSES: LearnerStatus[] = ['IN_PROGRESS', 'STUCK', 'COMPLETED', 'MEETING_FAILED']
export const STATUS_LABEL: Record<LearnerStatus, string> = {
  IN_PROGRESS: 'In progress',
  STUCK: 'Stuck',
  COMPLETED: 'Completed',
  MEETING_FAILED: 'Meeting failed',
}
export const STATUS_TAG: Record<LearnerStatus, 'blue' | 'red' | 'green' | 'warm-gray'> = {
  IN_PROGRESS: 'blue',
  STUCK: 'red',
  COMPLETED: 'green',
  MEETING_FAILED: 'warm-gray',
}

export const DEFAULT_STUCK_DAYS = 3
const DAY_MS = 24 * 60 * 60 * 1000

// Groups the 14 engagement states into the six stages a trainer recognises.
const STAGE_BY_STATE: Record<EngagementState, LearnerStage> = {
  QUALIFYING: 'Research',
  CLIENT_INTELLIGENCE: 'Research',
  HYPOTHESIS_READY: 'Research',
  OUTREACHING: 'Outreach',
  MEETING_SECURED: 'Preparation',
  PREPARING: 'Preparation',
  IN_MEETING: 'Meeting',
  MEETING_FAILED: 'Meeting',
  DISCOVERY_COMPLETE: 'Proposal',
  PROPOSAL_DRAFT: 'Proposal',
  PROPOSAL_SUBMITTED: 'Proposal',
  CLIENT_DECISION: 'Proposal',
  REVIEW: 'Review',
  COMPLETED: 'Review',
}

export const stageOf = (state: EngagementState): LearnerStage => STAGE_BY_STATE[state]
export const stageIndexOf = (state: EngagementState) => LEARNER_STAGES.indexOf(stageOf(state))

export const stateLabel = (state: EngagementState) =>
  state.split('_').map((part) => part[0] + part.slice(1).toLowerCase()).join(' ')

export function statusOf(entry: LearnerProgressEntry, now: number, stuckDays = DEFAULT_STUCK_DAYS): LearnerStatus {
  if (entry.state === 'COMPLETED' || entry.completedAt) return 'COMPLETED'
  if (entry.state === 'MEETING_FAILED') return 'MEETING_FAILED'
  const idleMs = now - new Date(entry.lastActivityAt).getTime()
  return idleMs >= stuckDays * DAY_MS ? 'STUCK' : 'IN_PROGRESS'
}

export function summarise(entries: LearnerProgressEntry[], now: number, stuckDays = DEFAULT_STUCK_DAYS) {
  const counts: Record<LearnerStatus, number> = { IN_PROGRESS: 0, STUCK: 0, COMPLETED: 0, MEETING_FAILED: 0 }
  const scores: number[] = []
  for (const entry of entries) {
    const status = statusOf(entry, now, stuckDays)
    counts[status] += 1
    if (status === 'COMPLETED' && entry.overallScore != null) scores.push(entry.overallScore)
  }
  const averageScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null
  return { ...counts, averageScore }
}

export function relativeTime(iso: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}
