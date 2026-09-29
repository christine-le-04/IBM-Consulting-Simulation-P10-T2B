import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProposalStudioPage from './ProposalStudioPage'
import { useProposalStudio } from '@/features/proposal/hooks/useProposalStudio'
import { createEmptyProposalDraft } from '@/features/proposal/services/proposalDraftService'
import type { ProposalReview, ProposalSource } from '@/api/types'
import type { ProposalDraftRequest } from '@/api/hooks/useProposal'

// mock hooks and shared components for tests
vi.mock('@/features/proposal/hooks/useProposalStudio', () => ({
  useProposalStudio: vi.fn(),
}))
vi.mock('@/api/hooks/useEngagements', () => ({
  useEngagement: () => ({ data: { leadCompanyName: 'Acme Insurance', scenarioId: 'scn-1', personaId: 'p-1' } }),
}))
vi.mock('@/api/hooks/useScenarios', () => ({
  useScenario: () => ({ data: { personas: [{ id: 'p-1', name: 'Sarah Chen', jobTitle: 'Chief Operating Officer' }] } }),
}))
vi.mock('@/components/shared/ObjectiveTourProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// typed mock reference
const mockedUseProposalStudio = vi.mocked(useProposalStudio)

// creates a proposal source object for tests
function makeSource(id: string): ProposalSource {
  return {
    id,
    label: `Source ${id}`,
    type: 'RESEARCH_EVIDENCE',
    content: `Content for ${id}`,
    reliability: 'HIGH',
  }
}

// sets up the mocked proposal studio data for tests
function setup(sources: ProposalSource[]) {
  mockedUseProposalStudio.mockReturnValue({
    workspace: {
      data: {
        sources,
        proposal: undefined,
      },
      isLoading: false,
      isError: false,
    },
    proposal: undefined,
    submitted: false,
    draft: createEmptyProposalDraft(),
    activeSection: 'PROBLEM',
    review: null,
    saveState: 'idle',
    updateDraft: vi.fn(),
    setActiveSection: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    attachedSourceIds: new Set<string>(),
    reviewCurrentDraft: vi.fn(),
    challengeCurrentDraft: vi.fn(),
    submit: vi.fn(),
    saveDraft: { isPending: false },
    reviewProposal: {
      isPending: false,
      isError: false,
      error: null,
    },
    challengeProposal: {
      isPending: false,
      data: undefined,
    },
    submitProposal: {
      isPending: false,
      isError: false,
      error: null,
    },
  } as unknown as ReturnType<typeof useProposalStudio>)
}

// sets up the mocked proposal studio data with a specific active section and draft,
// for exercising the structured/list editor pagination inside the builder panel
function setupSection(activeSection: 'PROBLEM' | 'OUTCOMES' | 'TIMELINE' | 'RISKS' | 'ASSUMPTIONS', draftOverrides: Partial<ProposalDraftRequest>) {
  mockedUseProposalStudio.mockReturnValue({
    workspace: {
      data: { sources: [], proposal: undefined },
      isLoading: false,
      isError: false,
    },
    proposal: undefined,
    submitted: false,
    draft: { ...createEmptyProposalDraft(), ...draftOverrides },
    activeSection,
    review: null,
    saveState: 'idle',
    updateDraft: vi.fn(),
    setActiveSection: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    attachedSourceIds: new Set<string>(),
    reviewCurrentDraft: vi.fn(),
    challengeCurrentDraft: vi.fn(),
    submit: vi.fn(),
    saveDraft: { isPending: false },
    reviewProposal: { isPending: false, isError: false, error: null },
    challengeProposal: { isPending: false, data: undefined },
    submitProposal: { isPending: false, isError: false, error: null },
  } as unknown as ReturnType<typeof useProposalStudio>)
}

// renders the proposal studio at the expected engagement route
function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={['/dashboard/engagements/eng-1/proposal']}
    >
      <Routes>
        <Route
          path="/dashboard/engagements/:engagementId/proposal"
          element={<ProposalStudioPage />}
        />
      </Routes>
    </MemoryRouter>
  )
}

describe('ProposalStudioPage evidence library', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows 4 sources per page and reports the range for an odd total', () => {
    setup(['1', '2', '3', '4', '5'].map(makeSource))
    renderPage()

    expect(screen.getByText(/Showing 1–4 of 5 for/)).toBeInTheDocument()
    expect(screen.getByText('Source 4')).toBeInTheDocument()
    expect(screen.queryByText('Source 5')).not.toBeInTheDocument()
  })

  it('moves to the next page and shows the remaining source', async () => {
    const user = userEvent.setup()
    setup(['1', '2', '3', '4', '5'].map(makeSource))
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Next sources' }))

    expect(screen.getByText('Source 5')).toBeInTheDocument()
    expect(screen.getByText(/Showing 5–5 of 5 for/)).toBeInTheDocument()
  })

  it('has no pager when every source fits on one page', () => {
    setup(['1', '2'].map(makeSource))
    renderPage()

    expect(screen.queryByRole('button', { name: 'Next sources' })).not.toBeInTheDocument()
  })
})

describe('ProposalStudioPage document', () => {
  beforeEach(() => vi.clearAllMocks())

  it('addresses the proposal to the client contact and keeps both actions in the document bar', () => {
    setup([])
    renderPage()

    expect(screen.getByText('Proposal — Acme Insurance')).toBeInTheDocument()
    expect(screen.getByText(/Proposal to Sarah Chen, Chief Operating Officer/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Review proposal' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit to client' })).toBeInTheDocument()
  })

  it('edits the draft through the studio', async () => {
    const user = userEvent.setup()
    setup([])
    renderPage()

    await user.type(screen.getByLabelText('Problem statement'), 'x')

    expect(mockedUseProposalStudio.mock.results[0].value.updateDraft).toHaveBeenCalled()
  })

  it('shows every row of a table without paging', () => {
    setupSection('OUTCOMES', {
      businessOutcomes: ['A', 'B', 'C', 'D'].map((name) => ({ outcome: `Outcome ${name}`, metric: '', target: '' })),
    })
    renderPage()

    expect(screen.getByDisplayValue('Outcome A')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Outcome D')).toBeInTheDocument()
  })
})

describe('ProposalStudioPage submit and review', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows what is missing before submitting early, and still lets the learner submit', async () => {
    const user = userEvent.setup()
    setup([])
    renderPage()
    const studio = mockedUseProposalStudio.mock.results[0].value

    await user.click(screen.getByRole('button', { name: 'Submit to client' }))
    expect(screen.getByText('Before you submit to the client')).toBeInTheDocument()
    expect(studio.submit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Continue anyway' }))
    expect(studio.submit).toHaveBeenCalled()
  })

  it('describes the review in words, never as scores (SRS FR-14)', async () => {
    const user = userEvent.setup()
    const review: ProposalReview = {
      readyToSubmit: false,
      validationIssues: [{ severity: 'BLOCKING', code: 'X', message: 'Name a mitigation for each risk.', section: 'RISKS' }],
      clientAlignment: [],
      problemDefinitionScore: 70,
      evidenceGroundingScore: 80,
      clientAlignmentScore: 65,
      commercialLogicScore: 40,
      riskCoverageScore: 50,
      feasibilityScore: 60,
      executiveFeedback: 'Grounded, but the commercials are thin.',
      improvementActions: ['Tie the budget to a confirmed source.'],
    }
    setup([])
    const studio = mockedUseProposalStudio('eng-1')
    mockedUseProposalStudio.mockReturnValue({ ...studio, review })
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Coach' }))
    expect(screen.getByText('Strong')).toBeInTheDocument()
    expect(screen.getByText('Adequate')).toBeInTheDocument()
    expect(screen.getByText('Needs work')).toBeInTheDocument()
    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument()
  })
})
