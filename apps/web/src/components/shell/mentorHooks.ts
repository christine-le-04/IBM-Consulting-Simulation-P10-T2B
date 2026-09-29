import { briefKey, useShellStore } from './shellStore'
import { useShellEngagement } from './useShellEngagement'

/** The mentor's current line: the page's live line, else the engagement's next action. */
export function useMentorLine(): string | null {
  const live = useShellStore((s) => s.mentorLine)
  const { engagement } = useShellEngagement()
  return live ?? engagement?.nextAction ?? null
}

export function useBriefOpen(): boolean {
  const { engagement, viewingPhase } = useShellEngagement()
  const briefDismissed = useShellStore((s) => s.briefDismissed)
  return Boolean(engagement && viewingPhase) && !briefDismissed[briefKey(engagement!.id, viewingPhase!)]
}
