import { useEffect, useRef, useState } from 'react'
import { Button, HeaderGlobalAction, InlineLoading, InlineNotification } from '@carbon/react'
import { Link } from 'react-router-dom'
import { Notification } from '@carbon/icons-react'
import { announcementTitle, announcementMessage, useAnnouncements, useAnnouncementUpdates } from '@/api/hooks/useAnnouncements'
import styles from './AnnouncementCenter.module.css'

const PREVIEW_SIZE = 5
const relativeTime = (value: string) => {
  const elapsedSeconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000)
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 60) return 'Just now'
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60],
  ]
  const [unit, seconds] = units.find(([, duration]) => elapsedSeconds >= duration) ?? units[units.length - 1]
  const label = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(-Math.floor(elapsedSeconds / seconds), unit)
  return label.charAt(0).toLocaleUpperCase() + label.slice(1)
}

export default function AnnouncementCenter() {
  const [open, setOpen] = useState(false)
  const feed = useAnnouncements(0, false, PREVIEW_SIZE)
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
      {feed.data?.items.length === 0 && <p className={styles.empty}>No notifications yet.</p>}
      <ul className={styles.list}>{feed.data?.items.map((item) => <li key={item.id} className={item.read ? '' : styles.unread}>
        <div className={styles.itemTop}>
          <span className={styles.typeLabel}>{item.kind === 'ADMIN_MESSAGE' ? 'Announcement' : 'System'}</span>
          <time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time>
        </div>
        <p className={styles.title}>{announcementTitle(item)}</p>
        <p className={styles.message}>{announcementMessage(item)}</p>
      </li>)}</ul>
      <Link className={styles.allLink} to="/dashboard/notifications" onClick={() => setOpen(false)}>See all notifications</Link>
    </section>}
  </div>
}
