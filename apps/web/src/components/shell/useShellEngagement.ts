/**
 * The engagement the shell is talking about, read from the URL. AppShell is
 * the parent route, so it cannot read a child route's params directly.
 */
import { useLocation } from 'react-router-dom'
import { useEngagement } from '@/api/hooks/useEngagements'
import type { Engagement, EngagementPhase } from '@/api/types'
import { phaseFromPath, phaseIndex } from '@/lifecycle/phases'

export function engagementIdFromPath(pathname: string): string | null {
  return /\/dashboard\/engagements\/([^/]+)/.exec(pathname)?.[1] ?? null
}

export interface ShellEngagement {
  engagementId: string | null
  engagement: Engagement | undefined
  /** The phase whose page is on screen — not necessarily how far the engagement has got. */
  viewingPhase: EngagementPhase | null
}

export function useShellEngagement(): ShellEngagement {
  const { pathname, search } = useLocation()
  const engagementId = engagementIdFromPath(pathname)
  const { data: engagement } = useEngagement(engagementId ?? '')
  let viewingPhase = phaseFromPath(pathname) ?? engagement?.phase ?? null
  // After submission /proposal opens on the client's decision, unless the
  // learner asked to read the proposal itself.
  if (viewingPhase === 'PROPOSAL' && engagement && phaseIndex(engagement.phase) >= phaseIndex('OUTCOME')
    && new URLSearchParams(search).get('view') !== 'proposal') {
    viewingPhase = 'OUTCOME'
  }
  return { engagementId, engagement, viewingPhase }
}
