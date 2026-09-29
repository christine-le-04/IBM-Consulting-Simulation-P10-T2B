import { Button } from '@carbon/react'
import { useNavigate } from 'react-router-dom'
import type { OutreachAttempt } from '@/api/types'
import { useEngagement } from '@/api/hooks/useEngagements'
import { useScenario } from '@/api/hooks/useScenarios'
import { useChosenContact } from '@/store/contactSelectionStore'
import { contactStatus } from '@/lifecycle/contactSelection'
import styles from './ChooseContactPage.module.scss'

/**
 * "To: Sarah Chen, Chief Operating Officer · Change contact", shown at the top
 * of Make contact. The Change link appears only while changing is allowed:
 * before the first email, or after 3 emails without a meeting.
 */
export default function ContactLine({
  engagementId,
  attempts,
}: {
  engagementId: string
  attempts: OutreachAttempt[]
}) {
  const navigate = useNavigate()
  const { data: engagement } = useEngagement(engagementId)
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  const choice = useChosenContact(engagementId)
  const contact = scenario?.personas.find((c) => c.id === choice?.personaId)
  if (!contact) return null
  const status = contactStatus(attempts, choice)

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
