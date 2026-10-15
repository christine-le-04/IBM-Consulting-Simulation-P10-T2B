import type { LearnerProgressEntry } from '@/api/types'
import { LEARNER_STAGES, stageIndexOf, stageOf, stateLabel } from '@/features/admin/learnerProgress'
import styles from './LearnerProgressPage.module.css'

export default function LearnerStageBar({ entry }: { entry: LearnerProgressEntry }) {
  const current = stageIndexOf(entry.state)
  const done = entry.state === 'COMPLETED'
  return <div className={styles.stage}>
    <div className={styles.stageBar} aria-hidden="true">
      {LEARNER_STAGES.map((stage, index) => {
        const tone = index < current || done ? styles.segmentDone
          : index === current ? (entry.state === 'MEETING_FAILED' ? styles.segmentFailed : styles.segmentCurrent)
            : ''
        return <span key={stage} className={`${styles.segment} ${tone}`} />
      })}
    </div>
    <span className={styles.stageLabel}>{stageOf(entry.state)} · {stateLabel(entry.state)}</span>
  </div>
}
