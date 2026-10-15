import { FormEvent, useState } from 'react'
import { Button, Form, Heading, InlineLoading, InlineNotification, TextArea, TextInput } from '@carbon/react'
import { Send } from '@carbon/icons-react'
import { announcementMessage, announcementTitle, useAnnouncements, usePublishAnnouncement } from '@/api/hooks/useAnnouncements'
import { getProblemDetail } from '@/api/problemDetails'
import styles from './AnnouncementsPage.module.css'

export default function AnnouncementsPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [published, setPublished] = useState(false)
  const publish = usePublishAnnouncement()
  const feed = useAnnouncements(0)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !message.trim() || publish.isPending) return
    setPublished(false)
    publish.mutate({ title: title.trim(), message: message.trim() }, {
      onSuccess: () => { setTitle(''); setMessage(''); setPublished(true) },
    })
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <p className={styles.eyebrow}>Platform communication</p>
      <Heading>Announcements</Heading>
      <p>Publish updates to everyone through their announcement bell.</p>
    </header>
    <div className={styles.layout}>
      <section className={styles.compose} aria-labelledby="compose-heading">
        <h2 id="compose-heading">New announcement</h2>
        <p>This will be published immediately to all users, including other administrators. It remains available when users next sign in.</p>
        {published && <InlineNotification kind="success" title="Announcement published" subtitle="Your update is available to all users in their announcement bell." hideCloseButton />}
        {publish.isError && <InlineNotification kind="error" title="Announcement could not be published"
          subtitle={getProblemDetail(publish.error, 'Please try again. Your message has been kept.')} hideCloseButton />}
        <Form onSubmit={submit} className={styles.form}>
          <TextInput id="announcement-title" labelText="Title" value={title} required maxLength={120} disabled={publish.isPending}
            helperText={`${title.length}/120 characters`} onChange={(event) => { setTitle(event.target.value); setPublished(false) }} />
          <TextArea id="announcement-message" labelText="Message" value={message} required maxLength={4000} rows={8} disabled={publish.isPending}
            helperText={`${message.length}/4000 characters. Plain text; line breaks are preserved.`}
            onChange={(event) => { setMessage(event.target.value); setPublished(false) }} />
          <Button type="submit" renderIcon={Send} disabled={!title.trim() || !message.trim() || publish.isPending}>
            {publish.isPending ? 'Publishing…' : 'Publish to all users'}
          </Button>
        </Form>
      </section>
      <section className={styles.history} aria-labelledby="recent-announcements">
        <h2 id="recent-announcements">Recent announcements</h2>
        <p>Latest published updates, including automatic scenario announcements.</p>
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
