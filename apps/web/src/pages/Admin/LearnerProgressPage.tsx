import { Button, Column, Grid, Heading, InlineLoading, Pagination, Select, SelectItem, Tag, TextInput } from '@carbon/react'
import { Renew, UserMultiple } from '@carbon/icons-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAdminLearnerProgress } from '@/api/hooks/useAdminLearnerProgress'
import ErrorState from '@/components/shared/ErrorState'
import LoadingState from '@/components/shared/LoadingState'
import {
  DEFAULT_STUCK_DAYS,
  LEARNER_STAGES,
  LEARNER_STATUSES as STATUSES,
  type LearnerStage,
  type LearnerStatus,
  relativeTime,
  STATUS_LABEL,
  STATUS_TAG,
  stageOf,
  statusOf,
  summarise,
} from '@/features/admin/learnerProgress'
import LearnerStageBar from './LearnerStageBar'
import shared from './AdminOperationsPage.module.css'
import styles from './LearnerProgressPage.module.css'

const PAGE_SIZES = [25, 50, 100]

const isStatus = (value: string | null): value is LearnerStatus => STATUSES.includes(value as LearnerStatus)

function SummaryTile({ label, value, detail, active, onClick }: {
  label: string
  value: string | number
  detail: string
  active?: boolean
  onClick?: () => void
}) {
  const content = <><span className={styles.tileLabel}>{label}</span><strong>{value}</strong><small>{detail}</small></>
  if (!onClick) return <div className={styles.tile}>{content}</div>
  return <button type="button" className={`${styles.tile} ${active ? styles.tileActive : ''}`} aria-pressed={active} onClick={onClick}>{content}</button>
}

export default function LearnerProgressPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialStatus = searchParams.get('status')
  const [search, setSearch] = useState('')
  const [scenarioFilter, setScenarioFilter] = useState('')
  const [stageFilter, setStageFilter] = useState<LearnerStage | ''>('')
  const [statusFilter, setStatusFilter] = useState<LearnerStatus | ''>(isStatus(initialStatus) ? initialStatus : '')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[0])
  const deferredSearch = useDeferredValue(search)
  const progress = useAdminLearnerProgress(true)
  const entries = useMemo(() => progress.data ?? [], [progress.data])
  // Freeze "now" per data load so statuses do not shift between renders.
  const now = useMemo(() => Date.now(), [progress.dataUpdatedAt]) // eslint-disable-line react-hooks/exhaustive-deps

  const scenarios = useMemo(() => {
    const byId = new Map(entries.map((entry) => [entry.scenarioId, entry.scenarioTitle]))
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]))
  }, [entries])

  const filtered = useMemo(() => {
    const term = deferredSearch.trim().toLowerCase()
    return entries
      .filter((entry) => !term || entry.displayName.toLowerCase().includes(term) || entry.email.toLowerCase().includes(term))
      .filter((entry) => !scenarioFilter || entry.scenarioId === scenarioFilter)
      .filter((entry) => !stageFilter || stageOf(entry.state) === stageFilter)
      .filter((entry) => !statusFilter || statusOf(entry, now) === statusFilter)
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime())
  }, [deferredSearch, entries, now, scenarioFilter, stageFilter, statusFilter])

  if (progress.isLoading) return <LoadingState />
  if (progress.isError) return <ErrorState actionLabel="Retry" onAction={() => void progress.refetch()} />

  const summary = summarise(entries, now)
  const hasFilters = Boolean(search.trim() || scenarioFilter || stageFilter || statusFilter)
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize)
  // The run page links back here with the status filter still applied.
  const listUrl = statusFilter ? `/dashboard/admin/learners?status=${statusFilter}` : '/dashboard/admin/learners'

  const applyStatus = (status: LearnerStatus | '') => {
    setStatusFilter(status)
    setPage(1)
    setSearchParams(status ? { status } : {}, { replace: true })
  }
  const toggleStatus = (status: LearnerStatus) => applyStatus(statusFilter === status ? '' : status)
  const resetFilters = () => {
    setSearch('')
    setScenarioFilter('')
    setStageFilter('')
    applyStatus('')
  }

  return <main className={shared.page}>
    <Grid condensed><Column lg={16} md={8} sm={4}>
      <header className={shared.userHeader}>
        <div>
          <p className={shared.eyebrow}>Learner analytics</p>
          <Heading>Learner progress</Heading>
          <p>See where every learner is in their engagement, how they scored, and who needs a nudge.</p>
        </div>
        <div className={shared.headerActions}>
          <Button kind="tertiary" renderIcon={Renew} disabled={progress.isFetching} onClick={() => progress.refetch()}>Refresh</Button>
        </div>
      </header>

      {entries.length === 0 ? (
        <section className={styles.empty}>
          <UserMultiple size={32} />
          <h2>No learners have started a scenario yet</h2>
          <p>Progress appears here as soon as a learner opens their first engagement. Make sure at least one scenario is published.</p>
          <Button as={Link} to="/dashboard/admin/scenarios" size="md">Go to learning journeys</Button>
        </section>
      ) : <>
        <section className={styles.tiles} aria-label="Learner summary">
          <SummaryTile label="In progress" value={summary.IN_PROGRESS} detail="Active learner runs" active={statusFilter === 'IN_PROGRESS'} onClick={() => toggleStatus('IN_PROGRESS')} />
          <SummaryTile label="Stuck" value={summary.STUCK} detail={`No activity for ${DEFAULT_STUCK_DAYS}+ days`} active={statusFilter === 'STUCK'} onClick={() => toggleStatus('STUCK')} />
          <SummaryTile label="Completed" value={summary.COMPLETED} detail="Reached assessment review" active={statusFilter === 'COMPLETED'} onClick={() => toggleStatus('COMPLETED')} />
          <SummaryTile label="Average score" value={summary.averageScore == null ? '—' : `${summary.averageScore}/100`} detail="Completed runs only" />
        </section>

        <section className={shared.userWorkspace}>
          <div className={shared.directoryHeading}>
            <div className={shared.directoryCount}><span className={shared.countIcon}><UserMultiple size={20} /></span><div><strong>{filtered.length}</strong><span>{hasFilters ? 'matching learner runs' : 'learner runs'}</span></div></div>
            {hasFilters && <Button kind="ghost" size="sm" onClick={resetFilters}>Clear filters</Button>}
          </div>
          <section className={styles.controls} aria-label="Learner progress filters">
            <TextInput id="learner-search" labelText="Search learner" placeholder="Name or email" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} />
            <Select id="learner-scenario-filter" labelText="Scenario" value={scenarioFilter} onChange={(event) => { setScenarioFilter(event.target.value); setPage(1) }}>
              <SelectItem value="" text="All scenarios" />
              {scenarios.map(([id, title]) => <SelectItem key={id} value={id} text={title} />)}
            </Select>
            <Select id="learner-stage-filter" labelText="Stage" value={stageFilter} onChange={(event) => { setStageFilter(event.target.value as LearnerStage | ''); setPage(1) }}>
              <SelectItem value="" text="All stages" />
              {LEARNER_STAGES.map((stage) => <SelectItem key={stage} value={stage} text={stage} />)}
            </Select>
            <Select id="learner-status-filter" labelText="Status" value={statusFilter} onChange={(event) => applyStatus(event.target.value as LearnerStatus | '')}>
              <SelectItem value="" text="All statuses" />
              {STATUSES.map((status) => <SelectItem key={status} value={status} text={STATUS_LABEL[status]} />)}
            </Select>
          </section>
          {progress.isFetching && <InlineLoading className={shared.directoryLoading} description="Updating learner progress" />}

          {filtered.length === 0 ? (
            <section className={styles.noResults}>
              <h2>No learners match these filters</h2>
              <Button kind="tertiary" size="md" onClick={resetFilters}>Clear filters</Button>
            </section>
          ) : <>
            <div className={shared.tableWrap}><table className={`${shared.table} ${styles.table}`}>
              <thead><tr><th>Learner</th><th>Scenario</th><th>Stage</th><th>Score</th><th>Last activity</th><th>Status</th></tr></thead>
              <tbody>{visible.map((entry) => {
                const status = statusOf(entry, now)
                return <tr key={entry.engagementId}>
                  <td><div className={shared.personCell}><div>
                    <Link className={styles.runLink} to={`/dashboard/admin/learners/${entry.engagementId}`} state={{ from: listUrl }}>{entry.displayName}</Link>
                    <span>{entry.email}</span>
                  </div></div></td>
                  <td>{entry.scenarioTitle}</td>
                  <td><LearnerStageBar entry={entry} /></td>
                  <td className={styles.score}>{entry.overallScore ?? '—'}</td>
                  <td><time dateTime={entry.lastActivityAt} title={new Date(entry.lastActivityAt).toLocaleString()}>{relativeTime(entry.lastActivityAt, now)}</time></td>
                  <td><Tag type={STATUS_TAG[status]}>{STATUS_LABEL[status]}</Tag></td>
                </tr>
              })}</tbody>
            </table></div>
            <Pagination className={shared.directoryPagination} page={page} pageSize={pageSize} pageSizes={PAGE_SIZES} totalItems={filtered.length}
              onChange={({ page: nextPage, pageSize: nextPageSize }) => { setPage(nextPage); setPageSize(nextPageSize) }} />
          </>}
          <p className={styles.legend}>Stages: {LEARNER_STAGES.join(' · ')}. A run is stuck after {DEFAULT_STUCK_DAYS} days without activity.</p>
        </section>
      </>}
    </Column></Grid>
  </main>
}
