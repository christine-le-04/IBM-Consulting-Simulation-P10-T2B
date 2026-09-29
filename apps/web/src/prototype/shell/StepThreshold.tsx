/**
 * 2 · The threshold — on the way in, then folds away (design doc §5.3).
 *
 * PHASE_BRIEF already holds a goal / done / unlocks sentence for every phase
 * and renders on zero screens today (FR-04, currently unmet). Option C's graft:
 * the manager says it, once, at the door. "Show brief" in the strip reopens it.
 */
import { Button } from '@carbon/react'
import { PHASE_BRIEF } from '@/lifecycle/phases'
import { MANAGER } from '../data/voice'
import { BRIEF_OVERRIDE } from '../data/briefs'
import { useProto } from '../state/protoStore'
import { SCREEN_PHASE } from '../state/stages'
import { useManagerLine } from './managerLine'
import DanaAvatar from './DanaAvatar'
import NextStepButton from './NextStepButton'
import styles from './shell.module.scss'

export default function StepThreshold() {
  const screen = useProto((s) => s.screen)
  const briefDismissed = useProto((s) => s.briefDismissed)
  const set = useProto((s) => s.set)
  const line = useManagerLine()
  const phase = SCREEN_PHASE[screen]
  if (!phase || briefDismissed[screen]) return null
  const brief = BRIEF_OVERRIDE[screen] ?? PHASE_BRIEF[phase]

  return (
    <section className={styles.threshold} aria-label="What this step is for">
      <div className={styles.thresholdBody}>
        <p className={styles.thresholdSpeaker}>
          <DanaAvatar size={28} />
          <span><strong>{MANAGER.name}</strong>, {MANAGER.role} — before you start this step</span>
        </p>
        {line && (
          <p className={styles.thresholdNow}>
            <span>Right now</span>
            <em>“{line}”</em>
            <NextStepButton />
          </p>
        )}
        <div className={styles.thresholdGrid}>
          <div>
            <span>Your goal</span>
            <p>{brief.goal}</p>
          </div>
          <div>
            <span>Done when</span>
            <p>{brief.done}</p>
          </div>
          <div>
            <span>Unlocks</span>
            <p>{brief.next}</p>
          </div>
        </div>
      </div>
      <Button size="md" onClick={() => set({ briefDismissed: { ...briefDismissed, [screen]: true } })}>
        Got it
      </Button>
    </section>
  )
}
