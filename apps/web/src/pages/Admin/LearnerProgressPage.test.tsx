import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAdminLearnerProgress } from '@/api/hooks/useAdminLearnerProgress'
import type { LearnerProgressEntry } from '@/api/types'
import LearnerProgressPage from './LearnerProgressPage'

vi.mock('@/api/hooks/useAdminLearnerProgress', () => ({ useAdminLearnerProgress: vi.fn() }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/components/shared/ErrorState', () => ({ default: ({ onAction }: { onAction?: () => void }) => <button onClick={onAction}>Error...</button> }))

const mockedProgress = vi.mocked(useAdminLearnerProgress)
const DAY = 24 * 60 * 60 * 1000

function entry(overrides: Partial<LearnerProgressEntry> = {}): LearnerProgressEntry {
  return {
    engagementId: 'e1',
    userId: 'u1',
    displayName: 'Ana Lee',
    email: 'ana@example.com',
    scenarioId: 's1',
    scenarioTitle: 'AeroVector Aviation',
    state: 'IN_MEETING',
    overallScore: null,
    lastActivityAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    completedAt: null,
    ...overrides,
  }
}

const learners = [
  entry(),
  entry({ engagementId: 'e2', displayName: 'Ben Ng', email: 'ben@example.com', state: 'OUTREACHING', lastActivityAt: new Date(Date.now() - 5 * DAY).toISOString() }),
  entry({ engagementId: 'e3', displayName: 'Cara Diaz', email: 'cara@example.com', scenarioId: 's2', scenarioTitle: 'Northwind Retail', state: 'COMPLETED', overallScore: 82, completedAt: new Date().toISOString() }),
]

function setup(data: LearnerProgressEntry[] | undefined, overrides: Record<string, unknown> = {}) {
  const refetch = vi.fn()
  mockedProgress.mockReturnValue({ data, dataUpdatedAt: Date.now(), isLoading: false, isError: false, isFetching: false, refetch, ...overrides } as unknown as ReturnType<typeof useAdminLearnerProgress>)
  return refetch
}

function renderPage(path = '/dashboard/admin/learners') {
  return render(<MemoryRouter initialEntries={[path]}><LearnerProgressPage /></MemoryRouter>)
}

const rowNames = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent)

describe('LearnerProgressPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the loading state', () => {
    setup(undefined, { isLoading: true })
    renderPage()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('offers a retry when loading fails', () => {
    const refetch = setup(undefined, { isError: true })
    renderPage()
    fireEvent.click(screen.getByText('Error...'))
    expect(refetch).toHaveBeenCalled()
  })

  it('explains the empty state when no learner has started', () => {
    setup([])
    renderPage()
    expect(screen.getByText('No learners have started a scenario yet')).toBeInTheDocument()
  })

  it('summarises statuses and lists the most recent activity first', () => {
    setup(learners)
    renderPage()
    expect(screen.getByRole('button', { name: /Stuck\s*1/ })).toBeInTheDocument()
    expect(screen.getByText('82/100')).toBeInTheDocument()
    expect(rowNames()[2]).toContain('Ben Ng')
  })

  it('filters to stuck learners from the summary tile', () => {
    setup(learners)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Stuck\s*1/ }))
    expect(rowNames()).toHaveLength(1)
    expect(rowNames()[0]).toContain('Ben Ng')
  })

  it('opens pre-filtered from the status query parameter', () => {
    setup(learners)
    renderPage('/dashboard/admin/learners?status=COMPLETED')
    expect(rowNames()).toHaveLength(1)
    expect(rowNames()[0]).toContain('Cara Diaz')
  })

  it('searches by name or email and can clear filters', () => {
    setup(learners)
    renderPage()
    fireEvent.change(screen.getByLabelText('Search learner'), { target: { value: 'nobody' } })
    expect(screen.getByText('No learners match these filters')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(rowNames()).toHaveLength(3)
  })

  it('filters by scenario and stage', () => {
    setup(learners)
    renderPage()
    fireEvent.change(screen.getByLabelText('Scenario'), { target: { value: 's1' } })
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'Outreach' } })
    expect(rowNames()).toEqual([expect.stringContaining('Ben Ng')])
  })
})
