import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useAdminCohortAnalytics } from '@/api/hooks/useAdminLearnerProgress'
import type { CohortAnalytics, CohortAnalyticsResponse } from '@/api/types'
import CohortAnalyticsPage from './CohortAnalyticsPage'

vi.mock('@/api/hooks/useAdminLearnerProgress', () => ({ useAdminCohortAnalytics: vi.fn() }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/components/shared/ErrorState', () => ({ default: ({ onAction }: { onAction?: () => void }) => <button onClick={onAction}>Error...</button> }))

const mockedAnalytics = vi.mocked(useAdminCohortAnalytics)

function cohort(overrides: Partial<CohortAnalytics> = {}): CohortAnalytics {
  return {
    scenarioId: null,
    scenarioTitle: 'All scenarios',
    learnerCount: 3,
    runCount: 4,
    completedCount: 2,
    meetingFailedCount: 1,
    averageScore: 76,
    stateCounts: { COMPLETED: 2, MEETING_FAILED: 1, OUTREACHING: 1 },
    competencies: [
      { name: 'Solution Alignment', averageScore: 63, belowTargetCount: 2, assessedCount: 2 },
      { name: 'Research & Discovery', averageScore: 85, belowTargetCount: 0, assessedCount: 2 },
    ],
    commonImprovementAreas: [{ text: 'Probe budget earlier', runCount: 2 }],
    ...overrides,
  }
}

const data: CohortAnalyticsResponse = {
  targetScore: 70,
  overall: cohort(),
  scenarios: [
    cohort({ scenarioId: 's1', scenarioTitle: 'AeroVector Aviation', runCount: 3 }),
    cohort({ scenarioId: 's2', scenarioTitle: 'Northwind Retail', learnerCount: 1, runCount: 1, completedCount: 0, meetingFailedCount: 0, averageScore: null, stateCounts: { OUTREACHING: 1 }, competencies: [], commonImprovementAreas: [] }),
  ],
}

function setup(value: CohortAnalyticsResponse | undefined, overrides: Record<string, unknown> = {}) {
  const refetch = vi.fn()
  mockedAnalytics.mockReturnValue({ data: value, isLoading: false, isError: false, isFetching: false, refetch, ...overrides } as unknown as ReturnType<typeof useAdminCohortAnalytics>)
  return refetch
}

const renderPage = () => render(<MemoryRouter><CohortAnalyticsPage /></MemoryRouter>)
const tile = (label: string) => within(screen.getByRole('region', { name: 'Cohort summary' })).getByText(label).parentElement as HTMLElement

describe('CohortAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.scrollTo = vi.fn()
  })

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

  it('explains the empty state when nobody has started', () => {
    setup({ targetScore: 70, overall: cohort({ runCount: 0, learnerCount: 0, completedCount: 0, stateCounts: {}, competencies: [], commonImprovementAreas: [] }), scenarios: [] })
    renderPage()
    expect(screen.getByText('No learner runs to analyse yet')).toBeInTheDocument()
  })

  it('summarises the whole cohort with weakest competency first', () => {
    setup(data)
    renderPage()
    expect(within(tile('Completion rate')).getByText('50%')).toBeInTheDocument()
    expect(within(tile('Average score')).getByText('76/100')).toBeInTheDocument()
    const rows = within(screen.getByText('Competency').closest('table') as HTMLElement).getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Solution Alignment')
    expect(rows[0]).toHaveTextContent('Needs work')
    expect(rows[1]).toHaveTextContent('On target')
    expect(screen.getByText('Probe budget earlier')).toBeInTheDocument()
  })

  it('counts runs per stage', () => {
    setup(data)
    renderPage()
    const stages = within(screen.getByRole('list', { name: 'Runs by current stage' })).getAllByRole('listitem')
    expect(stages.map((item) => item.textContent)).toEqual(['Research0', 'Outreach1', 'Preparation0', 'Meeting1', 'Proposal0', 'Review2'])
  })

  it('switches to one scenario from the picker or the comparison table', () => {
    setup(data)
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Northwind Retail' }))
    expect(within(tile('Completion rate')).getByText('0%')).toBeInTheDocument()
    expect(within(tile('Completion rate')).getByText('0 of 1 run completed')).toBeInTheDocument()
    expect(screen.getByText(/Competency averages appear once/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Cohort'), { target: { value: 'all' } })
    expect(within(tile('Completion rate')).getByText('50%')).toBeInTheDocument()
  })
})
