import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useAnnouncements, useReadAnnouncements, useAnnouncementUpdates, useMarkAllAnnouncementsRead, type AnnouncementFeed } from '@/api/hooks/useAnnouncements'
import AnnouncementCenter from './AnnouncementCenter'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/api/hooks/useAnnouncements', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/api/hooks/useAnnouncements')>(),
  useAnnouncements: vi.fn(), useReadAnnouncements: vi.fn(), useAnnouncementUpdates: vi.fn(), useMarkAllAnnouncementsRead: vi.fn(),
}))
const mutate = vi.fn()
const refetch = vi.fn()
const markAll = vi.fn()
const data: AnnouncementFeed = {
  items: [{ id: 'published', scenarioId: 'scenario-1', kind: 'SCENARIO_PUBLISHED', scenarioTitle: '<script>test</script>', createdAt: '2026-10-15T00:00:00Z', read: false },
    { id: 'archived', scenarioId: 'scenario-2', kind: 'SCENARIO_ARCHIVED', scenarioTitle: 'Retired scenario', createdAt: '2026-10-14T00:00:00Z', read: true }],
  readThrough: '2026-10-16T00:00:00Z', totalElements: 21, unreadCount: 3, page: 0, size: 20,
}
function setup(overrides = {}) {
  vi.mocked(useMarkAllAnnouncementsRead).mockReturnValue({ mutate: markAll, isPending: false, isError: false } as unknown as ReturnType<typeof useMarkAllAnnouncementsRead>)
  vi.mocked(useAnnouncements).mockReturnValue({ data, isLoading: false, isError: false, isFetching: false, refetch, ...overrides } as unknown as ReturnType<typeof useAnnouncements>)
  vi.mocked(useReadAnnouncements).mockReturnValue({ mutate, isPending: false, isError: false } as unknown as ReturnType<typeof useReadAnnouncements>)
}
function open() { fireEvent.click(screen.getByRole('button', { name: 'Announcements, 3 unread' })) }

describe('AnnouncementCenter', () => {
  beforeEach(() => { vi.clearAllMocks(); setup() })

  it('filters unread announcements, marks the complete snapshot and links to scenarios', () => {
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    expect(screen.getByRole('link', { name: 'View scenario' })).toHaveAttribute('href', '/dashboard/scenarios/scenario-1')
    expect(screen.getByRole('link', { name: 'Open your Office' })).toHaveAttribute('href', '/dashboard')
    fireEvent.click(screen.getByRole('button', { name: 'Mark all as read' }))
    expect(markAll).toHaveBeenCalledWith(data.readThrough)
    fireEvent.change(screen.getByLabelText('Show announcements'), { target: { value: 'unread' } })
    expect(useAnnouncements).toHaveBeenLastCalledWith(0, true)
  })

  it('shows saved announcements and unread count with escaped titles', () => {
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    expect(screen.queryByRole('region', { name: 'Announcements' })).not.toBeInTheDocument()
    open()
    expect(screen.getByRole('region', { name: 'Announcements' })).toHaveFocus()
    expect(screen.getByText('Scenario published')).toBeInTheDocument()
    expect(screen.getByText('Scenario archived')).toBeInTheDocument()
    expect(screen.getByText('<script>test</script>')).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    expect(useAnnouncementUpdates).toHaveBeenCalled()
    expect(refetch).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    open()
    expect(screen.queryByRole('region', { name: 'Announcements' })).not.toBeInTheDocument()
  })

  it('shows custom administrator titles and messages as plain text', () => {
    setup({ data: { ...data, items: [{ ...data.items[0], kind: 'ADMIN_MESSAGE', scenarioId: null, scenarioTitle: null,
      title: 'Maintenance', message: 'Tonight\n<script>test</script>' }] } })
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    expect(screen.getByText('From the administration team')).toBeInTheDocument()
    expect(screen.getByText('Maintenance')).toBeInTheDocument()
    expect(screen.getByText(/<script>test<\/script>/)).toBeInTheDocument()
    expect(document.querySelector('script')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mark Maintenance as read' }))
    expect(mutate).toHaveBeenLastCalledWith(['published'])
  })

  it('marks only displayed unread items and supports individual reads', () => {
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Mark this page as read' }))
    expect(mutate).toHaveBeenLastCalledWith(['published'])
    fireEvent.click(screen.getByRole('button', { name: 'Mark <script>test</script> as read' }))
    expect(mutate).toHaveBeenLastCalledWith(['published'])
  })

  it('labels personal scenario assignments and supports marking them as read', () => {
    setup({ data: { ...data, items: [{ ...data.items[0], kind: 'SCENARIO_ASSIGNED', scenarioTitle: 'Assigned scenario',
      message: 'You have been assigned this scenario.' }] } })
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    expect(screen.getByText('New scenario assignment')).toBeInTheDocument()
    expect(screen.getByText('You have been assigned this scenario.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Mark Assigned scenario as read' }))
    expect(mutate).toHaveBeenLastCalledWith(['published'])
  })

  it('paginates history and closes with Escape, returning focus to the bell', () => {
    render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    open()
    fireEvent.click(screen.getByRole('button', { name: 'Older' }))
    expect(useAnnouncements).toHaveBeenLastCalledWith(1, false)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('region', { name: 'Announcements' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Announcements, 3 unread' })).toHaveFocus()
  })

  it('supports empty history and recoverable feed errors', () => {
    setup({ data: { ...data, items: [], unreadCount: 0, totalElements: 0 } })
    const view = render(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'Announcements' }))
    expect(screen.getByText('No announcements yet.')).toBeInTheDocument()
    setup({ data: undefined, isError: true })
    view.rerender(<MemoryRouter><AnnouncementCenter /></MemoryRouter>)
    expect(screen.getByText('Announcements unavailable')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(refetch).toHaveBeenCalled()
  })
})
