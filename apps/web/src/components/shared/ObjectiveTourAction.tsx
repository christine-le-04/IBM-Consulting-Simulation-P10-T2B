import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HeaderGlobalAction } from '@carbon/react'
import { Help } from '@carbon/icons-react'
import { useTour } from '@reactour/tour'

/** Persistent app-header control for replaying the guided walkthrough. */
export default function ObjectiveTourAction() {
  const { isOpen, setIsOpen, setCurrentStep, steps, setSteps } = useTour()
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlot(document.getElementById('objective-tour-action-slot'))
  }, [])

  if (!slot) return null

  return createPortal(
    <HeaderGlobalAction
      aria-label={isOpen ? 'Close walkthrough' : 'Replay walkthrough'}
      aria-expanded={isOpen}
      tooltipAlignment="end"
      onClick={() => {
        if (isOpen) {
          setIsOpen(false)
          return
        }

        // Some workspaces hide sections until later in the flow. Only offer
        // steps that have a visible target, just as the automatic tour does.
        const availableSteps = steps.filter((step) =>
          typeof step.selector === 'string' ? Boolean(document.querySelector(step.selector)) : true,
        )
        if (availableSteps.length === 0) return
        if (availableSteps.length !== steps.length) setSteps?.(availableSteps)
        setCurrentStep?.(0)
        setIsOpen(true)
      }}
    >
      <Help size={20} />
    </HeaderGlobalAction>,
    slot,
  )
}
