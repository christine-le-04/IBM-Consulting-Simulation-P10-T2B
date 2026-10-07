import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AssessmentReviewPage from './AssessmentReviewPage'
import { useAssessment, useGenerateAssessment } from '@/api/hooks/useAssessment'
import { useEngagement } from '@/api/hooks/useEngagements'
import type { Assessment, Engagement } from '@/api/types'


vi.mock('@/api/hooks/useAssessment', () => ({
  useAssessment: vi.fn(),
  useGenerateAssessment: vi.fn(),
}))
vi.mock('@/api/hooks/useEngagements', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/hooks/useEngagements')>()
  return { ...actual, useEngagement: vi.fn() }
})
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/components/shared/ErrorState', () => ({ default: () => <div>Error...</div> }))

// typed mock references
const mockedAssessment = vi.mocked(useAssessment)
const mockedGenerateAssessment = vi.mocked(useGenerateAssessment)
const mockedEngagement = vi.mocked(useEngagement)

// creates an assessment object for tests
function makeAssessment(overrides: Partial<Assessment>): Assessment {
  return {
    id: 'assessment-1',
    engagementId: 'eng-1',
    competencyScores: [{ name: 'Discovery', score: 80, evidenceNote: 'Strong questions asked.' }],
    overallScore: 78,
    outcome: 'PROPOSAL_ACCEPTED',
    feedbackSummary: 'Solid engagement overall.',
    strengths: ['Asked focused discovery questions', 'Grounded the proposal in evidence'],
    improvementAreas: ['Could tighten the executive summary'],
    coachingPending: false,
    generatedAt: '2026-08-01T10:00:00Z',
    ...overrides,
  }
}

// helper function to set up the mocked assessment data for tests
function setup(assessment: Assessment) {
  mockedAssessment.mockReturnValue({
    data: assessment,
    isLoading: false,
    isError: false,
    error: null,
  } as unknown as ReturnType<typeof useAssessment>)

  mockedGenerateAssessment.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
    error: null,
  } as unknown as ReturnType<typeof useGenerateAssessment>)

  mockedEngagement.mockReturnValue({
    data: { id: 'eng-1', phase: 'ASSESSMENT' } as unknown as Engagement,
  } as unknown as ReturnType<typeof useEngagement>)
}

// renders the assessment page with the required router and query client providers
function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard/engagements/eng-1/assessment']}>
        <Routes>
          <Route
            path="/dashboard/engagements/:engagementId/assessment"
            element={<AssessmentReviewPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('AssessmentReviewPage strengths and improvement areas list', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders saved outcome identifiers as natural wording in coaching', () => {
    setup(makeAssessment({
      feedbackSummary: 'Congratulations on achieving a PILOT_APPROVED outcome.',
      strengths: ['Your evidence supported PROPOSAL_ACCEPTED.'],
      improvementAreas: ['Address the concerns behind REVISION_REQUESTED.'],
    }))
    renderPage()
    expect(screen.getByText('Congratulations on achieving a pilot approved outcome.')).toBeInTheDocument()
    expect(screen.getByText('Your evidence supported proposal accepted.')).toBeInTheDocument()
    expect(screen.getByText('Address the concerns behind revision requested.')).toBeInTheDocument()
  })

  it('renders every strength and improvement item as a numbered list item, in order', () => {
    setup(makeAssessment({}))
    renderPage()

    const strengthsHeading = screen.getByRole('heading', { name: 'Strengths' })
    const strengthsList = strengthsHeading.parentElement!.querySelector('ol') as HTMLOListElement

    // strengths should now use an ordered list
    expect(strengthsList).toBeInTheDocument()
    expect(strengthsList.tagName).toBe('OL')

    const strengthItems = Array.from(strengthsList.querySelectorAll('li')).map(
      (li) => li.textContent,
    )

    // every strength should be rendered in the same order as the assessment data
    expect(strengthItems).toEqual(['Asked focused discovery questions', 'Grounded the proposal in evidence',])

    const improvementHeading = screen.getByRole('heading', { name: 'Areas for Improvement' })
    const improvementList = improvementHeading.parentElement!.querySelector('ol') as HTMLOListElement

    // improvement areas should use the same ordered-list structure
    expect(Array.from(improvementList.querySelectorAll('li')).map(
      (li) => li.textContent),
    ).toEqual(['Could tighten the executive summary',])
  })

  it('shows "None recorded." instead of an empty list when there are no strengths', () => {
    setup(makeAssessment({ strengths: [] }))
    renderPage()

    const strengthsHeading = screen.getByRole('heading', { name: 'Strengths' })
    const strengthsList = strengthsHeading.parentElement!.querySelector('ol')

    // the ordered list should still render even when there are no strength items
    expect(strengthsList).not.toBeNull()
    expect(strengthsList!.children).toHaveLength(0)

    // the empty state should make it clear that no strengths were recorded
    expect(screen.getAllByText('None recorded.').length).toBeGreaterThan(0)
  })

  it('still shows the overall score and outcome tag alongside the restructured lists', () => {
    setup(makeAssessment({ overallScore: 91, outcome: 'PILOT_APPROVED' }))
    renderPage()

    // the list restructure should not remove or alter the existing assessment summary
    expect(screen.getByText('91/100')).toBeInTheDocument()
    expect(screen.getByText('Pilot approved')).toBeInTheDocument()
  })
})

describe('AssessmentReviewPage best stage scores', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows three stage best scores, total attempts and checkpoint cycles', () => {
    setup(makeAssessment({ competencyScores: [
      { name: 'Outreach Effectiveness', stage: 'OUTREACH', score: 90, evidenceNote: 'Best across all cycles.', attemptCount: 5, currentCycleAttempts: 2, checkpointResets: 1, scoreHistoryComplete: true },
      { name: 'Relationship Building', stage: 'MEETING', score: 80, evidenceNote: 'Best across all cycles.', attemptCount: 7, currentCycleAttempts: 1, checkpointResets: 2, scoreHistoryComplete: true },
      { name: 'Solution Alignment', stage: 'PROPOSAL', score: 75, evidenceNote: 'Best across all submissions.', attemptCount: 3, currentCycleAttempts: 3, checkpointResets: 0, scoreHistoryComplete: true },
    ] }))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Best scores by stage' })).toBeInTheDocument()
    expect(screen.getByText('Outreach')).toBeInTheDocument()
    expect(screen.getByText('Meeting')).toBeInTheDocument()
    expect(screen.getByText('Proposal')).toBeInTheDocument()
    expect(screen.getByText(/5 completed attempts total · 2 in the current checkpoint cycle · 1 checkpoint reset$/)).toBeInTheDocument()
    expect(screen.getByText(/7 completed attempts total · 1 in the current checkpoint cycle · 2 checkpoint resets$/)).toBeInTheDocument()
    expect(screen.getByText('90/100')).toBeInTheDocument()
    expect(screen.getByText(/Research and meeting preparation receive feedback only/)).toBeInTheDocument()
  })

  it('keeps historical assessments readable without claiming attempt metadata', () => {
    setup(makeAssessment({}))
    renderPage()
    expect(screen.getByRole('heading', { name: 'Competencies' })).toBeInTheDocument()
    expect(screen.queryByText(/completed attempts total/)).not.toBeInTheDocument()
  })
})
