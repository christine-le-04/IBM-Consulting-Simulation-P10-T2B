import { FormEvent, useState } from 'react'
import { Button, Checkbox, Form, Heading, InlineLoading, InlineNotification, Modal, Pagination, Select, SelectItem, Tag, TextArea, TextInput } from '@carbon/react'
import { Add, Renew } from '@carbon/icons-react'
import { usePublishAnnouncement, type AnnouncementRole, type PublishAnnouncementInput } from '@/api/hooks/useAnnouncements'
import { audienceLabel, recipientRoles as roles, useAdminAnnouncements, useWithdrawAnnouncement, type AnnouncementAudienceFilter, type AnnouncementStatusFilter, type SentAnnouncement } from '@/api/hooks/useAdminAnnouncements'
import { getProblemDetail } from '@/api/problemDetails'
import styles from './AnnouncementsPage.module.css'

const PAGE_SIZE = 20

export default function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [publishAt, setPublishAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [dateError, setDateError] = useState('')
  const [audience, setAudience] = useState('ALL')
  const [targetRoles, setTargetRoles] = useState<AnnouncementRole[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<AnnouncementStatusFilter>('')
  const [audienceFilter, setAudienceFilter] = useState<AnnouncementAudienceFilter>('')
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; title: string; subtitle: string } | null>(null)
  const publish = usePublishAnnouncement()
  const feed = useAdminAnnouncements(historyPage, search.trim(), statusFilter, audienceFilter)
  const withdraw = useWithdrawAnnouncement()
  const [withdrawTarget, setWithdrawTarget] = useState<SentAnnouncement | null>(null)
  const [preview, setPreview] = useState<{ input: PublishAnnouncementInput; recipientLabel: string } | null>(null)
  const hasRecipients = audience === 'ALL' || targetRoles.length > 0

  const resetForm = () => {
    setTitle('')
    setMessage('')
    setPublishAt('')
    setExpiresAt('')
    setAudience('ALL')
    setTargetRoles([])
    setDateError('')
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !message.trim() || !hasRecipients || publish.isPending) return
    const publication = publishAt ? new Date(publishAt).getTime() : Date.now()
    if (!Number.isFinite(publication) || (publishAt && publication <= Date.now()) ||
      (expiresAt && (!Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= publication))) {
      setDateError('Choose a future publication time and an expiry after publication.')
      return
    }
    setDateError('')
    const recipientLabel = audience === 'ALL' ? 'all users' : roles.filter((role) => targetRoles.includes(role.value)).map((role) => role.label.toLowerCase()).join(', ')
    setPreview({ input: { title: title.trim(), message: message.trim(), ...(audience === 'ROLES' ? { targetRoles: [...targetRoles] } : {}),
      ...(publishAt ? { publishAt: new Date(publishAt).toISOString() } : {}), ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) }, recipientLabel })
    setCreateOpen(false)
  }

  const confirmPublish = () => {
    if (!preview || publish.isPending) return
    publish.mutate(preview.input, {
      onSuccess: () => {
        setNotice({ kind: 'success', title: preview.input.publishAt ? 'Announcement scheduled' : 'Announcement published',
          subtitle: preview.input.publishAt ? `Your update will be sent to ${preview.recipientLabel} at the scheduled time.` : `Your update is available to ${preview.recipientLabel}.` })
        resetForm()
        setHistoryPage(0)
        setSearch('')
        setStatusFilter('')
        setAudienceFilter('')
        setPreview(null)
        void feed.refetch()
      },
    })
  }

  const reopenComposer = () => {
    if (publish.isPending) return
    setPreview(null)
    setCreateOpen(true)
  }
  const hasFilters = Boolean(search.trim() || statusFilter || audienceFilter)
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setAudienceFilter(''); setHistoryPage(0) }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Platform communication</p>
        <Heading>Announcements</Heading>
        <p>Create and manage updates for everyone or selected roles. Sent history retains published, scheduled, expired, and withdrawn announcements.</p>
      </div>
      <div className={styles.headerActions}>
        <Button kind="tertiary" renderIcon={Renew} disabled={feed.isFetching} onClick={() => void feed.refetch()}>Refresh</Button>
        <Button renderIcon={Add} onClick={() => { setNotice(null); setCreateOpen(true) }}>Create announcement</Button>
      </div>
    </header>

    {notice && <InlineNotification kind={notice.kind} title={notice.title} subtitle={notice.subtitle} onCloseButtonClick={() => setNotice(null)} />}

    <section className={styles.history} aria-labelledby="sent-announcements-heading">
      <section className={styles.filters} aria-label="Filter sent announcements">
        <TextInput id="announcement-search" labelText="Search announcements" placeholder="Search title or message" value={search}
          onChange={(event) => { setSearch(event.target.value); setHistoryPage(0) }} />
        <Select id="announcement-audience-filter" labelText="Audience" value={audienceFilter}
          onChange={(event) => { setAudienceFilter(event.target.value as AnnouncementAudienceFilter); setHistoryPage(0) }}>
          <SelectItem value="" text="All audiences" /><SelectItem value="ALL" text="All users" />
          <SelectItem value="LEARNER" text="Learners" /><SelectItem value="SCENARIO_AUTHOR" text="Scenario authors" />
          <SelectItem value="REVIEWER" text="Reviewers" /><SelectItem value="ADMINISTRATOR" text="Administrators" />
        </Select>
        <Select id="announcement-status-filter" labelText="Status" value={statusFilter}
          onChange={(event) => { setStatusFilter(event.target.value as AnnouncementStatusFilter); setHistoryPage(0) }}>
          <SelectItem value="" text="All statuses" /><SelectItem value="PUBLISHED" text="Published" />
          <SelectItem value="SCHEDULED" text="Scheduled" /><SelectItem value="EXPIRED" text="Expired" />
          <SelectItem value="WITHDRAWN" text="Withdrawn" />
        </Select>
        {hasFilters && <Button className={styles.clearFilters} kind="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>}
      </section>
      {feed.data && <p className={styles.count}>{feed.data.totalElements} matching announcement{feed.data.totalElements === 1 ? '' : 's'}</p>}
      {feed.isFetching && <InlineLoading description="Refreshing announcements" />}
      {feed.isError && <div className={styles.error}><InlineNotification kind="error" title="Sent announcements unavailable" subtitle="Try again in a moment." hideCloseButton />
        <Button kind="ghost" size="sm" onClick={() => void feed.refetch()}>Try again</Button></div>}
      {feed.data?.items.length === 0 && <div className={styles.empty}><h3>{hasFilters ? 'No matching announcements' : 'No announcements yet'}</h3><p>{hasFilters ? 'Try another search or clear your filters.' : 'Create an announcement to share an update with users.'}</p></div>}
      {feed.data?.items.length ? <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Title</th><th>Message</th><th>Audience</th><th>Status</th><th>Publication</th><th>Expires</th><th aria-label="Actions" /></tr></thead>
        <tbody>{feed.data.items.map((item) => <tr key={item.id}>
          <td className={styles.titleCell}><strong>{item.title}</strong></td>
          <td className={styles.messageCell}>{item.message}</td>
          <td>{audienceLabel(item.audience, item.targetRoles)}</td>
          <td><Tag type={item.status === 'PUBLISHED' ? 'green' : item.status === 'SCHEDULED' ? 'blue' : 'gray'}>
            {{ PUBLISHED: 'Published', WITHDRAWN: 'Withdrawn', SCHEDULED: 'Scheduled', EXPIRED: 'Expired' }[item.status]}</Tag>
            {item.withdrawnAt && <small className={styles.subtle}>Withdrawn {new Date(item.withdrawnAt).toLocaleString()}</small>}</td>
          <td><time dateTime={item.publishAt ?? item.createdAt}>{item.status === 'SCHEDULED' ? 'Publishes' : 'Published'}<small className={styles.subtle}>{new Date(item.publishAt ?? item.createdAt).toLocaleString()}</small></time></td>
          <td>{item.expiresAt ? <time dateTime={item.expiresAt}>{new Date(item.expiresAt).toLocaleString()}</time> : <span className={styles.subtle}>No expiry</span>}</td>
          <td>{item.status !== 'WITHDRAWN' && <Button kind="danger--ghost" size="sm" onClick={() => setWithdrawTarget(item)}>Withdraw</Button>}</td>
        </tr>)}</tbody>
      </table></div> : null}
      {feed.data && feed.data.totalElements > PAGE_SIZE && <Pagination page={historyPage + 1} pageSize={PAGE_SIZE} pageSizes={[PAGE_SIZE]}
        totalItems={feed.data.totalElements} onChange={({ page }) => setHistoryPage(page - 1)} />}
    </section>

    <Modal open={createOpen} modalHeading="Create announcement" primaryButtonText="Preview announcement" secondaryButtonText="Cancel"
      primaryButtonDisabled={publish.isPending || !title.trim() || !message.trim() || !hasRecipients}
      onRequestClose={() => !publish.isPending && setCreateOpen(false)}
      onRequestSubmit={() => (document.getElementById('announcement-form') as HTMLFormElement | null)?.requestSubmit()}>
      <Form id="announcement-form" onSubmit={submit} className={styles.form}>
        <p className={styles.modalIntro}>Choose who receives the announcement. You can publish now or schedule it for later.</p>
        <Select id="announcement-audience" labelText="Recipients" value={audience} disabled={publish.isPending}
          onChange={(event) => setAudience(event.target.value)}>
          <SelectItem value="ALL" text="All users" /><SelectItem value="ROLES" text="Selected roles" />
        </Select>
        {audience === 'ROLES' && <fieldset className={styles.roles}>
          <legend>Recipient roles</legend>
          {roles.map((role) => <Checkbox key={role.value} id={`announcement-role-${role.value}`} labelText={role.label}
            checked={targetRoles.includes(role.value)} disabled={publish.isPending}
            onChange={(_, { checked }) => setTargetRoles((current) => checked ? [...current, role.value] : current.filter((value) => value !== role.value))} />)}
          {!hasRecipients && <p>Select at least one role.</p>}
        </fieldset>}
        <TextInput id="announcement-title" labelText="Title" value={title} required maxLength={120} disabled={publish.isPending}
          helperText={`${title.length}/120 characters`} onChange={(event) => setTitle(event.target.value)} />
        <TextArea id="announcement-message" labelText="Message" value={message} required maxLength={4000} rows={6} disabled={publish.isPending}
          helperText={`${message.length}/4000 characters. Plain text; line breaks are preserved.`} onChange={(event) => setMessage(event.target.value)} />
        <TextInput id="announcement-publish-at" type="datetime-local" labelText="Publish at (optional)" value={publishAt}
          disabled={publish.isPending} helperText="Your local time. Leave empty to publish immediately."
          onChange={(event) => { setPublishAt(event.target.value); setDateError('') }} />
        <TextInput id="announcement-expires-at" type="datetime-local" labelText="Expires at (optional)" value={expiresAt}
          disabled={publish.isPending} helperText="Leave empty for no expiry. Expired announcements remain in sent history."
          onChange={(event) => { setExpiresAt(event.target.value); setDateError('') }} />
        {dateError && <InlineNotification kind="error" title="Check announcement dates" subtitle={dateError} hideCloseButton />}
      </Form>
    </Modal>

    {preview && <Modal open modalHeading="Preview announcement" primaryButtonText={preview.input.publishAt ? 'Confirm schedule' : 'Confirm publication'}
      secondaryButtonText="Keep editing" primaryButtonDisabled={publish.isPending} onRequestSubmit={confirmPublish} onSecondarySubmit={reopenComposer}
      onRequestClose={reopenComposer}>
      <h3>{preview.input.title}</h3>
      <p className={styles.message}>{preview.input.message}</p>
      <p>Sent to: {audienceLabel(preview.input.targetRoles ? 'ROLES' : 'ALL', preview.input.targetRoles ?? [])}</p>
      <p>Publication: {preview.input.publishAt ? new Date(preview.input.publishAt).toLocaleString() : 'Immediately'}</p>
      <p>Expiry: {preview.input.expiresAt ? new Date(preview.input.expiresAt).toLocaleString() : 'No expiry'}</p>
      {publish.isError && <InlineNotification kind="error" title="Announcement could not be published"
        subtitle={getProblemDetail(publish.error, 'Please try again. Your message has been kept.')} hideCloseButton />}
    </Modal>}

    {withdrawTarget && <Modal danger open modalHeading="Withdraw announcement?" primaryButtonText="Withdraw announcement" secondaryButtonText="Cancel"
      primaryButtonDisabled={withdraw.isPending} onRequestClose={() => !withdraw.isPending && setWithdrawTarget(null)}
      onRequestSubmit={() => { if (!withdraw.isPending) withdraw.mutate(withdrawTarget.id, { onSuccess: () => { setWithdrawTarget(null); void feed.refetch() } }) }}>
      <p className={styles.modalIntro}>Withdraw “{withdrawTarget.title}” from recipient feeds? The message and audit record will remain in sent history.</p>
      {withdraw.isError && <InlineNotification kind="error" title="Could not withdraw announcement" subtitle="Please try again." hideCloseButton />}
    </Modal>}
  </main>
}
