import type { OutreachAttempt } from '@/api/types'
import type { ContactChoice } from '@/store/contactSelectionStore'

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
