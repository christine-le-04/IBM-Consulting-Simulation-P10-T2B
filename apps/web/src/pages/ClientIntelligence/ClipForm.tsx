/**
 * "Assess selected evidence", moved from a modal into the side panel so the
 * source stays readable beside it. Same fields and rules as today: reasoning
 * lane, confidence, verification status, and a consulting takeaway that is
 * required before anything reaches the board.
 */
import { useState } from 'react'
import { Button, InlineLoading, TextArea } from '@carbon/react'
import Choice from '@/components/shell/Choice'
import type { ConfidenceLevel, EvidenceVerificationStatus, ReasoningLane, ResearchArtifact } from '@/api/types'
import { TRUST_LABEL } from './research'
import styles from './ClientIntelligencePage.module.scss'

const REASONING_LANES: { value: ReasoningLane; label: string }[] = [
  { value: 'SYMPTOM', label: 'Observable symptom' },
  { value: 'LIKELY_CAUSE', label: 'Likely cause' },
  { value: 'STAKEHOLDER_CONSTRAINT', label: 'Stakeholder constraint' },
  { value: 'BUSINESS_IMPACT', label: 'Business impact' },
  { value: 'OPEN_QUESTION', label: 'Open question to validate' },
]
const CONFIDENCE: ConfidenceLevel[] = ['LOW', 'MEDIUM', 'HIGH']
const VERIFICATION: EvidenceVerificationStatus[] = ['VERIFIED', 'CORROBORATED', 'UNVERIFIED', 'CONTRADICTED']
const sentence = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

export interface ClipValues {
  lane: ReasoningLane
  confidence: ConfidenceLevel
  verification: EvidenceVerificationStatus
  takeaway: string
}

export default function ClipForm({ source, snippet, saving, onCancel, onSave, onDirtyChange }: {
  source: ResearchArtifact
  snippet: string
  saving: boolean
  onCancel: () => void
  onSave: (values: ClipValues) => void
  /** Tells the page whether opening another passage would throw away a written takeaway. */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const [lane, setLane] = useState<ReasoningLane>('SYMPTOM')
  const [confidence, setConfidence] = useState<ConfidenceLevel>(source.confidence)
  const [verification, setVerification] = useState<EvidenceVerificationStatus>(source.origin === 'SCENARIO_CURATED' ? 'CORROBORATED' : 'UNVERIFIED')
  const [takeaway, setTakeaway] = useState('')

  return (
    <div className={styles.clip}>
      <p className={styles.panelEyebrow}>New evidence · from {source.sourceType}</p>
      <blockquote className={styles.clipQuote}>{snippet}</blockquote>
      <p className={styles.clipSource}>{source.title} · {TRUST_LABEL[source.confidence].toLowerCase()}</p>

      <Choice id="clip-lane" label="What does this help you explain?" value={lane} onChange={setLane} options={REASONING_LANES} />
      <div className={styles.clipGrid}>
        <Choice id="clip-confidence" label="Your confidence" value={confidence} onChange={setConfidence} options={CONFIDENCE.map((item) => ({ value: item, label: sentence(item) }))} />
        <Choice id="clip-verification" label="Verification status" value={verification} onChange={setVerification} options={VERIFICATION.map((item) => ({ value: item, label: sentence(item) }))} />
      </div>
      <TextArea
        id="clip-takeaway"
        labelText="Your consulting takeaway"
        placeholder="What does this mean for the client’s problem? Keep uncertainty explicit."
        rows={3}
        value={takeaway}
        onChange={(event) => {
          setTakeaway(event.target.value)
          onDirtyChange?.(event.target.value.trim().length > 0)
        }}
        helperText="Required — the board holds your reasoning, not just the quote."
      />
      {saving && <InlineLoading description="Saving evidence" />}
      <div className={styles.clipActions}>
        <Button kind="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" disabled={!takeaway.trim() || saving} onClick={() => onSave({ lane, confidence, verification, takeaway: takeaway.trim() })}>
          Add to evidence board
        </Button>
      </div>
    </div>
  )
}
