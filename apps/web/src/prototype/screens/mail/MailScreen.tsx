/**
 * Make contact — design doc §4 screen 4: "almost nothing changes". The attempt
 * counter goes (it shames without instructing) and the per-attempt scores wait
 * for the debrief (R4). Everything else OutreachWorkspacePage does is here,
 * in the shape of a real mailbox: the first email, the client's reply with
 * what she is asking for, the capability brief as an attached document, and
 * the acceptance with a meeting invitation.
 */
import { useState } from 'react'
import { Button, InlineLoading, Tag } from '@carbon/react'
import { ArrowRight, CheckmarkFilled, Reply, DocumentBlank } from '@carbon/icons-react'
import type { OutreachAttempt } from '@/api/types'
import { PHASE_LABEL } from '@/lifecycle/phases'
import { ACCEPTED_REPLY, DRAFT_BRIEF, FIRST_ATTEMPT } from '../../data/engagementFlow'
import { PERSONA } from '../../data/scenario'
import { useProto, type OutreachVariant } from '../../state/protoStore'
import Composer from './Composer'
import BriefDocument from './BriefDocument'
import DeclinedMailbox from './DeclinedMailbox'
import styles from './mail.module.scss'

const CLIENT_LINE = 'Chief Operating Officer · MediCare Regional Hospital Network'

const OUTCOME_TAG: Record<OutreachAttempt['outcome'], { type: 'green' | 'magenta' | 'red' | 'gray'; label: string }> = {
  ACCEPTED: { type: 'green', label: 'Accepted' },
  FOLLOW_UP_REQUIRED: { type: 'magenta', label: 'Follow-up needed' },
  REJECTED: { type: 'red', label: 'Declined' },
  PENDING: { type: 'gray', label: 'Awaiting reply' },
}

interface ListItem {
  id: string
  from: string
  subject: string
  preview: string
  time: string
  unread?: boolean
  tag?: { type: 'green' | 'magenta' | 'red' | 'gray'; label: string }
}

function listFor(variant: OutreachVariant): ListItem[] {
  const sent: ListItem = { id: 'sent-1', from: 'You', subject: FIRST_ATTEMPT.subject, preview: FIRST_ATTEMPT.body.slice(0, 90), time: 'Wed 08:12' }
  const reply: ListItem = { id: 'reply-1', from: PERSONA.name, subject: `Re: ${FIRST_ATTEMPT.subject}`, preview: FIRST_ATTEMPT.clientReply ?? '', time: 'Wed 08:42', unread: variant === 'REPLY', tag: OUTCOME_TAG.FOLLOW_UP_REQUIRED }
  const accepted: ListItem = { id: 'accept-1', from: PERSONA.name, subject: 'Re: Capability brief', preview: ACCEPTED_REPLY, time: 'Thu 11:05', unread: true, tag: OUTCOME_TAG.ACCEPTED }
  switch (variant) {
    case 'FIRST_CONTACT': return []
    case 'REPLY':
    case 'BRIEF_REQUESTED': return [reply, sent]
    case 'MEETING_SECURED': return [accepted, reply, sent]
    default: return []
  }
}

function Message({ from, address, to, time, children, tag }: { from: string; address: string; to: string; time: string; children: React.ReactNode; tag?: ListItem['tag'] }) {
  return (
    <article className={styles.message}>
      <header className={styles.messageHead}>
        <span className={styles.avatar} aria-hidden="true">{from.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span>
        <div>
          <strong>{from}</strong> <span className={styles.address}>{address}</span>
          <small>To: {to}</small>
        </div>
        <span className={styles.messageTime}>{time}</span>
        {tag && <Tag type={tag.type} size="sm">{tag.label}</Tag>}
      </header>
      <div className={styles.messageBody}>{children}</div>
    </article>
  )
}

export default function MailScreen() {
  const variant = useProto((s) => s.outreachVariant)
  const set = useProto((s) => s.set)
  const go = useProto((s) => s.go)
  const [selected, setSelected] = useState<string | null>(null)
  const [replying, setReplying] = useState(false)
  const [sending, setSending] = useState(false)
  const [briefReady, setBriefReady] = useState(false)
  const items = listFor(variant)
  const open = selected && items.some((item) => item.id === selected) ? selected : items[0]?.id ?? null

  const advance = (next: OutreachVariant) => {
    setSending(true)
    window.setTimeout(() => {
      setSending(false)
      setReplying(false)
      set({ outreachVariant: next })
    }, 1400)
  }

  const composingBrief = variant === 'BRIEF_REQUESTED' || (variant === 'REPLY' && replying)

  if (variant === 'REJECTED' || variant === 'EXHAUSTED') {
    return <DeclinedMailbox key={variant} exhausted={variant === 'EXHAUSTED'} />
  }

  return (
    <div className={styles.client}>

      <section className={styles.list} aria-label="Messages">
        <header className={styles.listHead}>
          <strong>Inbox</strong>
          <span>MediCare Regional Hospital Network</span>
        </header>
        {items.length === 0 ? (
          <p className={styles.listEmpty}>No messages from MediCare yet. Your first email starts the thread.</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" className={`${styles.listItem} ${item.id === open ? styles.listItemOpen : ''} ${item.unread ? styles.listItemUnread : ''}`} onClick={() => setSelected(item.id)}>
                  <span className={styles.listTop}>
                    <strong>{item.from}</strong>
                    <time>{item.time}</time>
                  </span>
                  <span className={styles.listSubject}>{item.subject}</span>
                  <span className={styles.listPreview}>{item.preview}</span>
                  {item.tag && <Tag type={item.tag.type} size="sm">{item.tag.label}</Tag>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={styles.reader} aria-label="Reading pane">
        {sending && (
          <div className={styles.sending}>
            <InlineLoading description={variant === 'FIRST_CONTACT' ? 'Sending — Sarah’s reply will land in your inbox' : 'Sending your reply and brief'} />
          </div>
        )}

        {variant === 'FIRST_CONTACT' && !sending && (
          <Composer reply={false} initialSubject="" onSent={() => advance('REPLY')} />
        )}

        {(variant === 'REPLY' || variant === 'BRIEF_REQUESTED') && !sending && open !== 'sent-1' && (
          <>
            <h2 className={styles.threadSubject}>Re: {FIRST_ATTEMPT.subject}</h2>
            {composingBrief ? (
              <Composer
                reply
                initialSubject={`Re: ${FIRST_ATTEMPT.subject}`}
                onSent={() => advance('MEETING_SECURED')}
                onClose={variant === 'REPLY' ? () => setReplying(false) : undefined}
                sendBlockedReason={briefReady ? null : 'Finish all four sections of the brief before sending.'}
                attachment={<BriefDocument draft={DRAFT_BRIEF} requirements={FIRST_ATTEMPT.requestRequirements} onReadyChange={setBriefReady} />}
              />
            ) : (
              <div className={styles.replyBar}>
                <Button renderIcon={Reply} onClick={() => setReplying(true)}>Reply with the brief</Button>
              </div>
            )}
            <Message from={PERSONA.name} address={CLIENT_LINE} to="Vince Tran" time="Wednesday 24 Sep, 08:42" tag={OUTCOME_TAG.FOLLOW_UP_REQUIRED}>
              <p>{FIRST_ATTEMPT.clientReply}</p>
              <p>Sarah</p>
              <p className={styles.signature}>Sarah Chen · Chief Operating Officer<br />MediCare Regional Hospital Network</p>
            </Message>
            <aside className={styles.request}>
              <p className={styles.requestTitle}>{FIRST_ATTEMPT.requestTitle}</p>
              <p>{FIRST_ATTEMPT.requestSummary}</p>
              <ul>{FIRST_ATTEMPT.requestRequirements.map((item) => <li key={item}>{item}</li>)}</ul>
            </aside>
            <details className={styles.quoted}>
              <summary>Your email · Wednesday 24 Sep, 08:12</summary>
              <pre>{FIRST_ATTEMPT.body}</pre>
            </details>
          </>
        )}

        {open === 'sent-1' && !sending && (
          <>
            <h2 className={styles.threadSubject}>{FIRST_ATTEMPT.subject}</h2>
            <Message from="Vince Tran" address="Associate Consultant · IBM Consulting" to={PERSONA.name} time="Wednesday 24 Sep, 08:12">
              <pre className={styles.plain}>{FIRST_ATTEMPT.body}</pre>
            </Message>
          </>
        )}

        {variant === 'MEETING_SECURED' && !sending && open !== 'sent-1' && open !== 'reply-1' && (
          <>
            <h2 className={styles.threadSubject}>Re: Capability brief</h2>
            <div className={styles.invite}>
              <CheckmarkFilled size={24} className={styles.inviteIcon} />
              <div className={styles.inviteBody}>
                <p className={styles.inviteLabel}>Next phase unlocked</p>
                <h3>Meeting secured</h3>
                <p>Sarah has agreed to a discovery conversation. Carry her reply into your preparation.</p>
              </div>
              <Button renderIcon={ArrowRight} onClick={() => go('PREPARE')}>Continue to {PHASE_LABEL.MEETING_PREPARATION}</Button>
            </div>
            <Message from={PERSONA.name} address={CLIENT_LINE} to="Vince Tran" time="Thursday 25 Sep, 11:05" tag={OUTCOME_TAG.ACCEPTED}>
              <p>{ACCEPTED_REPLY}</p>
              <p>Sarah</p>
            </Message>
            <details className={styles.quoted}>
              <summary>Your reply and capability brief · Thursday 25 Sep, 09:30</summary>
              <p className={styles.attachedNote}><DocumentBlank size={16} /> Capability brief — MediCare.docx</p>
            </details>
          </>
        )}

        {variant === 'MEETING_SECURED' && open === 'reply-1' && !sending && (
          <>
            <h2 className={styles.threadSubject}>Re: {FIRST_ATTEMPT.subject}</h2>
            <Message from={PERSONA.name} address={CLIENT_LINE} to="Vince Tran" time="Wednesday 24 Sep, 08:42" tag={OUTCOME_TAG.FOLLOW_UP_REQUIRED}>
              <p>{FIRST_ATTEMPT.clientReply}</p>
            </Message>
          </>
        )}
      </section>
    </div>
  )
}
