import { describe, expect, it } from 'vitest'
import type { CompletedEngagementView } from '@/api/types'
import { portfolioDifficultyLabel, portfolioTooltipLabel } from './portfolioPresentation'

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
