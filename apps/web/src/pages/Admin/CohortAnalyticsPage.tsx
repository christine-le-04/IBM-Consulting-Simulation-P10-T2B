import { Button, Column, Grid, Heading, InlineLoading, Select, SelectItem, Tag } from '@carbon/react'
import { ChartBar, Renew, UserMultiple } from '@carbon/icons-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminCohortAnalytics } from '@/api/hooks/useAdminLearnerProgress'
import type { CohortAnalytics } from '@/api/types'
import ErrorState from '@/components/shared/ErrorState'
import LoadingState from '@/components/shared/LoadingState'
import { completionRate, stageCounts } from '@/features/admin/learnerProgress'
import shared from './AdminOperationsPage.module.css'
import progressStyles from './LearnerProgressPage.module.css'
import styles from './CohortAnalyticsPage.module.css'

const ALL = 'all'
const runs = (count: number) => `${count} ${count === 1 ? 'run' : 'runs'}`

function Tile({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className={progressStyles.tile}><span className={progressStyles.tileLabel}>{label}</span><strong>{value}</strong><small>{detail}</small></div>
}

function StageFunnel({ cohort }: { cohort: CohortAnalytics }) {
  const stages = stageCounts(cohort)
  const max = Math.max(1, ...stages.map((stage) => stage.count))
  return <ol className={styles.bars} aria-label="Runs by current stage">
    {stages.map(({ stage, count }) => <li key={stage} className={styles.barRow} title={`${stage}: ${runs(count)}`}>
      <span className={styles.barLabel}>{stage}</span>
      <span className={styles.track}>{count > 0 && <span className={styles.fill} style={{ width: `${(count / max) * 100}%` }} />}</span>
      <span className={styles.barValue}>{count}</span>
    </li>)}
  </ol>
}

function Competencies({ cohort, target }: { cohort: CohortAnalytics; target: number }) {
  if (cohort.competencies.length === 0) return <p className={styles.muted}>Competency averages appear once a learner in this group finishes a run and is assessed.</p>
  return <div className={shared.tableWrap}><table className={`${shared.table} ${styles.competencyTable}`}>
    <thead><tr><th>Competency</th><th>Average score</th><th>Below {target}</th><th>Signal</th></tr></thead>
    <tbody>{cohort.competencies.map((competency) => {
      const weak = competency.averageScore < target
      return <tr key={competency.name}>
        <td>{competency.name}</td>
        <td><div className={styles.scoreCell} title={`${competency.name}: average ${competency.averageScore}/100 across ${runs(competency.assessedCount)} assessed`}>
          <span className={styles.track}>
            <span className={styles.fill} style={{ width: `${competency.averageScore}%` }} />
            <span className={styles.target} style={{ left: `${target}%` }} aria-hidden="true" />
          </span>
          <span className={styles.barValue}>{competency.averageScore}</span>
        </div></td>
        <td>{competency.belowTargetCount} of {competency.assessedCount}</td>
        <td>{weak ? <Tag type="red">Needs work</Tag> : <Tag type="green">On target</Tag>}</td>
      </tr>
    })}</tbody>
  </table></div>
}

function WeakAreas({ cohort, target }: { cohort: CohortAnalytics; target: number }) {
  const weakCompetencies = cohort.competencies.filter((competency) => competency.averageScore < target)
  if (weakCompetencies.length === 0 && cohort.commonImprovementAreas.length === 0) {
    return <p className={styles.muted}>No common weak areas yet. They appear when assessed runs share a low competency or the same coaching advice.</p>
  }
  return <div className={styles.weakGrid}>
    <div>
      <h3>Competencies below {target}</h3>
      {weakCompetencies.length ? <ul className={styles.weakList}>{weakCompetencies.map((competency) => <li key={competency.name}>
        <strong>{competency.name}</strong><span>Average {competency.averageScore} · {competency.belowTargetCount} of {runs(competency.assessedCount)} assessed below {target}</span>
      </li>)}</ul> : <p className={styles.muted}>Every competency averages {target} or more.</p>}
    </div>
    <div>
      <h3>Advice repeated across runs</h3>
      {cohort.commonImprovementAreas.length ? <ul className={`${styles.weakList} ${styles.adviceList}`}>{cohort.commonImprovementAreas.map((area) => <li key={area.text}>
        <strong>{area.text}</strong><span>Given to {runs(area.runCount)}</span>
      </li>)}</ul> : <p className={styles.muted}>No coaching advice has been repeated yet.</p>}
    </div>
  </div>
}

export default function CohortAnalyticsPage() {
  const [scenarioId, setScenarioId] = useState(ALL)
  const analytics = useAdminCohortAnalytics(true)

  if (analytics.isLoading) return <LoadingState />
  if (analytics.isError || !analytics.data) return <ErrorState actionLabel="Retry" onAction={() => void analytics.refetch()} />

  const { overall, scenarios, targetScore } = analytics.data
  const cohort = scenarios.find((scenario) => scenario.scenarioId === scenarioId) ?? overall
  const rate = completionRate(cohort)
  const weakest = (scenario: CohortAnalytics) => scenario.competencies[0]

  return <main className={shared.page}>
    <Grid condensed><Column lg={16} md={8} sm={4}>
      <header className={shared.userHeader}>
        <div>
          <p className={shared.eyebrow}>Learner analytics</p>
          <Heading>Cohort analytics</Heading>
          <p>Compare how groups of learners do in each scenario and spot the skills to coach next.</p>
        </div>
        <div className={shared.headerActions}>
          <Button kind="tertiary" renderIcon={UserMultiple} as={Link} to="/dashboard/admin/learners">Learner progress</Button>
          <Button kind="tertiary" renderIcon={Renew} disabled={analytics.isFetching} onClick={() => analytics.refetch()}>Refresh</Button>
        </div>
      </header>

      {overall.runCount === 0 ? (
        <section className={progressStyles.empty}>
          <ChartBar size={32} />
          <h2>No learner runs to analyse yet</h2>
          <p>Cohort results appear once learners start a scenario. Make sure at least one scenario is published.</p>
          <Button as={Link} to="/dashboard/admin/scenarios" size="md">Go to learning journeys</Button>
        </section>
      ) : <>
        <section className={styles.picker}>
          <Select id="cohort-scenario" labelText="Cohort" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>
            <SelectItem value={ALL} text={`All scenarios (${runs(overall.runCount)})`} />
            {scenarios.map((scenario) => <SelectItem key={scenario.scenarioId} value={scenario.scenarioId ?? ''} text={`${scenario.scenarioTitle} (${runs(scenario.runCount)})`} />)}
          </Select>
          {analytics.isFetching && <InlineLoading description="Updating cohort analytics" />}
        </section>

        <section className={progressStyles.tiles} aria-label="Cohort summary">
          <Tile label="Learners" value={cohort.learnerCount} detail={`${runs(cohort.runCount)} started`} />
          <Tile label="Completion rate" value={rate == null ? '—' : `${rate}%`} detail={`${cohort.completedCount} of ${runs(cohort.runCount)} completed`} />
          <Tile label="Average score" value={cohort.averageScore == null ? '—' : `${cohort.averageScore}/100`} detail="Assessed runs only" />
          <Tile label="Meeting failed" value={cohort.meetingFailedCount} detail="Runs that lost the client meeting" />
        </section>

        <section className={styles.panels}>
          <article className={styles.panel}>
            <h2>Where runs are now</h2>
            <p className={styles.muted}>Current stage of every run in this cohort. A tall bar before Review shows where learners stall.</p>
            <StageFunnel cohort={cohort} />
          </article>
          <article className={styles.panel}>
            <h2>Common weak areas</h2>
            <WeakAreas cohort={cohort} target={targetScore} />
          </article>
        </section>

        <section className={styles.panel}>
          <h2>Average score per competency</h2>
          <p className={styles.muted}>Weakest first. The line on each bar marks the target score of {targetScore}.</p>
          <Competencies cohort={cohort} target={targetScore} />
        </section>

        {scenarios.length > 1 && <section className={styles.panel}>
          <h2>Compare scenarios</h2>
          <div className={shared.tableWrap}><table className={shared.table}>
            <thead><tr><th>Scenario</th><th>Learners</th><th>Completion</th><th>Average score</th><th>Weakest competency</th></tr></thead>
            <tbody>{scenarios.map((scenario) => <tr key={scenario.scenarioId}>
              <td><button type="button" className={styles.linkButton} onClick={() => { setScenarioId(scenario.scenarioId ?? ALL); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>{scenario.scenarioTitle}</button></td>
              <td>{scenario.learnerCount}</td>
              <td className={styles.nowrap}>{completionRate(scenario) ?? '—'}% <span className={styles.muted}>({scenario.completedCount}/{scenario.runCount})</span></td>
              <td>{scenario.averageScore ?? '—'}</td>
              <td>{weakest(scenario) ? `${weakest(scenario).name} (${weakest(scenario).averageScore})` : '—'}</td>
            </tr>)}</tbody>
          </table></div>
        </section>}
      </>}
    </Column></Grid>
  </main>
}
