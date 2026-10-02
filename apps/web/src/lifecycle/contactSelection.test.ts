import { describe, expect, it } from 'vitest'
import type { ContactsResponse, Engagement, OutreachAttempt } from '@/api/types'
import {
  contactStatus, currentContactOf, emailsToContact, isBackFromFailedOutreach,
  statusFromContacts, type CurrentContact,
} from './contactSelection'

const contact: CurrentContact = { personaId: 'p-1', name: 'John Doe', jobTitle: 'CEO', round: 2 }

function attempt(attemptNumber: number, overrides: Partial<OutreachAttempt> = {}): OutreachAttempt {
  return { id: `a-${attemptNumber}`, attemptNumber, personaId: 'p-1', outreachRound: 2, outcome: 'REJECTED', ...overrides } as OutreachAttempt
}

describe('contact selection email history', () => {
  it('counts only the chosen person in the current round, oldest first', () => {
    const attempts = [attempt(4), attempt(2, { outreachRound: 1 }), attempt(3, { personaId: 'p-2' }), attempt(1)]

    expect(emailsToContact(attempts, contact).map((email) => email.id)).toEqual(['a-1', 'a-4'])
    expect(attempts.map((email) => email.id)).toEqual(['a-4', 'a-2', 'a-3', 'a-1'])
  })

  it('treats historic emails without a round as the first round', () => {
    expect(emailsToContact([attempt(1, { outreachRound: undefined })], { ...contact, round: 1 })).toHaveLength(1)
    expect(emailsToContact([attempt(1, { outreachRound: undefined })], contact)).toHaveLength(0)
  })

  it('allows a choice before the first email and locks it during the conversation', () => {
    expect(contactStatus([], undefined)).toBe('NONE')
    expect(contactStatus([], contact)).toBe('CHANGEABLE')
    expect(contactStatus([attempt(1)], contact)).toBe('LOCKED')
    expect(contactStatus([attempt(1), attempt(2)], contact)).toBe('LOCKED')
  })

  it('reopens the choice after three unsuccessful emails', () => {
    expect(contactStatus([attempt(1), attempt(2), attempt(3)], contact)).toBe('REOPENED')
  })

  it('keeps an accepted contact locked even on the third email', () => {
    expect(contactStatus([attempt(1), attempt(2), attempt(3, { outcome: 'ACCEPTED' })], contact)).toBe('LOCKED')
  })

  it('starts with three new emails after returning to a checkpoint', () => {
    const previousRound = [1, 2, 3].map((n) => attempt(n, { outreachRound: 1 }))

    expect(contactStatus(previousRound, contact)).toBe('CHANGEABLE')
  })
})

describe('contact selection backend state', () => {
  it('uses the chosen contact rather than the original meeting persona', () => {
    const engagement = {
      personaId: 'original-persona', contactPersonaId: 'p-2', contactName: 'Jane Roe',
      contactJobTitle: 'CFO', outreachRound: 3,
    } as Engagement

    expect(currentContactOf(engagement)).toEqual({ personaId: 'p-2', name: 'Jane Roe', jobTitle: 'CFO', round: 3 })
  })

  it('does not invent a contact when the engagement has none', () => {
    expect(currentContactOf(undefined)).toBeUndefined()
    expect(currentContactOf({ personaId: 'original-persona' } as Engagement)).toBeUndefined()
  })

  it.each([
    [false, false, 'CHANGEABLE'],
    [false, true, 'LOCKED'],
    [true, false, 'REOPENED'],
  ] as const)('uses the server choice state when usedUp is %s and locked is %s', (usedUp, locked, expected) => {
    const response = { contacts: [{ id: 'p-1', current: true, usedUp }], canChangeContact: !locked } as ContactsResponse

    expect(statusFromContacts(response)).toBe(expected)
  })

  it('does not treat another exhausted contact as the current choice', () => {
    const response = { contacts: [{ id: 'p-1', current: false, usedUp: true }], canChangeContact: true } as ContactsResponse

    expect(statusFromContacts(response)).toBe('NONE')
  })

  it('returns to research only when the new round has no chosen contact', () => {
    const engagement = { state: 'HYPOTHESIS_READY', outreachRound: 2, contactPersonaId: null } as Engagement

    expect(isBackFromFailedOutreach(engagement)).toBe(true)
    expect(isBackFromFailedOutreach({ ...engagement, outreachRound: 1 })).toBe(false)
    expect(isBackFromFailedOutreach({ ...engagement, contactPersonaId: 'p-2' })).toBe(false)
    expect(isBackFromFailedOutreach({ ...engagement, state: 'OUTREACHING' })).toBe(false)
  })
})
