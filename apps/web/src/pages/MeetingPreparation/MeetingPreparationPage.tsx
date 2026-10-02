import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, InlineLoading, InlineNotification } from '@carbon/react'
import { Add, TrashCan, ArrowRight, Calendar } from '@carbon/icons-react'
import {
  useMeetingPreparation,
  useUpdateMeetingPreparation,
  useStartMeeting,
} from '@/api/hooks/useMeeting'
import { useScenario } from '@/api/hooks/useScenarios'
import LoadingState from '@/components/shared/LoadingState'
import { getApiProblem } from '@/api/problemDetails'
import LoadError from '@/components/shared/LoadError'
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
const MIN_MEANINGFUL_LENGTH = 10
const OBJECTIVE_CREDIT = 20
const MAX_AGENDA_CREDIT = 40
const MAX_QUESTION_CREDIT = 40
const CREDIT_PER_AGENDA_ITEM = 10
const CREDIT_PER_QUESTION = 8
const MEETING_PREP_OBJECTIVES = [
  {
    id: 'readiness',
    objective: 'Understand readiness preview',
    description: 'The readiness score shows how much preparation you have completed before you can move to the live meeting.',
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
    description: 'Save your plan without leaving here or join the meeting. The join button stays locked until the readiness score reaches the threshold.',
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

export default function MeetingPreparationPage() {
  const { engagementId } = useParams<{ engagementId: string }>()
  const navigate = useNavigate()
  const { engagement } = useShellEngagement()
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  const { data: preparation, isLoading, isError, error, refetch } = useMeetingPreparation(engagementId!)
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
  if (isError) return <LoadError title="Meeting plan could not be opened" error={error} reassurance="Your draft is kept in this browser." onRetry={() => void refetch()} />

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

  const agendaCount = agenda.filter((item) => item.value.trim().length >= MIN_MEANINGFUL_LENGTH).length
  const questionCount = discoveryQuestions.filter((item) => item.value.trim().length >= MIN_MEANINGFUL_LENGTH).length
  const objectiveReady = objective.trim().length > 0
  const objectiveScore = objectiveReady ? OBJECTIVE_CREDIT : 0
  const agendaScore = Math.min(MAX_AGENDA_CREDIT, agendaCount * CREDIT_PER_AGENDA_ITEM)
  const questionScore = Math.min(MAX_QUESTION_CREDIT, questionCount * CREDIT_PER_QUESTION)
  const readinessScore = Math.min(100, objectiveScore + agendaScore + questionScore)
  const remainingPoints = Math.max(0, READY_THRESHOLD - readinessScore)
  const ready = readinessScore >= READY_THRESHOLD
  const isSaving = updatePreparation.isPending || launchingMeeting
  const readinessBreakdown = [
    `Objective — ${objectiveScore}/${OBJECTIVE_CREDIT} points`,
    `Agenda — ${agendaScore}/${MAX_AGENDA_CREDIT} points (${CREDIT_PER_AGENDA_ITEM} points each)`,
    `Discovery questions — ${questionScore}/${MAX_QUESTION_CREDIT} points (${CREDIT_PER_QUESTION} points each)`,
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

          {(updatePreparation.isError || startMeeting.isError) && (
            <div className={styles.eventErrors}>
              {updatePreparation.isError && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title="Failed to save preparation"
                  subtitle="Your local draft is still available. Try saving again."
                />
              )}
              {startMeeting.isError && (
                <InlineNotification
                  kind="error"
                  lowContrast
                  hideCloseButton
                  title="Meeting could not be started"
                  subtitle={getApiProblem(startMeeting.error, '').status === 422
                    ? 'Your preparation is saved, but the meeting cannot be opened yet. Check the readiness panel, then try again.'
                    : 'Your preparation is saved. Try joining the meeting again.'}
                />
              )}
            </div>
          )}

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
                <span className={styles.label}>Readiness</span>
                <div className={styles.readinessScore}>
                  <strong>{readinessScore}/{READY_THRESHOLD}</strong>
                  <span> points</span>
                </div>
                <ul className={styles.readinessList}>
                  {readinessBreakdown.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {ready ? (
                  <p>You have reached the readiness threshold and can join the meeting.</p>
                ) : (
                  <>
                    <p>{remainingPoints} more point{remainingPoints === 1 ? '' : 's'} needed to reach readiness.</p>
                    <p>Note: Each entry must be at least 10 characters to be counted as a meaningful response.</p>
                  </>
                )}
              </section>

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