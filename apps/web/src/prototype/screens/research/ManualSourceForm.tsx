/** "Add a source to the evidence board" — the learner's own finding, unchanged fields. */
import { useState } from 'react'
import { Button, TextArea, TextInput } from '@carbon/react'
import Choice from '../../shell/Choice'
import type { ConfidenceLevel, EvidenceType } from '@/api/types'
import { useProto } from '../../state/protoStore'
import styles from './research.module.scss'

const TYPES: EvidenceType[] = ['COMPANY_NEWS', 'FINANCIAL_SIGNAL', 'TECHNOLOGY_INDICATOR', 'STAKEHOLDER_PROFILE', 'MARKET_TREND', 'OTHER']
const sentence = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

export default function ManualSourceForm({ onDone }: { onDone: () => void }) {
  const addEvidence = useProto((s) => s.addEvidence)
  const [type, setType] = useState<EvidenceType>('COMPANY_NEWS')
  const [finding, setFinding] = useState('')
  const [title, setTitle] = useState('')
  const [reliability, setReliability] = useState<ConfidenceLevel>('MEDIUM')
  const [url, setUrl] = useState('')

  return (
    <div className={styles.clip}>
      <p className={styles.panelEyebrow}>Add a source you found yourself</p>
      <Choice id="manual-type" label="Research area" value={type} onChange={setType} options={TYPES.map((item) => ({ value: item, label: sentence(item.replace(/_/g, ' ')) }))} />
      <TextArea id="manual-finding" labelText="Finding" rows={3} value={finding} onChange={(event) => setFinding(event.target.value)} invalid={false} />
      <div className={styles.clipGrid}>
        <TextInput id="manual-title" labelText="Source title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Choice id="manual-reliability" label="Reliability" value={reliability} onChange={setReliability} options={(['LOW', 'MEDIUM', 'HIGH'] as ConfidenceLevel[]).map((level) => ({ value: level, label: sentence(level) }))} />
      </div>
      <TextInput id="manual-url" labelText="Source URL (optional)" placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} />
      <div className={styles.clipActions}>
        <Button kind="secondary" size="sm" onClick={onDone}>Cancel</Button>
        <Button
          size="sm"
          disabled={!finding.trim()}
          onClick={() => {
            addEvidence({
              note: finding.trim(), hypothesis: null, evidenceType: type, sourceUrl: url || null, sourceTitle: title || null,
              origin: 'USER_SUPPLIED', verificationStatus: 'UNVERIFIED', occurredOn: null, confidence: reliability,
              relevanceScore: 50, reasoningLane: null, supportingEvidenceIds: [],
            })
            onDone()
          }}
        >
          Add evidence
        </Button>
      </div>
    </div>
  )
}
