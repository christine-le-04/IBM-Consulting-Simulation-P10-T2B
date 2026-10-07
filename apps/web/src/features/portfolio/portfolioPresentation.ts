import type { CompletedEngagementView } from '@/api/types'

export function portfolioDifficultyLabel(difficulty: CompletedEngagementView['difficulty']): string {
  switch (difficulty) {
    case 'EASY': return 'Easy'
    case 'MEDIUM': return 'Medium'
    case 'HARD': return 'Hard'
    default: return 'Difficulty unavailable'
  }
}

export function portfolioTooltipLabel(point: { engagementId: string; engagement: string; generatedAt: string },
  history: CompletedEngagementView[]): string {
  const engagement = history.find((item) => item.engagementId === point.engagementId)
  return `${engagement?.scenarioTitle ?? point.engagement} · ${portfolioDifficultyLabel(engagement?.difficulty)} · Assessed ${new Date(point.generatedAt).toLocaleDateString('en-GB')}`
}
