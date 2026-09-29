/**
 * The six rooms of the office floor, shared by the Office page and the Office
 * map. Plain buttons: the room's state, not a walking avatar, carries the
 * sequence. A room header only describes; the pages inside are the actions.
 */
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckmarkFilled, Locked } from '@carbon/icons-react'
import type { Engagement, EngagementPhase } from '@/api/types'
import { phaseRoute } from '@/api/engagementRouting'
import { PHASE_LABEL, phaseIndex } from '@/lifecycle/phases'
import { ROOMS, isPhaseReached, roomIndex, roomPages } from './rooms'
import ContactRoomRow, { useOnContactPage } from './ContactRoomRow'
import styles from './shell.module.scss'

export interface RoomGridProps {
  /** The engagement the rooms belong to; none means nothing has started yet. */
  engagement?: Engagement
  /** The page on screen, marked "You are here". */
  viewingPhase?: EngagementPhase | null
  large?: boolean
  /** Tighter rooms for the Office map, so all six fit without scrolling. */
  compact?: boolean
  /** Runs after a page is opened, e.g. to close the map. */
  onOpen?: () => void
}

export default function RoomGrid({ engagement, viewingPhase = null, large = false, compact = false, onOpen }: RoomGridProps) {
  const navigate = useNavigate()
  const onContactPage = useOnContactPage()
  const reached = engagement?.phase ?? null
  const reachedRoom = reached ? roomIndex(reached) : -1
  const hereRoom = viewingPhase ? roomIndex(viewingPhase) : reachedRoom

  const pageState = (phase: EngagementPhase) => {
    // On Choose contact the phase is still Research, but "You are here" belongs to the contact row.
    if (phase === viewingPhase && !onContactPage) return 'You are here'
    if (phase === 'COMPLETED') return 'Open'
    return reached && phaseIndex(phase) < phaseIndex(reached) ? 'Done' : 'Continue'
  }

  return (
    <ol className={`${styles.rooms} ${large ? styles.roomsLarge : ''} ${compact ? styles.roomsCompact : ''}`}>
      {ROOMS.map((room, index) => {
        const fresh = !engagement
        const done = index < reachedRoom
        const isHere = index === hereRoom && !fresh
        const open = !fresh && index <= reachedRoom
        const status = fresh
          ? index === 0 ? 'Starts here' : 'Locked'
          : isHere ? 'You are here' : done ? 'Done' : index === reachedRoom ? 'Up to here' : 'Locked'
        const pages = open && engagement && reached ? roomPages(room).filter((phase) => isPhaseReached(phase, reached)) : []
        return (
          <li
            key={room.id}
            className={`${styles.room} ${isHere ? styles.roomHere : done ? styles.roomDone : open || (fresh && index === 0) ? styles.roomOpen : styles.roomLocked}`}
            aria-label={`${room.name}, ${status}`}
          >
            <div className={styles.roomHead}>
              <span className={styles.roomTop}>
                <span className={styles.roomNumber}>{String(index + 1).padStart(2, '0')}</span>
                {done && !isHere && <CheckmarkFilled size={16} className={styles.roomIconDone} />}
                {!open && !(fresh && index === 0) && <Locked size={16} className={styles.roomIconLocked} />}
                {isHere && <span className={styles.roomYou} aria-hidden="true" />}
              </span>
              <span className={styles.roomName}>{room.name}</span>
              {large && <span className={styles.roomBlurb}>{room.blurb}</span>}
              {pages.length === 0 && <span className={styles.roomStatus}>{status}</span>}
            </div>
            {pages.length > 0 && engagement && (
              <div className={styles.roomPages}>
                {pages.map((phase) => {
                  const state = pageState(phase)
                  return (
                    <button
                      key={phase}
                      type="button"
                      className={`${styles.pageRow} ${state === 'You are here' ? styles.pageRowHere : ''}`}
                      onClick={() => {
                        navigate(phaseRoute(engagement, phase))
                        onOpen?.()
                      }}
                    >
                      <span className={styles.pageName}>{PHASE_LABEL[phase]}</span>
                      <span className={styles.pageState}>{state}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  )
                })}
                {room.id === 'RESEARCH' && <ContactRoomRow engagement={engagement} onOpen={onOpen} />}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
