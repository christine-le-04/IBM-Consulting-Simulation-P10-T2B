import type { ContactsResponse, Engagement, OutreachAttempt } from '@/api/types'

export const MAX_EMAILS_PER_CONTACT = 3

/** Who the learner is emailing now, as the backend reports it on the engagement. */
export interface CurrentContact {
  personaId: string
  name: string
  jobTitle: string
  round: number
}

export function currentContactOf(engagement: Engagement | undefined): CurrentContact | undefined {
  if (!engagement?.contactPersonaId) return undefined
  return {
    personaId: engagement.contactPersonaId,
    name: engagement.contactName ?? '',
    jobTitle: engagement.contactJobTitle ?? '',
    round: engagement.outreachRound ?? 1,
  }
}

export type ContactStatus =
  | 'NONE'       // no contact chosen yet
  | 'CHANGEABLE' // chosen, no email sent yet: can still change
  | 'LOCKED'     // emailing this contact (1–2 emails, or they agreed to meet)
  | 'REOPENED'   // 3 emails without a meeting: choose again

/** Emails sent to the current contact in the current round, oldest first. */
export function emailsToContact(attempts: OutreachAttempt[], contact: CurrentContact | undefined): OutreachAttempt[] {
  if (!contact) return []
  return attempts
    .filter((a) => a.personaId === contact.personaId && (a.outreachRound ?? 1) === contact.round)
    .sort((a, b) => a.attemptNumber - b.attemptNumber)
}

export function contactStatus(attempts: OutreachAttempt[], contact: CurrentContact | undefined): ContactStatus {
  if (!contact) return 'NONE'
  const sent = emailsToContact(attempts, contact)
  if (sent.length === 0) return 'CHANGEABLE'
  if (sent.some((a) => a.outcome === 'ACCEPTED')) return 'LOCKED'
  return sent.length >= MAX_EMAILS_PER_CONTACT ? 'REOPENED' : 'LOCKED'
}

/** The same status, from the Choose contact list the backend returns. */
export function statusFromContacts(response: ContactsResponse | undefined): ContactStatus {
  const current = response?.contacts.find((c) => c.current)
  if (!current) return 'NONE'
  if (current.usedUp) return 'REOPENED'
  return response!.canChangeContact ? 'CHANGEABLE' : 'LOCKED'
}

export const canChooseContact = (status: ContactStatus) => status !== 'LOCKED'

/** After every contact fails, the learner goes back to research before choosing again. */
export function isBackFromFailedOutreach(engagement: Engagement | undefined): boolean {
  return engagement?.state === 'HYPOTHESIS_READY' && !engagement.contactPersonaId && (engagement.outreachRound ?? 1) > 1
}

/** Research is done once the engagement has moved past these states. */
export function isResearchDone(engagement: Engagement): boolean {
  return engagement.state !== 'QUALIFYING' && engagement.state !== 'CLIENT_INTELLIGENCE'
}

// Scenario contacts include ranks and honorifics ("Captain James Okafor"); a
// button reading "Choose Captain" names the title, not the person.
const stripTitle = (name: string) =>
  name.replace(/^((Dr|Mr|Ms|Mrs|Mx|Miss|Prof|Professor|Capt|Captain|Sir|Dame|Lady|Lord)\.?\s+)+/i, '')
export const firstName = (name: string) => stripTitle(name).split(/\s+/)[0]
export const initials = (name: string) =>
  stripTitle(name).split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
