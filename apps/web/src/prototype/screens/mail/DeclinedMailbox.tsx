/**
 * Outreach sad paths (the team's flow: "Accepted? → Rejected → Tries left?").
 *
 * The backend allows three emails per lead (OutreachService.MAX_ATTEMPTS). A
 * decline with tries left says how many remain, plainly, and what to change.
 * With none left the lead is closed: the thread stays readable, the lessons
 * from every attempt are collected in one place, and there is a way forward.
 * "Choose another client" needs a backend change — today the engagement has
 * no route out of an exhausted outreach.
 */
import { useState } from 'react'
import { Button, InlineLoading, Tag } from '@carbon/react'
import { ArrowRight, Edit, Locked } from '@carbon/icons-react'
import { DECLINED_ATTEMPTS } from '../../data/engagementFlow'
import { PERSONA } from '../../data/scenario'
import { useProto } from '../../state/protoStore'
import Composer from './Composer'
import styles from './mail.module.scss'

const MAX_ATTEMPTS = 3
const CLIENT_LINE = 'Chief Operating Officer · MediCare Regional Hospital Network'
const DAYS = ['Mon 22 Sep', 'Wed 24 Sep', 'Fri 26 Sep']

export default function DeclinedMailbox({ exhausted }: { exhausted: boolean }) {
  const set = useProto((s) => s.set)
  const go = useProto((s) => s.go)
  const [writing, setWriting] = useState(false)
  const [sending, setSending] = useState(false)
  const attempts = exhausted ? DECLINED_ATTEMPTS : DECLINED_ATTEMPTS.slice(0, 1)
  const left = MAX_ATTEMPTS - attempts.length
  const latest = attempts[attempts.length - 1]

  const send = () => {
    setSending(true)
    window.setTimeout(() => set({ outreachVariant: 'REPLY' }), 1400)
  }

  return (
    <div className={styles.client}>
      <section className={styles.list} aria-label="Messages">
        <header className={styles.listHead}>
          <strong>Inbox</strong>
          <span>MediCare Regional Hospital Network</span>
        </header>
        <ul>
          {[...attempts].reverse().map((attempt, index) => (
            <li key={attempt.id}>
              {attempt.clientReply && (
                <div className={`${styles.listItem} ${index === 0 ? styles.listItemOpen : ''}`}>
                  <span className={styles.listTop}><strong>{PERSONA.name}</strong><time>{DAYS[attempt.attemptNumber - 1]}</time></span>
                  <span className={styles.listSubject}>Re: {attempt.subject}</span>
                  <span className={styles.listPreview}>{attempt.clientReply}</span>
                  <Tag type="red" size="sm">Declined</Tag>
                </div>
              )}
              {!attempt.clientReply && (
                <div className={`${styles.listItem} ${index === 0 ? styles.listItemOpen : ''}`}>
                  <span className={styles.listTop}><strong>No reply</strong><time>{DAYS[attempt.attemptNumber - 1]}</time></span>
                  <span className={styles.listSubject}>{attempt.subject}</span>
                  <Tag type="gray" size="sm">No response</Tag>
                </div>
              )}
              <div className={styles.listItem}>
                <span className={styles.listTop}><strong>You</strong><time>{DAYS[attempt.attemptNumber - 1]}</time></span>
                <span className={styles.listSubject}>{attempt.subject}</span>
                <span className={styles.listPreview}>{attempt.body.slice(0, 90)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.reader} aria-label="Reading pane">
        {exhausted ? (
          <div className={styles.closed}>
            <Locked size={24} />
            <div>
              <p className={styles.closedLabel}>No more emails to Sarah</p>
              <h3>Sarah has not agreed to meet after three emails.</h3>
              <p>That is the most you can send one person. Your research and notes are kept — try someone else at MediCare.</p>
              <div className={styles.closedActions}>
                <Button renderIcon={ArrowRight} onClick={() => { set({ reached: 1, contactId: null, outreachVariant: 'FIRST_CONTACT' }); go('LEAD') }}>Choose another client</Button>
                <Button kind="tertiary" onClick={() => go('HUB')}>Back to the office</Button>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.declined}>
            <div>
              <p className={styles.declinedLabel}>Declined · you can write {left} more {left === 1 ? 'time' : 'times'}</p>
              <p className={styles.declinedHint}>{latest.coachingHint}</p>
            </div>
            {!writing && <Button renderIcon={Edit} onClick={() => setWriting(true)}>Write a follow-up</Button>}
          </div>
        )}

        {sending && <div className={styles.sending}><InlineLoading description="Sending your follow-up" /></div>}
        {writing && !sending && (
          <Composer reply initialSubject={`Re: ${latest.subject}`} onSent={send} onClose={() => setWriting(false)} />
        )}

        {exhausted && (
          <section className={styles.lessons} aria-label="What to change next time">
            <h3>What to take into the next lead</h3>
            <ol>
              {attempts.map((attempt) => (
                <li key={attempt.id}>
                  <span>Email {attempt.attemptNumber}</span>
                  {attempt.coachingHint}
                </li>
              ))}
            </ol>
          </section>
        )}

        <h2 className={styles.threadSubject}>{exhausted ? latest.subject : `Re: ${latest.subject}`}</h2>
        {latest.clientReply ? (
          <article className={styles.message}>
            <header className={styles.messageHead}>
              <span className={styles.avatar} aria-hidden="true">SC</span>
              <div>
                <strong>{PERSONA.name}</strong> <span className={styles.address}>{CLIENT_LINE}</span>
                <small>To: Vince Tran</small>
              </div>
              <span className={styles.messageTime}>{DAYS[latest.attemptNumber - 1]}</span>
              <Tag type="red" size="sm">Declined</Tag>
            </header>
            <div className={styles.messageBody}><p>{latest.clientReply}</p><p>Sarah</p></div>
          </article>
        ) : (
          <p className={styles.noReply}>No reply to your third email.</p>
        )}
        <details className={styles.quoted}>
          <summary>Your email · {DAYS[latest.attemptNumber - 1]}</summary>
          <pre>{latest.body}</pre>
        </details>
      </section>
    </div>
  )
}
