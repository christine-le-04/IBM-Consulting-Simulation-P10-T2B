import { useEffect, useRef, useState } from 'react'
import { Button, HeaderGlobalAction, InlineLoading, InlineNotification, Tag } from '@carbon/react'
import { Link } from 'react-router-dom'
import { Notification } from '@carbon/icons-react'
import { announcementTitle, announcementMessage, useAnnouncements, useAnnouncementUpdates, useReadAnnouncements } from '@/api/hooks/useAnnouncements'
import styles from './AnnouncementCenter.module.css'

const PREVIEW_SIZE = 5

export default function AnnouncementCenter() {
  const [open, setOpen] = useState(false)
  const feed = useAnnouncements(0, false, PREVIEW_SIZE)
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
  return <div ref={root} className={styles.root}>
    <HeaderGlobalAction ref={trigger} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
      aria-expanded={open} aria-controls="announcement-panel" isActive={open}
      tooltipAlignment="end" onClick={() => { setOpen((value) => !value); if (!open) void feed.refetch() }}>
      <Notification size={20} />
      {unread > 0 && <span className={styles.badge} aria-hidden="true">{unread > 99 ? '99+' : unread}</span>}
    </HeaderGlobalAction>
    {open && <section id="announcement-panel" aria-label="Recent notifications" className={styles.panel} ref={panel} tabIndex={-1}>
      <div className={styles.heading}><h2>Notifications</h2><span aria-live="polite">{unread} unread</span></div>
      {feed.isLoading && <InlineLoading description="Loading notifications" />}
      {feed.isError && <InlineNotification kind="error" title="Notifications unavailable" subtitle="Try again in a moment." hideCloseButton />}
      {feed.isError && <Button kind="ghost" size="sm" onClick={() => void feed.refetch()}>Try again</Button>}
      {markRead.isError && <InlineNotification kind="error" title="Could not mark notification as read" subtitle="Please try again." hideCloseButton />}
      {feed.data?.items.length === 0 && <p className={styles.empty}>No notifications yet.</p>}
      <ul className={styles.list}>{feed.data?.items.map((item) => <li key={item.id} className={item.read ? '' : styles.unread}>
        <div className={styles.itemHeading}><strong>{item.kind === 'SCENARIO_PUBLISHED' ? 'Scenario published' : item.kind === 'SCENARIO_ARCHIVED' ? 'Scenario archived' : item.kind === 'SCENARIO_ASSIGNED' ? 'New scenario assignment' : 'From the administration team'}</strong>{!item.read && <Tag type="blue">Unread</Tag>}</div>
        <p><strong>{announcementTitle(item)}</strong></p>
        <p className={styles.message}>{announcementMessage(item)}</p>
        {item.scenarioId && (item.kind === 'SCENARIO_PUBLISHED' || item.kind === 'SCENARIO_ASSIGNED') &&
          <p><Link to={`/dashboard/scenarios/${encodeURIComponent(item.scenarioId)}`} onClick={() => setOpen(false)}>View scenario</Link></p>}
        {item.kind === 'SCENARIO_ARCHIVED' && <p><Link to="/dashboard" onClick={() => setOpen(false)}>Open your Office</Link></p>}
        <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        {!item.read && <Button kind="ghost" size="sm" disabled={markRead.isPending} onClick={() => markRead.mutate([item.id])}
          aria-label={`Mark ${announcementTitle(item)} as read`}>Mark as read</Button>}
      </li>)}</ul>
      <Link className={styles.allLink} to="/dashboard/notifications" onClick={() => setOpen(false)}>See all notifications</Link>
    </section>}
  </div>
}
