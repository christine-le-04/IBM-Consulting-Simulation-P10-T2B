/**
 * The meeting, as a Teams-style chat with the client.
 *
 * All of the live behaviour is unchanged — the streamed replies over
 * useMeetingSocket, free text, the automatic close once the
 * client is ready, the debrief, retries and the termination dialog.
 *
 * The trust / interest / patience meters are gone (SRS FR-14: no numbers
 * during play): the engagement bar describes the client in a sentence, and
 * "What just happened" says what the last answer did, in words.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, InlineNotification, Modal, Tag } from '@carbon/react'
import { ArrowRight, Idea, Information, Send } from '@carbon/icons-react'
import { useEngagement, useRetryEngagement } from '@/api/hooks/useEngagements'
import { useMeeting, useMeetingPreparation, useMeetingTranscript, usePersonaState, useRetryMeeting, useReturnToPreparation } from '@/api/hooks/useMeeting'
import { useMeetingSocket } from '@/api/hooks/useMeetingSocket'
import { useScenario } from '@/api/hooks/useScenarios'
import type { ConversationTurn, MeetingBehaviourFeedback, MeetingTermination, PersonaState } from '@/api/types'
import ErrorState from '@/components/shared/ErrorState'
import LoadingState from '@/components/shared/LoadingState'
import ObjectiveTourProvider from '@/components/shared/ObjectiveTourProvider'
import { useMentor } from '@/components/shell/useMentor'
import styles from './LiveMeetingPage.module.scss'

const DEFAULT_MEETING_THRESHOLD = 70

const LIVE_MEETING_OBJECTIVES = [
  {
    id: 'meeting-options',
    objective: 'The conversation',
    description: 'This is the meeting. Write your own response, and the client answers in real time.',
    targets: ['.objective-meeting-view'],
  },
  {
    id: 'hints',
    objective: 'Stuck? Get a hint',
    description: 'If you are unsure what to say next, the hint points at what the client just asked or raised.',
    targets: ['.objective-hints'],
  },
  {
    id: 'relationship',
    objective: 'What just happened',
    description: 'After each answer this panel says what it did to the relationship, in words. Your plan and the facts the client has shared are one tab away.',
    targets: ['.objective-relationship'],
  },
]

type PanelView = 'happening' | 'notes' | 'facts'

function deriveHint(transcript: ConversationTurn[], signals: string[], state: PersonaState, threshold: number) {
  const latestPersonaTurn = [...transcript].reverse().find((turn) => turn.actor === 'PERSONA')
  const question = latestPersonaTurn?.content.match(/[^?.!]*\?/)?.[0]?.trim()
  const signal = signals.find((item) => item.startsWith('objection:'))?.replace('objection:', '').trim()
  const guidance: string[] = []

  if (question) guidance.push(`Answer the client’s specific question: “${question}”`)
  else if (latestPersonaTurn) guidance.push('Acknowledge the client’s latest point before moving to your next question.')
  if (signal) guidance.push(`Address this concern directly: ${signal}`)
  if (state.patience < threshold) guidance.push('Keep the next response focused: one point, one question.')
  if (state.trust < threshold) guidance.push('Use a concrete detail from what the client has already shared.')
  if (state.interest < threshold) guidance.push('Connect the next question to a business outcome the client cares about.')

  return guidance.slice(0, 3)
}

function toTermination(meetingReason: string | null, message: string | null, tips: string[],
                       meetingRetryAvailable: boolean, meetingRetriesRemaining: number): MeetingTermination | null {
  if (!meetingReason || !message) return null
  if (meetingReason !== 'UNPROFESSIONAL_CONDUCT' && meetingReason !== 'RELATIONSHIP_THRESHOLD_BREACH') return null
  return { reason: meetingReason, message, retryGuidance: tips, meetingRetryAvailable, meetingRetriesRemaining }
}

/** What the last answer did to the relationship, as a sentence rather than deltas. */
function effectOf(feedback: MeetingBehaviourFeedback): string {
  return [
    feedback.trustDelta > 0 ? 'They trust you a little more.' : feedback.trustDelta < 0 ? 'They trust you less.' : '',
    feedback.interestDelta > 0 ? 'Their interest went up.' : feedback.interestDelta < 0 ? 'Their interest dropped.' : '',
    feedback.patienceDelta < -5 ? 'It cost a lot of their patience.' : feedback.patienceDelta < 0 ? 'It cost a little of their patience.' : '',
  ].filter(Boolean).join(' ')
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function clock(createdAt: string) {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function LiveMeetingPage() {
  const { engagementId = '', meetingId = '' } = useParams<{ engagementId: string; meetingId: string }>()
  const navigate = useNavigate()
  const { data: meeting, isLoading: meetingLoading, isError: meetingError } = useMeeting(meetingId)
  const { data: transcript, isLoading: transcriptLoading } = useMeetingTranscript(meetingId)
  const { data: persistedPersonaState, isLoading: personaStateLoading } = usePersonaState(meetingId)
  const { data: preparation } = useMeetingPreparation(engagementId)
  const { data: engagement } = useEngagement(engagementId)
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  const retryMeeting = useRetryMeeting(meetingId, engagementId)
  const { streamingText, isStreaming, error, personaState, latestSignals, termination, behaviourFeedback, sendMessage } = useMeetingSocket(meetingId)
  const retryEngagement = useRetryEngagement(engagementId)
  const returnToPreparation = useReturnToPreparation(meetingId, engagementId)
  const [message, setMessage] = useState('')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [terminationDismissed, setTerminationDismissed] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)
  const [view, setView] = useState<PanelView>('happening')
  const chatRef = useRef<HTMLDivElement>(null)
  const debriefRef = useRef<HTMLElement>(null)

  const turns = useMemo(() => transcript ?? [], [transcript])
  const currentState = personaState ?? persistedPersonaState
  const latestPersistedFeedback = meeting?.behaviourLedger?.[meeting.behaviourLedger.length - 1] ?? null
  const feedback = behaviourFeedback ?? latestPersistedFeedback
  const meetingThreshold = meeting?.meetingThreshold ?? DEFAULT_MEETING_THRESHOLD
  const hint = useMemo(
    () => currentState ? deriveHint(turns, latestSignals, currentState, meetingThreshold) : [],
    [turns, latestSignals, currentState, meetingThreshold],
  )
  const persona = scenario?.personas.find((item) => item.id === meeting?.personaId)
  const clientName = persona?.name ?? 'The client'
  const isCompleted = meeting?.status === 'COMPLETED'
  const passed = meeting?.completionOutcome === 'PASSED'
  const meetingGateMet = Boolean(currentState
    && currentState.trust >= meetingThreshold && currentState.interest >= meetingThreshold && currentState.patience >= meetingThreshold)
  const clientReadyToClose = latestSignals.includes('client_ready_to_close') || latestSignals.includes('client_committed_next_step')
  const readyToClose = !isCompleted && (meetingGateMet || clientReadyToClose)

  // Keep the latest message in view; once the meeting ends, bring the debrief
  // up instead. Scrolls the chat only, never the page around it.
  useEffect(() => {
    const chat = chatRef.current
    if (!chat) return
    const debrief = debriefRef.current
    const top = debrief
      ? chat.scrollTop + debrief.getBoundingClientRect().top - chat.getBoundingClientRect().top - 16
      : chat.scrollHeight
    chat.scrollTo({ top, behavior: 'smooth' })
  }, [turns.length, streamingText, isCompleted])

  useEffect(() => {
    setMessage('')
    setPendingMessage(null)
    setTerminationDismissed(false)
    setHintOpen(false)
  }, [meetingId])

  useMentor(
    isCompleted
      ? passed
        ? 'Good meeting. Write down what they told you before you draft a single line of the proposal.'
        : 'That one got away from you. Read the debrief before you try again — it is short.'
      : readyToClose
        ? 'They are ready to wrap up. Confirm one next step, with a date and an owner.'
        : feedback?.nextBestAction ?? 'Open with a question about their priorities, not a pitch.',
    isCompleted && passed ? { label: 'Continue to the proposal', to: `/dashboard/engagements/${engagementId}/proposal`, ready: true } : null,
  )

  if (meetingLoading || transcriptLoading || personaStateLoading) return <LoadingState />
  if (meetingError || !meeting) return <ErrorState />
  if (!currentState) return <ErrorState />

  const debriefTips = meeting.debriefTips ?? []
  const automaticTermination = termination ?? toTermination(
    meeting.terminationReason,
    meeting.terminationMessage,
    debriefTips,
    meeting.meetingRetryAvailable,
    meeting.meetingRetriesRemaining,
  )
  const canRetryMeeting = automaticTermination?.meetingRetryAvailable ?? meeting.meetingRetryAvailable
  const meetingRetriesRemaining = automaticTermination?.meetingRetriesRemaining ?? meeting.meetingRetriesRemaining
  const pendingIsPersisted = pendingMessage !== null
    && turns.some((turn) => turn.actor === 'LEARNER' && turn.content === pendingMessage)
  const now = new Date().toISOString()

  const sendResponse = async (outgoing: string) => {
    if (!outgoing || isStreaming) return
    setMessage('')
    setPendingMessage(outgoing)
    try {
      // An undelivered message goes back in the box instead of being lost.
      if (await sendMessage(outgoing) === false) setMessage((current) => current || outgoing)
    } finally {
      setPendingMessage(null)
    }
  }

  const handleRetryLead = () => {
    if (automaticTermination?.reason !== 'UNPROFESSIONAL_CONDUCT') {
      returnToPreparation.mutate(undefined, {
        onSuccess: () => navigate(`/dashboard/engagements/${engagementId}/preparation`),
      })
      return
    }
    retryEngagement.mutate(undefined, {
      onSuccess: (retry) => navigate(`/dashboard/engagements/${retry.id}/intelligence`),
    })
  }

  const handleRetryMeeting = () => {
    retryMeeting.mutate(undefined, {
      onSuccess: (retry) => navigate(`/dashboard/engagements/${engagementId}/meetings/${retry.id}`),
    })
  }

  const renderTurn = (turn: ConversationTurn, streaming = false) => turn.actor === 'LEARNER' ? (
    <div key={turn.id} className={styles.mine}>
      <time>{clock(turn.createdAt)}</time>
      <p>{turn.content}</p>
    </div>
  ) : (
    <div key={turn.id} className={styles.theirs}>
      <span className={styles.avatar} aria-hidden="true">{initials(clientName)}</span>
      <div>
        <span className={styles.meta}><strong>{clientName}</strong> <time>{clock(turn.createdAt)}</time></span>
        <p className={streaming ? styles.streaming : undefined}>{turn.content}</p>
      </div>
    </div>
  )

  return (
    <ObjectiveTourProvider tourId="live-meeting" objectives={LIVE_MEETING_OBJECTIVES}>
      <div className={styles.teams}>
        <div className={`${styles.chatPane} objective-meeting-view`}>
          <header className={styles.chatHead}>
            <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden="true">
              {initials(clientName)}<i className={isCompleted ? styles.statusAway : styles.statusOn} />
            </span>
            <div className={styles.chatWho}>
              <strong>{clientName}</strong>
              <span>{[persona?.jobTitle, persona?.organisation ?? engagement?.leadCompanyName].filter(Boolean).join(' · ')}</span>
            </div>
            <Tag type="purple" size="sm" title="Respond in your own words">
              Free text
            </Tag>
            {!isCompleted && hint.length > 0 && (
              <div className={`${styles.hintWrap} objective-hints`}>
                <button type="button" className={styles.hintButton} aria-expanded={hintOpen} aria-controls="meeting-response-hint" onClick={() => setHintOpen((open) => !open)}>
                  <Idea size={16} /> Stuck? Get a hint
                </button>
                {hintOpen && (
                  <div className={styles.hint} id="meeting-response-hint" role="note">
                    <p>Next-turn hint</p>
                    {hint[0]}
                  </div>
                )}
              </div>
            )}
          </header>

          <div className={styles.messages} ref={chatRef} aria-label={`Conversation with ${clientName}`} aria-live="polite">
            <p className={styles.system}><Information size={14} /> Meeting started · transcript saved automatically</p>
            {turns.length === 0 && !pendingMessage && <p className={styles.system}>Begin with a focused discovery question.</p>}
            {turns.map((turn) => renderTurn(turn))}
            {pendingMessage && !pendingIsPersisted && renderTurn({ id: 'pending-learner', meetingId, actor: 'LEARNER', content: pendingMessage, sequence: -1, signals: null, createdAt: now })}
            {isStreaming && streamingText && renderTurn({ id: 'streaming-persona', meetingId, actor: 'PERSONA', content: streamingText, sequence: -1, signals: null, createdAt: now }, true)}

            {isCompleted && (
              <p className={styles.system}><Information size={14} /> {automaticTermination ? `${clientName} left the meeting` : 'Meeting ended'}</p>
            )}

            {isCompleted && (
              <section ref={debriefRef} className={passed ? styles.debriefPassed : styles.debriefFailed}>
                <div className={styles.debriefHead}>
                  <div>
                    <p className={styles.eyebrow}>Debrief</p>
                    <h2>{passed ? 'Meeting passed' : 'Meeting not passed'}</h2>
                  </div>
                  <Tag type={passed ? 'green' : 'red'}>{passed ? 'Passed' : 'Not passed'}</Tag>
                </div>
                {meeting.debriefFeedback && <p>{meeting.debriefFeedback}</p>}
                {debriefTips.length > 0 && <ul>{debriefTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>}
                {passed ? (
                  <Button renderIcon={ArrowRight} onClick={() => navigate(`/dashboard/engagements/${engagementId}/proposal`)}>Continue to the proposal</Button>
                ) : canRetryMeeting ? (
                  <Button kind="secondary" disabled={retryMeeting.isPending} onClick={handleRetryMeeting}>
                    {retryMeeting.isPending ? 'Starting live meeting…' : `Retry live meeting (${meetingRetriesRemaining} remaining)`}
                  </Button>
                ) : (
                  <Button kind="secondary" disabled={retryEngagement.isPending || returnToPreparation.isPending} onClick={handleRetryLead}>
                    {automaticTermination?.reason === 'UNPROFESSIONAL_CONDUCT' ? 'Retry this lead from the start' : 'Return to meeting preparation'}
                  </Button>
                )}
              </section>
            )}
          </div>

          {error && (
            <div className={styles.errors}>
              <InlineNotification kind="error" lowContrast hideCloseButton title="Message failed" subtitle={error} />
            </div>
          )}
          {returnToPreparation.isError && !automaticTermination && (
            <InlineNotification kind="error" hideCloseButton title="Could not return to preparation" subtitle="Your meeting is saved. Try again." />
          )}

          {!isCompleted && (
            <footer className={styles.composeArea}>
              {isStreaming && <p className={styles.typing}>{clientName} is typing<span>.</span><span>.</span><span>.</span></p>}
              {readyToClose && (
                <p className={styles.closeBanner}><strong>{clientName} is ready to wrap up.</strong> Confirm one concrete next step — the meeting closes after their reply.</p>
              )}

              <div className={styles.composeBox}>
                <textarea
                  value={message}
                  disabled={isStreaming}
                  rows={2}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      void sendResponse(message.trim())
                    }
                  }}
                  placeholder={readyToClose ? 'Confirm the next step, owner and timing…' : 'Type a message'}
                  aria-label={`Message ${clientName}`}
                />
                <button type="button" className={styles.send} disabled={isStreaming || !message.trim()} onClick={() => void sendResponse(message.trim())} aria-label="Send">
                  <Send size={20} />
                </button>
              </div>
              <p className={styles.composeHelp}>Enter to send · Shift + Enter for a new line</p>
            </footer>
          )}
        </div>

        <aside className={`${styles.panel} objective-relationship`} aria-label="Meeting panel">
          <div className={styles.segments} role="tablist">
            <button type="button" role="tab" aria-selected={view === 'happening'} onClick={() => setView('happening')}>What just happened</button>
            <button type="button" role="tab" aria-selected={view === 'notes'} onClick={() => setView('notes')}>Your notes</button>
            <button type="button" role="tab" aria-selected={view === 'facts'} onClick={() => setView('facts')}>Facts <span>{currentState.disclosedFacts.length}</span></button>
          </div>

          {view === 'happening' && (
            <div className={styles.panelBody}>
              {feedback ? (
                <>
                  <p className={styles.eyebrow}>Simulation director</p>
                  <h3 className={styles.quality}>{feedback.quality.replaceAll('_', ' ').toLowerCase()}</h3>
                  <p>{feedback.explanation}</p>
                  {effectOf(feedback) && <p className={styles.effect}>{effectOf(feedback)}</p>}
                  <div className={styles.behaviours}>
                    {feedback.verifiedBehaviours.map((item) => {
                      const label = item.replaceAll('_', ' ')
                      return <Tag key={item} type="blue" size="sm">{label.charAt(0).toUpperCase() + label.slice(1)}</Tag>
                    })}
                  </div>
                </>
              ) : (
                <p className={styles.muted}>After each answer, this says what it did to the relationship.</p>
              )}
            </div>
          )}

          {view === 'notes' && (
            <div className={styles.panelBody}>
              {preparation ? (
                <>
                  <p className={styles.eyebrow}>Objective</p>
                  <p>{preparation.objective ?? 'No objective written.'}</p>
                  <p className={styles.eyebrow}>Agenda</p>
                  <ol className={styles.checklist}>{preparation.agenda.map((item) => <li key={item}><input type="checkbox" aria-label={item} /> {item}</li>)}</ol>
                  <p className={styles.eyebrow}>Questions to ask</p>
                  <ol className={styles.checklist}>{preparation.discoveryQuestions.map((item) => <li key={item}><input type="checkbox" aria-label={item} /> {item}</li>)}</ol>
                  <p className={styles.muted}>Ticks are for you during the meeting; they are not saved.</p>
                </>
              ) : (
                <p className={styles.muted}>Your meeting plan will show here.</p>
              )}
            </div>
          )}

          {view === 'facts' && (
            <div className={styles.panelBody}>
              <p className={styles.eyebrow}>Validated during the meeting</p>
              {currentState.disclosedFacts.length > 0
                ? <ul className={styles.facts}>{currentState.disclosedFacts.map((fact) => <li key={fact}>{fact.replace(/_/g, ' ')}</li>)}</ul>
                : <p className={styles.muted}>Nothing yet. Hidden facts only come out when you ask the right question.</p>}
            </div>
          )}
        </aside>
      </div>

      <Modal
        open={Boolean(automaticTermination && !terminationDismissed)}
        danger
        modalLabel="Meeting ended"
        modalHeading={automaticTermination?.reason === 'UNPROFESSIONAL_CONDUCT'
          ? 'Meeting failed: unprofessional conduct'
          : 'Meeting failed: relationship threshold breached'}
        primaryButtonText={automaticTermination?.meetingRetryAvailable
          ? (retryMeeting.isPending ? 'Starting live meeting…' : `Retry live meeting (${automaticTermination.meetingRetriesRemaining} remaining)`)
          : (automaticTermination?.reason === 'UNPROFESSIONAL_CONDUCT' ? 'Retry this lead from the start' : 'Return to meeting preparation')}
        secondaryButtonText="Return to the Office"
        primaryButtonDisabled={retryMeeting.isPending || retryEngagement.isPending || returnToPreparation.isPending}
        onRequestSubmit={() => automaticTermination?.meetingRetryAvailable ? handleRetryMeeting() : handleRetryLead()}
        onSecondarySubmit={() => navigate('/dashboard')}
        onRequestClose={() => setTerminationDismissed(true)}
      >
        <p>{automaticTermination?.message}</p>
        <p className={styles.retryNote}>{automaticTermination?.meetingRetryAvailable
          ? 'This attempt is preserved for review. Your evidence and preparation remain available; the live conversation restarts with a clean relationship state.'
          : automaticTermination?.reason === 'UNPROFESSIONAL_CONDUCT'
            ? 'This attempt is preserved for review. Retrying creates a new engagement from the same lead with a clean learner state.'
            : 'Your research, preparation and transcripts are kept. Revise your meeting plan to start a fresh meeting cycle with three retries.'}</p>
        {automaticTermination?.retryGuidance.length ? (
          <ul className={styles.guidance}>{automaticTermination.retryGuidance.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        ) : null}
        {(retryMeeting.isError || retryEngagement.isError || returnToPreparation.isError) && (
          <InlineNotification kind="error" lowContrast hideCloseButton title="Retry could not be started" subtitle="Please try again. Your failed attempt has not been changed." />
        )}
      </Modal>
    </ObjectiveTourProvider>
  )
}
