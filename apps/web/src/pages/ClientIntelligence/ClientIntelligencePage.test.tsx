import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import ClientIntelligencePage from './ClientIntelligencePage'
import { useCompleteResearch, useResearch, useResearchGateStatus, useResearchSourceDeck, useSaveResearch } from '@/api/hooks/useLeads'
import { useEngagement } from '@/api/hooks/useEngagements'
import type { ResearchArtifact, ResearchEvidence } from '@/api/types'

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

  it('shows the outreach checklist in words and a loading state while saving a hypothesis', async () => {
    const user = userEvent.setup()
    setup([], true)
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Hypothesis' }))
    expect(screen.getByText('You know who makes the decision')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Add hypothesis/i }))
    expect(screen.getByText('Saving hypothesis')).toBeInTheDocument()
  })
})
