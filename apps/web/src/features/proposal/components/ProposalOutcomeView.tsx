/**
 * Their decision — the client's answer to a submitted proposal.
 *
 * The client's letter comes first: who decided, what they decided and what
 * they said. The three detail views stay (why it went this way, how the
 * client weighed it, your claims checked), in words. Decision confidence,
 * learner performance, the rationale and the dimension scores are one click
 * away under "Show the numbers" — words first (SRS FR-14), nothing lost.
 */
import { Button, InlineLoading, Tag } from '@carbon/react'
import { ArrowRight, Chat, Document, Renew, WarningFilled } from '@carbon/icons-react'
import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import type { Proposal } from '@/api/types'
import { useProposalCounterfactual, useProposalDecisionExplanation } from '@/api/hooks/useProposal'
import { decisionInsights, outcomePresentation } from '../services/proposalOutcomeService'
import styles from './ProposalOutcomeView.module.scss'

export interface OutcomeClient {
  /** The client organisation, e.g. the lead company. */
  company?: string | null
  /** The contact who decided. */
  contactName?: string | null
  contactTitle?: string | null
  /** What the proposal was about, for the letter's subject line. */
  subject?: string | null
}

/** How much a dimension weighed in the decision, in words. */
function band(score: number) {
  return score >= 80 ? 'Carried the decision' : score >= 65 ? 'Helped' : 'Held it back'
}

type View = 'overview' | 'score' | 'evidence'
type Support = Proposal['evidenceImpacts'][number]['supportLevel']

const SUPPORT: { level: Support; label: string; tone: 'countGreen' | 'countGray' | 'countRed'; tag: 'green' | 'warm-gray' | 'red' }[] = [
  { level: 'WELL_SUPPORTED', label: 'Well supported', tone: 'countGreen', tag: 'green' },
  { level: 'PARTIALLY_SUPPORTED', label: 'Partially supported', tone: 'countGray', tag: 'warm-gray' },
  { level: 'UNSUPPORTED', label: 'Unsupported', tone: 'countRed', tag: 'red' },
]

export function ProposalOutcomeView({ proposal, engagementId, client = {}, onReadProposal, onRevise, revising, revisionError }: {
  proposal: Proposal
  engagementId: string
  client?: OutcomeClient
  /** Opens the proposal that was sent, read-only. */
  onReadProposal?: () => void
  onRevise?: () => void
  revising?: boolean
  revisionError?: boolean
}) {
  const navigate = useNavigate()
  const explain = useProposalDecisionExplanation(engagementId)
  const counterfactual = useProposalCounterfactual(engagementId)
  const [view, setView] = useState<View>('overview')
  const [support, setSupport] = useState<Support | null>(null)
  // The coach shows whichever view the learner asked for last.
  const [coachView, setCoachView] = useState<'explain' | 'counterfactual' | null>(null)
  const presentation = outcomePresentation(proposal.clientDecisionOutcome)
  const letter = proposal.clientResponse ?? proposal.decisionRationale ?? 'The client response is not yet available.'
  const strengths = decisionInsights(proposal.decisionInsights, 'STRENGTH')
  const concerns = decisionInsights(proposal.decisionInsights, 'CONCERN')
  const conditions = decisionInsights(proposal.decisionInsights, 'CONDITION')
  const counts = proposal.evidenceImpacts.reduce<Record<string, number>>((all, item) => ({ ...all, [item.supportLevel]: (all[item.supportLevel] ?? 0) + 1 }), {})
  const claims = support ? proposal.evidenceImpacts.filter((item) => item.supportLevel === support) : proposal.evidenceImpacts
  const strongest = useMemo(
    () => [...proposal.decisionDimensions].sort((left, right) => right.score - left.score)[0],
    [proposal.decisionDimensions],
  )
  const company = client.company ?? 'The client'
  const submitted = new Date(proposal.submittedAt)
  const coachBusy = explain.isPending || counterfactual.isPending

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <article className={styles.letter} aria-label="The client's decision">
          <header className={styles.letterhead}>
            <div className={styles.crest} aria-hidden="true">{company.charAt(0)}</div>
            <div>
              <strong>{company}</strong>
              {client.contactTitle && <span>Office of the {client.contactTitle}</span>}
            </div>
          </header>
          {!Number.isNaN(submitted.getTime()) && (
            <p className={styles.dateLine}>{submitted.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          )}
          <p className={styles.re}>Re: Proposal{client.subject ? ` — ${client.subject}` : ''}</p>
          <div className={styles.outcomeLine}>
            <Tag type={proposal.decision === 'LOST' ? 'red' : presentation.tagType}>{proposal.decision === 'LOST' ? proposal.revisionAvailable ? 'Proposal not accepted' : 'Deal lost' : presentation.label}</Tag>
            <span>{presentation.subtitle}</span>
          </div>
          <p className={styles.letterBody}>{letter}</p>
          {client.contactName && (
            <p className={styles.signoff}>{client.contactName}{client.contactTitle && <><br /><span>{client.contactTitle}</span></>}</p>
          )}
        </article>

        <aside className={styles.side}>
          <section className={styles.nextStep}>
            <p className={styles.eyebrow}>Recommended next step</p>
            <p>Submission {proposal.submissionCount ?? 1} of 3</p>
            <h2>{proposal.revisionAvailable ? 'The client was not convinced by your proposal. Use the feedback to retry your proposal.' : proposal.decision === 'LOST' ? 'Deal lost. All proposal submissions have been used.' : presentation.nextAction}</h2>
            {proposal.revisionAvailable
              ? <Button disabled={revising} onClick={onRevise}>Retry proposal ({proposal.submissionsRemaining} attempts remaining)</Button>
              : <Button renderIcon={ArrowRight} onClick={() => navigate(`/dashboard/engagements/${engagementId}/assessment`)}>View full assessment</Button>}
            {revisionError && <p role="alert">The proposal could not be reopened. Your submitted proposal is saved; try again.</p>}
            {onReadProposal && <Button kind="ghost" renderIcon={Document} onClick={onReadProposal}>Read the proposal you sent</Button>}
          </section>
          <section className={styles.coach}>
            <p className={styles.eyebrow}>Decision coach</p>
            <h3>{coachView === 'explain' && explain.data ? 'Decision explanation' : coachView === 'counterfactual' && counterfactual.data ? 'What could have changed' : 'Understand the outcome'}</h3>
            {coachBusy
              ? <InlineLoading description="Preparing decision coaching" />
              : <p>{(coachView === 'explain' ? explain.data?.message : coachView === 'counterfactual' ? counterfactual.data?.message : null) ?? 'Read the reasons below, then open a focused coaching view when you need it.'}</p>}
            <div className={styles.coachActions}>
              <Button kind="tertiary" size="sm" renderIcon={Chat} onClick={() => { setCoachView('explain'); explain.mutate() }} disabled={coachBusy}>Explain decision</Button>
              <Button kind="ghost" size="sm" renderIcon={Renew} onClick={() => { setCoachView('counterfactual'); counterfactual.mutate() }} disabled={coachBusy}>What could change?</Button>
            </div>
          </section>
        </aside>
      </div>

      <section className={styles.details}>
        <div className={styles.tabs} role="tablist" aria-label="Decision detail">
          <button type="button" role="tab" aria-selected={view === 'overview'} onClick={() => setView('overview')}>Why it went this way</button>
          <button type="button" role="tab" aria-selected={view === 'score'} onClick={() => setView('score')}>How they weighed it</button>
          <button type="button" role="tab" aria-selected={view === 'evidence'} onClick={() => setView('evidence')}>Your claims, checked ({proposal.evidenceImpacts.length})</button>
        </div>

        {view === 'overview' && (
          <div className={styles.cards}>
            <section className={styles.card}>
              <p className={styles.eyebrow}>Why it moved forward</p>
              {strengths.length ? <ul className={styles.positive}>{strengths.slice(0, 3).map((item) => <li key={item.detail}>{item.detail}</li>)}</ul> : <p className={styles.empty}>No material strengths were recorded.</p>}
            </section>
            <section className={styles.card}>
              <p className={styles.eyebrow}>Conditions to carry forward</p>
              {conditions.length ? <ul className={styles.neutral}>{conditions.slice(0, 3).map((item) => <li key={item.detail}>{item.detail}</li>)}</ul> : <p className={styles.empty}>No additional conditions were recorded.</p>}
            </section>
            <section className={`${styles.card} ${styles.cardWarn}`}>
              <p className={styles.eyebrow}>Watch-outs</p>
              {concerns.length ? <ul className={styles.warning}>{concerns.slice(0, 3).map((item) => <li key={item.detail}>{item.detail}</li>)}</ul> : <p className={styles.empty}>No material concerns were recorded.</p>}
            </section>
          </div>
        )}

        {view === 'score' && (
          <div>
            <p className={styles.rule}>The decision is calculated from scenario rules — relationship, facts discovered and proposal fit. AI explains the result; it does not decide it. Scores are in your assessment.</p>
            <div className={styles.cards}>
              {proposal.decisionDimensions.map((dimension) => (
                <section key={dimension.dimension} className={styles.card}>
                  <div className={styles.dimHead}><strong>{dimension.dimension}</strong><span>{band(dimension.score)}</span></div>
                  <p>{dimension.interpretation}</p>
                </section>
              ))}
            </div>
            {strongest && <p className={styles.strongest}>Strongest factor: <strong>{strongest.dimension}</strong></p>}
            {/* Words first; the figures are one click away, never lost. */}
            <details className={styles.numbers}>
              <summary>Show the numbers behind the decision</summary>
              <dl className={styles.numberGrid}>
                <div><dt>Decision confidence</dt><dd>{proposal.decisionConfidence}%</dd></div>
                <div><dt>Learner performance</dt><dd>{proposal.learnerPerformanceScore}/100</dd></div>
              </dl>
              {proposal.decisionRationale && <p className={styles.rationale}>{proposal.decisionRationale}</p>}
              <ul className={styles.dimensionScores}>
                {proposal.decisionDimensions.map((dimension) => (
                  <li key={dimension.dimension}>
                    <span>{dimension.dimension}</span>
                    <b aria-hidden="true"><i style={{ width: `${dimension.score}%` }} /></b>
                    <strong>{dimension.score}/100</strong>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}

        {view === 'evidence' && (
          <div className={styles.evidence}>
            {/* Each count is a filter: press one to see only those claims, press it again for all. */}
            <div className={styles.counts} role="group" aria-label="Filter claims by support">
              <button type="button" className={styles.countAll} aria-pressed={support === null} onClick={() => setSupport(null)}>
                <span>All claims</span><strong>{proposal.evidenceImpacts.length}</strong>
              </button>
              {SUPPORT.map((item) => (
                <button
                  key={item.level}
                  type="button"
                  className={styles[item.tone]}
                  aria-pressed={support === item.level}
                  onClick={() => setSupport(support === item.level ? null : item.level)}
                >
                  <span>{item.label}</span><strong>{counts[item.level] ?? 0}</strong>
                </button>
              ))}
            </div>

            {proposal.evidenceImpacts.length === 0 ? (
              <div className={styles.emptyImpact}><WarningFilled size={20} /> This proposal predates detailed evidence-impact tracking.</div>
            ) : claims.length === 0 ? (
              <p className={styles.empty}>No claims in this group.</p>
            ) : (
              <ol className={styles.claims} aria-label="Claims">
                {claims.map((claim) => {
                  const meta = SUPPORT.find((item) => item.level === claim.supportLevel)
                  return (
                    <li key={`${claim.claim}-${claim.supportLevel}`} className={styles.impact}>
                      <div className={styles.impactHead}>
                        <Tag type={meta?.tag ?? 'gray'}>{meta?.label.toLowerCase() ?? claim.supportLevel}</Tag>
                      </div>
                      <h3>“{claim.claim}”</h3>
                      <p>{claim.explanation}</p>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
