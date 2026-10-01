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

it('offers revision before the third unsuccessful submission and hides final assessment', async () => {
  mockedUseExplanation.mockReturnValue(idleMutation())
  mockedUseCounterfactual.mockReturnValue(idleMutation())
  const revise = vi.fn()
  render(<MemoryRouter><ProposalOutcomeView engagementId="engagement-1" onRevise={revise}
    proposal={makeProposal({ decision: 'LOST', submissionCount: 1, submissionsRemaining: 2, revisionAvailable: true })} /></MemoryRouter>)
  await userEvent.click(screen.getByRole('button', { name: /Retry proposal/ }))
  expect(revise).toHaveBeenCalledOnce()
  expect(screen.queryByRole('button', { name: 'View full assessment' })).not.toBeInTheDocument()
})

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

  it('leads with words and keeps the numbers one click away (SRS FR-14)', async () => {
    const user = userEvent.setup()
    renderOutcome(makeProposal({
      decisionConfidence: 70,
      learnerPerformanceScore: 78,
      decisionRationale: 'Client alignment 23 and commercial logic 100 produced a decision score of 72.',
      decisionDimensions: [
        { dimension: 'Commercial logic', score: 100, interpretation: 'Budget and phasing were credible.' },
        { dimension: 'Client alignment', score: 23, interpretation: 'The priorities were only partly addressed.' },
      ],
    }))

    await user.click(screen.getByRole('tab', { name: 'How they weighed it' }))
    expect(screen.getByText('Carried the decision')).toBeInTheDocument()
    expect(screen.getByText('Held it back')).toBeInTheDocument()

    // The figures sit in a closed disclosure until the learner asks for them.
    const numbers = screen.getByText('Show the numbers behind the decision').closest('details')!
    expect(numbers).not.toHaveAttribute('open')
    expect(numbers).toHaveTextContent('70%')
    expect(numbers).toHaveTextContent('78/100')
    expect(numbers).toHaveTextContent('Client alignment 23 and commercial logic 100')
    expect(numbers).toHaveTextContent('100/100')
    await user.click(screen.getByText('Show the numbers behind the decision'))
    expect(numbers).toHaveAttribute('open')
  })

  it('lists every claim at once and filters by support level', async () => {
    const user = userEvent.setup()
    renderOutcome(makeProposal({
      evidenceImpacts: [
        { claim: 'Re-entry costs nursing time', supportLevel: 'WELL_SUPPORTED', explanation: 'Backed by E-01.' },
        { claim: 'Ward sisters back the pilot', supportLevel: 'PARTIALLY_SUPPORTED', explanation: 'One source.' },
        { claim: 'It can be funded divisionally', supportLevel: 'UNSUPPORTED', explanation: 'No evidence attached.' },
      ],
    }))

    await user.click(screen.getByRole('tab', { name: 'Your claims, checked (3)' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: /Unsupported/ }))
    expect(screen.getByText('“It can be funded divisionally”')).toBeInTheDocument()
    expect(screen.queryByText('“Re-entry costs nursing time”')).not.toBeInTheDocument()

    // Pressing the same filter again shows every claim.
    await user.click(screen.getByRole('button', { name: /Unsupported/ }))
    expect(screen.getByText('“Re-entry costs nursing time”')).toBeInTheDocument()
  })

  it('shows the coaching view the learner asked for last', async () => {
    const user = userEvent.setup()
    mockedUseExplanation.mockReturnValue({ ...idleMutation(), data: { message: 'Explanation text.' } } as unknown as ReturnType<typeof useProposalDecisionExplanation>)
    mockedUseCounterfactual.mockReturnValue({ ...idleMutation(), data: { message: 'Counterfactual text.' } } as unknown as ReturnType<typeof useProposalCounterfactual>)
    renderOutcome(makeProposal())

    await user.click(screen.getByRole('button', { name: 'Explain decision' }))
    expect(screen.getByText('Explanation text.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'What could change?' }))
    expect(screen.getByText('Counterfactual text.')).toBeInTheDocument()
    expect(screen.getByText('What could have changed')).toBeInTheDocument()
  })
})
