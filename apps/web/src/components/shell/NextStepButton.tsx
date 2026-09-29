import { useNavigate } from 'react-router-dom'
import { ArrowRight } from '@carbon/icons-react'
import GatedButton from './GatedButton'
import { useShellStore } from './shellStore'
import styles from './shell.module.scss'

/** The page's way forward, beside the mentor's line. Never locked. */
export default function NextStepButton() {
  const nextStep = useShellStore((s) => s.nextStep)
  const navigate = useNavigate()
  if (!nextStep) return null
  return (
    <GatedButton
      size="sm"
      renderIcon={ArrowRight}
      ready={nextStep.ready}
      checklist={nextStep.checklist}
      title={nextStep.checklistTitle ?? 'Before you move on'}
      stayLabel={nextStep.stayLabel ?? 'Keep working'}
      onGo={() => navigate(nextStep.to)}
      className={styles.nextPopover}
    >
      {nextStep.label}
    </GatedButton>
  )
}
