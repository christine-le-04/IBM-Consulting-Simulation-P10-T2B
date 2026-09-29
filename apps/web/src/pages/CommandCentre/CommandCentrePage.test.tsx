import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CommandCentrePage from './CommandCentrePage'
import { useMyEngagements, useStartEngagement } from '@/api/hooks/useEngagements'
import { useScenarioCatalog, useScenarioCatalogIndustries } from '@/api/hooks/useScenarios'
import { usePortfolioSummary } from '@/api/hooks/usePortfolio'
import type { Engagement, ScenarioCatalogPage, ScenarioSummary } from '@/api/types'

// mock hooks and shared components for tests
vi.mock('@/api/hooks/useEngagements', () => ({
  useMyEngagements: vi.fn(),
  useStartEngagement: vi.fn(),
}))
vi.mock('@/api/hooks/useScenarios', () => ({
  useScenarioCatalog: vi.fn(),
  useScenarioCatalogIndustries: vi.fn(),
}))
vi.mock('@/api/hooks/usePortfolio', () => ({
  usePortfolioSummary: vi.fn(),
}))
vi.mock('@/components/shared/ObjectiveTourProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/shared/LoadingState', () => ({
  default: () => <div>Loading...</div>,
}))
vi.mock('@/store/authStore', () => ({
  useAuthStore: () => ({ displayName: 'Viet' }),
}))

// typed mock references
const mockedMyEngagements = vi.mocked(useMyEngagements)
const mockedStartEngagement = vi.mocked(useStartEngagement)
const mockedScenarioCatalog = vi.mocked(useScenarioCatalog)
const mockedCatalogIndustries = vi.mocked(useScenarioCatalogIndustries)
const mockedPortfolio = vi.mocked(usePortfolioSummary)

// mock scrollIntoView for the tests
beforeEach(() => {
  vi.clearAllMocks()
  Element.prototype.scrollIntoView = vi.fn()
})

// creates an engagement object for tests with optional overrides
function makeEngagement(overrides: Partial<Engagement>): Engagement {
  return {
    id: 'eng-1',
    userId: 'user-1',
    scenarioId: 'scenario-1',
    personaId: 'persona-1',
    state: 'CLIENT_INTELLIGENCE',
    selectedLeadId: 'lead-1',
    createdAt: '2026-08-01T10:00:00Z',
    completedAt: null,
    events: [],
    scenarioTitle: 'Claims Modernisation',
    scenarioIndustry: 'Insurance',
    leadCompanyName: 'Acme Insurance',
    phase: 'CLIENT_INTELLIGENCE',
    phaseLabel: 'Research the client',
    progressPercent: 40,
    nextAction: 'Gather more evidence',
    evidenceCount: 2,
    daysElapsed: 1,
    meetingId: null,
    ...overrides,
  } as Engagement
}

// creates an empty scenario catalogue for tests where catalogue data is not needed
const emptyCatalogue: ScenarioCatalogPage = {
  items: [],
  page: 0,
  size: 8,
  totalElements: 0,
  totalPages: 1,
} as unknown as ScenarioCatalogPage

// sets up mocked api data used
function setup(engagements: Engagement[]) {
  mockedMyEngagements.mockReturnValue({
    data: engagements,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useMyEngagements>)

  mockedStartEngagement.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useStartEngagement>)

  mockedScenarioCatalog.mockReturnValue({
    data: emptyCatalogue,
    isLoading: false,
    isFetching: false,
    isError: false,
  } as unknown as ReturnType<typeof useScenarioCatalog>)

  mockedCatalogIndustries.mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof useScenarioCatalogIndustries>)

  mockedPortfolio.mockReturnValue({
    data: {
      totalEngagements: 3,
      completedEngagements: 3,
      contractsWon: 2,
      contractsLost: 1,
      completedEngagementsHistory: [],
    },
    isLoading: false,
  } as unknown as ReturnType<typeof usePortfolioSummary>)
}

// renders the command centre inside a router for tests that use navigation
function renderPage() {
  return render(
    <MemoryRouter>
      <CommandCentrePage />
    </MemoryRouter>,
  )
}

function scenario(overrides: Partial<ScenarioSummary> = {}): ScenarioSummary {
  return {
    id: 'scn-1',
    title: 'Hospital admissions',
    industry: 'Healthcare',
    difficulty: 3,
    description: 'Duplicate data entry across wards.',
    personas: [],
    briefing: {
      consultantRole: 'Consultant',
      simulatedDays: 30,
      objective: 'Find the real problem',
      successCriteria: [],
      businessSituation: 'Situation',
      observableSymptom: 'Symptom',
      consultingMandate: 'Mandate',
      unknownsToValidate: [],
    },
    difficultyProfile: { informationAmbiguity: 3, stakeholderComplexity: 3, commercialPressure: 3 },
    ...overrides,
  } as unknown as ScenarioSummary
}

function withCatalogue(items: ScenarioSummary[]) {
  mockedScenarioCatalog.mockReturnValue({
    data: { ...emptyCatalogue, items, totalElements: items.length },
    isLoading: false,
    isFetching: false,
    isError: false,
  } as unknown as ReturnType<typeof useScenarioCatalog>)
}

describe('Office: engagements on the floor', () => {
  it('puts the most recent engagement on the floor with a way to continue it', () => {
    setup([
      makeEngagement({ id: 'eng-old', createdAt: '2026-07-01T10:00:00Z', leadCompanyName: 'Older Client' }),
      makeEngagement({ id: 'eng-new', createdAt: '2026-08-05T10:00:00Z', leadCompanyName: 'Newest Client', nextAction: 'Build evidence' }),
    ])
    renderPage()

    expect(screen.getByRole('heading', { level: 2, name: 'Newest Client' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
    // The other engagement moves to the side list.
    expect(screen.getByText('Older Client')).toBeInTheDocument()
  })

  it('lists a failed meeting with its status so it can be retried', () => {
    setup([
      makeEngagement({ id: 'eng-live', createdAt: '2026-08-05T10:00:00Z', leadCompanyName: 'Live Client' }),
      makeEngagement({ id: 'eng-failed', state: 'MEETING_FAILED', phase: 'LIVE_MEETING', meetingId: 'm-1', leadCompanyName: 'Failed Client' }),
    ])
    renderPage()

    expect(screen.getByText('Failed Client')).toBeInTheDocument()
    expect(screen.getByText('Meeting failed')).toBeInTheDocument()
  })

  it('has the mentor say what is open, in words', () => {
    setup([makeEngagement({ leadCompanyName: 'Acme Insurance', nextAction: 'Gather more evidence' })])
    renderPage()

    expect(screen.getByText(/You have Acme Insurance open\. Next: gather more evidence\./)).toBeInTheDocument()
  })
})

describe('Office: first visit', () => {
  it('offers one starter client and opens its briefing', async () => {
    const user = userEvent.setup()
    setup([])
    mockedPortfolio.mockReturnValue({
      data: { totalEngagements: 0, completedEngagements: 0, contractsWon: 0, contractsLost: 0, completedEngagementsHistory: [] },
      isLoading: false,
    } as unknown as ReturnType<typeof usePortfolioSummary>)
    withCatalogue([scenario()])
    renderPage()

    expect(screen.getByText('Welcome, Viet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start your first engagement' }))
    expect(await screen.findByText('Scenario Briefing')).toBeInTheDocument()
  })
})

describe('Office: scenario catalogue', () => {
  async function openCatalogue() {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Start new' }))
    return user
  }

  it('shows a loading state while a catalogue page is being fetched', async () => {
    setup([makeEngagement({})])
    await openCatalogue()
    mockedScenarioCatalog.mockReturnValue({
      data: emptyCatalogue,
      isLoading: false,
      isFetching: true,
      isError: false,
    } as unknown as ReturnType<typeof useScenarioCatalog>)
    // Any re-render now reads the fetching state.
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Search client, industry or opportunity'), 'a')
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('passes the chosen industry to the catalogue query', async () => {
    setup([makeEngagement({})])
    mockedCatalogIndustries.mockReturnValue({
      data: ['Insurance', 'Retail'],
    } as unknown as ReturnType<typeof useScenarioCatalogIndustries>)
    const user = await openCatalogue()

    await user.click(screen.getByText('All industries'))
    await user.click(await screen.findByText('Retail'))

    expect(mockedScenarioCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ industry: 'Retail' }))
  })

  it('maps the difficulty label to its numeric value', async () => {
    setup([makeEngagement({})])
    const user = await openCatalogue()

    await user.click(screen.getByText('All difficulty'))
    await user.click(await screen.findByText('Advanced'))

    expect(mockedScenarioCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ difficulty: 4 }))
  })
})
