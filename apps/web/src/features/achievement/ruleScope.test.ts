import { describe, expect, it } from 'vitest'
import type { ConditionNode, ConditionType } from '@/api/types'
import { everyRunHasRequirement, newRunCriteria, pruneForScope } from './ruleScope'

const leaf = (type: ConditionType, threshold = 1): ConditionNode =>
  ({ kind: 'LEAF', operator: null, children: null, type, competencyName: null, threshold })
const group = (...children: ConditionNode[]): ConditionNode =>
  ({ kind: 'GROUP', operator: 'AND', children, type: null, competencyName: null, threshold: null })

describe('pruneForScope', () => {
  it('leaves a Generic rule untouched', () => {
    const rule = group(leaf('MIN_WIN_RATE_PERCENT', 50))
    expect(pruneForScope(rule, false)).toBe(rule)
  })

  it('removes career-wide conditions from an Exclusive rule and keeps the rest', () => {
    const rule = group(leaf('MIN_ENGAGEMENTS_WON'), leaf('MIN_WIN_RATE_PERCENT', 50), leaf('MIN_DISTINCT_SCENARIOS_COMPLETED', 3))
    expect(pruneForScope(rule, true).children?.map((c) => c.type)).toEqual(['MIN_ENGAGEMENTS_WON'])
  })

  it('drops groups left empty, and starts over when nothing remains', () => {
    const rule = group(group(leaf('MIN_WIN_RATE_PERCENT', 50)), leaf('MIN_ENGAGEMENTS_WON'))
    expect(pruneForScope(rule, true).children).toHaveLength(1)

    const onlyCareerWide = group(leaf('MIN_DISTINCT_SCENARIOS_COMPLETED', 3))
    expect(pruneForScope(onlyCareerWide, true).children?.[0].type).toBe('MIN_ENGAGEMENTS_COMPLETED')
  })
})

describe('everyRunHasRequirement', () => {
  it('rejects a run condition that requires nothing', () => {
    const empty = { ...newRunCriteria(), won: null }
    expect(everyRunHasRequirement(group({ ...leaf('MIN_RUNS_MATCHING'), run: empty }))).toBe(false)
    expect(everyRunHasRequirement(group({ ...leaf('MIN_RUNS_MATCHING'), run: newRunCriteria() }))).toBe(true)
  })
})
