import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import OutreachWorkspacePage from './OutreachWorkspacePage'
import { useCapabilityBrief, useOutreach, useSendOutreach, useSubmitCapabilityBrief } from '@/api/hooks/useOutreach'
import { useLeadIntelligence, useResearch } from '@/api/hooks/useLeads'
import type { CapabilityBrief, LeadIntelligence, OutreachAttempt, ResearchEvidence } from '@/api/types'
import { useContactSelectionStore } from '@/store/contactSelectionStore'

vi.mock('@/api/hooks/useOutreach', () => ({
  useOutreach: vi.fn(),
  useCapabilityBrief: vi.fn(),
  useSendOutreach: vi.fn(),
  useSubmitCapabilityBrief: vi.fn(),
}))
vi.mock('@/api/hooks/useLeads', () => ({
  useLeadIntelligence: vi.fn(),
  useResearch: vi.fn(),
}))
vi.mock('@/api/hooks/useEngagements', () => ({
  useEngagement: () => ({ data: { scenarioId: 'scn-1', personaId: 'p-1', leadCompanyName: 'Company Test' } }),
}))
vi.mock('@/api/hooks/useScenarios', () => ({
  useScenario: () => ({ data: { personas: [{ id: 'p-1', name: 'John Doe', jobTitle: 'CEO' }, { id: 'p-2', name: 'Jane Roe', jobTitle: 'CFO' }] } }),
}))
vi.mock('@/components/shared/ObjectiveTourProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))

const mockedOutreach = vi.mocked(useOutreach)
const mockedCapabilityBrief = vi.mocked(useCapabilityBrief)
const mockedSendOutreach = vi.mocked(useSendOutreach)
const mockedSubmitBrief = vi.mocked(useSubmitCapabilityBrief)
const mockedLeadIntelligence = vi.mocked(useLeadIntelligence)
const mockedResearch = vi.mocked(useResearch)

function makeEvidence(sequenceNo: number): ResearchEvidence {
  return {
    id: `evidence-${sequenceNo}`,
    engagementId: 'eng-1',
    note: `Client signal number ${sequenceNo}`,
    hypothesis: null,
    evidenceType: 'COMPANY_NEWS',
    sourceUrl: null,
    sourceTitle: `Signal ${sequenceNo}`,
    origin: 'AI_SYNTHESIZED',
    verificationStatus: 'VERIFIED',
    occurredOn: null,
    confidence: 'HIGH',
    relevanceScore: 80,
    reasoningLane: null,
    sequenceNo,
    supportingEvidenceIds: [],
    createdAt: '2026-08-01T10:00:00Z',
  } as ResearchEvidence
}

function attempt(n: number, overrides: Partial<OutreachAttempt> = {}): OutreachAttempt {
  return {
    id: `a-${n}`,
    engagementId: 'eng-1',
    attemptNumber: n,
    subject: `Email ${n}`,
    body: `Body of email ${n}, long enough to be a real message to the client.`,
    clientReply: `Reply to email ${n}`,
    outcome: 'REJECTED',
    scorePersonalisation: 40,
    scoreRelevance: 50,
    scoreClarity: 60,
    scoreCallToAction: 30,
    nextAction: 'SEND_FOLLOW_UP',
    requestTitle: null,
    requestSummary: null,
    requestRequirements: [],
    coachingHint: `Hint ${n}`,
    createdAt: `2026-08-0${n}T10:00:00Z`,
    ...overrides,
  }
}

const sendMutate = vi.fn()
const briefMutate = vi.fn()

function setup({ evidence = [makeEvidence(1)], attempts = [], brief = null }: { evidence?: ResearchEvidence[]; attempts?: OutreachAttempt[]; brief?: CapabilityBrief | null } = {}) {
  mockedOutreach.mockReturnValue({ data: attempts, isLoading: false, refetch: vi.fn() } as unknown as ReturnType<typeof useOutreach>)
  mockedCapabilityBrief.mockReturnValue({ data: brief } as unknown as ReturnType<typeof useCapabilityBrief>)
  mockedSendOutreach.mockReturnValue({ mutate: sendMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useSendOutreach>)
  mockedSubmitBrief.mockReturnValue({ mutate: briefMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useSubmitCapabilityBrief>)
  mockedLeadIntelligence.mockReturnValue({
    data: { companyName: 'Company Test', industry: 'Insurance', decisionMaker: { value: 'John Doe, CEO', supportingEvidence: [] } } as unknown as LeadIntelligence,
  } as unknown as ReturnType<typeof useLeadIntelligence>)
  mockedResearch.mockReturnValue({ data: evidence } as unknown as ReturnType<typeof useResearch>)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/engagements/eng-1/outreach']}>
      <Routes>
        <Route path="/dashboard/engagements/:engagementId/outreach" element={<OutreachWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('OutreachWorkspacePage first email', () => {
  beforeEach(() => vi.clearAllMocks())

  it('inserts a piece of evidence from the case file into the message', async () => {
    const user = userEvent.setup()
    setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: /Insert from case file/ }))
    const menu = screen.getByRole('menu', { name: 'Insert from case file' })
    await user.click(within(menu).getByRole('menuitem', { name: /Client signal number 1/ }))

    expect((screen.getByLabelText('Message') as HTMLTextAreaElement).value).toContain('Client signal number 1')
  })

  it('checks the subject and message before sending, then sends what was written', async () => {
    const user = userEvent.setup()
    setup()
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Send' }))
    expect(screen.getByText('Enter a clear subject')).toBeInTheDocument()
    expect(screen.getByText('Message must be at least 50 characters')).toBeInTheDocument()
    expect(sendMutate).not.toHaveBeenCalled()

    await user.type(screen.getByLabelText('Subject'), 'Protecting dispatch reliability')
    await user.type(screen.getByLabelText('Message'), 'Dear John, your team is protecting reliability. Would a 20-minute call help?')
    await user.click(screen.getByRole('button', { name: 'Send' }))

    expect(sendMutate).toHaveBeenCalledWith(
      { subject: 'Protecting dispatch reliability', body: 'Dear John, your team is protecting reliability. Would a 20-minute call help?' },
      expect.anything(),
    )
  })

  it('shows the four self-checks in the editor pane', () => {
    setup()
    renderPage()

    expect(within(screen.getByLabelText('Editor')).getByText(/of 4/)).toBeInTheDocument()
  })
})

describe('OutreachWorkspacePage after a reply', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a decline with the tries left, and a follow-up that replies to the thread', async () => {
    const user = userEvent.setup()
    setup({ attempts: [attempt(1)] })
    renderPage()

    expect(screen.getByText(/Declined · you can write 2 more times/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Write a follow-up' }))
    expect(screen.getByLabelText('Subject')).toHaveValue('Re: Email 1')
  })

  it('keeps the scores of a sent email behind "How this email scored"', async () => {
    const user = userEvent.setup()
    setup({ attempts: [attempt(1)] })
    renderPage()

    await user.click(within(screen.getByRole('region', { name: 'Messages' })).getByText('Email 1'))
    const scores = screen.getByText('How this email scored').closest('details')!
    expect(scores).not.toHaveAttribute('open')
    expect(scores).toHaveTextContent('40/100')
  })

  it('closes the lead after three emails', () => {
    setup({ attempts: [attempt(1), attempt(2), attempt(3)] })
    renderPage()

    expect(screen.getByText('No more emails to John Doe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Write a follow-up' })).not.toBeInTheDocument()
    expect(screen.getByText('Hint 3')).toBeInTheDocument()
  })

  it('invites the learner to prepare once the meeting is agreed', () => {
    setup({ attempts: [attempt(1, { outcome: 'ACCEPTED', nextAction: 'CONTINUE_TO_MEETING' })] })
    renderPage()

    expect(screen.getByText('Meeting secured')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Continue to Prepare/ }).length).toBeGreaterThan(0)
  })
})

describe('OutreachWorkspacePage capability brief', () => {
  beforeEach(() => vi.clearAllMocks())

  it('asks for all four sections before the brief goes to the client', async () => {
    const user = userEvent.setup()
    setup({
      attempts: [attempt(1, {
        outcome: 'FOLLOW_UP_REQUIRED',
        nextAction: 'SUBMIT_CAPABILITY_BRIEF',
        requestTitle: 'Capability brief requested',
        requestRequirements: ['A comparable example'],
      })],
    })
    renderPage()

    expect(screen.getAllByText('A comparable example').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Send the brief' }))
    expect(briefMutate).not.toHaveBeenCalled()

    const long = 'x'.repeat(90)
    for (const label of ['Experience', 'Approach', 'Case example', 'Client fit']) {
      await user.click(screen.getByRole('tab', { name: new RegExp(label) }))
      await user.type(screen.getByLabelText(label), long)
    }
    await user.click(screen.getByRole('button', { name: 'Send the brief' }))

    expect(briefMutate).toHaveBeenCalledWith(
      { relevantExperience: long, approach: long, caseExample: long, clientFit: long },
      expect.anything(),
    )
  })
})

describe('OutreachWorkspacePage with a chosen contact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useContactSelectionStore.setState({ byEngagement: {} })
  })

  it('writes to the chosen contact and counts emails for that contact only', () => {
    // Jane was chosen after two emails to someone else.
    useContactSelectionStore.getState().choose('eng-1', { id: 'p-2', name: 'Jane Roe', jobTitle: 'CFO' }, 2)
    setup({ attempts: [attempt(1), attempt(2), attempt(3)] })
    renderPage()

    expect(screen.getAllByText(/Jane Roe/).length).toBeGreaterThan(0)
    expect(screen.getByText(/you can write 2 more times/)).toBeInTheDocument()
  })

  it('offers another contact after three emails to one person', () => {
    useContactSelectionStore.getState().choose('eng-1', { id: 'p-1', name: 'John Doe', jobTitle: 'CEO' }, 0)
    setup({ attempts: [attempt(1), attempt(2), attempt(3)] })
    renderPage()

    expect(screen.getByText('No more emails to John Doe')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose another contact' })).toBeInTheDocument()
  })
})
