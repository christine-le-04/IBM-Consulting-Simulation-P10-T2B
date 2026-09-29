/** "Add a source to the evidence board" — the learner's own finding, same fields as before. */
import { useState } from 'react'
import { Button, InlineLoading, TextArea, TextInput } from '@carbon/react'
import type { ConfidenceLevel, EvidenceType } from '@/api/types'
import type { SaveResearchPayload } from '@/api/types'
import Choice from '@/components/shell/Choice'
import styles from './ClientIntelligencePage.module.scss'

const TYPES: Exclude<EvidenceType, 'HYPOTHESIS'>[] = ['COMPANY_NEWS', 'FINANCIAL_SIGNAL', 'TECHNOLOGY_INDICATOR', 'STAKEHOLDER_PROFILE', 'MARKET_TREND', 'OTHER']
const sentence = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()

export default function ManualSourceForm({ saving, onCancel, onSave }: {
  saving: boolean
  onCancel: () => void
  onSave: (payload: SaveResearchPayload) => void
}) {
  const [type, setType] = useState<Exclude<EvidenceType, 'HYPOTHESIS'>>('COMPANY_NEWS')
  const [finding, setFinding] = useState('')
  const [title, setTitle] = useState('')
  const [reliability, setReliability] = useState<ConfidenceLevel>('MEDIUM')
  const [url, setUrl] = useState('')

  return (
    <div className={styles.clip}>
      <p className={styles.panelEyebrow}>Add a source you found yourself</p>
      <Choice id="manual-type" label="Research area" value={type} onChange={setType} options={TYPES.map((item) => ({ value: item, label: sentence(item.replace(/_/g, ' ')) }))} />
      <TextArea id="manual-finding" labelText="Finding" rows={3} value={finding} onChange={(event) => setFinding(event.target.value)} />
      <div className={styles.clipGrid}>
        <TextInput id="manual-title" labelText="Source title" value={title} onChange={(event) => setTitle(event.target.value)} />
        <Choice id="manual-reliability" label="Reliability" value={reliability} onChange={setReliability} options={(['LOW', 'MEDIUM', 'HIGH'] as ConfidenceLevel[]).map((level) => ({ value: level, label: sentence(level) }))} />
      </div>
      <TextInput id="manual-url" labelText="Source URL (optional)" placeholder="https://" value={url} onChange={(event) => setUrl(event.target.value)} />
      {saving && <InlineLoading description="Saving evidence" />}
      <div className={styles.clipActions}>
        <Button kind="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          disabled={!finding.trim() || saving}
          onClick={() => onSave({
            note: finding.trim(),
            evidenceType: type,
            sourceTitle: title.trim() || undefined,
            sourceUrl: url.trim() || undefined,
            confidence: reliability,
          })}
        >
          Add evidence
        </Button>
      </div>
    </div>
  )
}
