/**
 * The capability brief as what it is: a one-page document for the client. The
 * same four sections and 80-character minimums as before, section tabs with
 * ticks, the client's "include" list and a ready count. It is submitted to the
 * client as the reply to their request.
 */
import { useEffect, useState } from 'react'
import { Button, InlineNotification } from '@carbon/react'
import { CheckmarkFilled, DocumentBlank, Send } from '@carbon/icons-react'
import type { CapabilityBrief } from '@/api/types'
import styles from './OutreachWorkspacePage.module.scss'

export type BriefKey = 'relevantExperience' | 'approach' | 'caseExample' | 'clientFit'

const BRIEF_SECTIONS: { key: BriefKey; label: string; guidance: string }[] = [
  { key: 'relevantExperience', label: 'Experience', guidance: 'Describe relevant industry or operational experience.' },
  { key: 'approach', label: 'Approach', guidance: 'Explain the phased implementation approach and control points.' },
  { key: 'caseExample', label: 'Case example', guidance: 'Provide a comparable example with a measurable outcome.' },
  { key: 'clientFit', label: 'Client fit', guidance: 'Connect this brief directly to the client’s requested outcome.' },
]
const MIN = 80
const MAX = 3000

export default function BriefComposer({ previous, requirements, clientName, company, sending, errorMessage, onSubmit }: {
  previous: CapabilityBrief | null | undefined
  requirements: string[]
  clientName: string
  company: string
  sending: boolean
  errorMessage?: string | null
  onSubmit: (brief: Record<BriefKey, string>) => void
}) {
  const [values, setValues] = useState<Record<BriefKey, string>>({ relevantExperience: '', approach: '', caseExample: '', clientFit: '' })
  const [active, setActive] = useState<BriefKey>('relevantExperience')
  const [touched, setTouched] = useState(false)

  // A brief the client sent back for changes opens with what was sent.
  useEffect(() => {
    if (!previous) return
    setValues({
      relevantExperience: previous.relevantExperience,
      approach: previous.approach,
      caseExample: previous.caseExample,
      clientFit: previous.clientFit,
    })
  }, [previous])

  const valid = (key: BriefKey) => values[key].trim().length >= MIN && values[key].length <= MAX
  const ready = BRIEF_SECTIONS.filter((section) => valid(section.key)).length
  const section = BRIEF_SECTIONS.find((item) => item.key === active) ?? BRIEF_SECTIONS[0]

  const submit = () => {
    setTouched(true)
    const firstInvalid = BRIEF_SECTIONS.find((item) => !valid(item.key))
    if (firstInvalid) {
      setActive(firstInvalid.key)
      return
    }
    onSubmit({
      relevantExperience: values.relevantExperience.trim(),
      approach: values.approach.trim(),
      caseExample: values.caseExample.trim(),
      clientFit: values.clientFit.trim(),
    })
  }

  return (
    <div className={styles.attachment}>
      <div className={styles.attachmentChip}>
        <DocumentBlank size={20} />
        <span>
          <strong>Capability brief — {company}.docx</strong>
          <small>{ready}/4 sections ready · 1 page</small>
        </span>
      </div>

      <div className={styles.docPage}>
        <header className={styles.letterhead}>
          <span className={styles.ibmMark}>IBM Consulting</span>
          <span>Capability brief · prepared for {clientName}</span>
        </header>

        {requirements.length > 0 && (
          <div className={styles.include}>
            <p>They asked you to include</p>
            {requirements.map((item) => <span key={item}><CheckmarkFilled size={14} />{item}</span>)}
          </div>
        )}

        <div className={styles.sectionTabs} role="tablist" aria-label="Capability brief sections">
          {BRIEF_SECTIONS.map((item, index) => (
            <button key={item.key} type="button" role="tab" aria-selected={item.key === active} onClick={() => setActive(item.key)}>
              {valid(item.key) ? <CheckmarkFilled size={14} /> : <span className={styles.sectionNumber}>{index + 1}</span>}
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.docSection} role="tabpanel">
          <h3>{section.label}</h3>
          <p className={styles.guidance}>{section.guidance}</p>
          <textarea
            value={values[active]}
            onChange={(event) => setValues({ ...values, [active]: event.target.value })}
            placeholder="Write a concise, client-specific section…"
            aria-label={section.label}
          />
          <small className={valid(active) ? styles.minMet : undefined}>
            {values[active].trim().length} / {MIN} characters minimum
          </small>
          {touched && !valid(active) && <p className={styles.error} role="alert">Write at least {MIN} characters for {section.label.toLowerCase()}.</p>}
        </div>

        {errorMessage && (
          <InlineNotification kind="error" lowContrast hideCloseButton title="Brief could not be submitted" subtitle={errorMessage} />
        )}
        <footer className={styles.briefFoot}>
          <Button renderIcon={Send} onClick={submit} disabled={sending}>{sending ? 'Sending to the client…' : 'Send the brief'}</Button>
          <span className={styles.composeNote}>All four sections are needed. The client reviews the document, not another email.</span>
        </footer>
      </div>
    </div>
  )
}
