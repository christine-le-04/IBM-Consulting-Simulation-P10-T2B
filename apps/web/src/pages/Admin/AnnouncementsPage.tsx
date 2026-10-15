import { FormEvent, useState } from 'react'
import { Button, Checkbox, Form, Heading, InlineLoading, InlineNotification, Select, SelectItem, TextArea, TextInput } from '@carbon/react'
import { Send } from '@carbon/icons-react'
import { announcementMessage, announcementTitle, useAnnouncements, usePublishAnnouncement, type AnnouncementRole } from '@/api/hooks/useAnnouncements'
import { getProblemDetail } from '@/api/problemDetails'
import styles from './AnnouncementsPage.module.css'

const roles: { value: AnnouncementRole; label: string }[] = [
  { value: 'LEARNER', label: 'Learners' }, { value: 'SCENARIO_AUTHOR', label: 'Scenario authors' },
  { value: 'REVIEWER', label: 'Reviewers' }, { value: 'ADMINISTRATOR', label: 'Administrators' },
]

export default function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [published, setPublished] = useState(false)
  const [audience, setAudience] = useState('ALL')
  const [targetRoles, setTargetRoles] = useState<AnnouncementRole[]>([])
  const [publishedAudience, setPublishedAudience] = useState('')
  const hasRecipients = audience === 'ALL' || targetRoles.length > 0
  const publish = usePublishAnnouncement()
  const feed = useAnnouncements(0)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !message.trim() || !hasRecipients || publish.isPending) return
    setPublished(false)
    const recipientLabel = audience === 'ALL' ? 'all users' : roles.filter((role) => targetRoles.includes(role.value)).map((role) => role.label.toLowerCase()).join(', ')
    publish.mutate({ title: title.trim(), message: message.trim(), ...(audience === 'ROLES' ? { targetRoles } : {}) }, {
      onSuccess: () => { setTitle(''); setMessage(''); setPublishedAudience(recipientLabel); setPublished(true) },
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
        <p>Choose who should receive this update. It will be published immediately and remain available when recipients next sign in. Role targeting follows each account's current role.</p>
        {published && <InlineNotification kind="success" title="Announcement published" subtitle={`Your update is available to ${publishedAudience} in their announcement bell.`} hideCloseButton />}
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
          <Button type="submit" renderIcon={Send} disabled={!title.trim() || !message.trim() || !hasRecipients || publish.isPending}>
            {publish.isPending ? 'Publishing…' : audience === 'ALL' ? 'Publish to all users' : 'Publish to selected roles'}
          </Button>
        </Form>
      </section>
      <section className={styles.history} aria-labelledby="recent-announcements">
        <h2 id="recent-announcements">Recent announcements</h2>
        <p>Latest updates visible to your role, including automatic scenario announcements. Updates sent only to other roles will not appear here.</p>
        {feed.isLoading && <InlineLoading description="Loading announcements" />}
        {feed.isError && <><InlineNotification kind="error" title="Recent announcements unavailable" subtitle="You can still compose an announcement." hideCloseButton />
          <Button kind="ghost" size="sm" onClick={() => void feed.refetch()}>Try again</Button></>}
        {feed.data?.items.length === 0 && <p>No announcements yet.</p>}
        <ul className={styles.list}>{feed.data?.items.map((item) => <li key={item.id}>
          <h3>{announcementTitle(item)}</h3>
          <p className={styles.message}>{announcementMessage(item)}</p>
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        </li>)}</ul>
      </section>
    </div>
  </main>
}
