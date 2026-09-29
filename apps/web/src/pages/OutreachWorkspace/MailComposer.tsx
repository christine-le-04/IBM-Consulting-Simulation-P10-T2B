/**
 * The compose window: subject and message with the same rules as before
 * (subject 5–200, message 50–5000 characters), live counts, the draft-safety
 * notice that can block Send, the evidence assistant as an "Insert from case
 * file" menu, and the self-check as the "Editor" pane beside the draft.
 */
import { useMemo, useState } from 'react'
import { Button, InlineNotification } from '@carbon/react'
import { Attachment, CheckmarkFilled, CircleDash, Close, Send } from '@carbon/icons-react'
import type { ResearchEvidence } from '@/api/types'
import { assessDraftSafety, evaluateOutreach, type RubricContext } from '@/lifecycle/coaching/outreachRubric'
import { rankOutreachEvidence } from '@/lifecycle/coaching/outreachEvidence'
import { evidenceCode } from '@/components/shell/evidence'
import styles from './OutreachWorkspacePage.module.scss'

export interface ComposerTourClasses {
  compose?: string
  insert?: string
  editor?: string
  send?: string
}

const firstParagraph = (note: string) => note.split('\n\n')[0]

export default function MailComposer({
  reply,
  initialSubject,
  from,
  to,
  toOrganisation,
  context,
  evidence,
  sending,
  errorMessage,
  onSend,
  onClose,
  tour = {},
}: {
  reply: boolean
  initialSubject: string
  from: string
  to: string
  toOrganisation: string
  context: RubricContext
  evidence: ResearchEvidence[]
  sending: boolean
  errorMessage?: string | null
  onSend: (email: { subject: string; body: string }, clear: () => void) => void
  onClose?: () => void
  tour?: ComposerTourClasses
}) {
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState('')
  const [insertOpen, setInsertOpen] = useState(false)
  const [touched, setTouched] = useState(false)

  const rubric = useMemo(() => evaluateOutreach(body, context), [body, context])
  const safety = assessDraftSafety(body)
  const ranked = rankOutreachEvidence(evidence).slice(0, 8)
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  const subjectError = !touched ? null
    : subject.trim().length < 5 ? 'Enter a clear subject' : subject.length > 200 ? 'Keep the subject under 200 characters' : null
  const bodyError = !touched ? null
    : body.trim().length < 50 ? 'Message must be at least 50 characters' : body.length > 5000 ? 'Keep the message under 5,000 characters' : null

  const append = (text: string) => {
    setBody((current) => `${current.trim()}${current.trim() ? '\n\n' : ''}${text}`)
    setInsertOpen(false)
  }

  const send = () => {
    setTouched(true)
    const valid = subject.trim().length >= 5 && subject.length <= 200 && body.trim().length >= 50 && body.length <= 5000
    if (!valid || safety.risk === 'blocking') return
    onSend({ subject: subject.trim(), body }, () => {
      setSubject(initialSubject)
      setBody('')
      setTouched(false)
    })
  }

  return (
    <div className={styles.composeWrap}>
      <section className={`${styles.compose} ${tour.compose ?? ''}`} aria-label={reply ? 'Reply' : 'New message'}>
        <header className={styles.composeBar}>
          <strong>{reply ? 'Reply' : 'New message'}</strong>
          {onClose && <button type="button" onClick={onClose} aria-label="Discard draft"><Close size={16} /></button>}
        </header>
        <div className={styles.field}>
          <span>From</span>
          <strong>{from}</strong>
          <small>Associate Consultant · IBM Consulting</small>
        </div>
        <div className={styles.field}>
          <span>To</span>
          <span className={styles.recipient}>{to}</span>
          <small>{toOrganisation}</small>
        </div>
        <label className={`${styles.field} ${subjectError ? styles.fieldInvalid : ''}`}>
          <span>Subject</span>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Add a subject" aria-label="Subject" />
          <small>{subject.length} characters</small>
        </label>
        {subjectError && <p className={styles.error}>{subjectError}</p>}

        <div className={styles.toolbar}>
          <span className={styles.toolbarSpacer} />
          <div className={styles.insert}>
            <button type="button" className={`${styles.insertButton} ${tour.insert ?? ''}`} onClick={() => setInsertOpen((open) => !open)} aria-expanded={insertOpen}>
              <Attachment size={16} /> Insert from case file
            </button>
          </div>
        </div>

        {insertOpen && (
          <div className={styles.insertMenu} role="menu" aria-label="Insert from case file">
            <p className={styles.menuLabel}>Quick starts</p>
            <button type="button" role="menuitem" onClick={() => { setSubject(`Idea for ${context.companyName ?? 'your team'}`); setInsertOpen(false) }}>Start a clear subject line</button>
            <button type="button" role="menuitem" disabled={!ranked[0]} onClick={() => ranked[0] && append(`I noticed ${firstParagraph(ranked[0].note)} `)}>Reference the latest client signal</button>
            <button type="button" role="menuitem" onClick={() => append('Would a 20-minute conversation next week be useful?')}>Invite a short conversation</button>
            {ranked.length > 0 && <p className={styles.menuLabel}>Evidence you can reference</p>}
            {ranked.map((item) => (
              <button key={item.id} type="button" role="menuitem" className={styles.menuEvidence} onClick={() => append(`I noticed ${firstParagraph(item.note)} `)}>
                <span className={styles.menuCode}>{evidenceCode(item.sequenceNo)}</span>
                <span>
                  <strong>{item.sourceTitle ?? item.evidenceType.replace(/_/g, ' ')}</strong>
                  <small>{firstParagraph(item.note)}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <textarea
          className={`${styles.body} ${bodyError ? styles.bodyInvalid : ''}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={reply ? 'Write your reply…' : `Dear ${to},\n\n…`}
          aria-label="Message"
        />
        {bodyError && <p className={styles.error}>{bodyError}</p>}

        {safety.message && (
          <p className={`${styles.safety} ${safety.risk === 'blocking' ? styles.safetyBlocking : ''}`} role="status">{safety.message}</p>
        )}
        {errorMessage && (
          <InlineNotification kind="error" lowContrast hideCloseButton title="Message could not be sent" subtitle={errorMessage} />
        )}

        <footer className={styles.composeFoot}>
          <span className={tour.send}>
            <Button renderIcon={Send} onClick={send} disabled={sending || safety.risk === 'blocking'}>
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </span>
          <span className={styles.counts}>{words} words · {body.length} characters</span>
          <span className={styles.composeNote}>Nothing is sent until you press Send. Evidence and tone are checked on the way out.</span>
        </footer>
      </section>

      {/* The learner's own pre-flight check, never a prediction of the reply. */}
      <aside className={`${styles.editor} ${tour.editor ?? ''}`} aria-live="polite" aria-label="Editor">
        <header>
          <strong>Editor</strong>
          <span>{rubric.metCount} of 4 · {words} {words === 1 ? 'word' : 'words'}</span>
        </header>
        {!reply && (
          <p className={styles.editorExplain}>
            These are the four things the client’s team looks for. This is your own check before you send — the client still decides.
          </p>
        )}
        <ul>
          {rubric.checks.map((check) => (
            <li key={check.dimension} className={check.met ? styles.checkMet : undefined}>
              {check.met ? <CheckmarkFilled size={16} /> : <CircleDash size={16} />}
              <span>
                <strong>{check.label}</strong>
                {!check.met && <small>{check.advice}</small>}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}
