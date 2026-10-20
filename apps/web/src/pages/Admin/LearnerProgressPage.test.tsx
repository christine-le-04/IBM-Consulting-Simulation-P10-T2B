import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAdminLearnerProgress, type LearnerProgressPage as ProgressPage } from '@/api/hooks/useAdminLearnerProgress'
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

function setup(items: LearnerProgressEntry[] | undefined, overrides: Record<string, unknown> = {}, pageOverrides: Partial<ProgressPage> = {}) {
  const refetch = vi.fn()
  const data: ProgressPage | undefined = items && {
    items, totalElements: items.length, page: 0, size: 25, totalPages: items.length ? 1 : 0,
    asOf: new Date().toISOString(),
    summary: { inProgress: 1, stuck: 1, completed: 1, meetingFailed: 0, averageScore: 82, totalRuns: items.length },
    scenarios: [{ id: 's1', title: 'AeroVector Aviation' }, { id: 's2', title: 'Northwind Retail' }],
    ...pageOverrides,
  }
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

  it('renders the server summary and preserves server row order', () => {
    setup(learners)
    renderPage()
    expect(screen.getByRole('button', { name: /Stuck\s*1/ })).toBeInTheDocument()
    expect(screen.getByText('82/100')).toBeInTheDocument()
    expect(rowNames()[1]).toContain('Ben Ng')
  })

  it('filters to stuck learners from the summary tile', () => {
    setup(learners)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: /Stuck\s*1/ }))
    expect(mockedProgress).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'STUCK', page: 0 }))
  })

  it('opens pre-filtered from the status query parameter', () => {
    setup(learners)
    renderPage('/dashboard/admin/learners?status=COMPLETED')
    expect(mockedProgress).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'COMPLETED' }))
  })

  it('searches by name or email and can clear filters', () => {
    setup(learners)
    renderPage()
    fireEvent.change(screen.getByLabelText('Search learner'), { target: { value: 'nobody' } })
    expect(mockedProgress).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'nobody', page: 0 }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(mockedProgress).toHaveBeenLastCalledWith(expect.objectContaining({ search: undefined, status: undefined, page: 0 }))
  })

  it('links each learner to their run page', () => {
    setup(learners)
    renderPage()
    expect(screen.getByRole('link', { name: 'Ben Ng' })).toHaveAttribute('href', '/dashboard/admin/learners/e2')
  })

  it('filters by scenario and stage', () => {
    setup(learners)
    renderPage()
    fireEvent.change(screen.getByLabelText('Scenario'), { target: { value: 's1' } })
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'Outreach' } })
    expect(mockedProgress).toHaveBeenLastCalledWith(expect.objectContaining({ scenarioId: 's1', stage: 'Outreach', page: 0 }))
  })

  it('keeps filters and global metadata when the server returns no matches', () => {
    setup([], {}, { summary: { inProgress: 1, stuck: 1, completed: 1, meetingFailed: 0, averageScore: 82, totalRuns: 3 } })
    renderPage('/dashboard/admin/learners?status=MEETING_FAILED')
    expect(screen.getByText('No learners match these filters')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('MEETING_FAILED')
    expect(screen.getByRole('option', { name: 'Northwind Retail' })).toBeInTheDocument()
    expect(screen.getByText('82/100')).toBeInTheDocument()
  })

  it('requests another server page and resets paging when filters change', () => {
    setup([learners[0]], {}, { totalElements: 76, totalPages: 4 })
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    expect(mockedProgress).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, size: 25 }))
    fireEvent.change(screen.getByLabelText('Stage'), { target: { value: 'Outreach' } })
    expect(mockedProgress).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0, stage: 'Outreach' }))
  })
})
