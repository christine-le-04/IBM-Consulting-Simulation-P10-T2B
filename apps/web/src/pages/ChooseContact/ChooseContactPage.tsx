import { useNavigate, useParams } from 'react-router-dom'
import { useEngagement } from '@/api/hooks/useEngagements'
import { useScenario } from '@/api/hooks/useScenarios'
import { useOutreach } from '@/api/hooks/useOutreach'
import { useMentor } from '@/components/shell/useMentor'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import { useChosenContact, useContactSelectionStore } from '@/store/contactSelectionStore'
import { contactStatus } from '@/lifecycle/contactSelection'
import { ChooseContactView, firstName } from './ChooseContactView'

/** Route: /dashboard/engagements/:engagementId/contact */
export default function ChooseContactPage() {
  const { engagementId } = useParams<{ engagementId: string }>()
  const navigate = useNavigate()
  const { data: engagement, isLoading } = useEngagement(engagementId!)
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  const { data: attempts = [] } = useOutreach(engagementId!)
  const choice = useChosenContact(engagementId!)
  const choose = useContactSelectionStore((s) => s.choose)

  const base = `/dashboard/engagements/${engagementId}`
  const status = contactStatus(attempts, choice)
  const chosen = scenario?.personas.find((p) => p.id === choice?.personaId)

  // Dana's line for this step. Without it the shell shows the backend's
  // nextAction, which after research is the outreach tip.
  useMentor(
    status === 'REOPENED'
      ? 'They did not agree to meet. Look again at who has the authority to say yes.'
      : chosen
        ? `Is ${firstName(chosen.name)} the person who can say yes? If so, write to them.`
        : 'Pick the person you will write to. Your research should tell you who can actually say yes.',
    chosen && status !== 'REOPENED'
      ? { label: `Write to ${firstName(chosen.name)}`, to: `${base}/outreach`, ready: true }
      : null,
  )

  if (isLoading || (engagement && !scenario)) return <LoadingState />
  if (!engagement || !scenario) return <ErrorState />

  return (
    <ChooseContactView
      company={scenario.personas[0]?.organisation ?? scenario.title}
      contacts={scenario.personas}
      chosenId={choice?.personaId ?? null}
      status={status}
      onChoose={(personaId) => choose(engagementId!, personaId, attempts.length)}
      onContinue={() => navigate(`${base}/outreach`)}
      onBackToResearch={() => navigate(`${base}/intelligence`)}
    />
  )
}
