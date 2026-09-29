/**
 * Payload 2 — where you are — as a floor plan of plain buttons (simplified
 * Option A). No walkable world: six rooms, lit, occupied or locked, read at a
 * glance. Opening it never leaves the screen; the work stays open behind it.
 */
import { ComposedModal, ModalBody, ModalHeader, Button } from '@carbon/react'
import { ArrowLeft, CheckmarkFilled, Locked, UserAvatarFilled } from '@carbon/icons-react'
import { ENGAGEMENT } from '../data/scenario'
import { useProto } from '../state/protoStore'
import { SCREEN_ORDER, STAGES, isEngagementScreen, stageIndex } from '../state/stages'
import RoomGrid from './RoomGrid'
import styles from './shell.module.scss'

export default function OfficeMap() {
  const open = useProto((s) => s.mapOpen)
  const screen = useProto((s) => s.screen)
  const set = useProto((s) => s.set)
  const reached = useProto((s) => s.reached)
  const reachedStage = stageIndex(SCREEN_ORDER[reached])
  const here = isEngagementScreen(screen) ? stageIndex(screen) : reachedStage

  return (
    <ComposedModal open={open} onClose={() => set({ mapOpen: false })} size="lg" aria-label="Office map" className={styles.mapModal}>
      <ModalHeader
        label="Office map"
        title={ENGAGEMENT.leadCompanyName ?? 'Office map'}
        buttonOnClick={() => set({ mapOpen: false })}
      />
      <ModalBody className={styles.mapBody}>
        <p className={styles.mapIntro}>
          You are in the <strong>{STAGES[here]?.room}</strong>. Rooms unlock as you finish the one before. Your work is
          still open behind this map.
        </p>
        <RoomGrid highlight={here} compact />
        <div className={styles.mapFoot}>
          <ul className={styles.mapLegend}>
            <li><CheckmarkFilled size={14} /> Done — you can go back in</li>
            <li><UserAvatarFilled size={14} /> You are here</li>
            <li><Locked size={14} /> Locked until the room before is done</li>
          </ul>
          <Button kind="primary" size="md" renderIcon={ArrowLeft} onClick={() => set({ mapOpen: false })}>
            Back to what I was doing
          </Button>
        </div>
      </ModalBody>
    </ComposedModal>
  )
}
