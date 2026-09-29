/**
 * The meeting — design doc §4 screen 6. "The centrepiece of the product, and
 * the conversation is the smallest thing on it." Now the conversation gets the
 * screen, Send is always above the fold, and the five-panel rail becomes one.
 * The meeting-gate meters go: the strip already carries the client's state as
 * a cue (FR-14). The "client is replying" indicator stays (NFR-02).
 *
 * Skin: a Teams-style chat with the client (team request, 28 Sep). Free text
 * is the default (SRS 2.0, FR-11); guided mode shows the AI-generated options
 * as suggested replies. Retries follow FR-23: three attempts, then back to
 * meeting prep with earlier progress kept.
 */
import { useEffect, useRef, useState } from 'react'
import { Button, InlineNotification, Modal, Tag } from '@carbon/react'
import { ArrowRight, Idea, Send, Information } from '@carbon/icons-react'
import type { ConversationTurn } from '@/api/types'
import {
  BEHAVIOUR,
  FAILED_BEHAVIOUR,
  DISCLOSED_FACTS,
  FAILED_DEBRIEF,
  PASSED_DEBRIEF,
  PREPARATION,
  READY_TO_CLOSE_OPTIONS,
  RESPONSE_OPTIONS,
  TERMINATION,
  TRANSCRIPT,
} from '../data/engagementFlow'
import { MOOD_STATE, useProto } from '../state/protoStore'
import styles from './meeting.module.scss'

type PanelView = 'happening' | 'notes' | 'facts'

const REPLY_TO_OPTION: Record<number, string> = {
  0: 'That I could defend. Two weeks, one site, and a number I can put in front of the regulator. Which site would you start with?',
  1: 'That is exactly what the last vendor said. Six months is past the review. I asked why you are different.',
  2: 'I would rather not relitigate them. The short version: they all started with software, not with the ward.',
}

// Sarah's reply to the learner's closing message. As in the live meeting,
// once she is ready to conclude, her next reply closes the meeting by itself.
const CLOSING_REPLY: Record<number, string> = {
  0: 'Agreed. Ashford from the 13th, and I will tell the ward sisters today. Send me the plan by Friday.',
  1: 'Next month is after the review. I needed a step we could take now. Let us leave it there for today.',
  2: 'Another meeting is not a next step. I will think about whether this is worth more of my time.',
}

// In the mockup, two good exchanges bring Sarah to the point of concluding.
const EXCHANGES_BEFORE_CLOSE = 2

const MAX_ATTEMPTS = 3

function clock(index: number) {
  return `10:${String(2 + index * 2).padStart(2, '0')}`
}

export default function MeetingScreen() {
  const mode = useProto((s) => s.meetingMode)
  const variant = useProto((s) => s.meetingVariant)
  const mood = useProto((s) => s.mood)
  const set = useProto((s) => s.set)
  const go = useProto((s) => s.go)
  const [turns, setTurns] = useState<ConversationTurn[]>(TRANSCRIPT)
  const [replying, setReplying] = useState(false)
  const [message, setMessage] = useState('')
  const [goodExchanges, setGoodExchanges] = useState(0)
  const [hintOpen, setHintOpen] = useState(false)
  const [view, setView] = useState<PanelView>('happening')
  const [terminationDismissed, setTerminationDismissed] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)

  const completed = variant === 'PASSED' || variant === 'FAILED' || variant === 'NO_RETRIES'
  const terminated = variant === 'TERMINATED'
  const ended = completed || terminated
  const readyToClose = variant === 'READY_TO_CLOSE'
  const guided = mode === 'GUIDED'
  const options = readyToClose ? READY_TO_CLOSE_OPTIONS : RESPONSE_OPTIONS
  const wentWrong = variant === 'FAILED' || variant === 'NO_RETRIES' || terminated
  const feedback = wentWrong ? FAILED_BEHAVIOUR : BEHAVIOUR
  // FR-23: attempts used so far on this meeting.
  const attemptsUsed = variant === 'NO_RETRIES' ? MAX_ATTEMPTS : ended ? 1 : 0
  const attemptsLeft = MAX_ATTEMPTS - attemptsUsed
  const state = MOOD_STATE[mood]
  const latestQuestion = [...turns].reverse().find((turn) => turn.actor === 'PERSONA')?.content.match(/[^?.!]*\?/)?.[0]?.trim()
  const hint = latestQuestion
    ? `Answer the client’s specific question: “${latestQuestion}”`
    : state.patience < 70 ? 'Keep the next response focused: one point, one question.' : 'Acknowledge the client’s latest point before moving to your next question.'

  const debriefRef = useRef<HTMLElement>(null)
  useEffect(() => {
    // When the meeting ends, bring the debrief's heading into view so the way
    // on is visible; otherwise keep the latest message in view.
    // Scrolls the chat only — scrollIntoView would also move the page around it.
    const frame = window.requestAnimationFrame(() => {
      const chat = chatRef.current
      const debrief = debriefRef.current
      if (!chat) return
      const top = debrief
        ? chat.scrollTop + debrief.getBoundingClientRect().top - chat.getBoundingClientRect().top - 16
        : chat.scrollHeight
      chat.scrollTo({ top, behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [turns.length, replying, variant])

  // The way on also sits beside Dana's line, so it never hides below the chat.
  useEffect(() => {
    if (variant === 'PASSED') set({ nextStep: { label: 'Continue to the proposal', screen: 'PROPOSAL', ready: true } })
    else set({ nextStep: null })
  }, [variant, set])

  const respond = (content: string, optionIndex = 0) => {
    if (!content.trim() || replying) return
    const sequence = turns.length + 1
    setTurns((current) => [...current, { ...current[0], id: `l${sequence}`, actor: 'LEARNER', content, sequence }])
    setMessage('')
    setReplying(true)
    const closing = readyToClose
    window.setTimeout(() => {
      const reply = closing ? CLOSING_REPLY[optionIndex] ?? CLOSING_REPLY[0] : REPLY_TO_OPTION[optionIndex] ?? REPLY_TO_OPTION[0]
      setTurns((current) => [...current, { ...current[0], id: `p${sequence + 1}`, actor: 'PERSONA', content: reply, sequence: sequence + 1 }])
      setReplying(false)
      if (closing) {
        // Her reply closes the meeting; the debrief follows.
        window.setTimeout(() => set({ meetingVariant: optionIndex === 0 ? 'PASSED' : 'FAILED', mood: optionIndex === 0 ? 'WARM' : 'COOLING' }), 1200)
        return
      }
      // Free text counts as a good reply in the mockup; in guided mode only the first suggestion does.
      if (optionIndex !== 0) return set({ mood: 'COOLING' })
      const exchanges = goodExchanges + 1
      setGoodExchanges(exchanges)
      if (exchanges >= EXCHANGES_BEFORE_CLOSE) set({ meetingVariant: 'READY_TO_CLOSE', mood: 'WARM' })
    }, 1800)
  }

  const retry = () => { setGoodExchanges(0); set({ meetingVariant: 'IN_PROGRESS', mood: 'GUARDED' }) }
  const backToPrep = () => { set({ meetingVariant: 'IN_PROGRESS', mood: 'GUARDED' }); go('PREPARE') }

  return (
    <div className={styles.teams}>
      <div className={styles.chatPane}>
        <header className={styles.chatHead}>
          <span className={`${styles.avatar} ${styles.avatarLarge}`} aria-hidden="true">SC<i className={ended ? styles.statusAway : styles.statusOn} /></span>
          <div className={styles.chatWho}>
            <strong>Sarah Chen</strong>
            <span>Chief Operating Officer · MediCare Regional Hospital Network</span>
          </div>
          <span className={styles.attempts}>Attempt {Math.min(attemptsUsed + (ended ? 0 : 1), MAX_ATTEMPTS)} of {MAX_ATTEMPTS}</span>
          {!ended && (
            <div className={styles.hintWrap}>
              <button type="button" className={styles.hintButton} aria-expanded={hintOpen} onClick={() => setHintOpen((open) => !open)}>
                <Idea size={16} /> Stuck? Get a hint
              </button>
              {hintOpen && (
                <div className={styles.hint} role="note">
                  <p>Next-turn hint</p>
                  {hint}
                </div>
              )}
            </div>
          )}
        </header>

        <div className={styles.messages} ref={chatRef} aria-label="Conversation with Sarah Chen" aria-live="polite">
          <p className={styles.system}><Information size={14} /> Meeting started · transcript saved automatically</p>
          {turns.map((turn, index) => {
            const mine = turn.actor === 'LEARNER'
            return mine ? (
              <div key={turn.id} className={styles.mine}>
                <time>{clock(index)}</time>
                <p>{turn.content}</p>
              </div>
            ) : (
              <div key={turn.id} className={styles.theirs}>
                <span className={styles.avatar} aria-hidden="true">SC</span>
                <div>
                  <span className={styles.meta}><strong>Sarah Chen</strong> <time>{clock(index)}</time></span>
                  <p>{turn.content}</p>
                </div>
              </div>
            )
          })}

          {ended && (
            <p className={styles.system}><Information size={14} /> {terminated ? 'Sarah left the meeting' : 'Meeting ended'}</p>
          )}

          {completed && (
            <section ref={debriefRef} className={variant === 'PASSED' ? styles.debriefPassed : styles.debriefFailed}>
              <div className={styles.debriefHead}>
                <div>
                  <p className={styles.eyebrow}>Debrief</p>
                  <h2>{variant === 'PASSED' ? 'Sarah is interested' : 'Sarah is not interested yet'}</h2>
                </div>
                <Tag type={variant === 'PASSED' ? 'green' : 'red'}>{variant === 'PASSED' ? 'Passed' : 'Not passed'}</Tag>
              </div>
              <p>{(variant === 'PASSED' ? PASSED_DEBRIEF : FAILED_DEBRIEF).feedback}</p>
              <ul>{(variant === 'PASSED' ? PASSED_DEBRIEF : FAILED_DEBRIEF).tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
              {variant === 'PASSED' ? (
                <Button renderIcon={ArrowRight} onClick={() => go('PROPOSAL')}>Continue to the proposal</Button>
              ) : variant === 'FAILED' ? (
                <>
                  <p className={styles.retryNote}>This attempt is kept for review. Your preparation stays; the conversation restarts with a clean relationship.</p>
                  <Button kind="secondary" onClick={retry}>Try the meeting again ({attemptsLeft} {attemptsLeft === 1 ? 'attempt' : 'attempts'} left)</Button>
                </>
              ) : (
                <>
                  <p className={styles.retryNote}>You have used all {MAX_ATTEMPTS} attempts at this meeting. Go back to meeting prep to rework your plan — your research, contact and earlier progress are kept, and you get {MAX_ATTEMPTS} fresh attempts.</p>
                  <div className={styles.retryActions}>
                    <Button kind="secondary" onClick={backToPrep}>Back to meeting prep</Button>
                    <Button kind="ghost" onClick={() => go('HUB')}>Back to the office</Button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        {variant === 'AI_ERROR' && (
          <div className={styles.errors}>
            <InlineNotification kind="error" lowContrast hideCloseButton title="Message failed" subtitle="Sarah could not reply. Nothing was lost — try again." />
            <Button kind="tertiary" size="sm" onClick={() => set({ meetingVariant: 'IN_PROGRESS' })}>Try again</Button>
          </div>
        )}

        {!ended && variant !== 'AI_ERROR' && (
          <footer className={styles.composeArea}>
            {replying && <p className={styles.typing}>Sarah Chen is typing<span>.</span><span>.</span><span>.</span></p>}
            {readyToClose && (
              <p className={styles.closeBanner}><strong>Sarah is ready to wrap up.</strong> Confirm one concrete next step — the meeting closes after her reply.</p>
            )}
            {guided && (
              <div className={styles.suggestions} aria-label="Suggested replies">
                <p>Suggested replies · not every professional-sounding answer moves things forward</p>
                {options.options.map((option, index) => (
                  <button key={option} type="button" disabled={replying} onClick={() => respond(option, index)}>{option}</button>
                ))}
              </div>
            )}
            <div className={`${styles.composeBox} ${guided ? styles.composeBoxOff : ''}`}>
              <textarea
                value={message}
                disabled={replying || guided}
                rows={2}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    respond(message)
                  }
                }}
                placeholder={guided ? 'Guided mode — pick a suggested reply above' : readyToClose ? 'Confirm the next step, owner and timing…' : 'Type a message'}
                aria-label="Message Sarah Chen"
              />
              <button type="button" className={styles.send} disabled={guided || replying || !message.trim()} onClick={() => respond(message)} aria-label="Send">
                <Send size={20} />
              </button>
            </div>
            {!guided && <p className={styles.composeHelp}>Enter to send · Shift + Enter for a new line</p>}
          </footer>
        )}
      </div>

      <aside className={styles.panel} aria-label="Meeting panel">
        <div className={styles.segments} role="tablist">
          <button type="button" role="tab" aria-selected={view === 'happening'} onClick={() => setView('happening')}>What just happened</button>
          <button type="button" role="tab" aria-selected={view === 'notes'} onClick={() => setView('notes')}>Your notes</button>
          <button type="button" role="tab" aria-selected={view === 'facts'} onClick={() => setView('facts')}>Facts <span>{DISCLOSED_FACTS.length}</span></button>
        </div>

        {view === 'happening' && (
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Simulation director</p>
            <h3 className={styles.quality}>{feedback.quality.replaceAll('_', ' ').toLowerCase()}</h3>
            <p>{feedback.explanation}</p>
            <p className={styles.effect}>
              {feedback.trustDelta > 0 ? 'She trusts you a little more. ' : feedback.trustDelta < 0 ? 'She trusts you less. ' : ''}
              {feedback.interestDelta > 0 ? 'Her interest went up. ' : feedback.interestDelta < 0 ? 'Her interest dropped. ' : ''}
              {feedback.patienceDelta < -5 ? 'It cost a lot of her patience.' : feedback.patienceDelta < 0 ? 'It cost a little of her patience.' : ''}
            </p>
            <div className={styles.behaviours}>
              {feedback.verifiedBehaviours.map((item) => {
                const label = item.replaceAll('_', ' ')
                return <Tag key={item} type={wentWrong ? 'red' : 'blue'} size="sm">{label.charAt(0).toUpperCase() + label.slice(1)}</Tag>
              })}
            </div>
          </div>
        )}

        {view === 'notes' && (
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Objective</p>
            <p>{PREPARATION.objective}</p>
            <p className={styles.eyebrow}>Agenda</p>
            <ol className={styles.checklist}>{PREPARATION.agenda.map((item, index) => <li key={item}><input type="checkbox" defaultChecked={index === 0} aria-label={item} /> {item}</li>)}</ol>
            <p className={styles.eyebrow}>Questions to ask</p>
            <ol className={styles.checklist}>{PREPARATION.discoveryQuestions.map((item, index) => <li key={item}><input type="checkbox" defaultChecked={index === 0} aria-label={item} /> {item}</li>)}</ol>
          </div>
        )}

        {view === 'facts' && (
          <div className={styles.panelBody}>
            <p className={styles.eyebrow}>Validated during the meeting</p>
            <ul className={styles.facts}>{DISCLOSED_FACTS.map((fact) => <li key={fact}>{fact.replace(/_/g, ' ')}</li>)}</ul>
            <p className={styles.muted}>Hidden facts only appear when you ask the right question (FR-13).</p>
          </div>
        )}
      </aside>

      <Modal
        open={terminated && !terminationDismissed}
        danger
        modalLabel="Meeting ended"
        modalHeading="Sarah ended the meeting early"
        primaryButtonText={`Try the meeting again (${MAX_ATTEMPTS - 1} attempts left)`}
        secondaryButtonText="Back to meeting prep"
        onRequestSubmit={retry}
        onSecondarySubmit={backToPrep}
        onRequestClose={() => setTerminationDismissed(true)}
      >
        <p>{TERMINATION.message}</p>
        <p style={{ marginTop: '1rem' }}>This attempt counts as 1 of {MAX_ATTEMPTS}. Your research and preparation are kept; the conversation restarts with a clean relationship.</p>
        <ul className={styles.guidance}>{TERMINATION.retryGuidance.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </Modal>
    </div>
  )
}
