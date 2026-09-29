/**
 * The capability brief as what it really is: a one-page document attached to
 * the reply. Same four sections, 80-character minimums, section tabs with
 * completion ticks, the client's "Include" list and the n/4 ready count.
 */
import { useState } from 'react'
import { CheckmarkFilled, DocumentBlank } from '@carbon/icons-react'
import type { CapabilityBrief } from '@/api/types'
import styles from './mail.module.scss'

type Key = 'relevantExperience' | 'approach' | 'caseExample' | 'clientFit'

const SECTIONS: { key: Key; label: string; guidance: string }[] = [
  { key: 'relevantExperience', label: 'Experience', guidance: 'Describe relevant industry or operational experience.' },
  { key: 'approach', label: 'Approach', guidance: 'Explain the phased implementation approach and control points.' },
  { key: 'caseExample', label: 'Case example', guidance: 'Provide a comparable example with a measurable outcome.' },
  { key: 'clientFit', label: 'Client fit', guidance: 'Connect this brief directly to the client’s requested outcome.' },
]
const MIN = 80

export default function BriefDocument({ draft, requirements, onReadyChange }: {
  draft: CapabilityBrief
  requirements: string[]
  onReadyChange: (ready: boolean) => void
}) {
  const [values, setValues] = useState<Record<Key, string>>({
    relevantExperience: draft.relevantExperience,
    approach: draft.approach,
    caseExample: draft.caseExample,
    clientFit: draft.clientFit,
  })
  const [active, setActive] = useState<Key>('relevantExperience')
  const done = (key: Key) => values[key].trim().length >= MIN
  const ready = SECTIONS.filter((section) => done(section.key)).length
  const section = SECTIONS.find((item) => item.key === active) ?? SECTIONS[0]

  const update = (value: string) => {
    const next = { ...values, [active]: value }
    setValues(next)
    onReadyChange(SECTIONS.every((item) => next[item.key].trim().length >= MIN))
  }

  return (
    <div className={styles.attachment}>
      <div className={styles.attachmentChip}>
        <DocumentBlank size={20} />
        <span>
          <strong>Capability brief — MediCare.docx</strong>
          <small>{ready}/4 sections ready · 1 page</small>
        </span>
      </div>

      <div className={styles.docPage}>
        <header className={styles.letterhead}>
          <span className={styles.ibmMark}>IBM Consulting</span>
          <span>Capability brief · prepared for Sarah Chen, COO</span>
        </header>

        {requirements.length > 0 && (
          <div className={styles.include}>
            <p>She asked you to include</p>
            {requirements.map((item) => <span key={item}><CheckmarkFilled size={14} />{item}</span>)}
          </div>
        )}

        <div className={styles.sectionTabs} role="tablist" aria-label="Capability brief sections">
          {SECTIONS.map((item, index) => (
            <button key={item.key} type="button" role="tab" aria-selected={item.key === active} onClick={() => setActive(item.key)}>
              {done(item.key) ? <CheckmarkFilled size={14} /> : <span className={styles.sectionNumber}>{index + 1}</span>}
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.docSection} role="tabpanel">
          <h3>{section.label}</h3>
          <p className={styles.guidance}>{section.guidance}</p>
          <textarea
            value={values[active]}
            onChange={(event) => update(event.target.value)}
            placeholder="Write a concise, client-specific section…"
            aria-label={section.label}
          />
          <small className={values[active].trim().length >= MIN ? styles.minMet : undefined}>
            {values[active].trim().length} / {MIN} characters minimum
          </small>
        </div>
      </div>
    </div>
  )
}
