/**
 * Where you are, as a floor plan of plain buttons. Opening it never leaves the
 * page; the work stays open behind it.
 */
import { Button, ComposedModal, ModalBody, ModalHeader } from '@carbon/react'
import { ArrowLeft, CheckmarkFilled, Locked, UserAvatarFilled } from '@carbon/icons-react'
import RoomGrid from './RoomGrid'
import { ROOMS, roomIndex } from './rooms'
import { useShellStore } from './shellStore'
import { useShellEngagement } from './useShellEngagement'
import styles from './shell.module.scss'

export default function OfficeMap() {
  const open = useShellStore((s) => s.mapOpen)
  const setMapOpen = useShellStore((s) => s.setMapOpen)
  const { engagement, viewingPhase } = useShellEngagement()
  if (!engagement) return null
  const here = ROOMS[roomIndex(viewingPhase ?? engagement.phase)]
  const close = () => setMapOpen(false)

  return (
    <ComposedModal open={open} onClose={close} size="lg" aria-label="Office map" className={styles.mapModal}>
      <ModalHeader label="Office map" title={engagement.leadCompanyName ?? engagement.scenarioTitle ?? 'Office map'} buttonOnClick={close} />
      <ModalBody className={styles.mapBody}>
        <p className={styles.mapIntro}>
          You are in the <strong>{here?.name}</strong>. Rooms unlock as you finish the one before. Your work is still open
          behind this map.
        </p>
        <RoomGrid engagement={engagement} viewingPhase={viewingPhase} compact onOpen={close} />
        <div className={styles.mapFoot}>
          <ul className={styles.mapLegend}>
            <li><CheckmarkFilled size={14} /> Done — you can go back in</li>
            <li><UserAvatarFilled size={14} /> You are here</li>
            <li><Locked size={14} /> Locked until the room before is done</li>
          </ul>
          <Button kind="primary" size="md" renderIcon={ArrowLeft} onClick={close}>
            Back to what I was doing
          </Button>
        </div>
      </ModalBody>
    </ComposedModal>
  )
}
