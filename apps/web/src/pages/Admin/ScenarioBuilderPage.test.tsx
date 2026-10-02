import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ScenarioBuilderPage from './ScenarioBuilderPage'
import {
  useAddPersona, useAdminScenarioCatalog, useArchiveScenario, useCreateScenario, usePublishScenario,
  useUpdateRubricWeights, useUpdateGameplayDifficulty, useUploadKnowledgeDocument, useScenarioAuthoring,
  useGetKnowledgeDocuments, useDeleteKnowledgeDocument, useUpdateKnowledgeDocument,
} from '@/api/hooks/useAdminScenarios'
import type { GameplayDifficultyProfile, ScenarioSummary } from '@/api/types'

vi.mock('@/api/hooks/useAdminScenarios', () => ({
  useAddPersona: vi.fn(), useAdminScenarioCatalog: vi.fn(), useArchiveScenario: vi.fn(),
  useCreateScenario: vi.fn(), usePublishScenario: vi.fn(), useUpdateRubricWeights: vi.fn(),
  useUpdateGameplayDifficulty: vi.fn(), useUploadKnowledgeDocument: vi.fn(), useScenarioAuthoring: vi.fn(),
  useGetKnowledgeDocuments: vi.fn(), useDeleteKnowledgeDocument: vi.fn(), useUpdateKnowledgeDocument: vi.fn(),
}))

vi.mock('@/components/admin/ScenarioBlueprintWorkspace', () => ({ default: () => <div>Authoring blueprint</div> }))
vi.mock('@/components/shared/LoadingState', () => ({ default: () => <div>Loading...</div> }))
vi.mock('@/components/shared/ErrorState', () => ({ default: () => <div>Error...</div> }))

const createMutate = vi.fn()
const addPersonaMutate = vi.fn()
const publishMutate = vi.fn()
const archiveMutate = vi.fn()
const gameplayDifficulty: GameplayDifficultyProfile = {
  level: 'MEDIUM', researchArtifactsPerAction: 4, distractorArtifactsPerAction: 1, contradictionCount: 1,
  initialTrust: 50, initialInterest: 50, initialPatience: 50, meetingTurnLimit: 10, budgetVisible: false,
  timelinePressureDays: 30, requiredEvidenceCount: 3, requiredConfidencePercent: 40,
  outreachAcceptanceThreshold: 65, proposalEvidenceCoverageThreshold: 60, personaResistance: 50, scoringTolerance: 100,
}
const scenario: ScenarioSummary = {
  id: 'scn-1', title: 'Protecting dispatch reliability', industry: 'Utilities',
  description: 'Validate the operating constraint and agree a pilot.', difficulty: 3, version: 1,
  status: 'DRAFT', personas: [], rubricWeights: {}, gameplayDifficulty,
  difficultyProfile: { informationAmbiguity: 3, stakeholderComplexity: 3, commercialPressure: 3 },
  briefing: {
    consultantRole: 'Associate consultant', objective: 'Agree a credible pilot', successCriteria: [],
    simulatedDays: 30, businessSituation: 'Dispatch reliability is under pressure.',
    observableSymptom: 'Delayed dispatch', consultingMandate: 'Validate the constraint', unknownsToValidate: [],
  },
}

function setupEditor(overrides: Partial<ScenarioSummary> = {}, readyToPublish = false) {
  vi.mocked(useScenarioAuthoring).mockReturnValue({
    data: { scenario: { ...scenario, ...overrides }, readiness: { readyToPublish } }, isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useScenarioAuthoring>)
}

function renderPage(search = '') {
  return render(<MemoryRouter initialEntries={[`/dashboard/admin/scenarios${search}`]}><ScenarioBuilderPage /></MemoryRouter>)
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(useAdminScenarioCatalog).mockReturnValue({
    data: { items: [scenario], totalElements: 1, totalPages: 1, page: 0, size: 12 }, isLoading: false, isError: false,
  } as unknown as ReturnType<typeof useAdminScenarioCatalog>)
  setupEditor()
  vi.mocked(useCreateScenario).mockReturnValue({ mutate: createMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useCreateScenario>)
  vi.mocked(useAddPersona).mockReturnValue({ mutate: addPersonaMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useAddPersona>)
  vi.mocked(usePublishScenario).mockReturnValue({ mutate: publishMutate, isPending: false } as unknown as ReturnType<typeof usePublishScenario>)
  vi.mocked(useArchiveScenario).mockReturnValue({ mutate: archiveMutate, isPending: false } as unknown as ReturnType<typeof useArchiveScenario>)
  vi.mocked(useUpdateRubricWeights).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useUpdateRubricWeights>)
  vi.mocked(useUpdateGameplayDifficulty).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useUpdateGameplayDifficulty>)
  vi.mocked(useUploadKnowledgeDocument).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useUploadKnowledgeDocument>)
  vi.mocked(useGetKnowledgeDocuments).mockReturnValue({ data: [], isLoading: false } as unknown as ReturnType<typeof useGetKnowledgeDocuments>)
  vi.mocked(useDeleteKnowledgeDocument).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useDeleteKnowledgeDocument>)
  vi.mocked(useUpdateKnowledgeDocument).mockReturnValue({ mutate: vi.fn() } as unknown as ReturnType<typeof useUpdateKnowledgeDocument>)
})

describe('ScenarioBuilderPage library and drafts', () => {
  it('shows the loading state before the library arrives', () => {
    vi.mocked(useAdminScenarioCatalog).mockReturnValue({ isLoading: true } as unknown as ReturnType<typeof useAdminScenarioCatalog>)
    renderPage()

    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('shows an error when the library cannot be loaded', () => {
    vi.mocked(useAdminScenarioCatalog).mockReturnValue({ isError: true } as unknown as ReturnType<typeof useAdminScenarioCatalog>)
    renderPage()

    expect(screen.getByText('Error...')).toBeInTheDocument()
  })

  it('opens the selected scenario from the library', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('button', { name: 'Open editor' }))

    expect(screen.getByText('Scenario editor')).toBeInTheDocument()
    expect(useScenarioAuthoring).toHaveBeenCalledWith('scn-1')
    expect(useAdminScenarioCatalog).toHaveBeenLastCalledWith(expect.anything(), false)
  })

  it('requires the client situation before creating a draft, then opens the created scenario', async () => {
    const user = userEvent.setup()
    createMutate.mockImplementation((_values, options) => options.onSuccess({ id: 'scn-2' }))
    renderPage()
    await user.click(screen.getByRole('button', { name: 'New scenario' }))

    const modal = screen.getByRole('dialog', { name: 'Create a new scenario' })
    expect(within(modal).getByRole('button', { name: 'Create draft' })).toBeDisabled()
    await user.type(within(modal).getByLabelText('Title'), 'Funding a pilot')
    await user.type(within(modal).getByLabelText('Industry'), 'Utilities')
    expect(within(modal).getByRole('button', { name: 'Create draft' })).toBeDisabled()
    await user.type(within(modal).getByLabelText('Client situation'), 'Validate the operating constraint.')
    await user.selectOptions(within(modal).getByLabelText('Difficulty'), '4')
    await user.click(within(modal).getByRole('button', { name: 'Create draft' }))

    expect(createMutate).toHaveBeenCalledWith({ title: 'Funding a pilot', industry: 'Utilities', description: 'Validate the operating constraint.', difficulty: 4 }, expect.anything())
    expect(useScenarioAuthoring).toHaveBeenCalledWith('scn-2')
    expect(screen.getByText('Scenario editor')).toBeInTheDocument()
  })

  it('keeps the draft details available when creation fails', async () => {
    const user = userEvent.setup()
    vi.mocked(useCreateScenario).mockReturnValue({ mutate: createMutate, isError: true } as unknown as ReturnType<typeof useCreateScenario>)
    renderPage()
    await user.click(screen.getByRole('button', { name: 'New scenario' }))
    const modal = screen.getByRole('dialog', { name: 'Create a new scenario' })
    await user.type(within(modal).getByLabelText('Title'), 'Funding a pilot')

    expect(within(modal).getByText('Could not create scenario')).toBeInTheDocument()
    expect(within(modal).getByLabelText('Title')).toHaveValue('Funding a pilot')
  })
})

describe('ScenarioBuilderPage personas and publication', () => {
  it('requires the contact identity, saves their concerns and goals, then clears the form', async () => {
    const user = userEvent.setup()
    addPersonaMutate.mockImplementation((_values, options) => options.onSuccess())
    renderPage('?scenario=scn-1')
    await user.click(screen.getByRole('button', { name: 'Personas (0)' }))
    expect(screen.getByRole('button', { name: 'Add persona' })).toBeDisabled()

    const fields = {
      Name: 'Jane Roe', 'Job title': 'CFO', Organisation: 'Company Test',
      'Communication style': 'Direct', 'Visible concerns': 'Commercial risk',
      'Hidden concerns (never shown to learner)': 'Board approval', 'Business goals': 'Fund a credible pilot',
    }
    for (const [label, value] of Object.entries(fields)) {
      await user.click(screen.getByLabelText(label))
      await user.paste(value)
    }
    await user.click(screen.getByRole('button', { name: 'Add persona' }))

    expect(useAddPersona).toHaveBeenCalledWith('scn-1')
    expect(addPersonaMutate).toHaveBeenCalledWith({ name: 'Jane Roe', jobTitle: 'CFO', organisation: 'Company Test', communicationStyle: 'Direct', visibleConcerns: 'Commercial risk', hiddenConcerns: 'Board approval', businessGoals: 'Fund a credible pilot' }, expect.anything())
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Add persona' })).toBeDisabled()
  })

  it('prevents publication until the backend checklist is complete', async () => {
    const user = userEvent.setup()
    renderPage('?scenario=scn-1')
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled()
    expect(publishMutate).not.toHaveBeenCalled()
  })

  it('publishes a ready draft using the selected scenario id', async () => {
    const user = userEvent.setup()
    setupEditor({}, true)
    renderPage('?scenario=scn-1')
    await user.click(screen.getByRole('button', { name: 'Publish' }))

    expect(publishMutate).toHaveBeenCalledWith('scn-1')
  })

  it('locks published personas and rules while allowing the revision to be archived', async () => {
    const user = userEvent.setup()
    setupEditor({ status: 'ACTIVE' }, true)
    renderPage('?scenario=scn-1')
    await user.click(screen.getByRole('button', { name: 'Personas (0)' }))

    expect(screen.getByText('Personas are locked in this published revision. Create a revision to make changes.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add persona' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Archive' }))
    expect(archiveMutate).toHaveBeenCalledWith('scn-1')
  })
})
