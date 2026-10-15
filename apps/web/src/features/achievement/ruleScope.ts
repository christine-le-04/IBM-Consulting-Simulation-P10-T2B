import type { ConditionNode, ConditionType, RunCriteria } from '@/api/types'

/** Career-wide measures that mean nothing for one scenario; Exclusive badges can't use them. */
export const GENERIC_ONLY_TYPES: ConditionType[] = ['MIN_DISTINCT_SCENARIOS_COMPLETED', 'MIN_WIN_RATE_PERCENT']

export function allowedFor(type: ConditionType, exclusive: boolean): boolean {
  return !exclusive || !GENERIC_ONLY_TYPES.includes(type)
}

export function newRunCriteria(): RunCriteria {
  return {
    won: true, minOverallScore: null, competencyName: null, minCompetencyScore: null,
    minEveryCompetencyScore: null, minDifficulty: null, firstAttemptStages: [], notARetry: null, maxHours: null,
  }
}

/** True when the criteria require something; an empty set would match every run. */
export function hasRequirement(run: RunCriteria): boolean {
  return Boolean(run.won) || run.minOverallScore != null || run.minCompetencyScore != null
    || run.minEveryCompetencyScore != null || run.minDifficulty != null || run.firstAttemptStages.length > 0
    || Boolean(run.notARetry) || run.maxHours != null
}

export function defaultRule(): ConditionNode {
  return {
    kind: 'GROUP', operator: 'AND', type: null, competencyName: null, threshold: null,
    children: [{ kind: 'LEAF', operator: null, children: null, type: 'MIN_ENGAGEMENTS_COMPLETED', competencyName: null, threshold: 1 }],
  }
}

/**
 * Removes conditions an Exclusive badge can't use. Groups left empty are removed
 * too; if nothing is left, the rule starts over from the default.
 */
export function pruneForScope(rule: ConditionNode, exclusive: boolean): ConditionNode {
  if (!exclusive) return rule
  const prune = (node: ConditionNode): ConditionNode | null => {
    if (node.kind === 'LEAF') return node.type && !allowedFor(node.type, true) ? null : node
    const children = (node.children ?? []).map(prune).filter((child): child is ConditionNode => child !== null)
    return children.length === 0 ? null : { ...node, children }
  }
  return prune(rule) ?? defaultRule()
}

/** Every "runs that achieve…" condition in the rule requires at least one thing. */
export function everyRunHasRequirement(rule: ConditionNode): boolean {
  if (rule.kind === 'GROUP') return (rule.children ?? []).every(everyRunHasRequirement)
  return rule.type !== 'MIN_RUNS_MATCHING' || (rule.run != null && hasRequirement(rule.run))
}
