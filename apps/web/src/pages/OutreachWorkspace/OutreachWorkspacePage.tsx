/**
 * Make contact — the mail desk.
 *
 * Everything the outreach workspace did is here, in the shape of a real
 * mailbox: the inbox is the thread (every email you sent and every reply),
 * the reading pane shows one message, and the next move sits above it — the
 * first email, a follow-up, the capability brief the client asked for, the
 * meeting invitation, or, after three emails, the closed lead.
 *
 * Per-attempt scores are kept out of the way (SRS FR-14): each sent email has
 * them under "How this email scored", closed until asked for.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Tag } from '@carbon/react'
import { ArrowRight, CheckmarkFilled, DocumentBlank, Edit, Locked } from '@carbon/icons-react'
import axios from 'axios'
import { useCapabilityBrief, useOutreach, useSendOutreach, useSubmitCapabilityBrief } from '@/api/hooks/useOutreach'
import { useEngagement } from '@/api/hooks/useEngagements'
import { useLeadIntelligence, useResearch } from '@/api/hooks/useLeads'
import { useScenario } from '@/api/hooks/useScenarios'
import { getProblemDetail } from '@/api/problemDetails'
import type { CapabilityBrief, OutreachAttempt } from '@/api/types'
import LoadingState from '@/components/shared/LoadingState'
import ObjectiveTourProvider from '@/components/shared/ObjectiveTourProvider'
import { useMentor } from '@/components/shell/useMentor'
import { keywordsFrom, stakeholderNameFrom } from '@/lifecycle/coaching/outreachRubric'
import { PHASE_LABEL } from '@/lifecycle/phases'
import { useAuthStore } from '@/store/authStore'
import BriefComposer from './BriefComposer'
import MailComposer from './MailComposer'
import styles from './OutreachWorkspacePage.module.scss'

/** Emails one learner may send one client (OutreachService.MAX_ATTEMPTS). */
const MAX_ATTEMPTS = 3

const OUTREACH_WORKSPACE_OBJECTIVES = [
  {
    id: 'client',
    objective: 'Your conversation with the client',
    description: 'Every email you send and every reply lands here, newest first. Open one to read it in full.',
    targets: ['.objective-client'],
  },
  {
    id: 'email',
    objective: 'Compose your email',
    description: 'One clear reason the client should care, and one small ask. The subject is all they see before deciding to open it.',
    targets: ['.objective-email'],
  },
  {
    id: 'evidence',
    objective: 'Use your evidence',
    description: 'Insert a signal from your research, or a quick start, straight into the message.',
    targets: ['.objective-evidence'],
  },
  {
    id: 'checklist',
    objective: 'Check before you send',
    description: 'The editor shows the four things the client’s team looks for. It is your own check — the client still decides.',
    targets: ['.objective-checklist'],
  },
  {
    id: 'send',
    objective: 'Sending it',
    description: 'Nothing is sent until you press it. The client answers the message you actually wrote, so a weak attempt is a real attempt.',
    targets: ['.objective-send'],
  },
]

type Outcome = OutreachAttempt['outcome']
const OUTCOME_TAG: Record<Outcome, { type: 'green' | 'magenta' | 'red' | 'gray'; label: string }> = {
  ACCEPTED: { type: 'green', label: 'Accepted' },
  FOLLOW_UP_REQUIRED: { type: 'magenta', label: 'Follow-up needed' },
  REJECTED: { type: 'red', label: 'Declined' },
  PENDING: { type: 'gray', label: 'Awaiting reply' },
}

interface MailItem {
  id: string
  mine: boolean
  subject: string
  preview: string
  at: string
  tag?: { type: 'green' | 'magenta' | 'red' | 'gray'; label: string }
  attempt?: OutreachAttempt
  brief?: CapabilityBrief
}

function stamp(at: string, long = false) {
  const date = new Date(at)
  if (Number.isNaN(date.getTime())) return ''
  return long
    ? date.toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

/** The thread as a mailbox: newest first, a reply above the email it answers. */
function mailbox(attempts: OutreachAttempt[], brief: CapabilityBrief | null | undefined): MailItem[] {
  const items: MailItem[] = []
  attempts.forEach((attempt) => {
    items.push({ id: `sent-${attempt.id}`, mine: true, subject: attempt.subject, preview: attempt.body, at: attempt.createdAt, attempt })
    if (attempt.clientReply) {
      items.push({ id: `reply-${attempt.id}`, mine: false, subject: `Re: ${attempt.subject}`, preview: attempt.clientReply, at: attempt.createdAt, tag: OUTCOME_TAG[attempt.outcome], attempt })
    }
  })
  if (brief) {
    items.push({ id: 'brief-sent', mine: true, subject: 'Capability brief', preview: brief.relevantExperience, at: brief.updatedAt, brief })
    if (brief.clientReply) {
      items.push({ id: 'brief-reply', mine: false, subject: 'Re: Capability brief', preview: brief.clientReply, at: brief.updatedAt, tag: OUTCOME_TAG[brief.outcome], brief })
    }
  }
  return items.reverse()
}

function Scores({ title, scores }: { title: string; scores: [string, number | null][] }) {
  const shown = scores.filter((entry): entry is [string, number] => entry[1] !== null)
  if (!shown.length) return null
  return (
    <details className={styles.scores}>
      <summary>{title}</summary>
      <ul>
        {shown.map(([label, value]) => (
          <li key={label}><span>{label}</span><b aria-hidden="true"><i style={{ width: `${value}%` }} /></b><strong>{value}/100</strong></li>
        ))}
      </ul>
    </details>
  )
}

export default function OutreachWorkspacePage() {
  const { engagementId = '' } = useParams<{ engagementId: string }>()
  const navigate = useNavigate()
  const { displayName } = useAuthStore()
  const { data: attempts, isLoading, refetch: refetchOutreach } = useOutreach(engagementId)
  const { data: brief } = useCapabilityBrief(engagementId)
  const sendOutreach = useSendOutreach(engagementId)
  const submitBrief = useSubmitCapabilityBrief(engagementId)
  const { data: intelligence } = useLeadIntelligence(engagementId)
  const { data: evidence } = useResearch(engagementId)
  const { data: engagement } = useEngagement(engagementId)
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  const [selected, setSelected] = useState<string | null>(null)
  const [writing, setWriting] = useState(false)
  const [sendTimedOut, setSendTimedOut] = useState(false)

  const thread = useMemo(() => [...(attempts ?? [])].sort((a, b) => a.attemptNumber - b.attemptNumber), [attempts])
  const latest = thread.at(-1)
  const persona = scenario?.personas.find((item) => item.id === engagement?.personaId)
  const clientName = persona?.name ?? stakeholderNameFrom(intelligence?.decisionMaker?.value) ?? 'Client stakeholder'
  const company = intelligence?.companyName ?? engagement?.leadCompanyName ?? 'Client organisation'
  const clientLine = [persona?.jobTitle, company].filter(Boolean).join(' · ')
  const me = displayName ?? 'You'

  const rubricContext = useMemo(() => ({
    personaName: stakeholderNameFrom(intelligence?.decisionMaker?.value) ?? persona?.name ?? null,
    companyName: intelligence?.companyName ?? null,
    keywords: keywordsFrom([
      ...(evidence ?? []).map((item) => item.note),
      intelligence?.painSeverity?.value,
      intelligence?.technologyStack?.value,
    ]),
  }), [evidence, intelligence, persona?.name])

  const meetingSecured = latest?.outcome === 'ACCEPTED' || brief?.outcome === 'ACCEPTED'
  const briefRequested = latest?.nextAction === 'SUBMIT_CAPABILITY_BRIEF' && brief?.outcome !== 'ACCEPTED'
  const exhausted = !meetingSecured && !briefRequested && thread.length >= MAX_ATTEMPTS && latest?.outcome !== 'PENDING'
  const stage = meetingSecured ? 'secured' : briefRequested ? 'brief' : exhausted ? 'exhausted' : thread.length === 0 ? 'first' : 'followup'
  const left = Math.max(0, MAX_ATTEMPTS - thread.length)

  const items = useMemo(() => mailbox(thread, brief), [thread, brief])
  const open = items.find((item) => item.id === selected) ?? items[0]

  // A send that timed out may still have reached the client: refetch, then clear.
  useEffect(() => {
    if (sendTimedOut && attempts?.length) setSendTimedOut(false)
  }, [attempts, sendTimedOut])

  useMentor(
    stage === 'first' ? 'One reason they should care, one small ask. Use something you found about them, not what IBM does.'
      : stage === 'brief' ? 'Answer what they asked for, in order. One page — they will not read two.'
        : stage === 'secured' ? 'They agreed to meet. Go and plan what you need to learn from them.'
          : stage === 'exhausted' ? 'Three emails is where a real client stops reading. Take the lessons below into the next lead.'
            : latest?.outcome === 'REJECTED' ? 'A no is information. Read why they declined, then change one thing — not everything.'
              : latest?.coachingHint ?? 'They did not say no. Answer exactly what they asked, and only that.',
    stage === 'secured' ? { label: `Continue to ${PHASE_LABEL.MEETING_PREPARATION}`, to: `/dashboard/engagements/${engagementId}/preparation`, ready: true } : null,
  )

  if (isLoading) return <LoadingState />

  const sendEmail = (email: { subject: string; body: string }, clear: () => void) => {
    setSendTimedOut(false)
    sendOutreach.mutate(email, {
      onSuccess: () => {
        clear()
        setWriting(false)
        setSelected(null)
      },
      onError: (error) => {
        if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
          setSendTimedOut(true)
          void refetchOutreach()
        }
      },
    })
  }

  const sendError = sendOutreach.isError && !sendTimedOut
    ? getProblemDetail(sendOutreach.error, 'Please retry after checking the latest client request.')
    : null

  const composer = (reply: boolean) => (
    <MailComposer
      reply={reply}
      initialSubject={reply && latest ? `Re: ${latest.subject.replace(/^Re:\s*/, '')}` : ''}
      from={me}
      to={clientName}
      toOrganisation={company}
      context={rubricContext}
      evidence={evidence ?? []}
      sending={sendOutreach.isPending}
      errorMessage={sendError}
      onSend={sendEmail}
      onClose={reply ? () => setWriting(false) : undefined}
      tour={{ compose: 'objective-email', insert: 'objective-evidence', editor: 'objective-checklist', send: 'objective-send' }}
    />
  )

  const isLatestOpen = !open || open.id === items[0]?.id

  return (
    <ObjectiveTourProvider tourId="outreach-workspace" objectives={OUTREACH_WORKSPACE_OBJECTIVES}>
      <div className={styles.client}>
        <section className={`${styles.list} objective-client`} aria-label="Messages">
          <header className={styles.listHead}>
            <strong>Inbox</strong>
            <span>{company}</span>
          </header>
          {items.length === 0 ? (
            <p className={styles.listEmpty}>No messages yet. Your first email starts the thread.</p>
          ) : (
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`${styles.listItem} ${item.id === open?.id ? styles.listItemOpen : ''} ${!item.mine && item.id === items[0]?.id ? styles.listItemUnread : ''}`}
                    onClick={() => setSelected(item.id)}
                  >
                    <span className={styles.listTop}>
                      <strong>{item.mine ? 'You' : clientName}</strong>
                      <time>{stamp(item.at)}</time>
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
          {sendTimedOut && (
            <p className={styles.sending} role="status">The send is taking longer than usual. Checking whether it reached the client…</p>
          )}

          {/* The next move sits above the latest message. */}
          {isLatestOpen && stage === 'first' && composer(false)}

          {isLatestOpen && stage === 'followup' && (
            <>
              <div className={latest?.outcome === 'REJECTED' ? styles.declined : styles.followUp}>
                <div>
                  <p className={styles.declinedLabel}>
                    {latest?.outcome === 'REJECTED' ? 'Declined' : latest?.outcome === 'PENDING' ? 'Awaiting a reply' : 'They want more before they agree'}
                    {' · '}you can write {left} more {left === 1 ? 'time' : 'times'}
                  </p>
                  {latest?.coachingHint && <p className={styles.declinedHint}>{latest.coachingHint}</p>}
                </div>
                {!writing && <Button renderIcon={Edit} onClick={() => setWriting(true)}>Write a follow-up</Button>}
              </div>
              {writing && composer(true)}
            </>
          )}

          {isLatestOpen && stage === 'brief' && latest && (
            <>
              <aside className={styles.request}>
                <p className={styles.requestTitle}>{latest.requestTitle ?? 'Capability brief requested'}</p>
                {latest.requestSummary && <p>{latest.requestSummary}</p>}
                {latest.requestRequirements.length > 0 && <ul>{latest.requestRequirements.map((item) => <li key={item}>{item}</li>)}</ul>}
              </aside>
              {brief?.outcome === 'FOLLOW_UP_REQUIRED' && (
                <p className={styles.declinedHint}>They read your brief and want changes. Their note is in the inbox; your last version is below.</p>
              )}
              <BriefComposer
                previous={brief?.outcome === 'FOLLOW_UP_REQUIRED' ? brief : null}
                requirements={latest.requestRequirements}
                clientName={clientName}
                company={company}
                sending={submitBrief.isPending}
                errorMessage={submitBrief.isError ? getProblemDetail(submitBrief.error, 'The client request may have changed. Refresh the workspace and try again.') : null}
                onSubmit={(values) => submitBrief.mutate(values, { onSuccess: () => setSelected(null) })}
              />
            </>
          )}

          {isLatestOpen && stage === 'secured' && (
            <div className={styles.invite}>
              <CheckmarkFilled size={24} className={styles.inviteIcon} />
              <div className={styles.inviteBody}>
                <p className={styles.inviteLabel}>Next phase unlocked</p>
                <h3>Meeting secured</h3>
                <p>{clientName} has agreed to a discovery conversation. Carry their reply into your preparation.</p>
              </div>
              <Button renderIcon={ArrowRight} onClick={() => navigate(`/dashboard/engagements/${engagementId}/preparation`)}>
                Continue to {PHASE_LABEL.MEETING_PREPARATION}
              </Button>
            </div>
          )}

          {isLatestOpen && stage === 'exhausted' && (
            <>
              <div className={styles.closed}>
                <Locked size={24} />
                <div>
                  <p className={styles.closedLabel}>No more emails to {clientName}</p>
                  <h3>{clientName} has not agreed to meet after {MAX_ATTEMPTS} emails.</h3>
                  <p>That is the most you can send one person. Your research and notes are kept.</p>
                  <div className={styles.closedActions}>
                    <Button kind="tertiary" onClick={() => navigate('/dashboard')}>Back to the Office</Button>
                  </div>
                </div>
              </div>
              {thread.some((attempt) => attempt.coachingHint) && (
                <section className={styles.lessons} aria-label="What to change next time">
                  <h3>What to take into the next lead</h3>
                  <ol>
                    {thread.filter((attempt) => attempt.coachingHint).map((attempt) => (
                      <li key={attempt.id}><span>Email {attempt.attemptNumber}</span>{attempt.coachingHint}</li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )}

          {open && (
            <>
              <h2 className={styles.threadSubject}>{open.subject}</h2>
              <article className={styles.message}>
                <header className={styles.messageHead}>
                  <span className={styles.avatar} aria-hidden="true">{initials(open.mine ? me : clientName)}</span>
                  <div>
                    <strong>{open.mine ? me : clientName}</strong>{' '}
                    <span className={styles.address}>{open.mine ? 'Associate Consultant · IBM Consulting' : clientLine}</span>
                    <small>To: {open.mine ? clientName : me}</small>
                  </div>
                  <span className={styles.messageTime}>{stamp(open.at, true)}</span>
                  {open.tag && <Tag type={open.tag.type} size="sm">{open.tag.label}</Tag>}
                </header>
                <div className={styles.messageBody}>
                  {open.brief && open.mine ? (
                    <>
                      <p className={styles.attachedNote}><DocumentBlank size={16} /> Capability brief — {company}.docx</p>
                      {([['Experience', open.brief.relevantExperience], ['Approach', open.brief.approach], ['Case example', open.brief.caseExample], ['Client fit', open.brief.clientFit]] as const).map(([label, text]) => (
                        <section key={label} className={styles.briefSection}><h4>{label}</h4><p>{text}</p></section>
                      ))}
                      <Scores
                        title="How this brief scored"
                        scores={[['Client fit', open.brief.scoreClientFit], ['Industry relevance', open.brief.scoreIndustryRelevance], ['Evidence quality', open.brief.scoreEvidenceQuality], ['Clarity', open.brief.scoreClarity], ['Credibility', open.brief.scoreCredibility]]}
                      />
                    </>
                  ) : open.mine && open.attempt ? (
                    <>
                      <pre className={styles.plain}>{open.attempt.body}</pre>
                      <Scores
                        title="How this email scored"
                        scores={[['Personalisation', open.attempt.scorePersonalisation], ['Relevance', open.attempt.scoreRelevance], ['Clarity', open.attempt.scoreClarity], ['Call to action', open.attempt.scoreCallToAction]]}
                      />
                    </>
                  ) : (
                    <>
                      <p>{open.preview}</p>
                      {open.attempt && !open.brief && open.attempt.requestTitle && stage !== 'brief' && (
                        <aside className={styles.request}>
                          <p className={styles.requestTitle}>{open.attempt.requestTitle}</p>
                          {open.attempt.requestSummary && <p>{open.attempt.requestSummary}</p>}
                        </aside>
                      )}
                    </>
                  )}
                </div>
              </article>
            </>
          )}
        </section>
      </div>
    </ObjectiveTourProvider>
  )
}
