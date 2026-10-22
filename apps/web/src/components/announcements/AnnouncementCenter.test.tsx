import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useAnnouncements, useAnnouncementUpdates, type AnnouncementFeed } from '@/api/hooks/useAnnouncements'
import AnnouncementCenter from './AnnouncementCenter'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/api/hooks/useAnnouncements', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/hooks/useAnnouncements')>(),
  useAnnouncements: vi.fn(), useAnnouncementUpdates: vi.fn(),
}))
const refetch = vi.fn()
const data: AnnouncementFeed = {
  items: [{ id: 'published', scenarioId: 'scenario-1', kind: 'SCENARIO_PUBLISHED', scenarioTitle: '<script>test</script>', createdAt: '2026-10-15T00:00:00Z', read: false },
    { id: 'archived', scenarioId: 'scenario-2', kind: 'SCENARIO_ARCHIVED', scenarioTitle: 'Retired scenario', createdAt: '2026-10-14T00:00:00Z', read: true }],
  readThrough: '2026-10-16T00:00:00Z', totalElements: 21, unreadCount: 3, page: 0, size: 5,
}
function setup(overrides = {}) {
  vi.mocked(useAnnouncements).mockReturnValue({ data, isLoading: false, isError: false, isFetching: false, refetch, ...overrides } as unknown as ReturnType<typeof useAnnouncements>)
}
function open() { fireEvent.click(screen.getByRole('button', { name: 'Notifications, 3 unread' })) }

describe('AnnouncementCenter', () => {
  beforeEach(() => { vi.clearAllMocks(); setup() })

  it('shows a compact recent preview with a link to the full notifications page', () => {
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    expect(screen.getByRole('link', { name: 'See all notifications' })).toHaveAttribute('href', '/dashboard/notifications')
    expect(screen.getAllByText('System')).toHaveLength(2)
    expect(screen.getAllByRole('time').every((time) => /^[A-Z]/.test(time.textContent ?? ''))).toBe(true)
    expect(screen.getByText(/<script>test<\/script>/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Show announcements')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'View scenario' })).not.toBeInTheDocument()
    expect(useAnnouncements).toHaveBeenLastCalledWith(0, false, 5)
  })

  it('shows saved notifications and the unread count with escaped titles', () => {
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    expect(screen.queryByRole('region', { name: 'Recent notifications' })).not.toBeInTheDocument()
    open()
    expect(screen.getByRole('region', { name: 'Recent notifications' })).toHaveFocus()
    expect(screen.getByText('<script>test</script>')).toBeInTheDocument()
    expect(screen.getByText('Retired scenario')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    expect(useAnnouncementUpdates).toHaveBeenCalled()
    expect(refetch).toHaveBeenCalled()
    open()
    expect(screen.queryByRole('region', { name: 'Recent notifications' })).not.toBeInTheDocument()
  })

  it('shows administrator announcements with a concise type label and plain text', () => {
    setup({ data: { ...data, items: [{ ...data.items[0], kind: 'ADMIN_MESSAGE', scenarioId: null, scenarioTitle: null,
      title: 'Maintenance', message: 'Tonight\n<script>test</script>' }] } })
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    expect(screen.getByText('Announcement')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText(/<script>test<\/script>/)).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    expect(screen.queryByText('From the administration team')).not.toBeInTheDocument()
  })

  it('labels scenario assignments as system notifications', () => {
    setup({ data: { ...data, items: [{ ...data.items[0], kind: 'SCENARIO_ASSIGNED', scenarioTitle: 'Assigned scenario',
      message: 'You have been assigned this scenario.' }] } })
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    expect(screen.getByText('System')).toBeInTheDocument()
    expect(screen.getByText('Assigned scenario')).toBeInTheDocument()
    expect(screen.getByText('You have been assigned this scenario.')).toBeInTheDocument()
  })

  it('closes with Escape and returns focus to the notification bell', () => {
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Recent notifications' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toHaveFocus()
  })

  it('supports empty history and recoverable feed errors', () => {
    setup({ data: { ...data, items: [], unreadCount: 0, totalElements: 0 } })
    const view = render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('No notifications yet.')).toBeInTheDocument()
    setup({ data: undefined, isError: true })
    view.rerender(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    expect(screen.getByText('Notifications unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })
})
