import { Button, Column, Grid, Heading, InlineLoading, InlineNotification, Tag } from '@carbon/react'
import { ArrowLeft } from '@carbon/icons-react'
import { useMemo } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { useAdminLearnerRun, useAdminRunAssessment } from '@/api/hooks/useAdminLearnerProgress'
import type { Assessment } from '@/api/types'
import ErrorState from '@/components/shared/ErrorState'
import LoadingState from '@/components/shared/LoadingState'
import { relativeTime, STATUS_LABEL, STATUS_TAG, statusOf } from '@/features/admin/learnerProgress'
import LearnerStageBar from './LearnerStageBar'
import shared from './AdminOperationsPage.module.css'
import styles from './LearnerRunPage.module.css'

const LIST_URL = '/dashboard/admin/learners'
const STAGE_LABEL = { OUTREACH: 'Outreach', MEETING: 'Meeting', PROPOSAL: 'Proposal' }

const formatDate = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
const readable = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

function AssessmentDetail({ assessment }: { assessment: Assessment }) {
  return <>
    <div className={styles.outcome}>
      <strong>{assessment.overallScore}/100</strong>
      <Tag type="blue">{readable(assessment.outcome)}</Tag>
      <span>Generated {formatDate(assessment.generatedAt)}</span>
    </div>
    {assessment.coachingPending
      ? <InlineLoading description="AI coaching is still being prepared" />
      : <p className={styles.feedback}>{assessment.feedbackSummary}</p>}
    <ul className={styles.scores}>
      {assessment.competencyScores.map((competency) => {
        const label = competency.stage ? STAGE_LABEL[competency.stage] : competency.name
        return <li key={competency.name}>
          <div className={styles.scoreHead}><strong>{label}</strong><span>{competency.score}/100</span></div>
          <div className={styles.bar} role="img" aria-label={`${label}: ${competency.score} out of 100`}><i style={{ width: `${competency.score}%` }} /></div>
          {competency.evidenceNote && <p>{competency.evidenceNote}</p>}
        </li>
      })}
    </ul>
    {!assessment.coachingPending && <div className={styles.columns}>
      <section><h3>Strengths</h3>{assessment.strengths.length ? <ol>{assessment.strengths.map((item, index) => <li key={index}>{item}</li>)}</ol> : <p>None recorded.</p>}</section>
      <section><h3>Areas for improvement</h3>{assessment.improvementAreas.length ? <ol>{assessment.improvementAreas.map((item, index) => <li key={index}>{item}</li>)}</ol> : <p>None recorded.</p>}</section>
    </div>}
  </>
}

export default function LearnerRunPage() {
  const { engagementId = '' } = useParams<{ engagementId: string }>()
  const location = useLocation()
  const backTo = (location.state as { from?: string } | null)?.from ?? LIST_URL
  const progress = useAdminLearnerRun(engagementId)
  const entry = progress.data
  // An assessment exists exactly when the run has an overall score.
  const assessment = useAdminRunAssessment(engagementId, entry?.overallScore != null)
  const now = useMemo(() => Date.now(), [progress.dataUpdatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const back = <Button as={Link} to={backTo} kind="ghost" size="sm" renderIcon={ArrowLeft} className={styles.back}>Learner progress</Button>

  if (progress.isLoading) return <LoadingState />
  if (progress.isError) return <ErrorState actionLabel="Retry" onAction={() => void progress.refetch()} />
  if (!entry) {
    return <main className={shared.page}>
      {back}
      <ErrorState title="Run not found" message="This learner run no longer exists or the link is wrong." />
    </main>
  }

  const status = statusOf(entry, now)

  return <main className={shared.page}>
    <Grid condensed><Column lg={16} md={8} sm={4}>
      {back}
      <header className={shared.userHeader}>
        <div>
          <p className={shared.eyebrow}>Learner run</p>
          <Heading>{entry.displayName}</Heading>
          <p>{entry.email} · {entry.scenarioTitle}</p>
        </div>
        <Tag type={STATUS_TAG[status]} size="md">{STATUS_LABEL[status]}</Tag>
      </header>

      <section className={styles.overview} aria-label="Run overview">
        <div><span>Stage</span><LearnerStageBar entry={entry} /></div>
        <div><span>Score</span><strong>{entry.overallScore == null ? '—' : `${entry.overallScore}/100`}</strong></div>
        <div><span>Last activity</span><strong><time dateTime={entry.lastActivityAt} title={formatDate(entry.lastActivityAt)}>{relativeTime(entry.lastActivityAt, now)}</time></strong></div>
        <div><span>Completed</span><strong>{entry.completedAt ? formatDate(entry.completedAt) : '—'}</strong></div>
      </section>

      <section className={styles.assessment}>
        <h2>Assessment</h2>
        {entry.overallScore == null
          ? <p className={styles.muted}>No assessment yet. It is written once the client has decided on the learner&apos;s proposal.</p>
          : assessment.isLoading ? <InlineLoading description="Loading assessment" />
            : assessment.isError || !assessment.data
              ? <InlineNotification kind="error" lowContrast hideCloseButton title="Assessment unavailable" subtitle="The assessment for this run could not be loaded." />
              : <AssessmentDetail assessment={assessment.data} />}
      </section>
    </Column></Grid>
  </main>
}
