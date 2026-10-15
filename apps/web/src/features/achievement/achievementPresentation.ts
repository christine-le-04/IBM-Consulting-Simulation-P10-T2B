import { ChartLineData, Collaborate, Compass, Education, Flag, Idea, Rocket, Star, Target, Trophy } from '@carbon/icons-react'
import type { AchievementSummary } from '@/api/types'

/** Every Carbon icon shares this component type. */
type AchievementIconType = typeof Trophy

const MISSING_ACHIEVEMENT_DESCRIPTION = 'No description provided.'

export function achievementDescription(description: string | null): string {
  return description?.trim() ? description : MISSING_ACHIEVEMENT_DESCRIPTION
}

/** Icons an admin can choose for a badge. Unknown keys fall back to the trophy. */
export const ACHIEVEMENT_ICONS: { key: string; label: string; icon: AchievementIconType }[] = [
  { key: 'trophy', label: 'Trophy', icon: Trophy },
  { key: 'star', label: 'Star', icon: Star },
  { key: 'flag', label: 'Flag', icon: Flag },
  { key: 'compass', label: 'Compass', icon: Compass },
  { key: 'chart', label: 'Chart', icon: ChartLineData },
  { key: 'handshake', label: 'Handshake', icon: Collaborate },
  { key: 'rocket', label: 'Rocket', icon: Rocket },
  { key: 'target', label: 'Target', icon: Target },
  { key: 'idea', label: 'Idea', icon: Idea },
  { key: 'education', label: 'Education', icon: Education },
]

export function achievementIcon(iconKey: string | null | undefined): AchievementIconType {
  return ACHIEVEMENT_ICONS.find((option) => option.key === iconKey)?.icon ?? Trophy
}

export function isExclusive(achievement: Pick<AchievementSummary, 'scope'>): boolean {
  return achievement.scope === 'EXCLUSIVE'
}

/** An Exclusive badge whose scenario is archived: it can't be earned now, and an earned one is shaded. */
export function isPaused(achievement: Pick<AchievementSummary, 'scope' | 'available'>): boolean {
  return isExclusive(achievement) && achievement.available === false
}

/** Badges unlocked by finishing this run, for the Review screen. */
export function unlockedByRun(achievements: AchievementSummary[] | undefined, engagementId: string | undefined) {
  if (!achievements || !engagementId) return []
  return achievements.filter((a) => a.unlocked && a.unlockedByEngagementId === engagementId)
}

/** The competencies every assessment scores; competency conditions must use one of these. */
export const COMPETENCIES = ['Outreach Effectiveness', 'Relationship Building', 'Solution Alignment'] as const
