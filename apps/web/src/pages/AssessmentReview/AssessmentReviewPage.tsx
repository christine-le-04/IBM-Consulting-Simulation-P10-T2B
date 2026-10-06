/**
 * Your review — the engagement assessment, read as the review document it is.
 * Numbers are kept off the play screens (SRS FR-14) so they land here, with
 * weight: the overall score and each competency. Every state is unchanged:
 * generating on first visit, coaching still pending, "not ready yet", errors.
 */
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, InlineLoading, Tag } from '@carbon/react'
import { ArrowRight } from '@carbon/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useAssessment, useGenerateAssessment } from '@/api/hooks/useAssessment'
import { engagementKeys, useEngagement } from '@/api/hooks/useEngagements'
import { portfolioKeys } from '@/api/hooks/usePortfolio'
import { resolveEngagementRoute } from '@/api/engagementRouting'
import { PHASE_LABEL } from '@/lifecycle/phases'
import LoadingState from '@/components/shared/LoadingState'
import { useMentor } from '@/components/shell/useMentor'
import { useAuthStore } from '@/store/authStore'
import ErrorState from '@/components/shared/ErrorState'
import styles from './AssessmentReviewPage.module.scss'

type OutcomePresentation = {
  label: string
  contractStatus: string
  tagType: 'green' | 'red' | 'blue' | 'purple'
}

function describeOutcome(outcome: string): OutcomePresentation {
  switch (outcome) {
    case 'PILOT_APPROVED':
      return { label: 'Pilot approved', contractStatus: 'Contract won', tagType: 'green' }
    case 'PROPOSAL_ACCEPTED':
    case 'WON':
      return { label: 'Proposal accepted', contractStatus: 'Contract won', tagType: 'green' }
    case 'STRATEGIC_PARTNERSHIP':
      return { label: 'Strategic partnership', contractStatus: 'Contract won', tagType: 'green' }
    case 'REVISION_REQUESTED':
      return { label: 'Revision requested', contractStatus: 'Client decision recorded', tagType: 'purple' }
    case 'FURTHER_DISCOVERY_REQUIRED':
      return { label: 'Further discovery requested', contractStatus: 'Client decision recorded', tagType: 'blue' }
    case 'DEFERRED':
      return { label: 'Decision deferred', contractStatus: 'Contract not awarded', tagType: 'blue' }
    case 'REJECTED':
    case 'PROPOSAL_REJECTED':
    case 'LOST':
      return { label: 'Proposal rejected', contractStatus: 'Contract not won', tagType: 'red' }
    default:
      return { label: outcome.replaceAll('_', ' '), contractStatus: 'Client decision recorded', tagType: 'blue' }
  }
}

/**
 * The backend refuses to assess an engagement that hasn't reached the end, and
 * says so in its own vocabulary: "Assessment is not available in state:
 * OUTREACHING". That is a correct refusal phrased as a leak — a learner is
 * shown an internal enum, and offered a Retry button that cannot ever succeed.
 * Detecting the refusal lets us say which step is actually outstanding and send
 * them there instead.
 */
function isTooEarly(detail: string | undefined): boolean {
  return !!detail && /not available in state/i.test(detail)
}

/** Older saved narratives may still contain outcome identifiers. */
function readableCoaching(text: string): string {
  return text.replace(/\b(PILOT_APPROVED|PROPOSAL_ACCEPTED|REVISION_REQUESTED|FURTHER_DISCOVERY_REQUIRED|STRATEGIC_PARTNERSHIP|DEFERRED|REJECTED)\b/g,
    (outcome) => describeOutcome(outcome).label.toLowerCase())
}

export default function AssessmentReviewPage() {
  const { engagementId } = useParams<{ engagementId: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { displayName } = useAuthStore()
  const { data: engagement } = useEngagement(engagementId!)
  const { data: assessment, isLoading, isError, error } = useAssessment(engagementId!)
  const generateAssessment = useGenerateAssessment(engagementId!)

  const notFound = isError && (error as { response?: { status?: number } })?.response?.status === 404
  const generationError = generateAssessment.error as
    | { response?: { data?: { detail?: string } } }
    | null

  useEffect(() => {
    if (notFound && !generateAssessment.isPending && !generateAssessment.isSuccess) {
      generateAssessment.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound])

  useEffect(() => {
    if (!assessment && !generateAssessment.data) return
    void queryClient.invalidateQueries({ queryKey: engagementKeys.all })
    void queryClient.invalidateQueries({ queryKey: engagementKeys.detail(engagementId!) })
    void queryClient.invalidateQueries({ queryKey: portfolioKeys.summary })
  }, [assessment, engagementId, generateAssessment.data, queryClient])

  useMentor('This is where the numbers live. Read the two things to work on; they are what I would coach you on.')

  if (isLoading || generateAssessment.isPending) return <LoadingState description="Generating assessment…" />
  if (isError && !notFound) {
    const problem = error as { response?: { data?: { detail?: string } } }
    return <ErrorState title="Assessment unavailable" message={problem.response?.data?.detail ?? 'The assessment could not be loaded. Retry to recover the assessment for this engagement.'} actionLabel="Retry assessment" onAction={() => generateAssessment.mutate()} />
  }
  if (generateAssessment.isError) {
    const detail = generationError?.response?.data?.detail
    if (isTooEarly(detail)) {
      const step = engagement ? PHASE_LABEL[engagement.phase] : null
      return (
        <ErrorState
          title="Your review isn't ready yet"
          message={
            step
              ? `Your review is written once the client has decided on your proposal. You're still on "${step}".`
              : 'Your review is written once the client has decided on your proposal.'
          }
          actionLabel={engagement ? `Back to ${PHASE_LABEL[engagement.phase]}` : undefined}
          onAction={engagement ? () => navigate(resolveEngagementRoute(engagement)) : undefined}
        />
      )
    }
    return (
      <ErrorState
        title="Assessment could not be generated"
        message={detail ?? 'Please retry after completing the proposal outcome.'}
        actionLabel="Retry assessment"
        onAction={() => generateAssessment.mutate()}
      />
    )
  }

  const result = assessment ?? generateAssessment.data
  if (!result) return <LoadingState description="Generating assessment…" />

  const outcome = describeOutcome(result.outcome)
  const hasStageScores = result.competencyScores.some((score) => score.stage)
  const stageLabels = { OUTREACH: 'Outreach', MEETING: 'Meeting', PROPOSAL: 'Proposal' }

  return (
    <div className={styles.page}>
      <article className={styles.report}>
        <header className={styles.reportHead}>
          <div>
            <p className={styles.org}>IBM Consulting</p>
            <h1>Engagement review</h1>
            <p className={styles.meta}>{[displayName, 'Associate Consultant', engagement?.scenarioTitle].filter(Boolean).join(' · ')}</p>
          </div>
          <div className={styles.overall}>
            <span>Overall</span>
            <strong>{result.overallScore}/100</strong>
          </div>
        </header>

        <div className={styles.outcomeRow}>
          <Tag type="blue">Engagement complete</Tag>
          <Tag type={outcome.tagType}>{outcome.label}</Tag>
          <strong>{outcome.contractStatus}</strong>
        </div>

        <section className={styles.summary}>
          <h2 className={styles.label}>Reviewer’s summary</h2>
          {result.coachingPending ? <InlineLoading description="Preparing personalised AI coaching…" status="active" /> : <p>{readableCoaching(result.feedbackSummary)}</p>}
        </section>

        <section>
          <h2 className={styles.label}>{hasStageScores ? 'Best scores by stage' : 'Competencies'}</h2>
          {hasStageScores && <p>Research and meeting preparation receive feedback only. Checkpoint resets give you fresh attempts and keep your earlier best scores.</p>}
          <div className={styles.competencies}>
            {result.competencyScores.map((competency) => (
              <div key={competency.name} className={styles.competency}>
                <div className={styles.competencyHead}>
                  <strong>{competency.stage ? stageLabels[competency.stage] : competency.name}</strong>
                  <span>{competency.score}/100</span>
                </div>
                <div className={styles.bar} role="img" aria-label={`${competency.name}: ${competency.score} out of 100`}><i style={{ width: `${competency.score}%` }} /></div>
                {competency.stage && competency.attemptCount != null && (
                  <p>{competency.attemptCount} completed {competency.attemptCount === 1 ? 'attempt' : 'attempts'} total
                    {competency.currentCycleAttempts != null && ` · ${competency.currentCycleAttempts} in the current checkpoint cycle`}
                    {competency.checkpointResets != null && ` · ${competency.checkpointResets} checkpoint ${competency.checkpointResets === 1 ? 'reset' : 'resets'}`}
                  </p>
                )}
                {competency.evidenceNote && <p>{competency.evidenceNote}</p>}
              </div>
            ))}
          </div>
        </section>

        <div className={styles.columns}>
          <section>
            <h2 className={styles.label}>Strengths</h2>
            {result.coachingPending ? <InlineLoading description="Preparing strengths…" status="active" /> : (
              <>
                <ol>{result.strengths.map((item, index) => <li key={index}>{readableCoaching(item)}</li>)}</ol>
                {result.strengths.length === 0 && <p className={styles.empty}>None recorded.</p>}
              </>
            )}
          </section>
          <section>
            <h2 className={styles.label}>Areas for Improvement</h2>
            {result.coachingPending ? <InlineLoading description="Preparing areas for improvement…" status="active" /> : (
              <>
                <ol>{result.improvementAreas.map((item, index) => <li key={index}>{readableCoaching(item)}</li>)}</ol>
                {result.improvementAreas.length === 0 && <p className={styles.empty}>None recorded.</p>}
              </>
            )}
          </section>
        </div>

        <footer className={styles.reportFoot}>
          <span>Generated {new Date(result.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <div className={styles.actions}>
            <Button kind="secondary" onClick={() => navigate('/dashboard')}>Back to the Office</Button>
            <Button renderIcon={ArrowRight} onClick={() => navigate('/dashboard/portfolio')}>View portfolio</Button>
          </div>
        </footer>
      </article>
    </div>
  )
}
