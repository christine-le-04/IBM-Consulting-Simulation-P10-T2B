import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render as renderRaw, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { ReactElement } from 'react'
import { usePortfolioSummary, useReplayComparison } from '@/api/hooks/usePortfolio'
import { useMyAchievements } from '@/api/hooks/useAchievements'
import { useAuthStore } from '@/store/authStore'
import PortfolioPage from './PortfolioPage'
import type { CompetencyTrend } from '@/api/types'
import userEvent from '@testing-library/user-event'

// The page links to each engagement's review, so it renders inside a router.
const render = (ui: ReactElement) => renderRaw(<MemoryRouter>{ui}</MemoryRouter>)

// mock hocks and share compoents for tests
vi.mock('@/api/hooks/usePortfolio', () => ({
  usePortfolioSummary: vi.fn(),
  useReplayComparison: vi.fn(() => ({
    data: undefined,
    isFetching: false,
  })),
}))
vi.mock('@/api/hooks/useAchievements', () => ({ useMyAchievements: vi.fn()}))
vi.mock('@/store/authStore', () => ({ useAuthStore: vi.fn() }))
vi.mock('@/lifecycle/components/PageHeader', () => ({ default: () => <div>Page Header</div> }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))

// typed mock references
const mockedUsePortfolioSummary = vi.mocked(usePortfolioSummary)
const mockedUseReplayComparison = vi.mocked(useReplayComparison)
const mockedUseMyAchievements = vi.mocked(useMyAchievements)
const mockedUseAuthStore = vi.mocked(useAuthStore)

// creates a competency trend object for tests
function makeTrend( competencyName: string, points: CompetencyTrend['points']): CompetencyTrend {
  return { competencyName, points }
}

const basePortfolio = {
  totalEngagements: 3,
  completedEngagements: 2,
  contractsWon: 2,
  contractsLost: 1,
  averageOverallScore: 75,
  completedEngagementsHistory: [],
  competencyTrends: [],
}

// helper function to set up the mocked portfolio data for tests
function setupPortfolio(trends: CompetencyTrend[], completedEngagements = 2) {
  mockedUsePortfolioSummary.mockReturnValue({
    data: {
      ...basePortfolio,
      completedEngagements,
      competencyTrends: trends,
    },
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof usePortfolioSummary>)

  mockedUseReplayComparison.mockReturnValue({
    data: undefined,
    isFetching: false,
  } as unknown as ReturnType<typeof useReplayComparison>)

  mockedUseMyAchievements.mockReturnValue({
    data: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useMyAchievements>)

  mockedUseAuthStore.mockReturnValue({
    displayName: 'Test User',
  } as unknown as ReturnType<typeof useAuthStore>)
}

// get the competency progression section from the rendered page
function getCompetencySection() {
  return screen
    .getByRole('heading', { name: 'Competency Progression' })
    .closest('section') as HTMLElement
}

// get all trend scores from the competency progression section
function getTrendScores() {
  const section = getCompetencySection()

  return within(section)
    .getAllByText(/^\d+$/)
    .filter((element) =>
      element.className.toString().includes('_trendScore_'),
    )
    .map((element) => Number(element.textContent))
}

describe('PortfolioPage competency progression', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('competency progression shows most recent engagement by default', () => {
    setupPortfolio([
      makeTrend('Communication', [
      {
        engagementId: 'engagement-1',
        generatedAt: '2026-08-01T10:00:00Z',
        score: 60,
      },
      {
        engagementId: 'engagement-2',
        generatedAt: '2026-08-10T10:00:00Z',
        score: 75,
      },
      {
        engagementId: 'engagement-3',
        generatedAt: '2026-08-15T10:00:00Z',
        score: 85,
      },
      ]),
    ])

    render(<PortfolioPage />)

    const section = getCompetencySection()

    expect(screen.getByText('Competency Progression')).toBeInTheDocument()
    expect(within(section).getByText('85')).toBeInTheDocument()
    expect(within(section).getByText('+25 since first engagement')).toBeInTheDocument()
    expect(within(section).queryByText(/since first attempt/)).not.toBeInTheDocument()
    expect(within(section).queryByText('60')).not.toBeInTheDocument()
    expect(within(section).queryByText('75')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View history' })).toBeInTheDocument()
  })

  it('competency progression shows all engagements when View history is clicked', () => {
    setupPortfolio([
      makeTrend('Communication', [
        {
          engagementId: 'engagement-1',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 60,
        },
        {
          engagementId: 'engagement-2',
          generatedAt: '2026-08-10T10:00:00Z',
          score: 75,
        },
        {
          engagementId: 'engagement-3',
          generatedAt: '2026-08-15T10:00:00Z',
          score: 85,
        },
      ]),
    ])

    render(<PortfolioPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View history' }))

    const section = getCompetencySection()

    expect(within(section).getByText('60')).toBeInTheDocument()
    expect(within(section).getByText('75')).toBeInTheDocument()
    expect(within(section).getByText('85')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide history' })).toBeInTheDocument()
  })

  it('history should be hidden when Hide history is clicked', () => {
    setupPortfolio([
      makeTrend('Communication', [
        {
          engagementId: 'engagement-1',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 60,
        },
        {
          engagementId: 'engagement-2',
          generatedAt: '2026-08-10T10:00:00Z',
          score: 75,
        },
        {
          engagementId: 'engagement-3',
          generatedAt: '2026-08-15T10:00:00Z',
          score: 85,
        },
      ]),
    ])

    render(<PortfolioPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View history' }))
    fireEvent.click(screen.getByRole('button', { name: 'Hide history' }),)

    const section = getCompetencySection()

    expect(within(section).getByText('85')).toBeInTheDocument()
    expect(within(section).queryByText('60')).not.toBeInTheDocument()
    expect(within(section).queryByText('75')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View history' })).toBeInTheDocument()
  })

  it('history toggle applies to all competency cards', () => {
    setupPortfolio([
      makeTrend('Communication', [
        {
          engagementId: 'communication-1',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 60,
        },
        {
          engagementId: 'communication-2',
          generatedAt: '2026-08-15T10:00:00Z',
          score: 80,
        },
      ]),
      makeTrend('Negotiation', [
        {
          engagementId: 'negotiation-1',
          generatedAt: '2026-08-02T10:00:00Z',
          score: 65,
        },
        {
          engagementId: 'negotiation-2',
          generatedAt: '2026-08-15T11:00:00Z',
          score: 90,
        },
      ]),
      makeTrend('Commercial', [
        {
          engagementId: 'commercial-1',
          generatedAt: '2026-08-03T10:00:00Z',
          score: 55,
        },
        {
          engagementId: 'commercial-2',
          generatedAt: '2026-08-15T12:00:00Z',
          score: 70,
        },
      ]),
      makeTrend('Discovery', [
        {
          engagementId: 'discovery-1',
          generatedAt: '2026-08-04T10:00:00Z',
          score: 50,
        },
        {
          engagementId: 'discovery-2',
          generatedAt: '2026-08-15T13:00:00Z',
          score: 85,
        },
      ]),
    ])

    render(<PortfolioPage />)

    const section = getCompetencySection()

    // by default, the latest scores are shown for each competency
    expect(within(section).getByText('80')).toBeInTheDocument()
    expect(within(section).getByText('90')).toBeInTheDocument()
    expect(within(section).getByText('70')).toBeInTheDocument()
    expect(within(section).getByText('85')).toBeInTheDocument()

    expect(within(section).queryByText('60')).not.toBeInTheDocument()
    expect(within(section).queryByText('65')).not.toBeInTheDocument()
    expect(within(section).queryByText('55')).not.toBeInTheDocument()
    expect(within(section).queryByText('50')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'View history' }))

    // after clicking "View history", all scores for each competency should be shown
    expect(within(section).getByText('60')).toBeInTheDocument()
    expect(within(section).getByText('80')).toBeInTheDocument()
    expect(within(section).getByText('65')).toBeInTheDocument()
    expect(within(section).getByText('90')).toBeInTheDocument()
    expect(within(section).getByText('55')).toBeInTheDocument()
    expect(within(section).getByText('70')).toBeInTheDocument()
    expect(within(section).getByText('50')).toBeInTheDocument()
    expect(within(section).getByText('85')).toBeInTheDocument()
  })

  it('utilises generatedAt to calculate the latest engagement', () => {
    setupPortfolio([
      makeTrend('Communication', [
        {
          engagementId: 'engagement-latest',
          generatedAt: '2026-08-15T10:00:00Z',
          score: 90,
        },
        {
          engagementId: 'engagement-old',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 60,
        },
        {
          engagementId: 'engagement-middle',
          generatedAt: '2026-08-10T10:00:00Z',
          score: 75,
        },
      ]),
    ])

    render(<PortfolioPage />)

    const section = getCompetencySection()

    // shows the latest engagement
    expect(within(section).getByText('90')).toBeInTheDocument()
    expect(within(section).queryByText('60')).not.toBeInTheDocument()
    expect(within(section).queryByText('75')).not.toBeInTheDocument()
  })

  it('displays competency history in chronological order', () => {
    setupPortfolio([
      makeTrend('Communication', [
        {
          engagementId: 'engagement-3',
          generatedAt: '2026-08-15T10:00:00Z',
          score: 90,
        },
        {
          engagementId: 'engagement-1',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 60,
        },
        {
          engagementId: 'engagement-2',
          generatedAt: '2026-08-10T10:00:00Z',
          score: 75,
        },
      ]),
    ])

    render(<PortfolioPage />)

    fireEvent.click(screen.getByRole('button', { name: 'View history' }))
    const scores = getTrendScores()
    expect(scores).toEqual([60, 75, 90])
  })

  it('renders multiple competency series in the progression graph', () => {
    setupPortfolio([
      makeTrend('Communication', [
        {
          engagementId: 'engagement-1',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 60,
        },
        {
          engagementId: 'engagement-2',
          generatedAt: '2026-08-10T10:00:00Z',
          score: 80,
        },
      ]),
      makeTrend('Negotiation', [
        {
          engagementId: 'engagement-1',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 70,
        },
        {
          engagementId: 'engagement-2',
          generatedAt: '2026-08-10T10:00:00Z',
          score: 85,
        },
      ]),
    ])

    render(<PortfolioPage />)

    expect(screen.getByText('Progress Across Engagements')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Communication' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Negotiation' })).toBeInTheDocument()
  })

  it('does not render the progression graph when there is no competency data', () => {
    setupPortfolio([])
    render(<PortfolioPage />)
    expect(screen.queryByText('Progress Across Engagements')).not.toBeInTheDocument()
  })

  it('renders a history toggle only when a competency has multiple engagements', () => {
    setupPortfolio([
      makeTrend('Negotiation', [
        {
          engagementId: 'engagement-1',
          generatedAt: '2026-08-01T10:00:00Z',
          score: 80,
        },
        {
          engagementId: 'engagement-2',
          generatedAt: '2026-08-10T10:00:00Z',
          score: 85,
        },
      ]),
    ])

    render(<PortfolioPage />)
    expect(screen.getByRole('button', { name: 'View history' })).toBeInTheDocument()
  })

  // for competency trend graph
  it('renders graph empty state when user has completed less than 2 engagements', () => {
    setupPortfolio([
      makeTrend('Communication', [{ engagementId: 'engagement-1', generatedAt: '2026-08-01T10:00:00Z', score: 70, },]),
    ],
    1,
    )
 
    render(<PortfolioPage />)
 
    expect(screen.getByText('Competency Progression')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Progress Across Engagements' })).toBeInTheDocument()
    expect(screen.getByText('Track your competency across your completed engagements. Complete at least 2 engagements to see your progress.'),).toBeInTheDocument()
 
    // graph elements and history toggle should not be rendered
    expect(screen.queryByRole('checkbox', { name: 'Communication' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'View history' })).not.toBeInTheDocument()
  })
 
  it('render graph when there is data for two engagements, regardless of missing competency score(s)', () => {
    setupPortfolio([
      makeTrend('Communication', [
        { engagementId: 'engagement-1', generatedAt: '2026-08-01T10:00:00Z', score: 60 },
        { engagementId: 'engagement-2', generatedAt: '2026-08-10T10:00:00Z', score: 80 },
      ]),
      makeTrend('Negotiation', [
        { engagementId: 'engagement-1', generatedAt: '2026-08-01T10:00:00Z', score: 70 },
      ]),
    ])
 
    render(<PortfolioPage />)
 
    expect(screen.getByText('Progress Across Engagements')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Communication' })).toBeInTheDocument()
    expect(screen.queryByText('Track your competency across your completed engagements. Complete at least 2 engagements to see your progress.'),).not.toBeInTheDocument()
  })
})
describe('PortfolioPage replay comparison', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn()
  })
  const comparison = {
    engagementA: { engagementId: 'a', scenarioTitle: 'Scenario A', personaName: 'Client A',
      outcome: 'REVISION_REQUESTED', overallScore: 60, competencyScores: [
        { competencyName: 'Discovery', score: 40, evidenceNote: null },
        { competencyName: 'Communication', score: 80, evidenceNote: null },
        { competencyName: 'Commercial', score: 0, evidenceNote: null },
      ] },
    engagementB: { engagementId: 'b', scenarioTitle: 'Scenario B', personaName: 'Client B',
      outcome: 'PILOT_APPROVED', overallScore: 80, competencyScores: [
        { competencyName: 'Commercial', score: 0, evidenceNote: null },
        { competencyName: 'Discovery', score: 70, evidenceNote: null },
        { competencyName: 'Communication', score: 65, evidenceNote: null },
        { competencyName: 'Negotiation', score: 75, evidenceNote: null },
      ] },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    setupPortfolio([])
    const query = mockedUsePortfolioSummary()
    mockedUsePortfolioSummary.mockReturnValue({ ...query, data: { ...basePortfolio,
      completedEngagementsHistory: ['a', 'b', 'c'].map((id) => ({
        engagementId: id, scenarioId: 'scenario', scenarioTitle: `Scenario ${id.toUpperCase()}`,
        industry: 'Healthcare', outcome: 'PILOT_APPROVED', overallScore: 80,
        completedAt: '2026-10-01T10:00:00Z',
      })),
    } } as ReturnType<typeof usePortfolioSummary>)
    mockedUseReplayComparison.mockReturnValue({ data: comparison, isFetching: false, isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useReplayComparison>)
  })

  async function select(label: string, scenario: string) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: label }))
    await user.click(screen.getByRole('option', { name: `${scenario} — 80/100 · 01/10/2026` }))
  }

  it('matches competencies by name and shows positive, negative, zero and unavailable differences', async () => {
    render(<PortfolioPage />)
    await select('Engagement A', 'Scenario A')
    await select('Engagement B', 'Scenario B')

    const table = screen.getByRole('table', { name: 'Score changes from Engagement A to Engagement B' })
    expect(within(table).getByRole('row', { name: /Overall score/ })).toHaveTextContent('+20 points')
    expect(within(table).getByRole('row', { name: /Discovery/ })).toHaveTextContent('+30 points')
    expect(within(table).getByRole('row', { name: /Communication/ })).toHaveTextContent('-15 points')
    expect(within(table).getByRole('row', { name: /Commercial/ })).toHaveTextContent('0 points')
    expect(within(table).getByRole('row', { name: /Negotiation/ })).toHaveTextContent('Not assessed75Not comparable')
    expect(screen.getByText('revision requested')).toBeInTheDocument()
    expect(screen.getByText('pilot approved')).toBeInTheDocument()
    expect(screen.getAllByText('01/10/2026')).toHaveLength(5)
    expect(screen.getAllByRole('link', { name: 'Open review' })).toHaveLength(2)
  })

  it('explains why selecting the same engagement cannot produce a comparison', async () => {
    render(<PortfolioPage />)
    await select('Engagement A', 'Scenario A')
    await select('Engagement B', 'Scenario A')

    expect(screen.getByText('Select two different engagements to compare.')).toHaveAttribute('role', 'alert')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows recorded difficulty and gives context for comparing different tiers', async () => {
    mockedUseReplayComparison.mockReturnValue({ data: {
      engagementA: { ...comparison.engagementA, difficulty: 'EASY' },
      engagementB: { ...comparison.engagementB, difficulty: 'HARD' },
    }, isFetching: false, isError: false } as unknown as ReturnType<typeof useReplayComparison>)
    render(<PortfolioPage />)
    await select('Engagement A', 'Scenario A')
    await select('Engagement B', 'Scenario B')

    expect(screen.getByText('Easy')).toBeInTheDocument()
    expect(screen.getByText('Hard')).toBeInTheDocument()
    expect(screen.getByText(/These engagements used different difficulty levels/)).toBeInTheDocument()
  })

  it('offers retry when comparison fails and does not show old results', async () => {
    const retry = vi.fn()
    mockedUseReplayComparison.mockReturnValue({ data: comparison, isFetching: false, isError: true,
      refetch: retry,
    } as unknown as ReturnType<typeof useReplayComparison>)
    render(<PortfolioPage />)
    await select('Engagement A', 'Scenario A')
    await select('Engagement B', 'Scenario B')

    expect(screen.getByText('Comparison could not be loaded')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(retry).toHaveBeenCalledOnce()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('hides a previous comparison when the selected pair changes', async () => {
    render(<PortfolioPage />)
    await select('Engagement A', 'Scenario A')
    await select('Engagement B', 'Scenario B')
    expect(screen.getByRole('table')).toBeInTheDocument()

    await select('Engagement B', 'Scenario C')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows loading instead of old scores while a comparison refreshes', async () => {
    mockedUseReplayComparison.mockReturnValue({ data: comparison, isFetching: true, isError: false,
    } as unknown as ReturnType<typeof useReplayComparison>)
    render(<PortfolioPage />)
    await select('Engagement A', 'Scenario A')
    await select('Engagement B', 'Scenario B')

    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('PortfolioPage history browsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Element.prototype.scrollIntoView = vi.fn()
    setupPortfolio([])
    const query = mockedUsePortfolioSummary()
    mockedUsePortfolioSummary.mockReturnValue({ ...query, data: { ...basePortfolio,
      totalEngagements: 8, completedEngagements: 8,
      completedEngagementsHistory: Array.from({ length: 8 }, (_, index) => ({
        engagementId: `run-${index + 1}`, scenarioId: 'scenario', scenarioTitle: `Client ${index + 1}`,
        industry: index < 4 ? 'Retail' : 'Healthcare', difficulty: index % 2 === 0 ? null : 'HARD',
        outcome: index === 0 ? 'ASSESSMENT_PENDING' : index === 1 ? 'REJECTED' : 'PILOT_APPROVED',
        overallScore: index === 0 ? null : 80, completedAt: '2026-10-01T10:00:00Z',
      })),
    } } as ReturnType<typeof usePortfolioSummary>)
  })

  function historySection() {
    return screen.getByRole('region', { name: 'Completed engagement history' })
  }

  async function filter(name: string, option: string) {
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name }))
    await user.click(screen.getByRole('option', { name: option }))
  }

  it('paginates newest-first history and resets the page when searching', async () => {
    render(<PortfolioPage />)
    expect(within(historySection()).getAllByRole('link')).toHaveLength(6)
    expect(within(historySection()).queryByRole('link', { name: 'Open the review of Client 1' })).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next page' }))
    expect(within(historySection()).getAllByRole('link')).toHaveLength(2)

    await userEvent.setup().type(screen.getByLabelText('Search completed engagements'), '  CLIENT 8 ')
    expect(within(historySection()).getAllByRole('link')).toHaveLength(1)
    expect(within(historySection()).getByRole('link', { name: 'Open the review of Client 8' })).toBeInTheDocument()
  })

  it('combines industry search, difficulty and outcome filters and can clear them', async () => {
    render(<PortfolioPage />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Search completed engagements'), 'retail')
    await filter('Difficulty', 'Hard')
    await filter('Outcome', 'Rejected')

    expect(within(historySection()).getAllByRole('link')).toHaveLength(1)
    expect(within(historySection()).getByRole('link', { name: 'Open the review of Client 2' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear history filters' }))
    expect(within(historySection()).getAllByRole('link')).toHaveLength(6)
    expect(screen.getByLabelText('Search completed engagements')).toHaveValue('')
  })

  it('filters unavailable difficulty and pending assessments without changing portfolio totals or comparisons', async () => {
    render(<PortfolioPage />)
    await filter('Difficulty', 'Difficulty unavailable')
    await filter('Outcome', 'Assessment pending')

    expect(within(historySection()).getAllByRole('link')).toHaveLength(1)
    expect(within(historySection()).getByRole('link', { name: 'Open the review of Client 1' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Completed engagements (8 of 8)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Replay comparison' })).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox', { name: 'Engagement A' }))
    expect(screen.getByRole('option', { name: 'Client 8 — 80/100 · 01/10/2026' })).toBeInTheDocument()
  })

  it('shows a recoverable empty result rather than the first-engagement empty state', async () => {
    render(<PortfolioPage />)
    await userEvent.setup().type(screen.getByLabelText('Search completed engagements'), 'no matching client')

    expect(within(historySection()).getByRole('status')).toHaveTextContent('No completed engagements match these filters.')
    expect(within(historySection()).queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByText(/Complete your first engagement/)).not.toBeInTheDocument()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Clear history filters' }))
    expect(within(historySection()).getAllByRole('link')).toHaveLength(6)
  })

  it('returns to the first page when the page size increases', async () => {
    render(<PortfolioPage />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next page' }))
    fireEvent.change(screen.getByRole('combobox', { name: /Items per page/ }), { target: { value: '12' } })

    expect(within(historySection()).getAllByRole('link')).toHaveLength(8)
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled()
  })
})

describe('PortfolioPage completed engagements', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a recorded zero average and counts failed meetings separately from active work', () => {
    setupPortfolio([])
    const query = mockedUsePortfolioSummary()
    mockedUsePortfolioSummary.mockReturnValue({ ...query, data: {
      ...basePortfolio, averageOverallScore: 0, inProgressEngagements: 0, failedEngagements: 1,
    } } as ReturnType<typeof usePortfolioSummary>)
    render(<PortfolioPage />)

    const totals = screen.getByRole('region', { name: 'Totals' })
    expect(within(totals).getByText('Average score').parentElement).toHaveTextContent('Average score0')
    expect(within(totals).getByText('0 still in progress')).toBeInTheDocument()
    expect(within(totals).getByText('1 ended after a failed meeting')).toBeInTheDocument()
  })

  it('shows an unavailable average separately from a recorded zero', () => {
    setupPortfolio([])
    const query = mockedUsePortfolioSummary()
    mockedUsePortfolioSummary.mockReturnValue({ ...query, data: { ...basePortfolio, averageOverallScore: null } } as ReturnType<typeof usePortfolioSummary>)
    render(<PortfolioPage />)

    expect(screen.getByText('Average score').parentElement).toHaveTextContent('Average score—')
  })

  it('shows pending assessments without a placeholder score or a replay comparison', () => {
    setupPortfolio([])
    const query = mockedUsePortfolioSummary()
    mockedUsePortfolioSummary.mockReturnValue({ ...query, data: { ...basePortfolio,
      completedEngagementsHistory: ['pending', 'scored'].map((id) => ({
        engagementId: id, scenarioId: 'scenario', scenarioTitle: id, industry: 'Healthcare',
        outcome: id === 'pending' ? 'ASSESSMENT_PENDING' : 'REJECTED',
        overallScore: id === 'pending' ? null : 0, completedAt: '2026-10-07T10:00:00Z',
      })),
    } } as ReturnType<typeof usePortfolioSummary>)
    render(<PortfolioPage />)

    const pending = screen.getByRole('link', { name: 'Open the review of pending' })
    expect(within(pending).getByText('Assessment pending')).toBeInTheDocument()
    expect(within(pending).queryByText(/\/100/)).not.toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: 'Open the review of scored' })).getByText('0/100')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Replay comparison' })).not.toBeInTheDocument()
  })

  it('opens the review of a completed engagement', () => {
    setupPortfolio([])
    mockedUsePortfolioSummary.mockReturnValue({
      data: {
        ...basePortfolio,
        completedEngagementsHistory: [{
          engagementId: 'eng-7',
          scenarioId: 'scn-7',
          scenarioTitle: 'MediCare Digital Transformation',
          industry: 'Healthcare',
          difficulty: 'MEDIUM',
          outcome: 'PROPOSAL_ACCEPTED',
          overallScore: 82,
          completedAt: '2026-09-28T10:00:00Z',
        }],
      },
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof usePortfolioSummary>)

    render(<PortfolioPage />)

    expect(screen.getByRole('link', { name: 'Open the review of MediCare Digital Transformation' }))
      .toHaveAttribute('href', '/dashboard/engagements/eng-7/assessment')
    expect(screen.getByText('Medium')).toBeInTheDocument()
  })
})
