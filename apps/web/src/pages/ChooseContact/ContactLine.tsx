import { Button } from '@carbon/react'
import { useNavigate } from 'react-router-dom'
import type { OutreachAttempt } from '@/api/types'
import { contactStatus, type CurrentContact } from '@/lifecycle/contactSelection'
import styles from './ChooseContactPage.module.scss'

/**
 * "To: Sarah Chen, Chief Operating Officer · Change contact", shown at the top
 * of Make contact. The Change link appears only while changing is allowed:
 * before the first email, or after 3 emails without a meeting.
 */
export default function ContactLine({
  engagementId,
  contact,
  attempts,
}: {
  engagementId: string
  contact: CurrentContact | undefined
  attempts: OutreachAttempt[]
}) {
  const navigate = useNavigate()
  if (!contact) return null
  const status = contactStatus(attempts, contact)

  return (
    <p className={styles.contactLine}>
      <span>To: <strong>{contact.name}</strong>, {contact.jobTitle}</span>
      {status !== 'LOCKED' && (
        <Button kind="ghost" size="sm" onClick={() => navigate(`/dashboard/engagements/${engagementId}/contact`)}>
          Change contact
        </Button>
      )}
    </p>
  )
}
