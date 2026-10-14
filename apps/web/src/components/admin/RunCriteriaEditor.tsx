import { Checkbox, NumberInput, Select, SelectItem } from '@carbon/react'
import { COMPETENCIES } from '@/features/achievement/achievementPresentation'
import type { AssessedStage, Difficulty, RunCriteria } from '@/api/types'

const STAGES: { value: AssessedStage; label: string }[] = [
  { value: 'OUTREACH', label: 'Outreach' },
  { value: 'MEETING', label: 'Meeting' },
  { value: 'PROPOSAL', label: 'Proposal' },
]

/** Carbon's NumberInput reports '' when cleared: that means "not required". */
function optionalNumber(value: number | string | undefined | null): number | null {
  return value === '' || value === undefined || value === null || Number.isNaN(Number(value)) ? null : Number(value)
}

/** Edits what a single run must achieve, all in the same run. Every field is optional. */
export default function RunCriteriaEditor({ value, onChange, path }: {
  value: RunCriteria
  onChange: (value: RunCriteria) => void
  path: string
}) {
  const set = (patch: Partial<RunCriteria>) => onChange({ ...value, ...patch })
  const toggleStage = (stage: AssessedStage, checked: boolean) =>
    set({ firstAttemptStages: checked ? [...value.firstAttemptStages, stage] : value.firstAttemptStages.filter((s) => s !== stage) })

  return (
    <fieldset style={{ display: 'grid', gap: '0.75rem', border: '1px solid #e0e0e0', padding: '0.75rem' }}>
      <legend style={{ fontSize: '0.75rem', color: '#525252' }}>In the same run, the learner must…</legend>
      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <Checkbox id={`run-won-${path}`} labelText="Win (proposal accepted)" checked={Boolean(value.won)}
          onChange={(_e, { checked }) => set({ won: checked || null })} />
        <Checkbox id={`run-retry-${path}`} labelText="Not be a retry" checked={Boolean(value.notARetry)}
          onChange={(_e, { checked }) => set({ notARetry: checked || null })} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <NumberInput id={`run-overall-${path}`} label="Overall score at least" allowEmpty size="sm" min={0} max={100}
          value={value.minOverallScore ?? ''} onChange={(_e, state) => set({ minOverallScore: optionalNumber(state?.value) })} />
        <NumberInput id={`run-every-${path}`} label="Every competency at least" allowEmpty size="sm" min={0} max={100}
          value={value.minEveryCompetencyScore ?? ''} onChange={(_e, state) => set({ minEveryCompetencyScore: optionalNumber(state?.value) })} />
        <Select id={`run-difficulty-${path}`} labelText="Difficulty at least" size="sm" value={value.minDifficulty ?? ''}
          onChange={(e) => set({ minDifficulty: (e.target.value || null) as Difficulty | null })}>
          <SelectItem value="" text="Any" />
          <SelectItem value="EASY" text="Easy" />
          <SelectItem value="MEDIUM" text="Medium" />
          <SelectItem value="HARD" text="Hard" />
        </Select>
        <NumberInput id={`run-hours-${path}`} label="Finished within (hours)" allowEmpty size="sm" min={1}
          value={value.maxHours ?? ''} onChange={(_e, state) => set({ maxHours: optionalNumber(state?.value) })} />
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <Select id={`run-competency-${path}`} labelText="A competency" size="sm" value={value.competencyName ?? ''}
          onChange={(e) => {
            const competencyName = e.target.value || null
            set({ competencyName, minCompetencyScore: competencyName ? value.minCompetencyScore ?? 80 : null })
          }}>
          <SelectItem value="" text="None" />
          {COMPETENCIES.map((c) => <SelectItem key={c} value={c} text={c} />)}
        </Select>
        {value.competencyName && (
          <NumberInput id={`run-competency-score-${path}`} label="…scored at least" size="sm" min={0} max={100}
            value={value.minCompetencyScore ?? 80}
            onChange={(_e, state) => set({ minCompetencyScore: optionalNumber(state?.value) ?? 0 })} />
        )}
      </div>

      <div>
        <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Pass on the first attempt</p>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {STAGES.map((stage) => (
            <Checkbox key={stage.value} id={`run-first-${stage.value}-${path}`} labelText={stage.label}
              checked={value.firstAttemptStages.includes(stage.value)}
              onChange={(_e, { checked }) => toggleStage(stage.value, checked)} />
          ))}
        </div>
      </div>
    </fieldset>
  )
}
