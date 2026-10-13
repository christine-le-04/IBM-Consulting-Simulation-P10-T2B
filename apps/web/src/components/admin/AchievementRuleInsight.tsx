import { useEffect, useState } from 'react'
import { InlineLoading } from '@carbon/react'
import { useAchievementPreview } from '@/api/hooks/useAdminAchievements'
import { summariseRule } from '@/features/achievement/ruleSummary'
import type { ConditionNode } from '@/api/types'

/** Waits until edits pause, so typing a threshold doesn't fire a request per keystroke. */
function useSettled<T>(value: T, delayMs = 600): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])
  return settled
}

const learners = (n: number) => `${n} ${n === 1 ? 'learner' : 'learners'}`

/** The rule in plain English, and who would earn it if saved now. */
export default function AchievementRuleInsight({ rule, exclusive, scenarioId, scenarioTitle, achievementId, ready }: {
  rule: ConditionNode
  exclusive: boolean
  scenarioId: string | null | undefined
  scenarioTitle?: string | null
  achievementId?: string
  /** False while the draft can't be evaluated yet (e.g. no scenario chosen). */
  ready: boolean
}) {
  // Only new drafts wait for edits to pause; an incomplete one stops the preview at once.
  const settled = useSettled(ready ? { rule, scenarioId: exclusive ? scenarioId ?? null : null } : null)
  const draft = ready ? settled : null
  const preview = useAchievementPreview(draft, achievementId)

  let outcome: string
  if (!ready) outcome = 'Finish the rule to see who would earn it.'
  else if (preview.isFetching || draft === null) outcome = ''
  else if (preview.isError) outcome = 'Could not check who would earn it. Check the rule and try again.'
  else if (!preview.data) outcome = ''
  else {
    const { qualifyingLearners, alreadyEarned, learnersChecked, awardable } = preview.data
    const newly = qualifyingLearners - alreadyEarned
    outcome = learnersChecked === 0
      ? 'No learner has completed a run in scope yet, so nobody qualifies.'
      : `${learners(qualifyingLearners)} of ${learnersChecked} with completed runs already qualify`
        + (alreadyEarned > 0 ? ` (${alreadyEarned} already have it)` : '') + '.'
        + (!awardable ? ' It can\'t be awarded while its scenario is archived.'
          : newly > 0 ? ` ${learners(newly)} will receive it when you save.` : '')
  }

  return (
    <section aria-label="Rule summary" style={{ background: '#f4f4f4', padding: '0.75rem 1rem', display: 'grid', gap: '0.5rem' }}>
      <p style={{ margin: 0 }}>{summariseRule(rule, { exclusive, scenarioTitle })}</p>
      <div style={{ fontSize: '0.875rem', color: '#525252' }} aria-live="polite">
        {ready && (preview.isFetching || draft === null) ? <InlineLoading description="Checking who would earn it…" /> : outcome}
      </div>
    </section>
  )
}
