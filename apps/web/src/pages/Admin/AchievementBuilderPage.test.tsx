import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AchievementBuilderPage from './AchievementBuilderPage'
import {
  useAdminAchievements, useCreateAchievement, useSetAchievementActive, useUpdateAchievement,
} from '@/api/hooks/useAdminAchievements'
import { useAdminScenarioCatalog } from '@/api/hooks/useAdminScenarios'
import type { AchievementAdminView, ConditionNode } from '@/api/types'

vi.mock('@/api/hooks/useAdminAchievements', () => ({
  useAdminAchievements: vi.fn(), useCreateAchievement: vi.fn(),
  useSetAchievementActive: vi.fn(), useUpdateAchievement: vi.fn(),
}))
vi.mock('@/api/hooks/useAdminScenarios', () => ({ useAdminScenarioCatalog: vi.fn() }))

const createMutate = vi.fn()
const rule: ConditionNode = {
  kind: 'LEAF', operator: null, children: null, type: 'MIN_ENGAGEMENTS_COMPLETED', competencyName: null, threshold: 1,
}

function setup(achievements: AchievementAdminView[] = []) {
  vi.mocked(useAdminAchievements).mockReturnValue({ data: achievements, isLoading: false, isError: false } as unknown as ReturnType<typeof useAdminAchievements>)
  vi.mocked(useCreateAchievement).mockReturnValue({ mutate: createMutate, isPending: false, isError: false } as unknown as ReturnType<typeof useCreateAchievement>)
  vi.mocked(useUpdateAchievement).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useUpdateAchievement>)
  vi.mocked(useSetAchievementActive).mockReturnValue({ mutate: vi.fn(), isPending: false } as unknown as ReturnType<typeof useSetAchievementActive>)
  vi.mocked(useAdminScenarioCatalog).mockReturnValue({
    data: { items: [{ id: 'scn-live', title: 'AeroVector: crew rostering' }], totalElements: 1, totalPages: 1, page: 0, size: 48 },
    isLoading: false,
  } as unknown as ReturnType<typeof useAdminScenarioCatalog>)
}

describe('AchievementBuilderPage scope and icons', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a generic badge with no scenario', async () => {
    const user = userEvent.setup()
    setup()
    render(<AchievementBuilderPage />)
    await user.click(screen.getByRole('button', { name: 'New achievement' }))
    await user.type(screen.getByLabelText('Achievement name'), 'First run')
    await user.selectOptions(screen.getByLabelText('Icon'), 'flag')
    await user.click(screen.getByRole('button', { name: 'Save achievement' }))

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'First run', iconKey: 'flag', scenarioId: null }), expect.anything())
  })

  it('needs a scenario before an exclusive badge can be saved', async () => {
    const user = userEvent.setup()
    setup()
    render(<AchievementBuilderPage />)
    await user.click(screen.getByRole('button', { name: 'New achievement' }))
    await user.type(screen.getByLabelText('Achievement name'), 'Rostering pro')
    await user.click(screen.getByLabelText('Exclusive: one scenario only'))

    expect(screen.getByRole('button', { name: 'Save achievement' })).toBeDisabled()

    await user.selectOptions(screen.getByLabelText('Scenario'), 'scn-live')
    await user.click(screen.getByRole('button', { name: 'Save achievement' }))

    expect(createMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Rostering pro', scenarioId: 'scn-live' }), expect.anything())
  })

  it('labels exclusive badges and warns when their scenario is archived', () => {
    setup([{
      id: 'a1', name: 'Rostering pro', description: '', iconKey: 'star', active: true, rule,
      scope: 'EXCLUSIVE', scenarioLineageId: 'lin-1', scenarioId: 'scn-old', scenarioTitle: 'AeroVector: crew rostering', scenarioLive: false,
    }])
    render(<AchievementBuilderPage />)

    expect(screen.getByText('Exclusive · AeroVector: crew rostering')).toBeInTheDocument()
    expect(screen.getByText("Scenario archived: can't be earned")).toBeInTheDocument()
  })

  it('offers only the competencies assessments score', async () => {
    const user = userEvent.setup()
    setup()
    render(<AchievementBuilderPage />)
    await user.click(screen.getByRole('button', { name: 'New achievement' }))
    const typeSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'MIN_COMPETENCY_SCORE'))!
    await user.selectOptions(typeSelect, 'MIN_COMPETENCY_SCORE')

    const competency = screen.getByLabelText('Competency') as HTMLSelectElement
    expect(Array.from(competency.options).map((o) => o.value).filter(Boolean))
      .toEqual(['Outreach Effectiveness', 'Relationship Building', 'Solution Alignment'])
  })
})

describe('AchievementBuilderPage condition sets', () => {
  beforeEach(() => vi.clearAllMocks())

  const conditionSelect = () => screen.getAllByRole('combobox').find((el) =>
    Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'MIN_ENGAGEMENTS_COMPLETED')) as HTMLSelectElement
  const options = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.value)

  it('hides career-wide conditions for an exclusive badge and removes them on switching', async () => {
    const user = userEvent.setup()
    setup()
    render(<AchievementBuilderPage />)
    await user.click(screen.getByRole('button', { name: 'New achievement' }))
    await user.selectOptions(conditionSelect(), 'MIN_WIN_RATE_PERCENT')
    expect(options(conditionSelect())).toContain('MIN_WIN_RATE_PERCENT')

    await user.click(screen.getByLabelText('Exclusive: one scenario only'))

    expect(options(conditionSelect())).not.toContain('MIN_WIN_RATE_PERCENT')
    expect(options(conditionSelect())).not.toContain('MIN_DISTINCT_SCENARIOS_COMPLETED')
    expect(options(conditionSelect())).toContain('MIN_RUNS_MATCHING')
    expect(conditionSelect().value).toBe('MIN_ENGAGEMENTS_COMPLETED')
  })

  it('sends a run condition with everything required in the same run', async () => {
    const user = userEvent.setup()
    setup()
    render(<AchievementBuilderPage />)
    await user.click(screen.getByRole('button', { name: 'New achievement' }))
    await user.type(screen.getByLabelText('Achievement name'), 'Hard win')
    await user.selectOptions(conditionSelect(), 'MIN_RUNS_MATCHING')
    await user.selectOptions(screen.getByLabelText('Difficulty at least'), 'HARD')
    await user.click(screen.getByLabelText('Meeting'))
    await user.click(screen.getByRole('button', { name: 'Save achievement' }))

    const sent = createMutate.mock.calls[0][0]
    const condition = sent.rule.children[0]
    expect(condition.type).toBe('MIN_RUNS_MATCHING')
    expect(condition.threshold).toBe(1)
    expect(condition.run).toMatchObject({ won: true, minDifficulty: 'HARD', firstAttemptStages: ['MEETING'] })
  })

  it('cannot save a run condition that requires nothing', async () => {
    const user = userEvent.setup()
    setup()
    render(<AchievementBuilderPage />)
    await user.click(screen.getByRole('button', { name: 'New achievement' }))
    await user.type(screen.getByLabelText('Achievement name'), 'Anything')
    await user.selectOptions(conditionSelect(), 'MIN_RUNS_MATCHING')
    await user.click(screen.getByLabelText('Win (proposal accepted)'))

    expect(screen.getByRole('button', { name: 'Save achievement' })).toBeDisabled()
  })
})
