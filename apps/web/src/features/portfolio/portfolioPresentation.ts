import type { CompletedEngagementView, CompetencyTrend, PortfolioStageScore } from '@/api/types'

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

const STAGE_PRACTICE: Record<PortfolioStageScore['stage'], { name: string; action: string }> = {
  OUTREACH: { name: 'Outreach', action: 'Connect your email to a specific client concern, explain the business value and ask for a focused next step.' },
  MEETING: { name: 'Meeting', action: 'Practise focused discovery questions, address the client’s concern directly and confirm scope, ownership and a success measure.' },
  PROPOSAL: { name: 'Proposal', action: 'Ground your recommendation in client evidence, define measurable outcomes and explain delivery risks and commercial assumptions.' },
}

/** Choose one practice focus from the latest saved assessment, without combining different runs. */
export function portfolioPracticeFocus(history: CompletedEngagementView[], trends: CompetencyTrend[]) {
  const assessed = new Map(history.filter((engagement) => engagement.overallScore != null)
    .map((engagement) => [engagement.engagementId, engagement]))
  const points = trends.flatMap((trend) => trend.points.map((point) => ({ ...point, name: trend.competencyName })))
    .filter((point) => assessed.has(point.engagementId) && Number.isFinite(Date.parse(point.generatedAt)))
    .sort((a, b) => Date.parse(b.generatedAt) - Date.parse(a.generatedAt)
      || a.engagementId.localeCompare(b.engagementId))
  const latest = points[0]
  if (!latest) return null
  const engagement = assessed.get(latest.engagementId)!
  const stageScore = [...(engagement.stageScores ?? [])].sort((a, b) => a.bestScore - b.bestScore
    || a.stage.localeCompare(b.stage))[0]
  const competency = points.filter((point) => point.engagementId === latest.engagementId)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name))[0]
  return {
    engagementId: engagement.engagementId,
    scenarioTitle: engagement.scenarioTitle,
    difficulty: engagement.difficulty,
    name: stageScore ? STAGE_PRACTICE[stageScore.stage].name : competency.name,
    score: stageScore?.bestScore ?? competency.score,
    basis: stageScore ? 'best stage score' : 'competency score',
    incompleteHistory: stageScore?.scoreHistoryComplete === false,
    action: stageScore ? STAGE_PRACTICE[stageScore.stage].action
      : 'Open the supporting review, choose one improvement for this competency and practise it in your next engagement.',
  }
}
