import { usePersonaState } from '@/api/hooks/useMeeting'
import { useOutreach } from '@/api/hooks/useOutreach'
import { useScenario } from '@/api/hooks/useScenarios'
import { phaseIndex } from '@/lifecycle/phases'
import { clientCue, type ClientCue } from './mentor'
import { useShellEngagement } from './useShellEngagement'

/** Who the client is to the learner right now, and how they feel about them. */
export function useClientCue(): { who: string; cue: ClientCue } | null {
  const { engagementId, engagement } = useShellEngagement()
  const { data: outreach } = useOutreach(engagementId ?? '')
  const { data: persona } = usePersonaState(engagement?.meetingId ?? '')
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  if (!engagement) return null

  const latestOutreach = [...(outreach ?? [])].sort((a, b) => b.attemptNumber - a.attemptNumber)[0]
  const contact = scenario?.personas.find((item) => item.id === engagement.personaId)
  const contacted = phaseIndex(engagement.phase) >= phaseIndex('OUTREACH')
  return {
    who: (contacted && contact?.name) || engagement.leadCompanyName || engagement.scenarioTitle || 'The client',
    cue: clientCue(engagement, latestOutreach, persona),
  }
}
