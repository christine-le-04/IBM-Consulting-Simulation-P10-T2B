/**
 * How a page talks through the shell: the mentor's line and the way forward.
 *
 *   useMentor('Pick the person who can say yes.', { label: 'Choose who to contact', to, ready })
 *
 * Both are cleared when the page unmounts, so a line never outlives its page.
 * A step's `onGo` always calls the page's latest handler.
 */
import { useEffect, useRef } from 'react'
import { useShellStore, type NextStep } from './shellStore'

export function useMentor(line: string | null, nextStep: NextStep | null = null) {
  const setMentorLine = useShellStore((s) => s.setMentorLine)
  const setNextStep = useShellStore((s) => s.setNextStep)
  // Pages build these objects inline; compare by value, not identity.
  // (JSON drops `onGo`; the ref below keeps the latest one.)
  const stepKey = JSON.stringify(nextStep)
  const onGoRef = useRef(nextStep?.onGo)
  onGoRef.current = nextStep?.onGo
  const hasOnGo = Boolean(nextStep?.onGo)

  useEffect(() => {
    setMentorLine(line)
    return () => setMentorLine(null)
  }, [line, setMentorLine])

  useEffect(() => {
    if (stepKey === 'null') {
      setNextStep(null)
      return
    }
    const step = JSON.parse(stepKey) as NextStep
    setNextStep(hasOnGo ? { ...step, onGo: () => onGoRef.current?.() } : step)
    return () => setNextStep(null)
  }, [stepKey, hasOnGo, setNextStep])
}
