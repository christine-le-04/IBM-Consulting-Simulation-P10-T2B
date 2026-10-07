import { describe, expect, it } from 'vitest'
import type { CompletedEngagementView, CompetencyTrend, PortfolioStageScore } from '@/api/types'
import { portfolioDifficultyLabel, portfolioPracticeFocus, portfolioTooltipLabel } from './portfolioPresentation'

describe('portfolio chart context', () => {
  const point = { engagementId: 'run-2', engagement: 'Engagement 2', generatedAt: '2026-10-02T10:00:00Z' }
  const history: CompletedEngagementView[] = [
    { engagementId: 'run-1', scenarioId: 'scenario', scenarioTitle: 'Earlier run', industry: 'Retail',
      difficulty: 'EASY', outcome: 'REJECTED', overallScore: 40, completedAt: null },
    { engagementId: 'run-2', scenarioId: 'scenario', scenarioTitle: 'Supply chain pilot', industry: 'Retail',
      difficulty: 'HARD', outcome: 'PILOT_APPROVED', overallScore: 80, completedAt: '2026-10-01T10:00:00Z' },
  ]

  it('matches the engagement by ID and uses the assessment date for its chart point', () => {
    expect(portfolioTooltipLabel(point, history))
      .toBe('Supply chain pilot · Hard · Assessed 02/10/2026')
  })

  it('keeps older chart points meaningful without inventing missing context', () => {
    expect(portfolioTooltipLabel(point, []))
      .toBe('Engagement 2 · Difficulty unavailable · Assessed 02/10/2026')
  })

  it('formats all tiers and treats missing difficulty as unavailable', () => {
    expect(['EASY', 'MEDIUM', 'HARD', null, undefined].map((level) =>
      portfolioDifficultyLabel(level as CompletedEngagementView['difficulty'])))
      .toEqual(['Easy', 'Medium', 'Hard', 'Difficulty unavailable', 'Difficulty unavailable'])
  })
})

describe('portfolio practice focus', () => {
  const history: CompletedEngagementView[] = ['old', 'latest', 'pending'].map((id) => ({
    engagementId: id, scenarioId: 'scenario', scenarioTitle: `${id} scenario`, industry: 'Retail',
    difficulty: 'HARD', outcome: 'PILOT_APPROVED', overallScore: id === 'pending' ? null : 80,
    completedAt: '2026-10-01T10:00:00Z',
  }))
  const trends: CompetencyTrend[] = [
    { competencyName: 'Outreach', points: [
      { engagementId: 'old', generatedAt: '2026-10-01T10:00:00Z', score: 0 },
      { engagementId: 'latest', generatedAt: '2026-10-02T10:00:00Z', score: 75 },
    ] },
    { competencyName: 'Meeting', points: [
      { engagementId: 'pending', generatedAt: '2026-10-03T10:00:00Z', score: 0 },
      { engagementId: 'latest', generatedAt: '2026-10-02T10:00:00Z', score: 60 },
    ] },
  ]
  const stage = (name: PortfolioStageScore['stage'], score: number, complete = true): PortfolioStageScore => ({
    stage: name, bestScore: score, attemptCount: 2, currentCycleAttempts: 1,
    checkpointResets: 1, scoreHistoryComplete: complete,
  })

  it('uses the lowest saved stage score in the latest assessment rather than an earlier low score', () => {
    const focus = portfolioPracticeFocus(history.map((engagement) => ({ ...engagement,
      stageScores: engagement.engagementId === 'latest' ? [stage('PROPOSAL', 90), stage('MEETING', 60), stage('OUTREACH', 75)] : [],
    })), trends)
    expect(focus).toMatchObject({ engagementId: 'latest', name: 'Meeting', score: 60, basis: 'best stage score', difficulty: 'HARD' })
    expect(focus?.action).toContain('discovery questions')
  })

  it('uses legacy competencies from the same assessment without combining runs', () => {
    expect(portfolioPracticeFocus(history, trends)).toMatchObject({ engagementId: 'latest',
      name: 'Meeting', score: 60, basis: 'competency score', incompleteHistory: false })
  })

  it('preserves a saved zero score and an incomplete-history qualification', () => {
    expect(portfolioPracticeFocus(history.map((engagement) => ({ ...engagement,
      stageScores: engagement.engagementId === 'latest' ? [stage('PROPOSAL', 0, false)] : [],
    })), trends)).toMatchObject({ name: 'Proposal', score: 0, incompleteHistory: true })
  })

  it('selects tied stages consistently regardless of stored order', () => {
    const focus = (stages: PortfolioStageScore[]) => portfolioPracticeFocus(history.map((engagement) => ({
      ...engagement, stageScores: stages,
    })), trends)
    expect(focus([stage('OUTREACH', 70), stage('MEETING', 70)]))
      .toEqual(focus([stage('MEETING', 70), stage('OUTREACH', 70)]))
  })

  it('does not recommend practice without an identifiable saved assessment', () => {
    expect(portfolioPracticeFocus(history, [])).toBeNull()
    expect(portfolioPracticeFocus([], trends)).toBeNull()
    expect(portfolioPracticeFocus(history.filter((engagement) => engagement.overallScore == null), trends)).toBeNull()
  })
})
