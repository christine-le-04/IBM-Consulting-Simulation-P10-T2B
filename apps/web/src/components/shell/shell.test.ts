import { describe, expect, it } from 'vitest'
import { phaseRoute } from '@/api/engagementRouting'
import type { Engagement, OutreachAttempt } from '@/api/types'
import { PHASE_ORDER } from '@/lifecycle/phases'
import { clientCue, meetingCue, outreachCue } from './mentor'
import { PAGE_PHASES, ROOMS, isPhaseReached, roomIndex, roomPages } from './rooms'

function engagement(overrides: Partial<Engagement> = {}): Engagement {
  return {
    id: 'eng-1',
    userId: 'user-1',
    scenarioId: 'scn-1',
    personaId: 'per-1',
    state: 'CLIENT_INTELLIGENCE',
    selectedLeadId: 'lead-1',
    createdAt: '2026-09-29T00:00:00Z',
    completedAt: null,
    events: [],
    scenarioTitle: 'MediCare',
    scenarioIndustry: 'Healthcare',
    leadCompanyName: 'MediCare Regional Hospital Network',
    phase: 'CLIENT_INTELLIGENCE',
    phaseLabel: 'Research the client',
    progressPercent: 20,
    nextAction: 'Research the client',
    evidenceCount: 0,
    daysElapsed: 0,
    meetingId: null,
    ...overrides,
  }
}

function attempt(outcome: OutreachAttempt['outcome']): OutreachAttempt {
  return { attemptNumber: 1, outcome } as OutreachAttempt
}

describe('rooms', () => {
  it('puts every lifecycle phase in exactly one room', () => {
    PHASE_ORDER.forEach((phase) => {
      expect(ROOMS.filter((room) => room.phases.includes(phase)), phase).toHaveLength(1)
      expect(roomIndex(phase)).toBeGreaterThanOrEqual(0)
    })
  })

  it('never lists debrief or the decision as a page of their own', () => {
    expect(PAGE_PHASES).not.toContain('MEETING_REVIEW')
    expect(PAGE_PHASES).not.toContain('OUTCOME')
    expect(roomPages(ROOMS[0])).toEqual(PHASE_ORDER.filter((phase) => phase === 'LEAD' || phase === 'CLIENT_INTELLIGENCE'))
  })

  it('opens earlier pages and the portfolio, and keeps later pages locked', () => {
    expect(isPhaseReached('LEAD', 'OUTREACH')).toBe(true)
    expect(isPhaseReached('PROPOSAL', 'OUTREACH')).toBe(false)
    expect(isPhaseReached('COMPLETED', 'LEAD')).toBe(true)
  })
})

describe('phaseRoute', () => {
  it('has a page for every phase', () => {
    PHASE_ORDER.forEach((phase) => expect(phaseRoute(engagement(), phase)).toMatch(/^\/dashboard\//))
  })

  it('opens the live meeting once there is one, and prep before that', () => {
    expect(phaseRoute(engagement(), 'LIVE_MEETING')).toBe('/dashboard/engagements/eng-1/preparation')
    expect(phaseRoute(engagement({ meetingId: 'm-1' }), 'LIVE_MEETING')).toBe('/dashboard/engagements/eng-1/meetings/m-1')
  })
})

describe('client cue', () => {
  it('says nobody knows you before outreach', () => {
    expect(clientCue(engagement(), undefined, undefined).tone).toBe('unmet')
  })

  it('follows the latest outreach reply', () => {
    const outreach = engagement({ phase: 'OUTREACH', state: 'OUTREACHING' })
    expect(clientCue(outreach, attempt('FOLLOW_UP_REQUIRED'), undefined).tone).toBe('neutral')
    expect(clientCue(outreach, attempt('REJECTED'), undefined).tone).toBe('watch')
    expect(outreachCue(undefined).tone).toBe('unmet')
  })

  it('reads the client in the meeting from their state', () => {
    const meeting = engagement({ phase: 'LIVE_MEETING', state: 'IN_MEETING', meetingId: 'm-1' })
    const persona = { engagementId: 'eng-1', trust: 80, interest: 80, patience: 80, disclosedFacts: [] }
    expect(clientCue(meeting, undefined, persona).tone).toBe('warm')
    expect(meetingCue({ trust: 80, interest: 80, patience: 30 }).tone).toBe('risk')
  })

  it('never shows the learner a number (SRS FR-14)', () => {
    const states = [0, 40, 52, 60, 75, 100]
    states.forEach((trust) => states.forEach((interest) => states.forEach((patience) => {
      expect(meetingCue({ trust, interest, patience }).text).not.toMatch(/\d/)
    })))
    ;(['PENDING', 'ACCEPTED', 'FOLLOW_UP_REQUIRED', 'REJECTED'] as const).forEach((outcome) => {
      expect(outreachCue(attempt(outcome)).text).not.toMatch(/\d/)
    })
  })
})
