import { useState } from 'react'
import {
  Grid,
  Column,
  Heading,
  Stack,
  Tile,
  Button,
  TextInput,
  TextArea,
  Tag,
  InlineNotification,
  RadioButton,
  RadioButtonGroup,
  Select,
  SelectItem,
} from '@carbon/react'
import { Add, CheckmarkFilled, CloseFilled } from '@carbon/icons-react'
import {
  useAdminAchievements,
  useCreateAchievement,
  useSetAchievementActive,
  useUpdateAchievement,
} from '@/api/hooks/useAdminAchievements'
import AchievementRuleBuilder from '@/components/admin/AchievementRuleBuilder'
import { useAdminScenarioCatalog } from '@/api/hooks/useAdminScenarios'
import LoadingState from '@/components/shared/LoadingState'
import ErrorState from '@/components/shared/ErrorState'
import type { AchievementAdminView, ConditionNode, UpsertAchievementRequest } from '@/api/types'
import { ACHIEVEMENT_ICONS, achievementDescription, achievementIcon } from '@/features/achievement/achievementPresentation'
import { everyRunHasRequirement, pruneForScope } from '@/features/achievement/ruleScope'

const DEFAULT_RULE: ConditionNode = {
  kind: 'GROUP',
  operator: 'AND',
  children: [
    { kind: 'LEAF', operator: null, children: null, type: 'MIN_ENGAGEMENTS_COMPLETED', competencyName: null, threshold: 1 },
  ],
  type: null,
  competencyName: null,
  threshold: null,
}

function emptyForm(): UpsertAchievementRequest {
  return { name: '', description: '', iconKey: 'trophy', rule: DEFAULT_RULE, scenarioId: null }
}

/** Live scenarios an Exclusive badge can belong to, plus the current one if it is no longer Live. */
function ScenarioPicker({ value, currentTitle, onChange }: {
  value: string | null | undefined
  currentTitle?: string | null
  onChange: (scenarioId: string | null) => void
}) {
  const { data, isLoading } = useAdminScenarioCatalog({ status: 'ACTIVE', page: 0, size: 48 })
  const live = data?.items ?? []
  const missingCurrent = value && !live.some((scenario) => scenario.id === value)
  return (
    <Select
      id="achievement-scenario"
      labelText="Scenario"
      helperText="Only runs of this scenario count, across all its revisions."
      value={value ?? ''}
      disabled={isLoading}
      onChange={(e) => onChange(e.target.value || null)}
    >
      <SelectItem value="" text={isLoading ? 'Loading scenarios…' : 'Choose a scenario'} />
      {missingCurrent && <SelectItem value={value} text={`${currentTitle ?? 'Current scenario'} (archived)`} />}
      {live.map((scenario) => <SelectItem key={scenario.id} value={scenario.id} text={scenario.title} />)}
    </Select>
  )
}

function AchievementForm({
  initial,
  initialScenarioTitle,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial: UpsertAchievementRequest
  initialScenarioTitle?: string | null
  onSubmit: (request: UpsertAchievementRequest) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [form, setForm] = useState<UpsertAchievementRequest>(initial)
  const [exclusive, setExclusive] = useState(Boolean(initial.scenarioId))
  const knownIcon = ACHIEVEMENT_ICONS.some((option) => option.key === form.iconKey)
  const PreviewIcon = achievementIcon(form.iconKey)
  const incomplete = !form.name.trim() || (exclusive && !form.scenarioId) || !everyRunHasRequirement(form.rule)

  return (
    <Tile>
      <Stack gap={5}>
        <TextInput
          id="achievement-name"
          labelText="Achievement name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <TextArea
          id="achievement-description"
          labelText="Description (optional)"
          value={form.description ?? ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
          <Select
            id="achievement-icon"
            labelText="Icon"
            value={form.iconKey}
            onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
          >
            {!knownIcon && <SelectItem value={form.iconKey} text={`${form.iconKey} (shown as trophy)`} />}
            {ACHIEVEMENT_ICONS.map((option) => <SelectItem key={option.key} value={option.key} text={option.label} />)}
          </Select>
          <span aria-hidden style={{ paddingBottom: '0.5rem' }}><PreviewIcon size={24} /></span>
        </div>

        <RadioButtonGroup
          legendText="Who can earn it"
          name="achievement-scope"
          valueSelected={exclusive ? 'EXCLUSIVE' : 'GENERIC'}
          onChange={(value) => {
            const isExclusive = value === 'EXCLUSIVE'
            setExclusive(isExclusive)
            // Conditions an Exclusive badge can't use are removed (development: no confirmation needed).
            setForm(isExclusive ? { ...form, rule: pruneForScope(form.rule, true) } : { ...form, scenarioId: null })
          }}
        >
          <RadioButton id="achievement-scope-generic" value="GENERIC" labelText="Generic: counts every scenario" />
          <RadioButton id="achievement-scope-exclusive" value="EXCLUSIVE" labelText="Exclusive: one scenario only" />
        </RadioButtonGroup>

        {exclusive && (
          <ScenarioPicker
            value={form.scenarioId}
            currentTitle={initialScenarioTitle}
            onChange={(scenarioId) => setForm({ ...form, scenarioId })}
          />
        )}

        <div>
          <h5 style={{ marginBottom: '0.75rem' }}>Unlock rule</h5>
          <AchievementRuleBuilder node={form.rule} exclusive={exclusive} onChange={(rule) => setForm({ ...form, rule })} />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button
            onClick={() => onSubmit({ ...form, scenarioId: exclusive ? form.scenarioId : null })}
            disabled={incomplete || submitting}
          >
            Save achievement
          </Button>
          <Button kind="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Stack>
    </Tile>
  )
}

function AchievementRow({ achievement }: { achievement: AchievementAdminView }) {
  const [editing, setEditing] = useState(false)
  const updateAchievement = useUpdateAchievement(achievement.id)
  const setActive = useSetAchievementActive()

  if (editing) {
    return (
      <AchievementForm
        initial={{
          name: achievement.name,
          description: achievement.description,
          iconKey: achievement.iconKey,
          rule: achievement.rule,
          scenarioId: achievement.scope === 'EXCLUSIVE' ? achievement.scenarioId ?? null : null,
        }}
        initialScenarioTitle={achievement.scenarioTitle}
        submitting={updateAchievement.isPending}
        onCancel={() => setEditing(false)}
        onSubmit={(request) => updateAchievement.mutate(request, { onSuccess: () => setEditing(false) })}
      />
    )
  }

  return (
    <Tile>
      <Stack gap={3}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h5>{achievement.name}</h5>
            <p style={{ color: '#525252', fontSize: '0.875rem' }}>
              {achievementDescription(achievement.description)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {achievement.scope === 'EXCLUSIVE' ? (
              <Tag type="purple">Exclusive · {achievement.scenarioTitle ?? 'Unknown scenario'}</Tag>
            ) : (
              <Tag type="cool-gray">Generic</Tag>
            )}
            {achievement.scope === 'EXCLUSIVE' && achievement.scenarioLive === false && (
              <Tag type="red">Scenario archived: can't be earned</Tag>
            )}
            <Tag type={achievement.active ? 'green' : 'gray'}>{achievement.active ? 'Active' : 'Inactive'}</Tag>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button kind="tertiary" size="sm" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button
            kind={achievement.active ? 'danger--tertiary' : 'tertiary'}
            size="sm"
            renderIcon={achievement.active ? CloseFilled : CheckmarkFilled}
            onClick={() => setActive.mutate({ id: achievement.id, active: !achievement.active })}
            disabled={setActive.isPending}
          >
            {achievement.active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </Stack>
    </Tile>
  )
}

export default function AchievementBuilderPage() {
  const { data: achievements, isLoading, isError } = useAdminAchievements()
  const createAchievement = useCreateAchievement()
  const [creating, setCreating] = useState(false)

  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState />

  return (
    <Grid fullWidth style={{ padding: '2rem' }}>
      <Column lg={16} md={8} sm={4}>
        <Stack gap={6}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <Heading>Achievement Builder</Heading>
              <p style={{ color: '#525252', marginTop: '0.5rem' }}>
                Design gamification badges with nested AND/OR unlock rules — fully customisable
                without a deployment.
              </p>
            </div>
            {!creating && (
              <Button renderIcon={Add} onClick={() => setCreating(true)}>
                New achievement
              </Button>
            )}
          </div>

          {createAchievement.isError && (
            <InlineNotification kind="error" title="Could not save achievement" subtitle={saveErrorMessage(createAchievement.error)} />
          )}

          {creating && (
            <AchievementForm
              initial={emptyForm()}
              submitting={createAchievement.isPending}
              onCancel={() => setCreating(false)}
              onSubmit={(request) => createAchievement.mutate(request, { onSuccess: () => setCreating(false) })}
            />
          )}

          {(achievements ?? []).length === 0 && !creating ? (
            <Tile>
              <p style={{ color: '#525252' }}>No achievements defined yet. Create the first one above.</p>
            </Tile>
          ) : (
            <Stack gap={4}>
              {(achievements ?? []).map((a) => (
                <AchievementRow key={a.id} achievement={a} />
              ))}
            </Stack>
          )}
        </Stack>
      </Column>
    </Grid>
  )
}

/** The server's reason (e.g. an unknown competency) when there is one. */
function saveErrorMessage(error: unknown): string {
  const detail = (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail
  return detail ?? 'Check the rule tree and try again.'
}
