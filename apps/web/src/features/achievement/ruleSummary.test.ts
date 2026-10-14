import { describe, expect, it } from 'vitest'
import type { ConditionNode, ConditionType, RunCriteria } from '@/api/types'
import { newRunCriteria } from './ruleScope'
import { describeRunCriteria, summariseRule } from './ruleSummary'

const leaf = (type: ConditionType, threshold: number, extra: Partial<ConditionNode> = {}): ConditionNode =>
  ({ kind: 'LEAF', operator: null, children: null, type, competencyName: null, threshold, ...extra })
const group = (operator: 'AND' | 'OR', ...children: ConditionNode[]): ConditionNode =>
  ({ kind: 'GROUP', operator, children, type: null, competencyName: null, threshold: null })
const criteria = (patch: Partial<RunCriteria>): RunCriteria => ({ ...newRunCriteria(), won: null, ...patch })

describe('summariseRule', () => {
  it('describes a generic rule with its operator and plurals', () => {
    const rule = group('AND', leaf('MIN_ENGAGEMENTS_WON', 3), leaf('MIN_COMPETENCY_SCORE', 85, { competencyName: 'Relationship Building' }))
    expect(summariseRule(rule, { exclusive: false })).toBe(
      'Unlocks when a learner wins at least 3 runs and scores at least 85 in Relationship Building. Runs of any scenario count.')
  })

  it('names the scenario for an exclusive badge', () => {
    const rule = group('AND', leaf('MIN_ENGAGEMENTS_COMPLETED', 1))
    expect(summariseRule(rule, { exclusive: true, scenarioTitle: 'AeroVector: crew rostering' })).toBe(
      'Unlocks when a learner completes at least 1 run. Only runs of “AeroVector: crew rostering” count.')
  })

  it('brackets nested groups so AND and OR read unambiguously', () => {
    const rule = group('AND', leaf('MIN_ENGAGEMENTS_WON', 1),
      group('OR', leaf('MIN_BEST_OVERALL_SCORE', 90), leaf('MIN_AVERAGE_OVERALL_SCORE', 80)))
    expect(summariseRule(rule, { exclusive: false })).toContain(
      'wins at least 1 run and (scores at least 90 overall in a run or averages at least 80 overall)')
  })

  it('describes a single-run condition as one run doing everything', () => {
    const rule = group('AND', leaf('MIN_RUNS_MATCHING', 1, {
      run: criteria({ won: true, minDifficulty: 'HARD', firstAttemptStages: ['MEETING'] }),
    }))
    expect(summariseRule(rule, { exclusive: false })).toContain(
      'has a run in which they win, play on Hard and pass the meeting on the first attempt')
  })
})

describe('describeRunCriteria', () => {
  it('covers every requirement, and calls all three stages "every stage"', () => {
    expect(describeRunCriteria(criteria({
      won: true, minDifficulty: 'MEDIUM', minOverallScore: 80, competencyName: 'Solution Alignment', minCompetencyScore: 75,
      minEveryCompetencyScore: 60, firstAttemptStages: ['OUTREACH', 'MEETING', 'PROPOSAL'], notARetry: true, maxHours: 1,
    }))).toEqual([
      'win', 'play on Medium or Hard', 'score at least 80 overall', 'score at least 75 in Solution Alignment',
      'score at least 60 in every competency', 'pass every stage on the first attempt', 'not be retrying', 'finish within 1 hour',
    ])
  })
})
