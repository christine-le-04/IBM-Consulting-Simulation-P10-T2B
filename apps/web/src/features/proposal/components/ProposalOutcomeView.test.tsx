import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { ProposalOutcomeView } from './ProposalOutcomeView'
import { useProposalCounterfactual, useProposalDecisionExplanation } from '@/api/hooks/useProposal'
import type { Proposal } from '@/api/types'

// mock the decision coaching hooks so tests can control their state
vi.mock('@/api/hooks/useProposal', () => ({
  useProposalDecisionExplanation: vi.fn(),
  useProposalCounterfactual: vi.fn(),
}))

// typed mock references
const mockedUseExplanation = vi.mocked(useProposalDecisionExplanation)
const mockedUseCounterfactual = vi.mocked(useProposalCounterfactual)

// creates an idle mutation result for the decision coaching hooks
function idleMutation() {
  return {
    data: undefined,
    isPending: false,
    mutate: vi.fn(),
  } as unknown as ReturnType<typeof useProposalDecisionExplanation>
}

// creates a base proposal object for tests with optional field overrides
function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: 'proposal-1',
    engagementId: 'engagement-1',
    status: 'SUBMITTED',
    problemStatement: '',
    solutionStrategy: null,
    components: [],
    budget: '125000.5',
    timelineWeeks: 8,
    budgetConfidence: null,
    budgetSource: null,
    businessOutcomes: [],
    milestones: [],
    risks: [],
    assumptions: [],
    evidenceLinks: [],
    alignmentScore: 0,
    decision: 'PENDING',
    decisionRationale: '',
    clientResponse: null,
    clientDecisionOutcome: 'DEFERRED',
    decisionConfidence: 0,
    learnerPerformanceScore: 0,
    decisionDimensions: [],
    decisionInsights: [],
    evidenceImpacts: [],
    submittedAt: '',
    ...overrides,
  }
}

// renders the proposal outcome page with the expected router context
function renderOutcome(proposal: Proposal) {
  return render(
    <MemoryRouter>
      <ProposalOutcomeView
        proposal={proposal}
        engagementId="engagement-1"
        client={{ company: 'MediCare Regional Hospital Network', contactName: 'Sarah Chen', contactTitle: 'Chief Operating Officer', subject: 'Ward re-entry' }}
      />
    </MemoryRouter>,
  )
}

describe('ProposalOutcomeView component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseExplanation.mockReturnValue(idleMutation())
    mockedUseCounterfactual.mockReturnValue(idleMutation())
  })

  it('opens with the client’s letter: who decided, what they decided and what they said', () => {
    renderOutcome(makeProposal({ clientDecisionOutcome: 'PILOT_APPROVED', clientResponse: 'We will approve the pilot.' }))

    const letter = screen.getByRole('article', { name: 'The client\'s decision' })
    expect(letter).toHaveTextContent('MediCare Regional Hospital Network')
    expect(letter).toHaveTextContent('Office of the Chief Operating Officer')
    expect(letter).toHaveTextContent('Re: Proposal — Ward re-entry')
    expect(letter).toHaveTextContent('We will approve the pilot.')
    expect(letter).toHaveTextContent('Sarah Chen')
  })

  it('falls back to the decision rationale when the client has not replied', () => {
    renderOutcome(makeProposal({ clientResponse: null, decisionRationale: 'Rationale used because no client response exists.' }))

    expect(screen.getByText('Rationale used because no client response exists.')).toBeInTheDocument()
  })

  it('shows the default message when there is neither a reply nor a rationale', () => {
    renderOutcome(makeProposal({ clientResponse: null, decisionRationale: null as unknown as string }))

    expect(screen.getByText('The client response is not yet available.')).toBeInTheDocument()
  })

  it('keeps confidence, performance and dimension scores for the assessment (SRS FR-14)', async () => {
    const user = userEvent.setup()
    renderOutcome(makeProposal({
      decisionConfidence: 70,
      learnerPerformanceScore: 78,
      decisionDimensions: [
        { dimension: 'Commercial logic', score: 100, interpretation: 'Budget and phasing were credible.' },
        { dimension: 'Client alignment', score: 23, interpretation: 'The priorities were only partly addressed.' },
      ],
    }))

    expect(screen.queryByText(/70%|78\/100/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'How they weighed it' }))
    expect(screen.getByText('Carried the decision')).toBeInTheDocument()
    expect(screen.getByText('Held it back')).toBeInTheDocument()
    expect(screen.getByText('Commercial logic', { selector: 'p strong' })).toBeInTheDocument()
    expect(screen.queryByText(/\/100/)).not.toBeInTheDocument()
  })

  it('shows each checked claim with its support level', async () => {
    const user = userEvent.setup()
    renderOutcome(makeProposal({
      evidenceImpacts: [
        { claim: 'Re-entry costs nursing time', supportLevel: 'WELL_SUPPORTED', explanation: 'Backed by E-01.' },
        { claim: 'It can be funded divisionally', supportLevel: 'UNSUPPORTED', explanation: 'No evidence attached.' },
      ],
    }))

    await user.click(screen.getByRole('tab', { name: 'Your claims, checked (2)' }))
    expect(screen.getByText('“Re-entry costs nursing time”')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next claim' }))
    expect(screen.getByText('“It can be funded divisionally”')).toBeInTheDocument()
  })
})
