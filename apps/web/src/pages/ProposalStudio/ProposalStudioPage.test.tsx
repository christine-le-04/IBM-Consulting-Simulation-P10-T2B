import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ProposalStudioPage from './ProposalStudioPage'
import { useProposalStudio } from '@/features/proposal/hooks/useProposalStudio'
import { createEmptyProposalDraft } from '@/features/proposal/services/proposalDraftService'
import type { Proposal, ProposalReview, ProposalSource } from '@/api/types'
import type { ProposalDraftRequest } from '@/api/hooks/useProposal'

// mock hooks and shared components for tests
vi.mock('@/features/proposal/hooks/useProposalStudio', () => ({
  useProposalStudio: vi.fn(),
}))
vi.mock('@/api/hooks/useProposal', () => ({
  useProposalDecisionExplanation: () => ({ data: undefined, isPending: false, mutate: vi.fn() }),
  useProposalCounterfactual: () => ({ data: undefined, isPending: false, mutate: vi.fn() }),
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
    reviseProposal: { isPending: false, isError: false },
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
        <Route path="/dashboard/engagements/:engagementId/assessment" element={<div>Feedback and review page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('scored proposal results', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['WON', 1, false],
    ['WON', 2, false],
    ['WON', 3, false],
    ['LOST', 3, false],
  ] as const)('moves %s on submission %i directly to feedback/review', async (decision, submissionCount, revisionAvailable) => {
    setup([])
    const studio = mockedUseProposalStudio('eng-1')
    mockedUseProposalStudio.mockReturnValue({ ...studio, submitted: true,
      proposal: { status: 'SUBMITTED', decision, submissionCount, revisionAvailable } as Proposal })
    renderPage()
    expect(await screen.findByText('Feedback and review page')).toBeInTheDocument()
  })

  it.each([1, 2])('keeps unsuccessful submission %i on the proposal page with a retry action', async (submissionCount) => {
    setup([])
    const studio = mockedUseProposalStudio('eng-1')
    const revise = vi.fn()
    mockedUseProposalStudio.mockReturnValue({ ...studio, submitted: true, revise,
      proposal: { ...createEmptyProposalDraft(), id: 'proposal-1', engagementId: 'eng-1',
        status: 'SUBMITTED', decision: 'LOST', submissionCount, submissionsRemaining: 3 - submissionCount,
        revisionAvailable: true, clientDecisionOutcome: 'REJECTED', budget: '100', submittedAt: '',
        alignmentScore: 40, decisionRationale: 'Score below acceptance threshold', decisionConfidence: 60,
        learnerPerformanceScore: 40,
        decisionDimensions: [], decisionInsights: [], evidenceImpacts: [], clientResponse: 'The client did not buy.' } as Proposal })
    renderPage()
    expect(screen.queryByText('Feedback and review page')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Retry proposal/ }))
    expect(revise).toHaveBeenCalledOnce()
  })
})

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

  it('wraps long table cells instead of cutting them off, and keeps Enter out of a cell', async () => {
    const user = userEvent.setup()
    setupSection('OUTCOMES', {
      businessOutcomes: [{ outcome: 'Reduce avoidable unplanned downtime on the critical asset group', metric: '', target: '' }],
    })
    renderPage()

    const cell = screen.getByLabelText('Business outcome 1')
    expect(cell.tagName).toBe('TEXTAREA')

    await user.type(cell, '{Enter}')
    const updateDraft = mockedUseProposalStudio.mock.results[0].value.updateDraft
    expect(updateDraft).not.toHaveBeenCalled()
  })
})

describe('ProposalStudioPage submit and review', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps the "Before you submit" checklist in the outline', () => {
    setup([])
    renderPage()

    expect(screen.getByText('Before you submit')).toBeInTheDocument()
    expect(screen.getAllByText('You have run a proposal review').length).toBeGreaterThan(0)
  })

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

describe('ProposalStudioPage after submission', () => {
  beforeEach(() => vi.clearAllMocks())

  function setupSubmitted() {
    setup([makeSource('1')])
    const studio = mockedUseProposalStudio('eng-1')
    mockedUseProposalStudio.mockReturnValue({
      ...studio,
      submitted: true,
      proposal: {
        clientDecisionOutcome: 'PILOT_APPROVED',
        clientResponse: 'We will run the pilot.',
        decisionRationale: '',
        decisionInsights: [],
        decisionDimensions: [],
        evidenceImpacts: [],
        submittedAt: '2026-09-28T10:00:00Z',
      },
      draft: { ...studio.draft, problemStatement: 'Duplicate entry costs nursing time.', evidenceLinks: [{ section: 'PROBLEM', sourceId: '1' }] },
      attachedSourceIds: new Set(['1']),
    } as unknown as ReturnType<typeof useProposalStudio>)
  }

  function renderAt(url: string) {
    return render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/dashboard/engagements/:engagementId/proposal" element={<ProposalStudioPage />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('opens on the client’s decision, with a way back to the proposal that was sent', async () => {
    const user = userEvent.setup()
    setupSubmitted()
    renderAt('/dashboard/engagements/eng-1/proposal')

    expect(screen.getByText('We will run the pilot.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Read the proposal you sent' }))

    expect(screen.getByDisplayValue('Duplicate entry costs nursing time.')).toBeInTheDocument()
  })

  it('shows the sent proposal read-only, without review, submit or attach', () => {
    setupSubmitted()
    renderAt('/dashboard/engagements/eng-1/proposal?view=proposal')

    expect(screen.getByLabelText('Problem statement')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Back to their decision' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Submit to client' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Review proposal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Attach source/ })).not.toBeInTheDocument()
    expect(screen.getByText('Attached to Foundation')).toBeInTheDocument()
    // The checklist stays in the outline, as what was sent.
    expect(screen.getByText('What you submitted')).toBeInTheDocument()
    expect(screen.getByText('At least one evidence source is attached')).toBeInTheDocument()
  })
})

describe('ProposalStudioPage checklist and editing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the frozen scenario threshold rather than requiring full coverage', () => {
    setup(['a', 'b', 'c', 'd'].map(makeSource))
    const studio = mockedUseProposalStudio('eng-1')
    mockedUseProposalStudio.mockReturnValue({
      ...studio,
      workspace: { ...studio.workspace, data: { ...studio.workspace.data!, evidenceCoverageThreshold: 50 } },
      draft: { ...createEmptyProposalDraft(), evidenceLinks: [{ section: 'PROBLEM', sourceId: 'a' }] },
    } as ReturnType<typeof useProposalStudio>)
    renderPage()
    expect(screen.getAllByText('Attach 1 more different source to meet the 50% evidence requirement')).not.toHaveLength(0)
  })

  it('matches backend rounding when two of three sources satisfy a 67 percent threshold', () => {
    setup(['a', 'b', 'c'].map(makeSource))
    const studio = mockedUseProposalStudio('eng-1')
    mockedUseProposalStudio.mockReturnValue({
      ...studio,
      workspace: { ...studio.workspace, data: { ...studio.workspace.data!, evidenceCoverageThreshold: 67 } },
      draft: { ...createEmptyProposalDraft(), evidenceLinks: [
        { section: 'PROBLEM', sourceId: 'a' }, { section: 'SOLUTION', sourceId: 'b' },
      ] },
    } as ReturnType<typeof useProposalStudio>)
    renderPage()
    expect(screen.getAllByText('Evidence draws on enough different sources')).not.toHaveLength(0)
    expect(screen.queryByText(/Attach .* more different/)).not.toBeInTheDocument()
  })

  it('says how many more different sources full evidence coverage needs', () => {
    setup(['a', 'b', 'c', 'd', 'e'].map(makeSource))
    const studio = mockedUseProposalStudio('eng-1')
    mockedUseProposalStudio.mockReturnValue({
      ...studio,
      draft: {
        ...createEmptyProposalDraft(),
        evidenceLinks: [
          { section: 'PROBLEM', sourceId: 'a' },
          { section: 'OUTCOMES', sourceId: 'a' },
        ],
      },
    } as ReturnType<typeof useProposalStudio>)
    renderPage()

    // The same source twice is still one source, and coverage counts up to four.
    const outline = screen.getByRole('region', { name: 'Before you submit' })
    expect(within(outline).getByText('Attach 3 more different sources for full evidence coverage')).toBeInTheDocument()
  })

  it('moves the caret into a newly added table row', async () => {
    const user = userEvent.setup()
    setupSection('RISKS', { risks: [{ risk: 'Data access', severity: 'MEDIUM', mitigation: 'Read-only' }] })
    const studio = mockedUseProposalStudio('eng-1')
    mockedUseProposalStudio.mockImplementation(() => {
      const [draft, setDraft] = useState(studio.draft)
      return { ...studio, draft, updateDraft: (updater: (current: ProposalDraftRequest) => ProposalDraftRequest) => setDraft(updater) } as ReturnType<typeof useProposalStudio>
    })
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Add row' }))
    expect(screen.getByLabelText('Risk 2')).toHaveFocus()
    await user.keyboard('False positives')
    expect(screen.getByLabelText('Risk 2')).toHaveValue('False positives')
    expect(screen.queryByLabelText('Risk 3')).not.toBeInTheDocument()
  })
})
