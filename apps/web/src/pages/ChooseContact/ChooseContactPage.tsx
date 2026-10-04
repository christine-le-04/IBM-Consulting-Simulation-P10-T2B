import { useNavigate, useParams } from 'react-router-dom'
import { InlineNotification } from '@carbon/react'
import { useContacts, useChooseContact } from '@/api/hooks/useContacts'
import { useMentor } from '@/components/shell/useMentor'
import LoadingState from '@/components/shared/LoadingState'
import LoadError from '@/components/shared/LoadError'
import { firstName, statusFromContacts } from '@/lifecycle/contactSelection'
import { ChooseContactView } from './ChooseContactView'

/** Route: /dashboard/engagements/:engagementId/contact */
export default function ChooseContactPage() {
  const { engagementId } = useParams<{ engagementId: string }>()
  const navigate = useNavigate()
  const { data, isLoading, isError, error, refetch } = useContacts(engagementId!)
  const choose = useChooseContact(engagementId!)

  const base = `/dashboard/engagements/${engagementId}`
  const status = statusFromContacts(data)
  const chosen = data?.contacts.find((c) => c.current)

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

  if (isLoading) return <LoadingState />
  if (isError || !data) return <LoadError title="Contacts could not be opened" error={error} reassurance="Your research is saved." onRetry={() => void refetch()} />

  return (
    <>
      {choose.isError && (
        <InlineNotification kind="error" lowContrast title="Could not choose this contact" subtitle="Please try again." hideCloseButton />
      )}
      <ChooseContactView
        company={data.contacts[0]?.organisation ?? 'the company'}
        contacts={data.contacts}
        chosenId={chosen?.id ?? null}
        status={status}
        pending={choose.isPending}
        onChoose={(personaId) => choose.mutate(personaId)}
        onContinue={() => navigate(`${base}/outreach`)}
        onBackToResearch={() => navigate(`${base}/intelligence`)}
      />
    </>
  )
}
