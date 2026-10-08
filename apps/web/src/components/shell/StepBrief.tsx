/**
 * The step brief — what this step is for, what done looks like, what it
 * unlocks — said once by the mentor on the way in, then folded away. "Show
 * brief" in the engagement bar reopens it.
 */
import { useCallback, useEffect, useRef } from 'react'
import { Button } from '@carbon/react'
import { PHASE_BRIEF } from '@/lifecycle/phases'
import DanaAvatar from './DanaAvatar'
import { MENTOR } from './mentor'
import { useBriefOpen, useMentorLine } from './mentorHooks'
import NextStepButton from './NextStepButton'
import { briefKey, useShellStore } from './shellStore'
import { useShellEngagement } from './useShellEngagement'
import styles from './shell.module.scss'

/**
 * Publishes the brief's height as --sim-brief-height, so a page that sizes
 * itself to the viewport (the meeting) can leave room for it instead of
 * pushing its message box below the fold.
 */
function useBriefHeight() {
  const observer = useRef<ResizeObserver | null>(null)
  useEffect(() => () => {
    observer.current?.disconnect()
    document.documentElement.style.removeProperty('--sim-brief-height')
  }, [])
  return useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect()
    const root = document.documentElement.style
    if (!node) {
      root.removeProperty('--sim-brief-height')
      return
    }
    const publish = () => root.setProperty('--sim-brief-height', `${node.offsetHeight}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return
    observer.current = new ResizeObserver(publish)
    observer.current.observe(node)
  }, [])
}

export default function StepBrief() {
  const { engagement, viewingPhase } = useShellEngagement()
  const setBriefDismissed = useShellStore((s) => s.setBriefDismissed)
  const open = useBriefOpen()
  const line = useMentorLine()
  const measure = useBriefHeight()
  if (!open || !engagement || !viewingPhase) return null
  const brief = PHASE_BRIEF[viewingPhase]

  return (
    <section ref={measure} className={styles.threshold} aria-label="What this step is for">
      <div className={styles.thresholdBody}>
        <p className={styles.thresholdSpeaker}>
          <DanaAvatar size={28} />
          <span><strong>{MENTOR.name}</strong>, {MENTOR.role} — before you start this step</span>
        </p>
        {line && (
          <p className={styles.thresholdNow}>
            <span className={styles.thresholdNowLabel}>Right now</span>
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
      <Button size="md" onClick={() => setBriefDismissed(briefKey(engagement.id, viewingPhase), true)}>
        Got it
      </Button>
    </section>
  )
}
