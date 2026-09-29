/**
 * How a page talks through the shell: the mentor's line and the way forward.
 *
 *   useMentor('Pick the person who can say yes.', { label: 'Choose who to contact', to, ready })
 *
 * Both are cleared when the page unmounts, so a line never outlives its page.
 */
import { useEffect } from 'react'
import { useShellStore, type NextStep } from './shellStore'

export function useMentor(line: string | null, nextStep: NextStep | null = null) {
  const setMentorLine = useShellStore((s) => s.setMentorLine)
  const setNextStep = useShellStore((s) => s.setNextStep)
  // Pages build these objects inline; compare by value, not identity.
  const stepKey = JSON.stringify(nextStep)

  useEffect(() => {
    setMentorLine(line)
    return () => setMentorLine(null)
  }, [line, setMentorLine])

  useEffect(() => {
    setNextStep(stepKey === 'null' ? null : (JSON.parse(stepKey) as NextStep))
    return () => setNextStep(null)
  }, [stepKey, setNextStep])
}
