import { describe, expect, it } from 'vitest'
import type { LearnerProgressEntry } from '@/api/types'
import { relativeTime, stageIndexOf, stageOf, statusOf, summarise } from './learnerProgress'

const NOW = new Date('2026-10-13T12:00:00Z').getTime()
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString()

function entry(overrides: Partial<LearnerProgressEntry> = {}): LearnerProgressEntry {
  return {
    engagementId: 'e1',
    userId: 'u1',
    displayName: 'Learner',
    email: 'learner@example.com',
    scenarioId: 's1',
    scenarioTitle: 'AeroVector Aviation',
    state: 'OUTREACHING',
    overallScore: null,
    lastActivityAt: daysAgo(0),
    completedAt: null,
    ...overrides,
  }
}

describe('learner progress stages', () => {
  it('groups engagement states into six stages', () => {
    expect(stageOf('CLIENT_INTELLIGENCE')).toBe('Research')
    expect(stageOf('MEETING_SECURED')).toBe('Preparation')
    expect(stageOf('MEETING_FAILED')).toBe('Meeting')
    expect(stageOf('CLIENT_DECISION')).toBe('Proposal')
    expect(stageIndexOf('COMPLETED')).toBe(5)
  })
})

describe('learner progress status', () => {
  it('marks a run idle for the threshold as stuck', () => {
    expect(statusOf(entry({ lastActivityAt: daysAgo(3) }), NOW, 3)).toBe('STUCK')
    expect(statusOf(entry({ lastActivityAt: daysAgo(2) }), NOW, 3)).toBe('IN_PROGRESS')
  })

  it('never marks completed or failed runs as stuck', () => {
    expect(statusOf(entry({ state: 'COMPLETED', lastActivityAt: daysAgo(30), completedAt: daysAgo(30) }), NOW)).toBe('COMPLETED')
    expect(statusOf(entry({ state: 'MEETING_FAILED', lastActivityAt: daysAgo(30) }), NOW)).toBe('MEETING_FAILED')
  })

  it('averages scores of completed runs only', () => {
    const summary = summarise([
      entry({ state: 'COMPLETED', completedAt: daysAgo(1), overallScore: 80 }),
      entry({ state: 'COMPLETED', completedAt: daysAgo(1), overallScore: 91 }),
      entry({ state: 'MEETING_FAILED', overallScore: 20 }),
      entry({ lastActivityAt: daysAgo(5) }),
    ], NOW)
    expect(summary).toMatchObject({ COMPLETED: 2, MEETING_FAILED: 1, STUCK: 1, IN_PROGRESS: 0, averageScore: 86 })
  })

  it('has no average when nothing is completed', () => {
    expect(summarise([entry()], NOW).averageScore).toBeNull()
  })
})

describe('relativeTime', () => {
  it('formats recent and older activity', () => {
    expect(relativeTime(new Date(NOW - 20 * 60_000).toISOString(), NOW)).toBe('20 min ago')
    expect(relativeTime(new Date(NOW - 2 * 3_600_000).toISOString(), NOW)).toBe('2 hours ago')
    expect(relativeTime(daysAgo(1), NOW)).toBe('Yesterday')
    expect(relativeTime(daysAgo(4), NOW)).toBe('4 days ago')
  })
})
