import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LiveMeetingPage from './LiveMeetingPage'
import { useMeeting, useMeetingResponseOptions, useMeetingTranscript, usePersonaState, useRetryMeeting, useReturnToPreparation } from '@/api/hooks/useMeeting'
import { useRetryEngagement } from '@/api/hooks/useEngagements'
import { useMeetingSocket } from '@/api/hooks/useMeetingSocket'
import type { ConversationTurn, Meeting, PersonaState } from '@/api/types'

Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
  configurable: true,
  value: vi.fn(),
})

// mock hocks and share components for tests
vi.mock('@/api/hooks/useMeeting', () => ({
  useMeeting: vi.fn(),
  useMeetingTranscript: vi.fn(),
  usePersonaState: vi.fn(),
  useMeetingResponseOptions: vi.fn(),
  useRetryMeeting: vi.fn(),
  useReturnToPreparation: vi.fn(),
  useMeetingPreparation: () => ({ data: { objective: 'Validate the problem', agenda: ['Confirm objectives'], discoveryQuestions: ['Which site hurts most?'] } }),
}))
// what the engagement and scenario lookups answer; one test swaps them out
const lookups = vi.hoisted(() => {
  const defaults = {
    engagement: { scenarioId: 'scn-1', leadCompanyName: 'MediCare' } as Record<string, unknown>,
    scenario: { personas: [{ id: 'persona-1', name: 'Sarah Chen', jobTitle: 'Chief Operating Officer', organisation: 'MediCare' }] } as unknown,
  }
  return { defaults, current: { ...defaults } }
})
vi.mock('@/api/hooks/useEngagements', () => ({
  useRetryEngagement: vi.fn(),
  useEngagement: () => ({ data: lookups.current.engagement }),
}))
vi.mock('@/api/hooks/useScenarios', () => ({
  useScenario: () => ({ data: lookups.current.scenario }),
}))
vi.mock('@/api/hooks/useMeetingSocket', () => ({ useMeetingSocket: vi.fn() }))
vi.mock('@/components/shared/ObjectiveTourProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/components/shared/ErrorState', () => ({ default: () => <div>Error...</div> }))

// typed mock references
const mockedMeeting = vi.mocked(useMeeting)
const mockedTranscript = vi.mocked(useMeetingTranscript)
const mockedPersonaState = vi.mocked(usePersonaState)
const mockedResponseOptions = vi.mocked(useMeetingResponseOptions)
const mockedRetryMeeting = vi.mocked(useRetryMeeting)
const mockedReturnToPreparation = vi.mocked(useReturnToPreparation)
const mockedRetryEngagement = vi.mocked(useRetryEngagement)
const mockedMeetingSocket = vi.mocked(useMeetingSocket)

// mock persona data
const personaState: PersonaState = {
  engagementId: 'eng-1',
  trust: 80,
  interest: 80,
  patience: 80,
  disclosedFacts: [],
}

// create default meeting data
function makeMeeting(overrides: Partial<Meeting>): Meeting {
  return {
    id: 'meeting-1',
    engagementId: 'eng-1',
    personaId: 'persona-1',
    status: 'IN_PROGRESS',
    interactionMode: 'FREEFORM',
    meetingThreshold: 70,
    completedAt: null,
    transcriptStorageReference: null,
    completionOutcome: null,
    debriefFeedback: null,
    debriefTips: [],
    terminationReason: null,
    terminationMessage: null,
    meetingRetryAvailable: false,
    meetingRetriesRemaining: 0,
    behaviourLedger: [],
    ...overrides,
  }
}

// helper function to set up the mocked live meeting data for tests
function setup(meeting: Meeting, transcript: ConversationTurn[] = []) {
  mockedReturnToPreparation.mockReturnValue({
    mutate: vi.fn(), isPending: false, isError: false,
  } as unknown as ReturnType<typeof useReturnToPreparation>)
  mockedMeeting.mockReturnValue({
    data: meeting,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useMeeting>)

  mockedTranscript.mockReturnValue({
    data: transcript,
    isLoading: false,
  } as unknown as ReturnType<typeof useMeetingTranscript>)

  mockedPersonaState.mockReturnValue({
    data: personaState,
    isLoading: false,
  } as unknown as ReturnType<typeof usePersonaState>)

  mockedResponseOptions.mockReturnValue({
    data: { available: false, options: [], interactionMode: 'FREEFORM', sourceSequence: 0, unavailableReason: null },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useMeetingResponseOptions>)

  mockedRetryMeeting.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useRetryMeeting>)

  mockedRetryEngagement.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useRetryEngagement>)

  mockedMeetingSocket.mockReturnValue({
    streamingText: '',
    isStreaming: false,
    error: null,
    personaState: null,
    latestSignals: [],
    termination: null,
    guidedOptionsPending: false,
    guidedOptionsError: null,
    behaviourFeedback: null,
    sendMessage: vi.fn(),
  } as unknown as ReturnType<typeof useMeetingSocket>)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/engagements/eng-1/meetings/meeting-1']}>
      <Routes>
        <Route path="/dashboard/engagements/:engagementId/meetings/:meetingId" element={<LiveMeetingPage />} />
        <Route path="/dashboard/engagements/:engagementId/preparation" element={<div>Meeting preparation page</div>} />
        <Route path="/dashboard/engagements/:engagementId/proposal" element={<div>Proposal page</div>} />
        <Route path="/dashboard/engagements/:engagementId/intelligence" element={<div>Client intelligence page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('LiveMeetingPage states', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['EASY', 70, 14, 'the client explains concerns clearly'],
    ['MEDIUM', 70, 14, 'use focused follow-ups'],
    ['HARD', 80, 12, 'reconcile competing priorities'],
  ] as const)('shows saved %s expectations and meeting limits', (difficulty, meetingThreshold, meetingTurnLimit, expectation) => {
    setup(makeMeeting({ difficulty, meetingThreshold, meetingTurnLimit }))
    renderPage()
    expect(screen.getByText(new RegExp(expectation))).toHaveTextContent("Build the client's trust, interest and patience")
    expect(screen.getByText(new RegExp(expectation))).toHaveTextContent(`up to ${meetingTurnLimit} responses`)
  })

  it.each(['GUIDED', 'FREEFORM'] as const)('sends typed responses without requesting choices when the API reports %s', async (interactionMode) => {
    setup(makeMeeting({ interactionMode }))
    renderPage()

    const input = screen.getByRole('textbox', { name: 'Message Sarah Chen' })
    expect(screen.queryByLabelText('Suggested replies')).not.toBeInTheDocument()
    expect(mockedResponseOptions).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()

    fireEvent.change(input, { target: { value: '  Which constraint matters most?  ' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    })
    expect(mockedMeetingSocket.mock.results.at(-1)?.value.sendMessage).toHaveBeenCalledWith('Which constraint matters most?')
  })

  it('holds the message until the live channel is connected', async () => {
    setup(makeMeeting({ status: 'IN_PROGRESS' }))
    const socket = mockedMeetingSocket('meeting-1')
    const sendMessage = vi.fn()
    mockedMeetingSocket.mockReturnValue({ ...socket, connected: false, sendMessage })
    renderPage()

    const input = screen.getByRole('textbox', { name: 'Message Sarah Chen' })
    fireEvent.change(input, { target: { value: 'Which constraint matters most?' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(screen.getByText(/Connecting to the meeting/)).toBeInTheDocument()
    expect(sendMessage).not.toHaveBeenCalled()
    expect(input).toHaveValue('Which constraint matters most?')
  })

  it('keeps the learner’s text in the box when the message was not delivered', async () => {
    setup(makeMeeting({ status: 'IN_PROGRESS' }))
    const socket = mockedMeetingSocket('meeting-1')
    mockedMeetingSocket.mockReturnValue({ ...socket, sendMessage: vi.fn().mockResolvedValue(false) })
    renderPage()

    const input = screen.getByRole('textbox', { name: 'Message Sarah Chen' })
    fireEvent.change(input, { target: { value: 'Which constraint matters most?' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    })

    expect(input).toHaveValue('Which constraint matters most?')
  })

  // empty state when user has not 
  it('shows the empty-transcript placeholder when there are no turns yet', () => {
    setup(makeMeeting({ status: 'IN_PROGRESS' }), [])
    renderPage()

    expect(screen.getByText('Begin with a focused discovery question.')).toBeInTheDocument()
  })
})

describe('LiveMeetingPage status', () => {
  beforeEach(() => vi.clearAllMocks())

  it('replaces the transcript with a passed debrief and a Continue button', () => {
    setup(
      makeMeeting({
        status: 'COMPLETED',
        completionOutcome: 'PASSED',
        debriefFeedback: 'You navigated the discovery conversation well.',
        debriefTips: ['Keep connecting solutions back to stated priorities.'],
      }),
      [{ id: 't1', meetingId: 'meeting-1', actor: 'LEARNER', content: 'Hello', sequence: 0, signals: null, createdAt: '2026-08-01T10:00:00Z' }],
    )
    renderPage()

    expect(screen.getByText('Meeting passed')).toBeInTheDocument()
    expect(screen.getByText('You navigated the discovery conversation well.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to the proposal' })).toBeInTheDocument()

    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('shows a failed debrief with a retry option instead of the live transcript', () => {
    setup(
      makeMeeting({
        status: 'COMPLETED',
        completionOutcome: 'FAILED',
        debriefFeedback: 'The relationship broke down before you reached a next step.',
        debriefTips: ['Address objections directly before moving on.'],
        meetingRetryAvailable: true,
        meetingRetriesRemaining: 2,
      }),
      [],
    )
    renderPage()

    expect(screen.getByText('Meeting not passed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Retry live meeting \(2 remaining\)/ })).toBeInTheDocument()
    expect(screen.getByText('Begin with a focused discovery question.')).toBeInTheDocument()
  })
})

describe('LiveMeetingPage retry actions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starts the live retry in the same engagement', async () => {
    setup(makeMeeting({ status: 'COMPLETED', completionOutcome: 'FAILED', meetingRetryAvailable: true, meetingRetriesRemaining: 2 }))
    const mutate = vi.fn()
    mockedRetryMeeting.mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useRetryMeeting>)
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Retry live meeting (2 remaining)' }))

    expect(mutate).toHaveBeenCalledWith(undefined, expect.objectContaining({ onSuccess: expect.any(Function) }))
    expect(mockedRetryMeeting).toHaveBeenCalledWith('meeting-1', 'eng-1')
    expect(mockedRetryEngagement.mock.results.at(-1)?.value.mutate).not.toHaveBeenCalled()
  })

  it('returns to preparation after performance retries are exhausted', async () => {
    setup(makeMeeting({ status: 'COMPLETED', completionOutcome: 'FAILED', terminationReason: 'RELATIONSHIP_THRESHOLD_BREACH', terminationMessage: 'The client ended the meeting.' }))
    const mutate = vi.fn((_variables, options) => options.onSuccess())
    mockedReturnToPreparation.mockReturnValue({ mutate, isPending: false, isError: false } as unknown as ReturnType<typeof useReturnToPreparation>)
    renderPage()

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Return to meeting preparation' }).at(-1)!)
    })

    expect(screen.getByText('Meeting preparation page')).toBeInTheDocument()
    expect(mutate).toHaveBeenCalledOnce()
    expect(mockedRetryEngagement.mock.results.at(-1)?.value.mutate).not.toHaveBeenCalled()
  })

  it('starts a new engagement after an unprofessional-conduct termination', async () => {
    setup(makeMeeting({ status: 'COMPLETED', completionOutcome: 'FAILED', terminationReason: 'UNPROFESSIONAL_CONDUCT', terminationMessage: 'The client ended the meeting.' }))
    const mutate = vi.fn((_variables, options) => options.onSuccess({ id: 'eng-2' }))
    mockedRetryEngagement.mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useRetryEngagement>)
    renderPage()

    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Retry this lead from the start' }).at(-1)!)
    })

    expect(screen.getByText('Client intelligence page')).toBeInTheDocument()
    expect(mutate).toHaveBeenCalledOnce()
    expect(mockedReturnToPreparation.mock.results.at(-1)?.value.mutate).not.toHaveBeenCalled()
  })

  it('continues to the proposal after passing the meeting', async () => {
    setup(makeMeeting({ status: 'COMPLETED', completionOutcome: 'PASSED' }))
    renderPage()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Continue to the proposal' }))
    })

    expect(screen.getByText('Proposal page')).toBeInTheDocument()
  })
})

describe('LiveMeetingPage without numbers', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows the client by name and describes the last answer in words, never as scores (SRS FR-14)', () => {
    setup(
      makeMeeting({
        behaviourLedger: [{
          quality: 'STRONG_DISCOVERY',
          trustDelta: 6,
          interestDelta: 4,
          patienceDelta: -2,
          verifiedBehaviours: ['asked_open_question'],
          explanation: 'You asked what would make the time worthwhile.',
          nextBestAction: 'Ask which site loses the most time.',
        }],
      }),
      [{ id: 't1', meetingId: 'meeting-1', actor: 'PERSONA', content: 'Thanks for coming.', sequence: 0, signals: null, createdAt: '2026-08-01T10:00:00Z' }],
    )
    renderPage()

    expect(screen.getByLabelText('Conversation with Sarah Chen')).toBeInTheDocument()
    expect(screen.getByText('They trust you a little more. Their interest went up. It cost a little of their patience.')).toBeInTheDocument()
    expect(screen.queryByText(/\/100|\+6|points to threshold/)).not.toBeInTheDocument()
  })
})

describe('LiveMeetingPage client name', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => { lookups.current = { ...lookups.defaults } })

  it('names the contact the learner wrote to when the scenario personas are not available', () => {
    lookups.current = {
      engagement: { scenarioId: 'scn-1', leadCompanyName: 'AeroVector', contactPersonaId: 'persona-1', contactName: 'Elena Vargas Atlas', contactJobTitle: 'VP Asset Operations' },
      scenario: undefined,
    }
    setup(makeMeeting({}))
    renderPage()

    expect(screen.getByLabelText('Message Elena Vargas Atlas')).toBeInTheDocument()
    expect(screen.getByText('VP Asset Operations · AeroVector')).toBeInTheDocument()
    expect(screen.queryByText('The client')).not.toBeInTheDocument()
  })
})

describe('LiveMeetingPage wrap-up', () => {
  beforeEach(() => vi.clearAllMocks())

  const learnerTurns = (count: number): ConversationTurn[] => Array.from({ length: count }, (_, index) => ({
    id: `turn-${index}`, meetingId: 'meeting-1', actor: 'LEARNER', content: `Question ${index + 1}`,
    sequence: index * 2, signals: null, createdAt: '2026-10-07T05:30:00Z',
  }))

  function withSocket(signals: string[], state: PersonaState | null = null) {
    mockedMeetingSocket.mockReturnValue({
      streamingText: '', isStreaming: false, error: null, personaState: state, latestSignals: signals,
      termination: null, guidedOptionsPending: false, guidedOptionsError: null, behaviourFeedback: null, sendMessage: vi.fn(),
    } as unknown as ReturnType<typeof useMeetingSocket>)
  }

  it('promises the meeting will close only once the scores pass and three turns are done', () => {
    setup(makeMeeting({}), learnerTurns(3))
    renderPage()

    expect(screen.getByText('Sarah Chen is ready to wrap up.')).toBeInTheDocument()
  })

  it('does not promise a close before the third turn, even with passing scores', () => {
    setup(makeMeeting({}), learnerTurns(2))
    renderPage()

    expect(screen.queryByText('Sarah Chen is ready to wrap up.')).not.toBeInTheDocument()
  })

  it('says the client is not convinced when they signal a close the scores do not allow', () => {
    setup(makeMeeting({}), learnerTurns(5))
    withSocket(['client_ready_to_close'], { ...personaState, trust: 55 })
    renderPage()

    expect(screen.queryByText('Sarah Chen is ready to wrap up.')).not.toBeInTheDocument()
    expect(screen.getByText('Sarah Chen is trying to wrap up, but is not convinced yet.')).toBeInTheDocument()
  })

  it('still says so after a reload, from the signals saved on the client’s last reply', () => {
    const goodbye: ConversationTurn = {
      id: 'turn-goodbye', meetingId: 'meeting-1', actor: 'PERSONA', content: 'I will see you on Friday.',
      sequence: 99, signals: 'client_ready_to_close, client_committed_next_step', createdAt: '2026-10-07T05:40:00Z',
    }
    setup(makeMeeting({}), [...learnerTurns(5), goodbye])
    withSocket([], { ...personaState, trust: 55 })
    renderPage()

    expect(screen.getByText('Sarah Chen is trying to wrap up, but is not convinced yet.')).toBeInTheDocument()
  })
})
