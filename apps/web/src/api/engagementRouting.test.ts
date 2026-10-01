import { describe, expect, it } from 'vitest'
import type { Engagement } from './types'
import { resolveEngagementRoute } from './engagementRouting'

describe('proposal revision routing', () => {
  it('resumes a client decision at the proposal so remaining revisions stay reachable', () => {
    const engagement = { id: 'eng-1', state: 'CLIENT_DECISION', phase: 'OUTCOME' } as Engagement
    expect(resolveEngagementRoute(engagement)).toBe('/dashboard/engagements/eng-1/proposal')
  })

  it('keeps a completed review routed to its assessment', () => {
    const engagement = { id: 'eng-1', state: 'COMPLETED', phase: 'COMPLETED' } as Engagement
    expect(resolveEngagementRoute(engagement)).toBe('/dashboard/engagements/eng-1/assessment')
  })
})
