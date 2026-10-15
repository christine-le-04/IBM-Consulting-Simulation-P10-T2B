import { FormEvent, useState } from 'react'
import { Button, Checkbox, Form, Heading, InlineLoading, InlineNotification, Modal, Pagination, Select, SelectItem, Tag, TextArea, TextInput } from '@carbon/react'
import { Send } from '@carbon/icons-react'
import { usePublishAnnouncement, type AnnouncementRole } from '@/api/hooks/useAnnouncements'
import { audienceLabel, recipientRoles as roles, useAdminAnnouncements, useWithdrawAnnouncement, type SentAnnouncement } from '@/api/hooks/useAdminAnnouncements'
import { getProblemDetail } from '@/api/problemDetails'
import styles from './AnnouncementsPage.module.css'

export default function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [publishAt, setPublishAt] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [dateError, setDateError] = useState('')
  const [wasScheduled, setWasScheduled] = useState(false)
  const [published, setPublished] = useState(false)
  const [audience, setAudience] = useState('ALL')
  const [targetRoles, setTargetRoles] = useState<AnnouncementRole[]>([])
  const [publishedAudience, setPublishedAudience] = useState('')
  const hasRecipients = audience === 'ALL' || targetRoles.length > 0
  const publish = usePublishAnnouncement()
  const [historyPage, setHistoryPage] = useState(0)
  const feed = useAdminAnnouncements(historyPage)
  const withdraw = useWithdrawAnnouncement()
  const [withdrawTarget, setWithdrawTarget] = useState<SentAnnouncement | null>(null)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !message.trim() || !hasRecipients || publish.isPending) return
    const publication = publishAt ? new Date(publishAt).getTime() : Date.now()
    if (!Number.isFinite(publication) || (publishAt && publication <= Date.now()) ||
      (expiresAt && (!Number.isFinite(new Date(expiresAt).getTime()) || new Date(expiresAt).getTime() <= publication))) {
      setDateError('Choose a future publication time and an expiry after publication.'); return
    }
    setDateError('')
    setPublished(false)
    const recipientLabel = audience === 'ALL' ? 'all users' : roles.filter((role) => targetRoles.includes(role.value)).map((role) => role.label.toLowerCase()).join(', ')
    publish.mutate({ title: title.trim(), message: message.trim(), ...(audience === 'ROLES' ? { targetRoles } : {}),
      ...(publishAt ? { publishAt: new Date(publishAt).toISOString() } : {}), ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}) }, {
      onSuccess: () => { setWasScheduled(Boolean(publishAt)); setPublishAt(''); setExpiresAt(''); setTitle(''); setMessage(''); setPublishedAudience(recipientLabel); setPublished(true); setHistoryPage(0) },
    })
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Platform communication</p>
      <Heading>Announcements</Heading>
      <p>Publish updates to everyone or selected roles through their announcement bell.</p>
    </header>
    <div className={styles.layout}>
      <section className={styles.compose} aria-labelledby="compose-heading">
        <h2 id="compose-heading">New announcement</h2>
        <p>Choose recipients and optionally schedule publication or expiry. Role targeting follows each account's current role.</p>
        {published && <InlineNotification kind="success" title={wasScheduled ? 'Announcement scheduled' : 'Announcement published'} subtitle={wasScheduled ? `Your update will appear for ${publishedAudience} at the scheduled time.` : `Your update is available to ${publishedAudience} in their announcement bell.`} hideCloseButton />}
        {dateError && <InlineNotification kind="error" title="Check announcement dates" subtitle={dateError} hideCloseButton />}
        {publish.isError && <InlineNotification kind="error" title="Announcement could not be published"
          subtitle={getProblemDetail(publish.error, 'Please try again. Your message has been kept.')} hideCloseButton />}
        <Form onSubmit={submit} className={styles.form}>
          <Select id="announcement-audience" labelText="Recipients" value={audience} disabled={publish.isPending}
            onChange={(event) => { setAudience(event.target.value); setPublished(false) }}>
            <SelectItem value="ALL" text="All users" />
            <SelectItem value="ROLES" text="Selected roles" />
          </Select>
          {audience === 'ROLES' && <fieldset className={styles.roles}>
            <legend>Recipient roles</legend>
            {roles.map((role) => <Checkbox key={role.value} id={`announcement-role-${role.value}`} labelText={role.label}
              checked={targetRoles.includes(role.value)} disabled={publish.isPending}
              onChange={(_, { checked }) => { setTargetRoles((current) => checked ? [...current, role.value] : current.filter((value) => value !== role.value)); setPublished(false) }} />)}
            {!hasRecipients && <p>Select at least one role.</p>}
          </fieldset>}
          <TextInput id="announcement-title" labelText="Title" value={title} required maxLength={120} disabled={publish.isPending}
            helperText={`${title.length}/120 characters`} onChange={(event) => { setTitle(event.target.value); setPublished(false) }} />
          <TextArea id="announcement-message" labelText="Message" value={message} required maxLength={4000} rows={8} disabled={publish.isPending}
            helperText={`${message.length}/4000 characters. Plain text; line breaks are preserved.`}
            onChange={(event) => { setMessage(event.target.value); setPublished(false) }} />
          <TextInput id="announcement-publish-at" type="datetime-local" labelText="Publish at (optional)" value={publishAt}
            disabled={publish.isPending} helperText="Your local time. Leave empty to publish immediately."
            onChange={(event) => { setPublishAt(event.target.value); setDateError(''); setPublished(false) }} />
          <TextInput id="announcement-expires-at" type="datetime-local" labelText="Expires at (optional)" value={expiresAt}
            disabled={publish.isPending} helperText="Your local time. Leave empty to keep the announcement available."
            onChange={(event) => { setExpiresAt(event.target.value); setDateError(''); setPublished(false) }} />
          <Button type="submit" renderIcon={Send} disabled={!title.trim() || !message.trim() || !hasRecipients || publish.isPending}>
            {publish.isPending ? 'Publishing…' : audience === 'ALL' ? 'Publish to all users' : 'Publish to selected roles'}
          </Button>
        </Form>
      </section>
      <section className={styles.history} aria-labelledby="recent-announcements">
        <h2 id="recent-announcements">Sent announcements</h2>
        <p>All administrator-published updates, including messages sent only to other roles. Withdrawing a notice removes it from recipient feeds and preserves its audit history.</p>
        {feed.isLoading && <InlineLoading description="Loading announcements" />}
        {feed.isError && <><InlineNotification kind="error" title="Recent announcements unavailable" subtitle="You can still compose an announcement." hideCloseButton />
          <Button kind="ghost" size="sm" onClick={() => void feed.refetch()}>Try again</Button></>}
        {feed.data?.items.length === 0 && <p>No announcements yet.</p>}
        <ul className={styles.list}>{feed.data?.items.map((item) => <li key={item.id}>
          <h3>{item.title}</h3>
          <Tag type={item.status === 'PUBLISHED' ? 'green' : item.status === 'SCHEDULED' ? 'blue' : 'gray'}>
            {{ PUBLISHED: 'Published', WITHDRAWN: 'Withdrawn', SCHEDULED: 'Scheduled', EXPIRED: 'Expired' }[item.status]}</Tag>
          <p>Sent to: {audienceLabel(item.audience, item.targetRoles)}</p>
          <p className={styles.message}>{item.message}</p>
          <time dateTime={item.publishAt ?? item.createdAt}>{item.status === 'SCHEDULED' ? 'Publishes' : 'Publication'}: {new Date(item.publishAt ?? item.createdAt).toLocaleString()}</time>
          {item.expiresAt && <p>Expires: {new Date(item.expiresAt).toLocaleString()}</p>}
          {item.withdrawnAt && <p>Withdrawn: {new Date(item.withdrawnAt).toLocaleString()}</p>}
          {item.status !== 'WITHDRAWN' && <Button kind="danger--ghost" size="sm" onClick={() => setWithdrawTarget(item)}>Withdraw</Button>}
        </li>)}</ul>
        {feed.data && feed.data.totalElements > 20 && <Pagination page={historyPage + 1} pageSize={20} pageSizes={[20]}
          totalItems={feed.data.totalElements} onChange={({ page }) => setHistoryPage(page - 1)} />}
      </section>
    </div>
    {withdrawTarget && <Modal open modalHeading="Withdraw announcement?" primaryButtonText="Withdraw announcement" secondaryButtonText="Cancel"
      danger primaryButtonDisabled={withdraw.isPending} onRequestClose={() => { if (!withdraw.isPending) setWithdrawTarget(null) }}
      onRequestSubmit={() => { if (!withdraw.isPending) withdraw.mutate(withdrawTarget.id, { onSuccess: () => setWithdrawTarget(null) }) }}>
      <p>Withdraw “{withdrawTarget.title}” from recipient feeds? The message and audit record will remain in sent history.</p>
      {withdraw.isError && <InlineNotification kind="error" title="Could not withdraw announcement" subtitle="Please try again." hideCloseButton />}
    </Modal>}
  </main>
}
