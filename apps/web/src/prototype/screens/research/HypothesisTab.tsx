/**
 * Notes and hypothesis (FR-06). The hypothesis composer keeps today's fields —
 * statement, supporting evidence citations (paged by four), confidence.
 * Research notes are new: FR-06 asks for them and nothing stores them today.
 */
import { useState } from 'react'
import { Button, Checkbox, RadioButton, RadioButtonGroup, Tag, TextArea } from '@carbon/react'
import { ArrowRight, ChevronLeft, ChevronRight } from '@carbon/icons-react'
import type { ConfidenceLevel } from '@/api/types'
import { gateFor, readinessFor } from '../../data/research'
import ReadinessList from '../../shell/ReadinessList'
import { evidenceCode, useProto } from '../../state/protoStore'
import styles from './research.module.scss'

const CONFIDENCE_TAG: Record<ConfidenceLevel, 'red' | 'warm-gray' | 'green'> = { LOW: 'red', MEDIUM: 'warm-gray', HIGH: 'green' }
const PAGE = 4

export default function HypothesisTab() {
  const evidence = useProto((s) => s.evidence)
  const addEvidence = useProto((s) => s.addEvidence)
  const go = useProto((s) => s.go)
  const [composing, setComposing] = useState(false)
  const [statement, setStatement] = useState('')
  const [support, setSupport] = useState<string[]>([])
  const [confidence, setConfidence] = useState<ConfidenceLevel>('MEDIUM')
  const [page, setPage] = useState(0)
  const [notes, setNotes] = useState('Alan feels the pain but cannot fund it. Sarah can — and cares about the autumn review.')

  const gate = gateFor(evidence)
  const citable = evidence.filter((item) => item.evidenceType !== 'HYPOTHESIS')
  const pages = Math.max(1, Math.ceil(citable.length / PAGE))
  const current = evidence.filter((item) => item.evidenceType === 'HYPOTHESIS').sort((a, b) => b.sequenceNo - a.sequenceNo)[0]
  const codeById = new Map(evidence.map((item) => [item.id, evidenceCode(item.sequenceNo)]))

  const save = () => {
    addEvidence({
      note: statement, hypothesis: statement, evidenceType: 'HYPOTHESIS', sourceUrl: null, sourceTitle: null,
      origin: 'USER_SUPPLIED', verificationStatus: 'UNVERIFIED', occurredOn: null, confidence,
      relevanceScore: 0, reasoningLane: null, supportingEvidenceIds: support,
    })
    setComposing(false)
    setStatement('')
    setSupport([])
  }

  return (
    <div className={styles.hypothesis}>
      <section className={styles.readinessBox} aria-label="Before you contact the client">
        <p className={styles.panelEyebrow}>Before you contact the client</p>
        <ReadinessList items={readinessFor(gate)} />
      </section>

      <div className={styles.fld}>
        <label htmlFor="research-notes" className={styles.panelEyebrow}>Research notes</label>
        <TextArea id="research-notes" labelText="Research notes" hideLabel rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What are you noticing? Who seems to own this problem?" />
        <p className={styles.help}>Private to you. Not scored.</p>
      </div>

      <div className={styles.hypoHead}>
        <p className={styles.panelEyebrow}>Your hypothesis</p>
        {!composing && <Button kind="ghost" size="sm" onClick={() => setComposing(true)}>{current ? 'Refine hypothesis' : 'Add hypothesis'}</Button>}
      </div>

      {current && !composing && (
        <div className={styles.hypoCard}>
          <p className={styles.hypoStatement}>“{current.hypothesis}”</p>
          <div className={styles.hypoMeta}>
            <span>
              <small>Supporting evidence</small>
              {current.supportingEvidenceIds.length ? current.supportingEvidenceIds.map((id) => codeById.get(id)).join(' · ') : 'None cited'}
            </span>
            <Tag type={CONFIDENCE_TAG[current.confidence]} size="sm">{current.confidence.toLowerCase()} confidence</Tag>
          </div>
        </div>
      )}

      {!current && !composing && (
        <p className={styles.help}>No hypothesis yet. Once you have a few pieces of evidence, say what you think their real problem is — and who can act on it.</p>
      )}

      {composing && (
        <div className={styles.compose}>
          <TextArea id="hypothesis" labelText="Hypothesis statement" rows={3} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="State the observed problem, likely cause and business impact." />
          {citable.length > 0 && (
            <fieldset className={styles.cite}>
              <legend>
                Supporting evidence
                {citable.length > PAGE && (
                  <span className={styles.pager}>
                    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous"><ChevronLeft size={14} /></button>
                    {page + 1} / {pages}
                    <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next"><ChevronRight size={14} /></button>
                  </span>
                )}
              </legend>
              {citable.slice(page * PAGE, (page + 1) * PAGE).map((item) => (
                <Checkbox
                  key={item.id}
                  id={`cite-${item.id}`}
                  labelText={`${evidenceCode(item.sequenceNo)} — ${item.note.slice(0, 74)}…`}
                  checked={support.includes(item.id)}
                  onChange={(_, { checked }) => setSupport(checked ? [...support, item.id] : support.filter((id) => id !== item.id))}
                />
              ))}
            </fieldset>
          )}
          <RadioButtonGroup legendText="How confident are you?" name="hypothesis-confidence" valueSelected={confidence} onChange={(value) => setConfidence(value as ConfidenceLevel)}>
            {(['LOW', 'MEDIUM', 'HIGH'] as ConfidenceLevel[]).map((level) => <RadioButton key={level} id={`hc-${level}`} value={level} labelText={level.charAt(0) + level.slice(1).toLowerCase()} />)}
          </RadioButtonGroup>
          <div className={styles.clipActions}>
            <Button kind="secondary" size="sm" onClick={() => setComposing(false)}>Cancel</Button>
            <Button size="sm" disabled={!statement.trim()} onClick={save}>Save hypothesis</Button>
          </div>
        </div>
      )}

      <div className={styles.proceed}>
        <Button renderIcon={ArrowRight} kind={gate.ready ? 'primary' : 'secondary'} onClick={() => go('LEAD')}>Choose who to contact</Button>
        <p className={styles.help}>
          {gate.ready
            ? 'Your research covers the essentials.'
            : 'You can move on now. Anything not yet ticked above will show in how the client responds.'}
        </p>
      </div>
    </div>
  )
}
