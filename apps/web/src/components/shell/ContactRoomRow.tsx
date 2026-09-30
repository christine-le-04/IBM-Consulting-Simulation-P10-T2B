import { useNavigate } from 'react-router-dom'
import { ArrowRight } from '@carbon/icons-react'
import type { Engagement } from '@/api/types'
import { useChosenContact } from '@/store/contactSelectionStore'
import { isResearchDone } from '@/lifecycle/contactSelection'
import { useOnContactPage } from './useOnContactPage'
import styles from './shell.module.scss'

/**
 * The Choose contact row inside the Research room. Hidden until research is
 * done; shows the chosen contact's name once there is one.
 */
export default function ContactRoomRow({ engagement, onOpen }: { engagement: Engagement; onOpen?: () => void }) {
  const navigate = useNavigate()
  const onContactPage = useOnContactPage()
  const choice = useChosenContact(engagement.id)
  if (!isResearchDone(engagement)) return null

  const state = onContactPage ? 'You are here' : choice ? choice.name : 'Continue'

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