import { Button, Heading, InlineLoading, InlineNotification, Pagination, Select, SelectItem, Tag, TextInput } from '@carbon/react'
import { ArrowLeft, Renew } from '@carbon/icons-react'
import { FormEvent, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAdminAuditEvents, type AdminAuditFilters } from '@/api/hooks/useAdminAuditEvents'
import ErrorState from '@/components/shared/ErrorState'
import styles from './AuditLogPage.module.css'

const targets = ['USER', 'SCENARIO', 'LEAD', 'KNOWLEDGE_DOCUMENT', 'ACHIEVEMENT']
const label = (value: string) => value.replace(/^ADMIN_/, '').toLowerCase().replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase())
const emptyFilters = { search: '', action: '', targetType: '', from: '', to: '' }
const formatTime = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export default function AuditLogPage() {
  const [draft, setDraft] = useState(emptyFilters)
  const [applied, setApplied] = useState<Omit<AdminAuditFilters, 'page' | 'size'>>({})
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(25)
  const [dateError, setDateError] = useState(false)
  const events = useAdminAuditEvents({ ...applied, page, size })
  const update = (field: keyof typeof draft, value: string) => setDraft((previous) => ({ ...previous, [field]: value }))
  const apply = (event: FormEvent) => {
    event.preventDefault()
    if (draft.from && draft.to && draft.from > draft.to) { setDateError(true); return }
    setDateError(false)
    setPage(0)
    setApplied({ search: draft.search.trim() || undefined, action: draft.action || undefined,
      targetType: draft.targetType || undefined, from: draft.from || undefined, to: draft.to || undefined })
  }
  const clear = () => { setDraft(emptyFilters); setApplied({}); setPage(0); setDateError(false) }

  return <main className={styles.page}>
    <Link to="/dashboard/admin" className={styles.back}><ArrowLeft size={16} /> Admin console</Link>
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>Administration history</p><Heading>Audit log</Heading>
        <p>See who changed people, scenarios and platform settings.</p></div>
      <Button kind="tertiary" renderIcon={Renew} disabled={events.isFetching} onClick={() => events.refetch()}>Refresh</Button>
    </header>
    <form onSubmit={apply} className={styles.filters} aria-label="Audit log filters">
      <TextInput id="audit-search" labelText="Search activity" placeholder="Person, email, target ID or detail" maxLength={100}
        value={draft.search} onChange={(event) => update('search', event.target.value)} />
      <Select id="audit-action" labelText="Action" value={draft.action} onChange={(event) => update('action', event.target.value)}>
        <SelectItem value="" text="All actions" />
        {(events.data?.actions ?? []).map((action) => <SelectItem key={action} value={action} text={label(action)} />)}
      </Select>
      <Select id="audit-target" labelText="Resource" value={draft.targetType} onChange={(event) => update('targetType', event.target.value)}>
        <SelectItem value="" text="All resources" />
        {targets.map((target) => <SelectItem key={target} value={target} text={label(target)} />)}
      </Select>
      <TextInput id="audit-from" type="date" labelText="From date (UTC)" value={draft.from} onChange={(event) => update('from', event.target.value)} />
      <TextInput id="audit-to" type="date" labelText="To date (UTC)" value={draft.to} onChange={(event) => update('to', event.target.value)} />
      <div className={styles.filterActions}><Button type="submit" size="sm">Apply filters</Button><Button kind="ghost" size="sm" onClick={clear}>Clear</Button></div>
    </form>
    {dateError && <InlineNotification kind="error" title="Check the date range" subtitle="Start date must be on or before end date." hideCloseButton />}
    {events.isError ? <ErrorState title="Audit history could not be loaded" actionLabel="Try again" onAction={() => events.refetch()} /> : <>
      <div className={styles.summary}><strong>{events.data?.totalElements ?? 0} recorded actions</strong><span>Newest first. Times shown in your local time.</span></div>
      {events.isFetching && <InlineLoading description="Loading audit history" />}
      {!events.isLoading && events.data?.items.length === 0 && <div className={styles.empty}>
        <h2>No matching activity</h2><p>New administrative changes appear here after they are saved. Try clearing your filters or refreshing.</p>
      </div>}
      {events.data && events.data.items.length > 0 && <div className={styles.tableWrap} aria-busy={events.isFetching}>
        <table className={styles.table}><caption className={styles.visuallyHidden}>Administrative activity</caption>
          <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">Action</th><th scope="col">Target</th><th scope="col">Details</th></tr></thead>
          <tbody>{events.data.items.map((item) => <tr key={item.id}>
            <td><time dateTime={item.occurredAt}>{formatTime(item.occurredAt)}</time></td>
            <td><strong>{item.actorDisplayName || item.actorEmail || (item.actorId ? 'Unknown user' : 'System')}</strong>
              <small>{item.actorEmail || item.actorId || 'Automated action'}</small>{item.actorRole && <small>{label(item.actorRole)}</small>}</td>
            <td><Tag type={item.action.includes('DELETED') ? 'red' : 'blue'}>{label(item.action)}</Tag></td>
            <td><strong>{label(item.targetType)}</strong><code>{item.targetId}</code></td>
            <td className={styles.details}>{item.details || 'No additional details'}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      {events.data && events.data.totalElements > 0 && <Pagination page={page + 1} pageSize={size} pageSizes={[25, 50, 100]}
        totalItems={events.data.totalElements} onChange={({ page: nextPage, pageSize }) => {
          setPage(pageSize === size ? nextPage - 1 : 0); setSize(pageSize)
        }} />}
    </>}
  </main>
}
