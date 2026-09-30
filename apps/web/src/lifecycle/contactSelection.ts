import type { ContactChoice } from '@/store/contactSelectionStore'
import type { Engagement, OutreachAttempt } from '@/api/types'

export const MAX_EMAILS_PER_CONTACT = 3

export type ContactStatus =
  | 'NONE'       // no contact chosen yet
  | 'CHANGEABLE' // chosen, no email sent yet: can still change
  | 'LOCKED'     // emailing this contact (1–2 emails, or they agreed to meet)
  | 'REOPENED'   // 3 emails without a meeting: choose again

export function contactStatus(attempts: OutreachAttempt[], choice: ContactChoice | undefined): ContactStatus {
  if (!choice) return 'NONE'
  const ordered = [...attempts].sort((a, b) => a.attemptNumber - b.attemptNumber)
  const sent = ordered.slice(choice.emailsBefore)
  if (sent.length === 0) return 'CHANGEABLE'
  if (sent.some((a) => a.outcome === 'ACCEPTED')) return 'LOCKED'
  return sent.length >= MAX_EMAILS_PER_CONTACT ? 'REOPENED' : 'LOCKED'
}

export const canChooseContact = (status: ContactStatus) => status !== 'LOCKED'
/** Research is done once the engagement has moved past these states. */
export function isResearchDone(engagement: Engagement): boolean {
  return engagement.state !== 'QUALIFYING' && engagement.state !== 'CLIENT_INTELLIGENCE'
}

const stripTitle = (name: string) => name.replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '')
export const firstName = (name: string) => stripTitle(name).split(/\s+/)[0]
export const initials = (name: string) =>
  stripTitle(name).split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
