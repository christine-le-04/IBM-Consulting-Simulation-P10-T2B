import { Button } from '@carbon/react'
import { useNavigate } from 'react-router-dom'
import type { OutreachAttempt } from '@/api/types'
import { useChosenContact } from '@/store/contactSelectionStore'
import { contactStatus } from '@/lifecycle/contactSelection'
import styles from './ChooseContactPage.module.scss'

/**
 * "To: Sarah Chen, Chief Operating Officer · Change contact", shown at the top
 * of Make contact. The Change link appears only while changing is allowed:
 * before the first email, or after 3 emails without a meeting.
 */
export default function ContactLine({ engagementId, attempts }: { engagementId: string; attempts: OutreachAttempt[] }) {
  const navigate = useNavigate()
  const choice = useChosenContact(engagementId)
  if (!choice) return null
  const status = contactStatus(attempts, choice)

  return (
    <p className={styles.contactLine}>
      <span>To: <strong>{choice.name}</strong>, {choice.jobTitle}</span>
      {status !== 'LOCKED' && (
        <Button kind="ghost" size="sm" onClick={() => navigate(`/dashboard/engagements/${engagementId}/contact`)}>
          Change contact
        </Button>
      )}
    </p>
  )
}