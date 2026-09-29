/**
 * Their decision — the client's answer to a submitted proposal.
 *
 * The client's letter comes first: who decided, what they decided and what
 * they said. The three detail views stay (why it went this way, how the
 * client weighed it, your claims checked), in words. Decision confidence,
 * learner performance and the dimension scores are left to the assessment,
 * where the numbers live (SRS FR-14).
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

export function ProposalOutcomeView({ proposal, engagementId, client = {}, onReadProposal }: {
  proposal: Proposal
  engagementId: string
  client?: OutcomeClient
  /** Opens the proposal that was sent, read-only. */
  onReadProposal?: () => void
}) {
  const navigate = useNavigate()
  const explain = useProposalDecisionExplanation(engagementId)
  const counterfactual = useProposalCounterfactual(engagementId)
  const [view, setView] = useState<View>('overview')
  const [impact, setImpact] = useState(0)
  const presentation = outcomePresentation(proposal.clientDecisionOutcome)
  const letter = proposal.clientResponse ?? proposal.decisionRationale ?? 'The client response is not yet available.'
  const strengths = decisionInsights(proposal.decisionInsights, 'STRENGTH')
  const concerns = decisionInsights(proposal.decisionInsights, 'CONCERN')
  const conditions = decisionInsights(proposal.decisionInsights, 'CONDITION')
  const counts = proposal.evidenceImpacts.reduce<Record<string, number>>((all, item) => ({ ...all, [item.supportLevel]: (all[item.supportLevel] ?? 0) + 1 }), {})
  const current = proposal.evidenceImpacts[impact]
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
            <Tag type={presentation.tagType}>{presentation.label}</Tag>
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
            <h2>{presentation.nextAction}</h2>
            <Button renderIcon={ArrowRight} onClick={() => navigate(`/dashboard/engagements/${engagementId}/assessment`)}>View full assessment</Button>
            {onReadProposal && <Button kind="ghost" renderIcon={Document} onClick={onReadProposal}>Read the proposal you sent</Button>}
          </section>
          <section className={styles.coach}>
            <p className={styles.eyebrow}>Decision coach</p>
            <h3>{explain.data ? 'Decision explanation' : counterfactual.data ? 'What could have changed' : 'Understand the outcome'}</h3>
            {coachBusy
              ? <InlineLoading description="Preparing decision coaching" />
              : <p>{explain.data?.message ?? counterfactual.data?.message ?? 'Read the reasons below, then open a focused coaching view when you need it.'}</p>}
            <div className={styles.coachActions}>
              <Button kind="tertiary" size="sm" renderIcon={Chat} onClick={() => explain.mutate()} disabled={coachBusy}>Explain decision</Button>
              <Button kind="ghost" size="sm" renderIcon={Renew} onClick={() => counterfactual.mutate()} disabled={coachBusy}>What could change?</Button>
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
          </div>
        )}

        {view === 'evidence' && (
          <div className={styles.evidence}>
            <div className={styles.counts}>
              <div className={styles.countGreen}><span>Well supported</span><strong>{counts.WELL_SUPPORTED ?? 0}</strong></div>
              <div className={styles.countGray}><span>Partially supported</span><strong>{counts.PARTIALLY_SUPPORTED ?? 0}</strong></div>
              <div className={styles.countRed}><span>Unsupported</span><strong>{counts.UNSUPPORTED ?? 0}</strong></div>
            </div>
            {current ? (
              <article className={styles.impact}>
                <div className={styles.impactHead}>
                  <Tag type={current.supportLevel === 'WELL_SUPPORTED' ? 'green' : current.supportLevel === 'PARTIALLY_SUPPORTED' ? 'warm-gray' : 'red'}>{current.supportLevel.replace('_', ' ').toLowerCase()}</Tag>
                  <span>{impact + 1} of {proposal.evidenceImpacts.length}</span>
                </div>
                <h3>“{current.claim}”</h3>
                <p>{current.explanation}</p>
                {proposal.evidenceImpacts.length > 1 && (
                  <div className={styles.pager}>
                    <Button kind="ghost" size="sm" disabled={impact === 0} onClick={() => setImpact(impact - 1)}>Previous</Button>
                    <Button kind="tertiary" size="sm" disabled={impact >= proposal.evidenceImpacts.length - 1} onClick={() => setImpact(impact + 1)}>Next claim</Button>
                  </div>
                )}
              </article>
            ) : (
              <div className={styles.emptyImpact}><WarningFilled size={20} /> This proposal predates detailed evidence-impact tracking.</div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
