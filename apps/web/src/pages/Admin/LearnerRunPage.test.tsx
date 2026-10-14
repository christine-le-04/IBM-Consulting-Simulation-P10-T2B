import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useAdminLearnerProgress, useAdminRunAssessment } from '@/api/hooks/useAdminLearnerProgress'
import type { Assessment, LearnerProgressEntry } from '@/api/types'
import LearnerRunPage from './LearnerRunPage'

vi.mock('@/api/hooks/useAdminLearnerProgress', () => ({ useAdminLearnerProgress: vi.fn(), useAdminRunAssessment: vi.fn() }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))

const mockedProgress = vi.mocked(useAdminLearnerProgress)
const mockedAssessment = vi.mocked(useAdminRunAssessment)
const DAY = 24 * 60 * 60 * 1000

function entry(overrides: Partial<LearnerProgressEntry> = {}): LearnerProgressEntry {
  return {
    engagementId: 'e1',
    userId: 'u1',
    displayName: 'Ana Lee',
    email: 'ana@example.com',
    scenarioId: 's1',
    scenarioTitle: 'AeroVector Aviation',
    state: 'OUTREACHING',
    overallScore: null,
    lastActivityAt: new Date(Date.now() - 5 * DAY).toISOString(),
    completedAt: null,
    ...overrides,
  }
}

const assessment: Assessment = {
  id: 'a1',
  engagementId: 'e1',
  competencyScores: [{ name: 'Proposal quality', score: 74, evidenceNote: 'Clear scope', stage: 'PROPOSAL' }],
  overallScore: 81,
  outcome: 'PILOT_APPROVED',
  feedbackSummary: 'Strong discovery, tighten the pricing.',
  strengths: ['Asked about budget early'],
  improvementAreas: [],
  coachingPending: false,
  generatedAt: new Date().toISOString(),
}

function setup(data: LearnerProgressEntry[] | undefined, assessmentState: Record<string, unknown> = {}) {
  mockedProgress.mockReturnValue({ data, dataUpdatedAt: Date.now(), isLoading: false, isError: false, refetch: vi.fn() } as unknown as ReturnType<typeof useAdminLearnerProgress>)
  mockedAssessment.mockReturnValue({ data: undefined, isLoading: false, isError: false, ...assessmentState } as unknown as ReturnType<typeof useAdminRunAssessment>)
}

function renderPage(engagementId = 'e1', from?: string) {
  return render(<MemoryRouter initialEntries={[{ pathname: `/dashboard/admin/learners/${engagementId}`, state: from ? { from } : null }]}>
    <Routes><Route path="/dashboard/admin/learners/:engagementId" element={<LearnerRunPage />} /></Routes>
  </MemoryRouter>)
}

describe('LearnerRunPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the run overview and explains a missing assessment', () => {
    setup([entry()])
    renderPage()
    expect(screen.getByRole('heading', { name: 'Ana Lee' })).toBeInTheDocument()
    expect(screen.getByText('Stuck')).toBeInTheDocument()
    expect(screen.getByText(/No assessment yet/)).toBeInTheDocument()
    expect(mockedAssessment).toHaveBeenCalledWith('e1', false)
  })

  it('shows the assessment once the run is scored', () => {
    setup([entry({ state: 'COMPLETED', overallScore: 81, completedAt: new Date().toISOString() })], { data: assessment })
    renderPage()
    expect(mockedAssessment).toHaveBeenCalledWith('e1', true)
    expect(screen.getByText('Strong discovery, tighten the pricing.')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Proposal: 74 out of 100' })).toBeInTheDocument()
    expect(screen.getByText('Asked about budget early')).toBeInTheDocument()
  })

  it('reports an assessment that fails to load', () => {
    setup([entry({ overallScore: 81 })], { isError: true })
    renderPage()
    expect(screen.getByText('Assessment unavailable')).toBeInTheDocument()
  })

  it('says when the run does not exist', () => {
    setup([entry()])
    renderPage('missing')
    expect(screen.getByText('Run not found')).toBeInTheDocument()
  })

  it('links back to the filtered list it came from', () => {
    setup([entry()])
    renderPage('e1', '/dashboard/admin/learners?status=STUCK')
    expect(screen.getByRole('link', { name: 'Learner progress' })).toHaveAttribute('href', '/dashboard/admin/learners?status=STUCK')
  })
})
