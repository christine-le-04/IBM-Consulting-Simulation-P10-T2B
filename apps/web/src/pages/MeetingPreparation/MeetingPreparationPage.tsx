import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, InlineLoading, InlineNotification, Tag } from '@carbon/react'
import { Add, TrashCan, ArrowRight, CheckmarkFilled, Calendar } from '@carbon/icons-react'
import {
  useMeetingPreparation,
  useUpdateMeetingPreparation,
  useStartMeeting,
} from '@/api/hooks/useMeeting'
import { useScenario } from '@/api/hooks/useScenarios'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import styles from './MeetingPreparationPage.module.scss'
import ObjectiveTourProvider from '@/components/shared/ObjectiveTourProvider'
import { useShellEngagement } from '@/components/shell/useShellEngagement'

interface DraftListItem {
  id: string
  value: string
}

interface PreparationDraft {
  objective: string
  agenda: string[]
  discoveryQuestions: string[]
}

const READY_THRESHOLD = 70
const OBJECTIVE_MAX_LENGTH = 300
const MEETING_PREP_OBJECTIVES = [
  {
    id: 'readiness',
    objective: 'Understand readiness preview',
    description: 'The checklist shows what you need to complete before you can move to the live meeting.',
    targets: ['.objective-readiness'],
  },
  {
    id: 'meeting-objective',
    objective: 'Determine the meeting objective',
    description: 'Using your previous knowledge of the collected evidence and outreach email, write your meeting objective.',
    targets: ['.objective-meeting-obj'],
  },
  {
    id: 'preparation',
    objective: 'Meeting preparations',
    description: 'This is where you prepare for your meeting by adding agenda items and discovery questions.',
    targets: ['.objective-preparation'],
  },
  {
    id: 'start',
    objective: 'Opening the meeting',
    description: 'Save your plan without leaving here or join the meeting. The join button stays locked until the checklist is complete.',
    targets: ['.objective-start'],
  },
]

let generatedItemId = 0

function createDraftItem(value = ''): DraftListItem {
  generatedItemId += 1
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `preparation-item-${Date.now()}-${generatedItemId}`,
    value,
  }
}

function toDraftItems(values: string[]): DraftListItem[] {
  const items = values.map(createDraftItem)
  if (items.length === 0 || items[items.length - 1].value.trim()) items.push(createDraftItem())
  return items
}

function draftStorageKey(engagementId: string) {
  return `consulting-sim:meeting-preparation:${engagementId}`
}

function readDraft(engagementId: string): PreparationDraft | null {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(engagementId))
    if (!raw) return null
    const draft = JSON.parse(raw) as PreparationDraft
    if (!Array.isArray(draft.agenda) || !Array.isArray(draft.discoveryQuestions) || typeof draft.objective !== 'string') {
      return null
    }
    return draft
  } catch {
    return null
  }
}

function EditableList({
  itemLabel,
  items,
  onChange,
  placeholder,
  lined = false,
}: {
  itemLabel: string
  items: DraftListItem[]
  onChange: (items: DraftListItem[]) => void
  placeholder: string
  lined?: boolean
}) {
  const update = (index: number, value: string) => {
    onChange(items.map((item, itemIndex) => (itemIndex === index ? { ...item, value } : item)))
  }
  const remove = (index: number) => {
    const next = items.filter((_, itemIndex) => itemIndex !== index)
    onChange(next.length > 0 ? next : [createDraftItem()])
  }
  const add = () => onChange([...items, createDraftItem()])

  return (
    <div className={lined ? styles.linedList : styles.agendaList}>
      <ol>
        {items.map((item, index) => (
          <li key={item.id}>
            <span className={styles.itemNumber}>{index + 1}</span>
            <input
              value={item.value}
              placeholder={placeholder}
              aria-label={`${itemLabel} ${index + 1}`}
              onChange={(event) => update(index, event.target.value)}
            />
            <button
              type="button"
              aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`}
              onClick={() => remove(index)}
            >
              <TrashCan size={16} />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className={styles.addItem} onClick={add}>
        <Add size={16} /> Add {itemLabel.toLowerCase()}
      </button>
    </div>
  )
}

function ReadinessList({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <ul className={styles.readinessList}>
      {items.map((item) => (
        <li key={item.label} className={item.done ? styles.readinessDone : undefined}>
          {item.done
            ? <CheckmarkFilled size={16} aria-label="Done" />
            : <span className={styles.pendingDot} role="img" aria-label="Not yet" />}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}

export default function MeetingPreparationPage() {
  const { engagementId } = useParams<{ engagementId: string }>()
  const navigate = useNavigate()
  const { engagement } = useShellEngagement()
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  const { data: preparation, isLoading, isError } = useMeetingPreparation(engagementId!)
  const updatePreparation = useUpdateMeetingPreparation(engagementId!)
  const startMeeting = useStartMeeting(engagementId!)

  const [objective, setObjective] = useState('')
  const [agenda, setAgenda] = useState<DraftListItem[]>([])
  const [discoveryQuestions, setDiscoveryQuestions] = useState<DraftListItem[]>([])
  const [launchingMeeting, setLaunchingMeeting] = useState(false)
  const hydratedEngagementRef = useRef<string | null>(null)
  const hasHydratedRef = useRef(false)

  useEffect(() => {
    if (!preparation || !engagementId || hydratedEngagementRef.current === engagementId) return

    const draft = readDraft(engagementId)
    const source = draft ?? {
      objective: preparation.objective ?? '',
      agenda: preparation.agenda,
      discoveryQuestions: preparation.discoveryQuestions,
    }
    setObjective(source.objective)
    setAgenda(toDraftItems(source.agenda))
    setDiscoveryQuestions(toDraftItems(source.discoveryQuestions))
    hydratedEngagementRef.current = engagementId
    hasHydratedRef.current = true
  }, [engagementId, preparation])

  useEffect(() => {
    if (!engagementId || !hasHydratedRef.current || hydratedEngagementRef.current !== engagementId) return

    const timer = window.setTimeout(() => {
      const draft: PreparationDraft = {
        objective,
        agenda: agenda.map((item) => item.value),
        discoveryQuestions: discoveryQuestions.map((item) => item.value),
      }
      window.localStorage.setItem(draftStorageKey(engagementId), JSON.stringify(draft))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [agenda, discoveryQuestions, engagementId, objective])

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState />

  const savePreparation = (onSuccess?: () => void) => {
    updatePreparation.mutate({
      objective,
      agenda: agenda.map((item) => item.value).filter((value) => value.trim()),
      discoveryQuestions: discoveryQuestions.map((item) => item.value).filter((value) => value.trim()),
    }, {
      onSuccess: (saved) => {
        window.localStorage.setItem(draftStorageKey(engagementId!), JSON.stringify({
          objective: saved.objective ?? '',
          agenda: saved.agenda,
          discoveryQuestions: saved.discoveryQuestions,
        } satisfies PreparationDraft))
        onSuccess?.()
      },
      onError: () => setLaunchingMeeting(false),
    })
  }

  const handleSave = () => savePreparation()

  const handleStartMeeting = () => {
    setLaunchingMeeting(true)
    savePreparation(() => {
      startMeeting.mutate(undefined, {
        onSuccess: (meeting) => navigate(`/dashboard/engagements/${engagementId}/meetings/${meeting.id}`),
        onError: () => setLaunchingMeeting(false),
      })
    })
  }

  const agendaCount = agenda.filter((item) => item.value.trim()).length
  const questionCount = discoveryQuestions.filter((item) => item.value.trim()).length
  const objectiveReady = objective.trim().length > 0
  const readinessScore = Math.min(100,
    (objectiveReady ? 20 : 0)
    + Math.min(40, agendaCount * 10)
    + Math.min(40, questionCount * 8),
  )
  const ready = readinessScore >= READY_THRESHOLD
  const isSaving = updatePreparation.isPending || launchingMeeting
  const checklist = [
    { label: 'A clear outcome you need from the meeting', done: objectiveReady },
    { label: 'An agenda with at least three points', done: agendaCount >= 3 },
    { label: 'At least three open questions to ask', done: questionCount >= 3 },
  ]
  const saveState = updatePreparation.isPending && !launchingMeeting ? 'Saving…' : updatePreparation.isSuccess ? 'Plan saved' : 'Saved in this browser as you type'
  const persona = scenario?.personas.find((item) => item.id === engagement?.personaId)
  const firstName = persona?.name?.split(' ')[0] ?? 'the client'

  return (
    <ObjectiveTourProvider tourId="meeting-preparation" objectives={MEETING_PREP_OBJECTIVES}>
      <div className={styles.page}>
        <div className={styles.event}>
          <header className={styles.eventBar}>
            <div className={styles.eventTitle}>
              <Calendar size={20} />
              <div>
                <h1>Meeting with {persona?.name ?? 'The client'}</h1>
                <p>Meeting Preparation</p>
              </div>
            </div>
            <div className={`${styles.eventActions} objective-start`}>
              <span className={styles.saveState}>{saveState}</span>
              <Button kind="tertiary" disabled={isSaving} onClick={handleSave}>
                Save plan
              </Button>
              <Button
                renderIcon={launchingMeeting || startMeeting.isPending ? undefined : ArrowRight}
                disabled={!ready || isSaving || startMeeting.isPending}
                onClick={handleStartMeeting}
              >
                {launchingMeeting || startMeeting.isPending
                  ? <InlineLoading description="Opening meeting" status="active" />
                  : 'Join meeting'}
              </Button>
            </div>
          </header>

          <div className={styles.columns}>
            <section className={styles.invite} aria-label="Meeting plan">
              <label className={`${styles.objective} objective-meeting-obj`}>
                <span className={styles.label}>What you need to leave with</span>
                <textarea
                  maxLength={OBJECTIVE_MAX_LENGTH}
                  rows={3}
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  placeholder="e.g. Validate the operational problem, quantify its impact and agree a low-risk next step."
                />
                <small>{objective.trim().length}/{OBJECTIVE_MAX_LENGTH}</small>
              </label>

              <div className={`${styles.block} objective-preparation`}>
                <span className={styles.label}>Agenda — shared with {firstName}</span>
                <EditableList
                  itemLabel="Agenda item"
                  items={agenda}
                  onChange={setAgenda}
                  placeholder="e.g. Confirm meeting objectives"
                />
              </div>

              <section className={`${styles.readiness} objective-readiness`} aria-label="Before you join the meeting">
                <span className={styles.label}>Before you join the meeting</span>
                <ReadinessList items={checklist} />
              </section>

              {updatePreparation.isError && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title="Failed to save preparation"
                  subtitle="Your local draft is still available. Try saving again."
                />
              )}
            </section>

            <section className={styles.notepad} aria-label="Discovery questions">
              <p className={styles.notepadTitle}>Questions to ask</p>
              <p className={styles.notepadHint}>Only you see these. Open questions reveal what the brief did not.</p>
              <EditableList
                lined
                itemLabel="Question"
                items={discoveryQuestions}
                onChange={setDiscoveryQuestions}
                placeholder="e.g. Which operational issue has the highest impact?"
              />
            </section>
          </div>
        </div>
      </div>
    </ObjectiveTourProvider>
  )
}