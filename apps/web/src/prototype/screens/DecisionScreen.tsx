/**
 * Their decision (Proposal Outcome) — design doc §4 screen 8. The learner read
 * six numbers before learning what the client said. Now the client's letter
 * comes first, the three tabs stay (they are genuinely different content), and
 * every number — decision confidence, learner performance, dimension scores —
 * is deferred to the assessment (R4).
 */
import { useState } from 'react'
import { Button, InlineLoading, Tag } from '@carbon/react'
import { ArrowRight, Chat, Renew, WarningFilled } from '@carbon/icons-react'
import type { ClientDecisionOutcome } from '@/api/types'
import { decisionInsights, outcomePresentation } from '@/features/proposal/services/proposalOutcomeService'
import { COUNTERFACTUAL, DECISION_EXPLANATION, SUBMITTED_PROPOSAL } from '../data/engagementFlow'
import { useProto } from '../state/protoStore'
import styles from './decision.module.scss'

const LETTER: Partial<Record<ClientDecisionOutcome, string>> = {
  REVISION_REQUESTED: SUBMITTED_PROPOSAL.clientResponse ?? '',
  PILOT_APPROVED: 'Vince — I am happy to approve the Ashford measurement and a controlled interface pilot, on the condition that it pauses if ward sisters cannot release staff. Please send the start date and the named lead from your side.',
  PROPOSAL_ACCEPTED: 'Vince — we will go ahead with the proposal as written. My office will raise the purchase order this week; please confirm the start date with Alan.',
  STRATEGIC_PARTNERSHIP: 'Vince — the board would like to discuss a wider programme across all twelve sites, starting with your Ashford measurement. Can we meet with Priya next week?',
  FURTHER_DISCOVERY_REQUIRED: 'Vince — before I can consider this I need to understand the pharmacy system’s role. We did not cover it, and it is where half our duplicate entries start.',
  DEFERRED: 'Vince — thank you. With the regulator arriving I cannot take on anything new this quarter. Please come back to me in January.',
  REJECTED: 'Vince — thank you for the work. The plan asks my wards for time they do not have this winter, and I cannot support it.',
}

function band(score: number) {
  return score >= 80 ? 'Carried the decision' : score >= 65 ? 'Helped' : 'Held it back'
}

export default function DecisionScreen() {
  const outcome = useProto((s) => s.decisionOutcome)
  const go = useProto((s) => s.go)
  const [view, setView] = useState<'overview' | 'score' | 'evidence'>('overview')
  const [impact, setImpact] = useState(0)
  const [coach, setCoach] = useState<'idle' | 'explaining' | 'explained' | 'imagining' | 'imagined'>('idle')
  const proposal = SUBMITTED_PROPOSAL
  const presentation = outcomePresentation(outcome)
  const strengths = decisionInsights(proposal.decisionInsights, 'STRENGTH')
  const concerns = decisionInsights(proposal.decisionInsights, 'CONCERN')
  const conditions = decisionInsights(proposal.decisionInsights, 'CONDITION')
  const counts = proposal.evidenceImpacts.reduce<Record<string, number>>((all, item) => ({ ...all, [item.supportLevel]: (all[item.supportLevel] ?? 0) + 1 }), {})
  const current = proposal.evidenceImpacts[impact]
  const strongest = [...proposal.decisionDimensions].sort((a, b) => b.score - a.score)[0]

  const ask = (kind: 'explain' | 'imagine') => {
    setCoach(kind === 'explain' ? 'explaining' : 'imagining')
    window.setTimeout(() => setCoach(kind === 'explain' ? 'explained' : 'imagined'), 1200)
  }

  return (
    <div className={styles.page}>
      <div className={styles.layout}>
        <article className={styles.letter}>
          <header className={styles.letterhead}>
            <div className={styles.crest} aria-hidden="true">M</div>
            <div>
              <strong>MediCare Regional Hospital Network</strong>
              <span>Office of the Chief Operating Officer</span>
            </div>
          </header>
          <p className={styles.dateLine}>{new Date(proposal.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          <p className={styles.re}>Re: Proposal — ward re-entry at Ashford</p>
          <div className={styles.outcomeLine}>
            <Tag type={presentation.tagType}>{presentation.label}</Tag>
            <span>{presentation.subtitle}</span>
          </div>
          <p className={styles.letterBody}>{LETTER[outcome]}</p>
          <p className={styles.signoff}>Sarah Chen<br /><span>Chief Operating Officer</span></p>
        </article>

        <aside className={styles.side}>
          <section className={styles.nextStep}>
            <p className={styles.eyebrow}>Recommended next step</p>
            <h2>{presentation.nextAction}</h2>
            <Button renderIcon={ArrowRight} onClick={() => go('ASSESSMENT')}>View full assessment</Button>
          </section>
          <section className={styles.coach}>
            <p className={styles.eyebrow}>Decision coach</p>
            <h3>{coach === 'explained' ? 'Decision explanation' : coach === 'imagined' ? 'What could have changed' : 'Understand the outcome'}</h3>
            {coach === 'explaining' || coach === 'imagining' ? (
              <InlineLoading description="Preparing decision coaching" />
            ) : (
              <p>{coach === 'explained' ? DECISION_EXPLANATION : coach === 'imagined' ? COUNTERFACTUAL : 'Read the reasons below, then open a focused coaching view when you need it.'}</p>
            )}
            <div className={styles.coachActions}>
              <Button kind="tertiary" size="sm" renderIcon={Chat} onClick={() => ask('explain')}>Explain decision</Button>
              <Button kind="ghost" size="sm" renderIcon={Renew} onClick={() => ask('imagine')}>What could change?</Button>
            </div>
          </section>
        </aside>
      </div>

      <section className={styles.details}>
        <div className={styles.tabs} role="tablist" aria-label="Decision detail">
          <button type="button" role="tab" aria-selected={view === 'overview'} onClick={() => setView('overview')}>Why it went this way</button>
          <button type="button" role="tab" aria-selected={view === 'score'} onClick={() => setView('score')}>How she weighed it</button>
          <button type="button" role="tab" aria-selected={view === 'evidence'} onClick={() => setView('evidence')}>Your claims, checked ({proposal.evidenceImpacts.length})</button>
        </div>

        {view === 'overview' && (
          <div className={styles.cards}>
            <section className={styles.card}><p className={styles.eyebrow}>Why it moved forward</p><ul className={styles.positive}>{strengths.slice(0, 3).map((item) => <li key={item.detail}>{item.detail}</li>)}</ul></section>
            <section className={styles.card}><p className={styles.eyebrow}>Conditions to carry forward</p><ul className={styles.neutral}>{conditions.slice(0, 3).map((item) => <li key={item.detail}>{item.detail}</li>)}</ul></section>
            <section className={`${styles.card} ${styles.cardWarn}`}><p className={styles.eyebrow}>Watch-outs</p><ul className={styles.warning}>{concerns.slice(0, 3).map((item) => <li key={item.detail}>{item.detail}</li>)}</ul></section>
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
            <p className={styles.strongest}>Strongest factor: <strong>{strongest.dimension}</strong></p>
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
                <div className={styles.pager}>
                  <Button kind="ghost" size="sm" disabled={impact === 0} onClick={() => setImpact(impact - 1)}>Previous</Button>
                  <Button kind="tertiary" size="sm" disabled={impact >= proposal.evidenceImpacts.length - 1} onClick={() => setImpact(impact + 1)}>Next claim</Button>
                </div>
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
