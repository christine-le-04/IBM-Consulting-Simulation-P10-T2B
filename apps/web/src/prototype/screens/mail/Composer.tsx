/**
 * The compose window. Subject + message with the same validation as today
 * (subject ≥ 5, body ≥ 50 characters), live counts, the draft-safety notice
 * that can block Send, and the evidence assistant turned into an "Insert"
 * menu — the way a real mail client offers snippets and attachments.
 */
import { useMemo, useState } from 'react'
import { Button } from '@carbon/react'
import { Attachment, Close, Send, TextBold, TextItalic, ListBulleted, Link as LinkIcon } from '@carbon/icons-react'
import { assessDraftSafety, evaluateOutreach, keywordsFrom } from '@/lifecycle/coaching/outreachRubric'
import { rankOutreachEvidence } from '@/lifecycle/coaching/outreachEvidence'
import { PERSONA } from '../../data/scenario'
import { evidenceCode, useProto } from '../../state/protoStore'
import EditorPane from './EditorPane'
import styles from './mail.module.scss'

export default function Composer({ reply, initialSubject, onSent, onClose, attachment, sendBlockedReason, sending = false }: {
  reply: boolean
  initialSubject: string
  onSent: () => void
  onClose?: () => void
  attachment?: React.ReactNode
  /** Set when something other than the message itself must be finished first. */
  sendBlockedReason?: string | null
  sending?: boolean
}) {
  const evidence = useProto((s) => s.evidence)
  const [subject, setSubject] = useState(initialSubject)
  const [body, setBody] = useState('')
  const [insertOpen, setInsertOpen] = useState(false)
  const [touched, setTouched] = useState(false)

  const context = useMemo(() => ({
    personaName: PERSONA.name,
    companyName: 'MediCare Regional Hospital Network',
    keywords: keywordsFrom(evidence.map((item) => item.note)),
  }), [evidence])
  const rubric = evaluateOutreach(body, context)
  const safety = assessDraftSafety(body)
  const ranked = rankOutreachEvidence(evidence).slice(0, 8)
  const words = body.trim() ? body.trim().split(/\s+/).length : 0
  const subjectError = touched && subject.trim().length < 5 ? 'Enter a clear subject' : null
  const bodyError = touched && body.trim().length < 50 ? 'Message must be at least 50 characters' : null

  const append = (text: string) => {
    setBody((current) => `${current.trim()}${current.trim() ? '\n\n' : ''}${text}`)
    setInsertOpen(false)
  }

  const send = () => {
    setTouched(true)
    if (subject.trim().length < 5 || body.trim().length < 50 || safety.risk === 'blocking' || sendBlockedReason) return
    onSent()
  }

  return (
    <div className={styles.composeWrap}>
      <section className={styles.compose} aria-label={reply ? 'Reply' : 'New message'}>
        <header className={styles.composeBar}>
          <strong>{reply ? 'Reply' : 'New message'}</strong>
          {onClose && <button type="button" onClick={onClose} aria-label="Discard draft"><Close size={16} /></button>}
        </header>
        <div className={styles.field}>
          <span>From</span>
          <strong>Vince Tran</strong>
          <small>Associate Consultant · IBM Consulting</small>
        </div>
        <div className={styles.field}>
          <span>To</span>
          <span className={styles.recipient}>{PERSONA.name}</span>
          <small>MediCare Regional Hospital Network</small>
        </div>
        <label className={`${styles.field} ${subjectError ? styles.fieldInvalid : ''}`}>
          <span>Subject</span>
          <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Add a subject" />
          <small>{subject.length} characters</small>
        </label>
        {subjectError && <p className={styles.error}>{subjectError}</p>}

        <div className={styles.toolbar} aria-hidden="true">
          <TextBold size={16} /><TextItalic size={16} /><ListBulleted size={16} /><LinkIcon size={16} />
          <span className={styles.toolbarSpacer} />
          <div className={styles.insert}>
            <button type="button" className={styles.insertButton} onClick={() => setInsertOpen((open) => !open)} aria-expanded={insertOpen}>
              <Attachment size={16} /> Insert from case file
            </button>
          </div>
        </div>

        {insertOpen && (
          <div className={styles.insertMenu} role="menu">
            <p className={styles.menuLabel}>Quick starts</p>
            <button type="button" role="menuitem" onClick={() => { setSubject('Idea for MediCare Regional Hospital Network'); setInsertOpen(false) }}>Start a clear subject line</button>
            <button type="button" role="menuitem" disabled={!ranked[0]} onClick={() => ranked[0] && append(`I noticed ${ranked[0].note.split('\n\n')[0]} `)}>Reference the latest client signal</button>
            <button type="button" role="menuitem" onClick={() => append('Would a 20-minute conversation next week be useful?')}>Invite a short conversation</button>
            <p className={styles.menuLabel}>Evidence you can reference</p>
            {ranked.map((item) => (
              <button key={item.id} type="button" role="menuitem" className={styles.menuEvidence} onClick={() => append(`I noticed ${item.note.split('\n\n')[0]} `)}>
                <span className={styles.menuCode}>{evidenceCode(item.sequenceNo)}</span>
                <span>
                  <strong>{item.sourceTitle ?? item.evidenceType.replace(/_/g, ' ')}</strong>
                  <small>{item.note.split('\n\n')[0]}</small>
                </span>
              </button>
            ))}
          </div>
        )}

        <textarea
          className={`${styles.body} ${bodyError ? styles.bodyInvalid : ''}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={reply ? 'Write your reply…' : `Dear Ms Chen,\n\n…`}
          aria-label="Message"
        />
        {bodyError && <p className={styles.error}>{bodyError}</p>}

        {attachment}

        {safety.message && (
          <p className={`${styles.safety} ${safety.risk === 'blocking' ? styles.safetyBlocking : ''}`} role="status">{safety.message}</p>
        )}

        <footer className={styles.composeFoot}>
          <Button renderIcon={Send} onClick={send} disabled={sending || safety.risk === 'blocking' || Boolean(sendBlockedReason)}>
            {sending ? 'Sending…' : 'Send'}
          </Button>
          <span className={styles.counts}>{words} words · {body.length} characters</span>
          <span className={styles.composeNote}>
            {sendBlockedReason ?? 'Nothing is sent until you press Send. Evidence and tone are checked on the way out.'}
          </span>
        </footer>
      </section>

      <EditorPane checks={rubric.checks} metCount={rubric.metCount} words={words} explain={!reply} />
    </div>
  )
}
