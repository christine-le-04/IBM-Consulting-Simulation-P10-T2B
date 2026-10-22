import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NotificationsPage from './NotificationsPage'
import {
  useAnnouncements, useMarkAllAnnouncementsRead, useReadAnnouncements, useUnreadAnnouncements,
} from '@/api/hooks/useAnnouncements'

vi.mock('@/api/hooks/useAnnouncements', () => ({
  announcementMessage: (item: { message?: string }) => item.message ?? '',
  announcementTitle: (item: { title?: string; scenarioTitle?: string | null }) => item.title ?? item.scenarioTitle ?? 'Announcement',
  useAnnouncements: vi.fn(),
  useAnnouncementUpdates: vi.fn(),
  useMarkAllAnnouncementsRead: vi.fn(),
  useReadAnnouncements: vi.fn(),
  useUnreadAnnouncements: vi.fn(),
}))

describe('Notifications page scenario actions', () => {
  beforeEach(() => {
    vi.mocked(useAnnouncements).mockReturnValue({
      data: {
        items: [
          { id: 'assigned', scenarioId: 'scenario-1', kind: 'SCENARIO_ASSIGNED', scenarioTitle: 'Assigned scenario', message: 'You have been assigned this scenario.', createdAt: '2026-10-23T00:00:00Z', read: false },
          { id: 'published', scenarioId: 'scenario-2', kind: 'SCENARIO_PUBLISHED', scenarioTitle: 'Published scenario', message: 'A scenario is now available.', createdAt: '2026-10-22T00:00:00Z', read: true },
        ],
        unreadCount: 1, totalElements: 2, page: 0, size: 10,
      }, isLoading: false, isError: false,
    } as unknown as ReturnType<typeof useAnnouncements>)
    vi.mocked(useMarkAllAnnouncementsRead).mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as unknown as ReturnType<typeof useMarkAllAnnouncementsRead>)
    vi.mocked(useReadAnnouncements).mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as unknown as ReturnType<typeof useReadAnnouncements>)
    vi.mocked(useUnreadAnnouncements).mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as unknown as ReturnType<typeof useUnreadAnnouncements>)
  })

  it('sends scenario assignment and publication notifications to the Office', () => {
    render(<MemoryRouter><NotificationsPage /></MemoryRouter>)

    const assigned = screen.getByText('Assigned scenario').closest('li')!
    const published = screen.getByText('Published scenario').closest('li')!
    expect(within(assigned).getByRole('link', { name: 'Open your Office' })).toHaveAttribute('href', '/dashboard')
    expect(within(published).getByRole('link', { name: 'Open your Office' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('link', { name: 'View scenario' })).not.toBeInTheDocument()
  })
})
