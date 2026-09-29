/**
 * The six rooms of the office floor, shared by the hub and the Office map.
 * Plain buttons — the room state, not a walking avatar, carries the sequence.
 */
import { ArrowRight, CheckmarkFilled, Locked } from '@carbon/icons-react'
import { useProto } from '../state/protoStore'
import { SCREEN_LABEL, SCREEN_ORDER, STAGES, stageIndex, type ScreenId } from '../state/stages'
import styles from './shell.module.scss'

export interface RoomGridProps {
  /** Stage to mark "you are here". Defaults to the stage the engagement reached. */
  highlight?: number
  large?: boolean
  /** A learner with nothing started: every room locked, the first one waiting. */
  fresh?: boolean
  /** Tighter rooms for the Office map, so all six fit without scrolling. */
  compact?: boolean
}

const ROOM_BLURB: Record<string, string> = {
  FIND_LEAD: 'Research the company, then choose who to contact',
  OUTREACH: 'Earn a meeting by email',
  MEETING_PREP: 'Objective, agenda, questions',
  MEETING: 'Thirty minutes with the client',
  PROPOSAL: 'Write it, submit it, hear back',
  REVIEW: 'Your assessment and portfolio',
}

export default function RoomGrid({ highlight, large = false, fresh = false, compact = false }: RoomGridProps) {
  const go = useProto((s) => s.go)
  const reached = useProto((s) => s.reached)
  const current = useProto((s) => s.screen)
  const reachedScreen = SCREEN_ORDER[reached]
  const reachedStage = fresh ? 0 : stageIndex(reachedScreen)
  const here = fresh ? -1 : highlight ?? reachedStage

  const isReachable = (id: ScreenId) => id === 'PORTFOLIO' || SCREEN_ORDER.indexOf(id) <= reached
  const pageStatus = (id: ScreenId) => {
    if (id === current) return 'You are here'
    if (id === 'PORTFOLIO') return 'Open'
    const position = SCREEN_ORDER.indexOf(id)
    return position < reached ? 'Done' : 'Continue'
  }

  return (
    <ol className={`${styles.rooms} ${large ? styles.roomsLarge : ''} ${compact ? styles.roomsCompact : ''}`}>
      {STAGES.map((stage, index) => {
        const done = index < reachedStage
        const isHere = index === here
        const open = !fresh && index <= reachedStage
        const status = fresh
          ? index === 0 ? 'Starts here' : 'Locked'
          : isHere ? 'You are here' : done ? 'Done' : index === reachedStage ? 'Up to here' : 'Locked'
        // The room header only describes; the pages inside are the actions.
        // Every room uses the same rows, so there is one obvious place to click.
        const pages = open ? stage.screens.filter(isReachable) : []
        return (
          <li
            key={stage.id}
            className={`${styles.room} ${isHere ? styles.roomHere : done ? styles.roomDone : open || (fresh && index === 0) ? styles.roomOpen : styles.roomLocked}`}
            aria-label={`${stage.room}, ${status}`}
          >
            <div className={styles.roomHead}>
              <span className={styles.roomTop}>
                <span className={styles.roomNumber}>{String(index + 1).padStart(2, '0')}</span>
                {done && !isHere && <CheckmarkFilled size={16} className={styles.roomIconDone} />}
                {!open && !(fresh && index === 0) && <Locked size={16} className={styles.roomIconLocked} />}
                {isHere && <span className={styles.roomYou} aria-hidden="true" />}
              </span>
              <span className={styles.roomName}>{stage.room}</span>
              {large && <span className={styles.roomBlurb}>{ROOM_BLURB[stage.id]}</span>}
              {pages.length === 0 && <span className={styles.roomStatus}>{status}</span>}
            </div>
            {pages.length > 0 && (
              <div className={styles.roomPages}>
                {pages.map((id) => {
                  const pageState = pageStatus(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`${styles.pageRow} ${pageState === 'You are here' ? styles.pageRowHere : ''}`}
                      onClick={() => go(id)}
                    >
                      <span className={styles.pageName}>{SCREEN_LABEL[id]}</span>
                      <span className={styles.pageState}>{pageState}</span>
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  )
                })}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
