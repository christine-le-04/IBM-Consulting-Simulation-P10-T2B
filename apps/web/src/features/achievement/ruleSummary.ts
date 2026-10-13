import type { AssessedStage, ConditionNode, RunCriteria } from '@/api/types'

const STAGE_NAMES: Record<AssessedStage, string> = { OUTREACH: 'outreach', MEETING: 'meeting', PROPOSAL: 'proposal' }
const DIFFICULTY_PHRASES = { EASY: 'on any difficulty', MEDIUM: 'on Medium or Hard', HARD: 'on Hard' } as const

const runs = (n: number) => `${n} ${n === 1 ? 'run' : 'runs'}`

/** "a, b and c" / "a, b or c" */
function joinPhrases(parts: string[], word: 'and' | 'or'): string {
  if (parts.length <= 1) return parts[0] ?? ''
  return `${parts.slice(0, -1).join(', ')} ${word} ${parts[parts.length - 1]}`
}

/** What one run must achieve, as a list of verb phrases ("win", "play on Hard", …). */
export function describeRunCriteria(run: RunCriteria): string[] {
  const parts: string[] = []
  if (run.won) parts.push('win')
  if (run.minDifficulty) parts.push(`play ${DIFFICULTY_PHRASES[run.minDifficulty]}`)
  if (run.minOverallScore != null) parts.push(`score at least ${run.minOverallScore} overall`)
  if (run.competencyName && run.minCompetencyScore != null) {
    parts.push(`score at least ${run.minCompetencyScore} in ${run.competencyName}`)
  }
  if (run.minEveryCompetencyScore != null) parts.push(`score at least ${run.minEveryCompetencyScore} in every competency`)
  if (run.firstAttemptStages.length > 0) {
    const stages = run.firstAttemptStages.length === 3 ? 'every stage'
      : `the ${joinPhrases(run.firstAttemptStages.map((s) => STAGE_NAMES[s]), 'and')}`
    parts.push(`pass ${stages} on the first attempt`)
  }
  if (run.notARetry) parts.push('not be retrying')
  if (run.maxHours != null) parts.push(`finish within ${run.maxHours} ${run.maxHours === 1 ? 'hour' : 'hours'}`)
  return parts
}

/** One condition or group as a verb phrase, e.g. "wins at least 3 runs". */
export function describeCondition(node: ConditionNode): string {
  if (node.kind === 'GROUP') {
    const parts = (node.children ?? []).map((child) =>
      child.kind === 'GROUP' && (child.children?.length ?? 0) > 1 ? `(${describeCondition(child)})` : describeCondition(child))
    return joinPhrases(parts, node.operator === 'OR' ? 'or' : 'and')
  }
  const n = node.threshold ?? 0
  switch (node.type) {
    case 'MIN_ENGAGEMENTS_COMPLETED': return `completes at least ${runs(n)}`
    case 'MIN_ENGAGEMENTS_WON': return `wins at least ${runs(n)}`
    case 'MIN_BEST_OVERALL_SCORE': return `scores at least ${n} overall in a run`
    case 'MIN_AVERAGE_OVERALL_SCORE': return `averages at least ${n} overall`
    case 'MIN_COMPETENCY_SCORE': return `scores at least ${n} in ${node.competencyName ?? 'a competency'}`
    case 'MIN_DISTINCT_SCENARIOS_COMPLETED': return `completes runs of at least ${n} different scenarios`
    case 'MIN_WIN_RATE_PERCENT': return `wins at least ${n}% of their runs`
    case 'MIN_RUNS_MATCHING': {
      const criteria = node.run ? describeRunCriteria(node.run) : []
      const what = criteria.length ? joinPhrases(criteria, 'and') : 'meet no requirement yet'
      return n === 1 ? `has a run in which they ${what}` : `has at least ${runs(n)} in which they ${what}`
    }
    default: return 'meets a condition'
  }
}

/** The whole rule as a sentence, shown under the builder and suitable as a description. */
export function summariseRule(rule: ConditionNode, scope: { exclusive: boolean; scenarioTitle?: string | null }): string {
  const sentence = `Unlocks when a learner ${describeCondition(rule)}.`
  if (!scope.exclusive) return `${sentence} Runs of any scenario count.`
  return `${sentence} Only runs of ${scope.scenarioTitle ? `“${scope.scenarioTitle}”` : 'the chosen scenario'} count.`
}
