import { useEffect, useRef, useState } from 'react'
import { Button, HeaderGlobalAction, InlineLoading, InlineNotification, Tag } from '@carbon/react'
import { Notification } from '@carbon/icons-react'
import { announcementTitle, announcementMessage, useAnnouncements, useAnnouncementUpdates, useReadAnnouncements } from '@/api/hooks/useAnnouncements'
import styles from './AnnouncementCenter.module.css'

export default function AnnouncementCenter() {
  const [open, setOpen] = useState(false)
  const [page, setPage] = useState(0)
  const feed = useAnnouncements(page)
  const markRead = useReadAnnouncements()
  useAnnouncementUpdates()
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus() }
    }
    const onClick = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onClick)
    }
  }, [open])
  const unread = feed.data?.unreadCount ?? 0
  const unreadIds = feed.data?.items.filter((item) => !item.read).map((item) => item.id) ?? []
  return <div ref={root} className={styles.root}>
    <HeaderGlobalAction ref={trigger} aria-label={`Announcements${unread ? `, ${unread} unread` : ''}`}
      aria-expanded={open} aria-controls="announcement-panel" isActive={open}
      tooltipAlignment="end" onClick={() => { setOpen((value) => !value); if (!open) { setPage(0); void feed.refetch() } }}>
      <Notification size={20} />
      {unread > 0 && <span className={styles.badge} aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </HeaderGlobalAction>
    {open && <section id="announcement-panel" aria-label="Announcements" className={styles.panel} ref={panel} tabIndex={-1}>
      <div className={styles.heading}><h2>Announcements</h2></div>
      <p aria-live="polite">{unread} unread</p>
      {feed.isLoading && <InlineLoading description="Loading announcements" />}
      {feed.isError && <InlineNotification kind="error" title="Announcements unavailable" subtitle="Try again in a moment." hideCloseButton />}
      {feed.isError && <Button kind="ghost" size="sm" onClick={() => void feed.refetch()}>Try again</Button>}
      {markRead.isError && <InlineNotification kind="error" title="Could not mark announcements as read" subtitle="Please try again." hideCloseButton />}
      {unreadIds.length > 0 && <Button kind="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate(unreadIds)}>Mark this page as read</Button>}
      {feed.data?.items.length === 0 && <p>No announcements yet.</p>}
      <ul className={styles.list}>{feed.data?.items.map((item) => <li key={item.id} className={item.read ? '' : styles.unread}>
        <div><strong>{item.kind === 'SCENARIO_PUBLISHED' ? 'Scenario published' : item.kind === 'SCENARIO_ARCHIVED' ? 'Scenario archived' : 'From the administration team'}</strong>{!item.read && <Tag type="blue">Unread</Tag>}</div>
        <p><strong>{announcementTitle(item)}</strong></p>
        <p className={styles.message}>{announcementMessage(item)}</p>
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        {!item.read && <Button kind="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate([item.id])}
          aria-label={`Mark ${announcementTitle(item)} as read`}>Mark as read</Button>}
      </li>)}</ul>
      {feed.data && feed.data.totalElements > feed.data.size && <div className={styles.paging}>
        <Button kind="ghost" size="sm" disabled={page === 0 || feed.isFetching} onClick={() => setPage((value) => value - 1)}>Newer</Button>
        <span>Page {page + 1}</span>
        <Button kind="ghost" size="sm" disabled={(page + 1) * feed.data.size >= feed.data.totalElements || feed.isFetching} onClick={() => setPage((value) => value + 1)}>Older</Button>
      </div>}
    </section>}
  </div>
}
