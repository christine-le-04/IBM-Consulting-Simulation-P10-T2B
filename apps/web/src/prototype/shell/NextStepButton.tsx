import { ArrowRight } from '@carbon/icons-react'
import { useProto } from '../state/protoStore'
import GatedButton from './GatedButton'
import styles from './shell.module.scss'

/** The screen's way forward, beside the manager's line. Never locked. */
export default function NextStepButton() {
  const nextStep = useProto((s) => s.nextStep)
  const go = useProto((s) => s.go)
  if (!nextStep) return null
  return (
    <GatedButton
      size="sm"
      renderIcon={ArrowRight}
      ready={nextStep.ready}
      checklist={nextStep.checklist}
      title={nextStep.checklistTitle ?? 'Before you move on'}
      stayLabel={nextStep.stayLabel ?? 'Keep working'}
      onGo={() => go(nextStep.screen)}
      className={styles.nextPopover}
    >
      {nextStep.label}
    </GatedButton>
  )
}
