import { useState } from 'react'
import { Button, InlineLoading, InlineNotification, Tag } from '@carbon/react'
import { Link } from 'react-router-dom'
import { announcementMessage, announcementTitle, useAnnouncements, useAnnouncementUpdates, useMarkAllAnnouncementsRead, useReadAnnouncements, useUnreadAnnouncements } from '@/api/hooks/useAnnouncements'
import styles from './NotificationsPage.module.css'

const PAGE_SIZE = 10

export default function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(0)
  const feed = useAnnouncements(page, unreadOnly, PAGE_SIZE)
  const markAll = useMarkAllAnnouncementsRead()
  const markRead = useReadAnnouncements()
  const markUnread = useUnreadAnnouncements()
  useAnnouncementUpdates()

  const unread = feed.data?.unreadCount ?? 0
  const pageUnreadIds = feed.data?.items.filter((item) => !item.read).map((item) => item.id) ?? []
  const setFilter = (nextUnreadOnly: boolean) => { setUnreadOnly(nextUnreadOnly); setPage(0) }
  const notificationType = (kind: string) => kind === 'ADMIN_MESSAGE' ? 'Announcement' : 'System'

  return <main className={styles.page}>
    <header className={styles.header}>
      <div>
        <p className={styles.eyebrow}>Your updates</p>
        <h1>Notifications</h1>
        <p className={styles.summary} aria-live="polite">{unread} unread notification{unread === 1 ? '' : 's'}</p>
      </div>
      {unread > 0 && <Button kind="tertiary" disabled={markAll.isPending || !feed.data?.readThrough}
        onClick={() => { if (feed.data?.readThrough) markAll.mutate(feed.data.readThrough) }}>Mark all as read</Button>}
    </header>

    <div className={styles.toolbar}>
      <div className={styles.tabs} role="tablist" aria-label="Filter notifications">
        <Button className={!unreadOnly ? styles.activeTab : styles.tab} kind="ghost" role="tab" aria-selected={!unreadOnly} size="sm" onClick={() => setFilter(false)}>All</Button>
        <Button className={unreadOnly ? styles.activeTab : styles.tab} kind="ghost" role="tab" aria-selected={unreadOnly} size="sm" onClick={() => setFilter(true)}>Unread{unread > 0 ? ` (${unread})` : ''}</Button>
      </div>
      {pageUnreadIds.length > 0 && <Button kind="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(pageUnreadIds)}>Mark this page as read</Button>}
    </div>

    {markAll.isError && <InlineNotification kind="error" title="Could not mark notifications as read" subtitle="Please try again." hideCloseButton />}
    {(markRead.isError || markUnread.isError) && <InlineNotification kind="error" title="Could not update notification status" subtitle="Please try again." hideCloseButton />}
    {feed.isLoading && <div className={styles.loading}><InlineLoading description="Loading notifications" /></div>}
    {feed.isError && <div className={styles.error}><InlineNotification kind="error" title="Notifications unavailable" subtitle="Try again in a moment." hideCloseButton /><Button kind="ghost" onClick={() => void feed.refetch()}>Try again</Button></div>}

    {!feed.isLoading && !feed.isError && feed.data?.items.length === 0 && <section className={styles.empty}>
      <h2>{unreadOnly ? "You're all caught up" : 'No notifications yet'}</h2>
      <p>{unreadOnly ? 'Unread notifications will appear here.' : 'Updates about announcements and scenario activity will appear here.'}</p>
    </section>}

    <ul className={styles.list}>{feed.data?.items.map((item) => <li key={item.id} className={`${styles.item} ${item.read ? '' : styles.unread}`}>
      <div className={styles.itemContent}>
        <div className={styles.itemHeader}>
          <Tag type={item.kind === 'ADMIN_MESSAGE' ? 'purple' : 'cool-gray'}>{notificationType(item.kind)}</Tag>
          <time dateTime={item.createdAt}>{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time>
        </div>
        <h2 className={styles.itemTitle}>{announcementTitle(item)}</h2>
        <p className={styles.message}>{announcementMessage(item)}</p>
        <div className={styles.actions}>
          {item.scenarioId && (item.kind === 'SCENARIO_PUBLISHED' || item.kind === 'SCENARIO_ASSIGNED') &&
            <Link to="/dashboard">Open your Office</Link>}
          {item.kind === 'SCENARIO_ARCHIVED' && <Link to="/dashboard">Open your Office</Link>}
          <Button kind="ghost" size="sm" disabled={markRead.isPending || markUnread.isPending}
            onClick={() => item.read ? markUnread.mutate([item.id]) : markRead.mutate([item.id])}
            aria-label={`Mark ${announcementTitle(item)} as ${item.read ? 'unread' : 'read'}`}>
            Mark as {item.read ? 'unread' : 'read'}
          </Button>
        </div>
      </div>
    </li>)}</ul>

    {feed.data && feed.data.totalElements > 0 && <nav className={styles.pagination} aria-label="Notifications pages">
      <Button kind="tertiary" size="sm" disabled={page === 0 || feed.isFetching} onClick={() => setPage((value) => value - 1)}>Newer</Button>
      <span>Page {page + 1} of {Math.max(1, Math.ceil(feed.data.totalElements / feed.data.size))}</span>
      <Button kind="tertiary" size="sm" disabled={(page + 1) * feed.data.size >= feed.data.totalElements || feed.isFetching} onClick={() => setPage((value) => value + 1)}>Older</Button>
    </nav>}
  </main>
}
