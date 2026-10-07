import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AxiosError, type AxiosResponse } from 'axios'
import ClientIntelligencePage from './ClientIntelligencePage'
import { useCompleteResearch, useResearch, useResearchGateStatus, useResearchSourceDeck, useSaveResearch } from '@/api/hooks/useLeads'
import { useEngagement } from '@/api/hooks/useEngagements'
import type { ResearchArtifact, ResearchEvidence } from '@/api/types'
import { useShellStore } from '@/components/shell/shellStore'

// mock hooks and shared components for tests
vi.mock('@/api/hooks/useLeads', () => ({
  useResearch: vi.fn(),
  useSaveResearch: vi.fn(),
  useResearchSourceDeck: vi.fn(),
  useResearchGateStatus: vi.fn(),
  useCompleteResearch: vi.fn(),
}))
vi.mock('@/api/hooks/useEngagements', () => ({
  useEngagement: vi.fn(),
}))
vi.mock('@/components/shell/CompanyFile', () => ({
  default: () => <div>Company file</div>,
}))
vi.mock('@/components/shared/ObjectiveTourProvider', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/shared/LoadingState', () => ({
  default: () => <div>Loading...</div>,
}))
vi.mock('@/components/shared/ErrorState', () => ({
  default: () => <div>Error...</div>,
}))

// mock scrollIntoView / scrollTo for dropdowns and the reading pane
Element.prototype.scrollIntoView = vi.fn()
Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo

const mockedResearch = vi.mocked(useResearch)
const mockedSaveResearch = vi.mocked(useSaveResearch)
const mockedResearchSourceDeck = vi.mocked(useResearchSourceDeck)
const mockedGateStatus = vi.mocked(useResearchGateStatus)
const mockedCompleteResearch = vi.mocked(useCompleteResearch)
const mockedEngagement = vi.mocked(useEngagement)

const gate = {
  researchCompleted: false,
  evidenceCount: 1,
  requiredEvidenceCount: 2,
  hasStakeholderEvidence: false,
  hasHypothesis: false,
  confidencePercent: 20,
  requiredConfidencePercent: 40,
  ready: false,
  coverageCount: 1,
  requiredCoverageCount: 2,
  groundedHypothesis: false,
  reliabilityScore: 20,
  verificationScore: 20,
  relevanceScore: 20,
  coaching: ['Read the stakeholder material before writing a hypothesis.'],
}

const newsSource: ResearchArtifact = {
  id: 'src-1',
  title: 'Network delays clinical systems review',
  sourceType: 'Health Service Journal',
  summary: 'Staff enter the same details three times per admission.',
  evidenceType: 'COMPANY_NEWS',
  confidence: 'MEDIUM',
  origin: 'SCENARIO_CURATED',
  publishedOn: '2026-03-14',
  relevanceScore: 86,
  allowedFactKeys: [],
  correlatesWithEvidence: [],
  relevanceRationale: '',
  blocks: [
    { id: 'b1', type: 'PARAGRAPH', content: 'Staff at two sites re-enter patient details into three systems.', attribution: null, factIds: [], corpusChunkIds: [], selectable: true, purpose: 'FACT' },
  ],
}

const saveMutate = vi.fn()

function setup(evidence: ResearchEvidence[], isSaving = false) {
  mockedResearch.mockReturnValue({ data: evidence, isLoading: false, isError: false } as unknown as ReturnType<typeof useResearch>)
  mockedSaveResearch.mockReturnValue({ mutate: saveMutate, isPending: isSaving, isError: false } as unknown as ReturnType<typeof useSaveResearch>)
  mockedResearchSourceDeck.mockReturnValue({
    data: { sourcesByType: { COMPANY_NEWS: [newsSource] }, enrichmentPending: false },
    isFetching: false,
    isError: false,
  } as unknown as ReturnType<typeof useResearchSourceDeck>)
  mockedGateStatus.mockReturnValue({ data: gate } as unknown as ReturnType<typeof useResearchGateStatus>)
  mockedCompleteResearch.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: false } as unknown as ReturnType<typeof useCompleteResearch>)
  mockedEngagement.mockReturnValue({ data: undefined } as unknown as ReturnType<typeof useEngagement>)
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/engagements/eng-1/intelligence']}>
      <Routes>
        <Route path="/dashboard/engagements/:engagementId/intelligence" element={<ClientIntelligencePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ClientIntelligencePage research desk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the source as a document, with trust in words rather than a relevance percentage', () => {
    setup([])
    renderPage()

    expect(screen.getByRole('heading', { name: 'Network delays clinical systems review' })).toBeInTheDocument()
    expect(screen.getAllByText('Medium trust').length).toBeGreaterThan(0)
    expect(screen.queryByText(/86%/)).not.toBeInTheDocument()
  })

  it('saves a passage with the learner’s takeaway', async () => {
    const user = userEvent.setup()
    setup([])
    renderPage()

    await user.click(screen.getByRole('button', { name: 'Save this passage as evidence' }))
    await user.type(screen.getByLabelText('Your consulting takeaway'), 'Clinical time, not IT cost.')
    await user.click(screen.getByRole('button', { name: 'Add to evidence board' }))

    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceType: 'COMPANY_NEWS',
        sourceTitle: 'Network delays clinical systems review',
        note: 'Staff at two sites re-enter patient details into three systems.\n\nConsulting takeaway: Clinical time, not IT cost.',
      }),
      expect.anything(),
    )
  })

  it('asks before another passage replaces a written takeaway', async () => {
    const user = userEvent.setup()
    setup([])
    const twoPassages = {
      ...newsSource,
      blocks: [...newsSource.blocks, { ...newsSource.blocks[0], id: 'b2', content: 'Discharge summaries reach GPs four days late.' }],
    }
    mockedResearchSourceDeck.mockReturnValue({
      data: { sourcesByType: { COMPANY_NEWS: [twoPassages] }, enrichmentPending: false },
      isFetching: false,
      isError: false,
    } as unknown as ReturnType<typeof useResearchSourceDeck>)
    renderPage()

    const [first, second] = screen.getAllByRole('button', { name: 'Save this passage as evidence' })
    await user.click(first)
    await user.type(screen.getByLabelText('Your consulting takeaway'), 'Clinical time, not IT cost.')
    vi.mocked(Element.prototype.scrollIntoView).mockClear()
    await user.click(second)

    const warning = screen.getByText('You have not added this evidence yet. Opening the new passage will discard your takeaway.')
    expect(warning).toBeInTheDocument()
    // Scrolled into view, since the learner is usually down at the takeaway
    expect(vi.mocked(Element.prototype.scrollIntoView).mock.contexts).toContain(warning.closest('[role="alert"]'))
    await user.click(screen.getByRole('button', { name: 'Keep this draft' }))
    expect(screen.getByLabelText('Your consulting takeaway')).toHaveValue('Clinical time, not IT cost.')
    expect(screen.getByText('Staff at two sites re-enter patient details into three systems.', { selector: 'blockquote' })).toBeInTheDocument()

    await user.click(second)
    await user.click(screen.getByRole('button', { name: 'Discard and open new passage' }))
    expect(screen.getByLabelText('Your consulting takeaway')).toHaveValue('')
    expect(screen.getByText('Discharge summaries reach GPs four days late.', { selector: 'blockquote' })).toBeInTheDocument()
  })

  it('submits the research area and reliability actually chosen for a source the learner found', async () => {
    const user = userEvent.setup()
    setup([])
    renderPage()

    await user.click(screen.getByRole('tab', { name: /Evidence/ }))
    await user.click(screen.getByRole('button', { name: /Add source/i }))

    await user.click(screen.getByRole('combobox', { name: 'Research area' }))
    await user.click(await screen.findByRole('option', { name: 'Stakeholder profile' }))
    await user.click(screen.getByRole('combobox', { name: 'Reliability' }))
    await user.click(await screen.findByRole('option', { name: 'High' }))
    await user.type(screen.getByLabelText('Finding'), 'Test finding.')
    await user.click(screen.getByRole('button', { name: 'Add evidence' }))

    expect(saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({ evidenceType: 'STAKEHOLDER_PROFILE', confidence: 'HIGH', note: 'Test finding.' }),
      expect.anything(),
    )
  })

  it('shows the empty hypothesis state before a hypothesis is added', async () => {
    const user = userEvent.setup()
    setup([], true)
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Hypothesis' }))
    expect(screen.getByText(
      'No hypothesis yet. Once you have a few pieces of evidence, say what you think their real problem is — and who can act on it.',),
    ).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Add hypothesis/i }))
    expect(screen.getByText('Saving hypothesis')).toBeInTheDocument()
  })

  it('has Dana point at the checklist only when the gate itself refused', () => {
    setup([])
    const refused = new AxiosError('Unprocessable', 'ERR_BAD_REQUEST', undefined, undefined, {
      status: 422,
      data: { status: 422, detail: 'Research is not yet complete (evidence=1/2)' },
    } as AxiosResponse)
    mockedCompleteResearch.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: true, error: refused } as unknown as ReturnType<typeof useCompleteResearch>)
    renderPage()

    expect(useShellStore.getState().mentorLine).toBe('The engagement could not move on yet. Tick off what is missing, then try again.')
  })

  it('has Dana blame the connection, not the research, when the request never arrived', () => {
    setup([])
    mockedCompleteResearch.mockReturnValue({ mutate: vi.fn(), isPending: false, isError: true, error: new AxiosError('Network Error', 'ERR_NETWORK') } as unknown as ReturnType<typeof useCompleteResearch>)
    renderPage()

    expect(useShellStore.getState().mentorLine).toBe('The engagement could not move on just now. Your research is saved; check your connection, then try again.')
  })
})
