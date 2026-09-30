/**
 * The hypothesis (FR-06): statement, the evidence it cites (paged by four) and
 * confidence — the same fields as before, now beside the source instead of in a
 * modal. The readiness checklist sits on top, in words.
 */
import { useState } from 'react'
import { Button, Checkbox, InlineLoading, RadioButton, RadioButtonGroup, Tag, TextArea, InlineNotification } from '@carbon/react'
import { ChevronLeft, ChevronRight } from '@carbon/icons-react'
import type { ConfidenceLevel, ResearchEvidence, SaveResearchPayload } from '@/api/types'
import { currentHypothesis, evidenceCode } from '@/components/shell/evidence'
import styles from './ClientIntelligencePage.module.scss'

const CONFIDENCE_TAG: Record<ConfidenceLevel, 'red' | 'warm-gray' | 'green'> = { LOW: 'red', MEDIUM: 'warm-gray', HIGH: 'green' }
const PAGE = 4
const MIN_HYPOTHESIS_LENGTH = 40
const MIN_SUPPORTING_EVIDENCE = 2
const MIN_SUBSTANTIVE_EVIDENCE = 3
const MIN_COVERAGE = 2

const RESEARCH_AREAS = new Set([
  'COMPANY_NEWS',
  'STAKEHOLDER_PROFILE',
  'FINANCIAL_SIGNAL',
  'TECHNOLOGY_INDICATOR',
])

export default function HypothesisTab({ evidence, saving, onSave }: {
  evidence: ResearchEvidence[]
  saving: boolean
  onSave: (payload: SaveResearchPayload, onDone: () => void) => void
}) {
  const [composing, setComposing] = useState(false)
  const [statement, setStatement] = useState('')
  const [support, setSupport] = useState<string[]>([])
  const [confidence, setConfidence] = useState<ConfidenceLevel>('MEDIUM')
  const [page, setPage] = useState(0)

  const citable = evidence.filter((item) => item.evidenceType !== 'HYPOTHESIS')
  const substantiveEvidence = citable.length
  const coverageCount = new Set(
    citable
      .filter((item) => RESEARCH_AREAS.has(item.evidenceType))
      .map((item) => {
        if (item.evidenceType === 'COMPANY_NEWS' || item.evidenceType === 'MARKET_TREND') {
          return 'COMPANY_NEWS_OR_MARKET_TREND'
        }
        return item.evidenceType
      }),
  ).size

  const hypothesisIssues = [
    statement.trim().length < MIN_HYPOTHESIS_LENGTH
      ? `Your hypothesis is ${statement.trim().length} characters long; it needs at least ${MIN_HYPOTHESIS_LENGTH}.`
      : null,
    support.length < MIN_SUPPORTING_EVIDENCE
      ? `Link at least ${MIN_SUPPORTING_EVIDENCE} supporting findings to your hypothesis.`
      : null,
    support.length < MIN_SUPPORTING_EVIDENCE &&
    (substantiveEvidence < MIN_SUBSTANTIVE_EVIDENCE || coverageCount < MIN_COVERAGE)
      ? `You do not have enough evidence in your evidence board. Your research must contain at least ${MIN_SUBSTANTIVE_EVIDENCE} findings across ${MIN_COVERAGE} research areas.`
      : null,
  ].filter((issue): issue is string => issue !== null)
  const pages = Math.max(1, Math.ceil(citable.length / PAGE))
  const current = currentHypothesis(evidence)
  const codeById = new Map(evidence.map((item) => [item.id, evidenceCode(item.sequenceNo)]))

  const save = () => {
    onSave(
      {
        note: statement.trim(),
        hypothesis: statement.trim(),
        evidenceType: 'HYPOTHESIS',
        confidence,
        supportingEvidenceIds: support.length ? support : undefined,
      },
      () => {
        setComposing(false)
        setStatement('')
        setSupport([])
        setPage(0)
      },
    )
  }

  return (
    <div className={styles.hypothesis}>
      <div className={styles.hypoHead}>
        <p className={styles.panelEyebrow}>Your hypothesis</p>
        {!composing && <Button kind="ghost" size="sm" onClick={() => setComposing(true)}>{current ? 'Refine hypothesis' : 'Add hypothesis'}</Button>}
      </div>

      {current && !composing && (
        <div className={styles.hypoCard}>
          <p className={styles.hypoStatement}>“{current.hypothesis ?? current.note}”</p>
          <div className={styles.hypoMeta}>
            <span>
              <small>Supporting evidence</small>
              {current.supportingEvidenceIds.length ? current.supportingEvidenceIds.map((id) => codeById.get(id) ?? '?').join(' · ') : 'None cited'}
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
          <TextArea id="hypothesis-statement" labelText="Hypothesis statement" rows={3} value={statement} onChange={(event) => setStatement(event.target.value)} placeholder="State the observed problem, likely cause and business impact." />
          {citable.length > 0 && (
            <fieldset className={styles.cite}>
              <legend>
                Supporting evidence
                {citable.length > PAGE && (
                  <span className={styles.pager}>
                    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous citations"><ChevronLeft size={14} /></button>
                    {page + 1} / {pages}
                    <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next citations"><ChevronRight size={14} /></button>
                  </span>
                )}
              </legend>
              {citable.slice(page * PAGE, (page + 1) * PAGE).map((item) => (
                <Checkbox
                  key={item.id}
                  id={`support-${item.id}`}
                  labelText={`${evidenceCode(item.sequenceNo)} — ${item.note.slice(0, 74)}${item.note.length > 74 ? '…' : ''}`}
                  checked={support.includes(item.id)}
                  onChange={(_, { checked }) => setSupport(checked ? [...support, item.id] : support.filter((id) => id !== item.id))}
                />
              ))}
            </fieldset>
          )}
          <RadioButtonGroup legendText="How confident are you?" name="hypothesis-confidence" valueSelected={confidence} onChange={(value) => setConfidence(value as ConfidenceLevel)}>
            {(['LOW', 'MEDIUM', 'HIGH'] as ConfidenceLevel[]).map((level) => <RadioButton key={level} id={`hypothesis-confidence-${level}`} value={level} labelText={level.charAt(0) + level.slice(1).toLowerCase()} />)}
          </RadioButtonGroup>
          {saving && <InlineLoading description="Saving hypothesis" />}
          {hypothesisIssues.length > 0 && (
            <InlineNotification
              className={styles.hypothesisNotification}
              kind="warning"
              lowContrast
              hideCloseButton
              title="Your hypothesis is not grounded yet"
              subtitle={hypothesisIssues.map((issue) => `• ${issue}`).join('\n')}
            />
          )}
          <div className={styles.clipActions}>
            <Button kind="secondary" size="sm" onClick={() => setComposing(false)}>Cancel</Button>
            <Button size="sm" disabled={!statement.trim() || saving} onClick={save}>Save hypothesis</Button>
          </div>
        </div>
      )}
    </div>
  )
}
