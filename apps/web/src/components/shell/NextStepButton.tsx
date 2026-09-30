import { useNavigate } from 'react-router-dom'
import { Button } from '@carbon/react'
import { ArrowRight } from '@carbon/icons-react'
import { resolveEngagementRoute } from '@/api/engagementRouting'
import { PHASE_LABEL, phaseIndex } from '@/lifecycle/phases'
import GatedButton from './GatedButton'
import { useShellStore } from './shellStore'
import { useShellEngagement } from './useShellEngagement'
import styles from './shell.module.scss'

/**
 * The page's way forward, beside the mentor's line. Never locked.
 *
 * A page that has not set one still gets a way back to where the engagement
 * is up to, whenever the learner has walked back to an earlier step.
 */
export default function NextStepButton() {
  const nextStep = useShellStore((s) => s.nextStep)
  const navigate = useNavigate()
  const { engagement, viewingPhase } = useShellEngagement()

  if (!nextStep) {
    const behind = engagement && viewingPhase && engagement.phase !== 'COMPLETED'
      && phaseIndex(viewingPhase) < phaseIndex(engagement.phase)
    if (!behind) return null
    return (
      <Button size="sm" kind="tertiary" renderIcon={ArrowRight} className={styles.nextPopover} onClick={() => navigate(resolveEngagementRoute(engagement))}>
        Back to {PHASE_LABEL[engagement.phase]}
      </Button>
    )
  }

  return (
    <GatedButton
      size="sm"
      renderIcon={ArrowRight}
      ready={nextStep.ready}
      checklist={nextStep.checklist}
      title={nextStep.checklistTitle ?? 'Before you move on'}
      stayLabel={nextStep.stayLabel ?? 'Keep working'}
      allowEarly={nextStep.allowEarly ?? true}
      onGo={() => (nextStep.onGo ? nextStep.onGo() : nextStep.to && navigate(nextStep.to))}
      className={styles.nextPopover}
    >
      {nextStep.label}
    </GatedButton>
  )
}
