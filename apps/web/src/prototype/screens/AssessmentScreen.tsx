/**
 * Your review (Engagement Assessment) — design doc §4 screen 9: deliberately
 * untouched. Rule R4 takes numbers off the play screens so they land here with
 * weight. Every field AssessmentReviewPage renders is here, including the
 * coaching-pending, generating and "not ready yet" states. Only the skin
 * changes: it reads as the review document it is.
 */
import { Button, InlineLoading, Tag } from '@carbon/react'
import { ArrowRight } from '@carbon/icons-react'
import { PHASE_LABEL } from '@/lifecycle/phases'
import { ASSESSMENT } from '../data/engagementFlow'
import { LEARNER_NAME, SCENARIO } from '../data/scenario'
import { useProto } from '../state/protoStore'
import styles from './assessment.module.scss'

function describe(outcome: string) {
  switch (outcome) {
    case 'PILOT_APPROVED': return { label: 'Pilot approved', contract: 'Contract won', tag: 'green' as const }
    case 'PROPOSAL_ACCEPTED': return { label: 'Proposal accepted', contract: 'Contract won', tag: 'green' as const }
    case 'STRATEGIC_PARTNERSHIP': return { label: 'Strategic partnership', contract: 'Contract won', tag: 'green' as const }
    case 'REVISION_REQUESTED': return { label: 'Revision requested', contract: 'Client decision recorded', tag: 'purple' as const }
    case 'FURTHER_DISCOVERY_REQUIRED': return { label: 'Further discovery requested', contract: 'Client decision recorded', tag: 'blue' as const }
    case 'DEFERRED': return { label: 'Decision deferred', contract: 'Contract not awarded', tag: 'blue' as const }
    default: return { label: 'Proposal rejected', contract: 'Contract not won', tag: 'red' as const }
  }
}

export default function AssessmentScreen() {
  const variant = useProto((s) => s.assessmentVariant)
  const outcome = useProto((s) => s.decisionOutcome)
  const go = useProto((s) => s.go)
  const pending = variant === 'COACHING_PENDING'
  const result = { ...ASSESSMENT, outcome }
  const presentation = describe(result.outcome)

  if (variant === 'GENERATING') {
    return <div className={styles.state}><InlineLoading description="Generating assessment…" /></div>
  }
  if (variant === 'TOO_EARLY') {
    return (
      <div className={styles.state}>
        <h2>Your review isn’t ready yet</h2>
        <p>Your review is written once the client has decided on your proposal. You’re still on “{PHASE_LABEL.OUTREACH}”.</p>
        <Button kind="secondary" onClick={() => go('OUTREACH')}>Back to {PHASE_LABEL.OUTREACH}</Button>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <article className={styles.report}>
        <header className={styles.reportHead}>
          <div>
            <p className={styles.org}>IBM Consulting</p>
            <h1>Engagement review</h1>
            <p className={styles.meta}>{LEARNER_NAME} · Associate Consultant · {SCENARIO.title}</p>
          </div>
          <div className={styles.overall}>
            <span>Overall</span>
            <strong>{result.overallScore}<small>/100</small></strong>
          </div>
        </header>

        <div className={styles.outcomeRow}>
          <Tag type="blue">Engagement complete</Tag>
          <Tag type={presentation.tag}>{presentation.label}</Tag>
          <strong>{presentation.contract}</strong>
        </div>

        <section className={styles.summary}>
          <p className={styles.label}>Reviewer’s summary</p>
          {pending ? <InlineLoading description="Preparing personalised AI coaching…" /> : <p>{result.feedbackSummary}</p>}
        </section>

        <section>
          <p className={styles.label}>Competencies</p>
          <div className={styles.competencies}>
            {result.competencyScores.map((competency) => (
              <div key={competency.name} className={styles.competency}>
                <div className={styles.competencyHead}>
                  <strong>{competency.name}</strong>
                  <span>{competency.score}/100</span>
                </div>
                <div className={styles.bar}><i style={{ width: `${competency.score}%` }} /></div>
                {competency.evidenceNote && <p>{competency.evidenceNote}</p>}
              </div>
            ))}
          </div>
        </section>

        <div className={styles.columns}>
          <section>
            <p className={styles.label}>Strengths</p>
            {pending ? <InlineLoading description="Preparing strengths…" /> : (
              result.strengths.length ? <ol>{result.strengths.map((item) => <li key={item}>{item}</li>)}</ol> : <p className={styles.empty}>None recorded.</p>
            )}
          </section>
          <section>
            <p className={styles.label}>Areas for improvement</p>
            {pending ? <InlineLoading description="Preparing areas for improvement…" /> : (
              result.improvementAreas.length ? <ol>{result.improvementAreas.map((item) => <li key={item}>{item}</li>)}</ol> : <p className={styles.empty}>None recorded.</p>
            )}
          </section>
        </div>

        <footer className={styles.reportFoot}>
          <span>Generated {new Date(result.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <div className={styles.actions}>
            <Button kind="secondary" onClick={() => go('HUB')}>Back to the office</Button>
            <Button renderIcon={ArrowRight} onClick={() => go('PORTFOLIO')}>View portfolio</Button>
          </div>
        </footer>
      </article>
    </div>
  )
}
