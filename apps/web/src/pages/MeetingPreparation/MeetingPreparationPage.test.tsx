import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import MeetingPreparationPage from './MeetingPreparationPage'
import {
  useMeetingPreparation,
  useStartMeeting,
  useUpdateMeetingPreparation,
} from '@/api/hooks/useMeeting'
import type { MeetingPreparation } from '@/api/types'
import { useScenario } from '@/api/hooks/useScenarios'
import { useShellEngagement } from '@/components/shell/useShellEngagement'

vi.mock('@/api/hooks/useMeeting', () => ({
  useMeetingPreparation: vi.fn(),
  useUpdateMeetingPreparation: vi.fn(),
  useStartMeeting: vi.fn(),
}))
vi.mock('@/components/shared/ObjectiveTourProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/api/hooks/useScenarios', () => ({ useScenario: vi.fn(), }))
vi.mock('@/components/shell/useShellEngagement', () => ({ useShellEngagement: vi.fn(), }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/components/shared/ErrorState', () => ({ default: () => <div>Error...</div> }))

// mocks matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// typed mock references
const mockedPreparation = vi.mocked(useMeetingPreparation)
const mockedUpdatePreparation = vi.mocked(useUpdateMeetingPreparation)
const mockedStartMeeting = vi.mocked(useStartMeeting)
const mockedScenario = vi.mocked(useScenario)
const mockedShellEngagement = vi.mocked(useShellEngagement)

// helper function to set up the mocked meeting preparation data for tests
function setup(preparation: Partial<MeetingPreparation>, isStarting = false) {
  mockedPreparation.mockReturnValue({
    data: {
      id: 'prep-1',
      engagementId: 'eng-1',
      objective: '',
      agenda: [],
      discoveryQuestions: [],
      readinessScore: 0,
      ready: false,
      ...preparation,
    } as MeetingPreparation,
    isLoading: false,
    isError: false,
  } as unknown as ReturnType<typeof useMeetingPreparation>)

  mockedUpdatePreparation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof useUpdateMeetingPreparation>)

  mockedStartMeeting.mockReturnValue({
    mutate: vi.fn(),
    isPending: isStarting,
  } as unknown as ReturnType<typeof useStartMeeting>)

  mockedShellEngagement.mockReturnValue({
    engagement: {
      scenarioId: 'scenario-1',
      personaId: 'persona-1',
    } as never,
    engagementId: 'eng-1',
    viewingPhase: 'MEETING_PREPARATION',
  })

  mockedScenario.mockReturnValue({
    data: {
      personas: [
        {
          id: 'persona-1',
          name: 'Elena Vargas Atlas',
        },
      ],
    },
  } as never)
}

// renders the meeting preparation page with the required router
function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/engagements/eng-1/preparation']}>
      <Routes>
        <Route
          path="/dashboard/engagements/:engagementId/preparation"
          element={<MeetingPreparationPage />}
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('MeetingPreparationPage readiness labels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('reports agenda readiness as zero points with no meaningful items', () => {
    setup({ objective: 'Test objective', agenda: [], discoveryQuestions: [] })
    renderPage()

    expect(screen.getByText('Agenda — 0/40 points (10 points each)')).toBeInTheDocument()
    expect(screen.getByText('Discovery questions — 0/40 points (8 points each)')).toBeInTheDocument()
    expect(screen.getByText('50 more points needed to reach readiness.')).toBeInTheDocument()
  })

  it('awards agenda points for three meaningful agenda items', () => {
    setup({
      agenda: ['Discuss meeting objectives', 'Explore current issues', 'Agree next steps'],
      discoveryQuestions: [],
    })
    renderPage()

    expect(screen.getByText('Agenda — 30/40 points (10 points each)')).toBeInTheDocument()
    expect(screen.getByText('40 more points needed to reach readiness.')).toBeInTheDocument()
  })

  it('allows adding a 4th agenda item, over cap', async () => {
    const user = userEvent.setup()
    setup({
      agenda: ['Intro', 'Discovery', 'Next steps'],
      discoveryQuestions: [],
    })
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Add agenda item' }))

    // the editor should still allow additional agenda items beyond the minimum readiness threshold
    expect(screen.getByLabelText('Agenda item 4')).toBeInTheDocument()
  })

  it('shows a spinner while the meeting is opening', () => {
    setup({
      objective: 'Confirm client priorities',
      agenda: ['Opening', 'Discovery', 'Next steps'],
      discoveryQuestions: ['Question one', 'Question two', 'Question three'],
    }, true)
    renderPage()

    expect(screen.getByText('Opening meeting')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Opening meeting/i })).toBeDisabled()
  })

  it('tells the learner when the meeting could not be started', () => {
    setup({
      objective: 'Confirm client priorities',
      agenda: ['Opening', 'Discovery', 'Next steps'],
      discoveryQuestions: ['Question one', 'Question two', 'Question three'],
    })
    mockedStartMeeting.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      error: new Error('Network Error'),
    } as unknown as ReturnType<typeof useStartMeeting>)
    renderPage()

    expect(screen.getByText('Meeting could not be started')).toBeInTheDocument()
    expect(screen.getByText('Your preparation is saved. Try joining the meeting again.')).toBeInTheDocument()
  })
})
