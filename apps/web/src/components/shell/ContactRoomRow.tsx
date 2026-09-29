import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight } from '@carbon/icons-react'
import type { Engagement } from '@/api/types'
import { useScenario } from '@/api/hooks/useScenarios'
import { useChosenContact } from '@/store/contactSelectionStore'
import styles from './shell.module.scss'

/** Research is done once the engagement has moved past these states. */
export function isResearchDone(engagement: Engagement): boolean {
  return engagement.state !== 'QUALIFYING' && engagement.state !== 'CLIENT_INTELLIGENCE'
}

/** True while the Choose contact page is on screen. */
export function useOnContactPage(): boolean {
  return /\/dashboard\/engagements\/[^/]+\/contact\/?$/.test(useLocation().pathname)
}

/**
 * The Choose contact row inside the Research room. Hidden until research is
 * done; shows the chosen contact's name once there is one.
 */
export default function ContactRoomRow({ engagement, onOpen }: { engagement: Engagement; onOpen?: () => void }) {
  const navigate = useNavigate()
  const onContactPage = useOnContactPage()
  const { data: scenario } = useScenario(engagement.scenarioId)
  const choice = useChosenContact(engagement.id)
  if (!isResearchDone(engagement)) return null

  const contact = scenario?.personas.find((p) => p.id === choice?.personaId)
  const state = onContactPage ? 'You are here' : contact ? contact.name : 'Continue'

  return (
    <button
      type="button"
      className={`${styles.pageRow} ${onContactPage ? styles.pageRowHere : ''}`}
      onClick={() => {
        navigate(`/dashboard/engagements/${engagement.id}/contact`)
        onOpen?.()
      }}
    >
      <span className={styles.pageName}>Choose contact</span>
      <span className={styles.pageState}>{state}</span>
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  )
}
