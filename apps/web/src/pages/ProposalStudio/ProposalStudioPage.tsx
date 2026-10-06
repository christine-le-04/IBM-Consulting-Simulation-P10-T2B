/**
 * Proposal — a document editor: the outline on the left, the proposal as a
 * page in the middle, and the margin on the right holding the evidence library
 * and the coach's comments. Every field of the studio is kept, and all of the
 * behaviour stays in useProposalStudio (autosave, recovery, review, challenge,
 * submit).
 *
 * Three changes follow SRS v2: review scores become words and the outline's
 * counters become a word-only "Before you submit" checklist (FR-14), and
 * Submit is never locked — pressed early, it shows what is missing first.
 *
 * Once submitted, /proposal opens on the client's decision; `?view=proposal`
 * shows the submitted attempt read-only. Retryable losses can reopen the editor;
 * wins and exhausted losses go directly to the feedback/review page.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, InlineLoading, InlineNotification, Tag } from '@carbon/react'
import { Add, ArrowLeft, Checkmark, CheckmarkFilled, ChevronLeft, ChevronRight, Renew, Send, TrashCan, WarningAlt } from '@carbon/icons-react'
import { useEngagement } from '@/api/hooks/useEngagements'
import { useScenario } from '@/api/hooks/useScenarios'
import { getApiProblem } from '@/api/problemDetails'
import type { ProposalReview } from '@/api/types'
import GrowingTextarea from '@/components/shared/GrowingTextarea'
import LoadError from '@/components/shared/LoadError'
import LoadingState from '@/components/shared/LoadingState'
import ObjectiveTourProvider from '@/components/shared/ObjectiveTourProvider'
import Choice from '@/components/shell/Choice'
import GatedButton from '@/components/shell/GatedButton'
import ReadinessList from '@/components/shell/ReadinessList'
import { useMentor } from '@/components/shell/useMentor'
import { ProposalOutcomeView } from '@/features/proposal/components/ProposalOutcomeView'
import { useProposalStudio } from '@/features/proposal/hooks/useProposalStudio'
import { proposalSections } from '@/features/proposal/services/proposalDraftService'
import { currentContactOf } from '@/lifecycle/contactSelection'
import styles from './ProposalStudioPage.module.scss'

const SOURCES_PER_PAGE = 4
const SEVERITY = [{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]
const BUDGET_CONFIDENCE = [{ value: 'UNCONFIRMED', label: 'Unconfirmed' }, ...SEVERITY]

const PROPOSAL_OBJECTIVES = [
  {
    id: 'completion-steps',
    objective: 'Five sections, one proposal',
    description: 'Work through the outline. The checklist under it shows what the proposal still needs before you submit it.',
    targets: ['.objective-steps'],
  },
  {
    id: 'evidence',
    objective: 'Attach evidence',
    description: 'Attach the research and meeting evidence each section relies on, so every claim stays traceable.',
    targets: ['.objective-evidence'],
  },
  {
    id: 'review',
    objective: 'Review before you submit',
    description: 'The AI review says which areas need work. It is recommended before you submit the proposal to the client.',
    targets: ['.objective-review'],
  },
]

/** Review scores stay underneath; the learner reads a word (FR-14). */
function band(score: number) {
  return score >= 75 ? 'Strong' : score >= 60 ? 'Adequate' : 'Needs work'
}

const filled = (value: string | number) => String(value).trim().length > 0

const VALIDATION_LABELS: Record<string, string> = {
  PROBLEM_REQUIRED: 'Describe the client problem',
  SOLUTION_REQUIRED: 'Explain your recommendation',
  OUTCOME_REQUIRED: 'Add a measurable outcome',
  RISK_COVERAGE: 'Document delivery risks',
  TIMELINE_DETAIL: 'Add delivery milestones',
  ASSUMPTIONS: 'State your assumptions',
  EVIDENCE_REQUIRED: 'Attach supporting evidence',
  INVALID_EVIDENCE_LINK: 'Replace an unavailable source',
  DIFFICULTY_EVIDENCE_COVERAGE: 'Support your proposal with enough evidence',
  UNSUPPORTED_CLAIM: 'Check the evidence behind your claim',
}

/**
 * Adding a row moves the caret into it. Left on the button, typing a space
 * would press it again and fill the list with empty rows.
 */
function useFocusAddedRow(count: number) {
  const container = useRef<HTMLElement | null>(null)
  const added = useRef(false)
  useEffect(() => {
    if (!added.current) return
    added.current = false
    const rows = container.current?.querySelectorAll('[data-row]')
    rows?.[rows.length - 1]?.querySelector<HTMLElement>('input, textarea, button')?.focus()
  }, [count])
  return { container, markAdded: () => { added.current = true } }
}

function Table<T extends object>({ columns, rows, empty, onChange, readOnly = false }: {
  columns: [keyof T & string, string][]
  rows: T[]
  empty: T
  onChange: (rows: T[]) => void
  readOnly?: boolean
}) {
  const edit = (index: number, key: keyof T & string, value: string) =>
    onChange(rows.map((item, position) => (position === index ? { ...item, [key]: value } : item)))
  const { container, markAdded } = useFocusAddedRow(rows.length)
  return (
    <div className={styles.table} ref={(node) => { container.current = node }}>
      <table>
        <thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}{!readOnly && <th aria-label="Remove" />}</tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} data-row>
              {columns.map(([key, label]) => (
                <td key={key}>
                  {key === 'severity' ? (
                    <Choice id={`severity-${index}`} label={label} hideLabel size="sm" disabled={readOnly} value={String(row[key])} options={SEVERITY} onChange={(value) => edit(index, key, value)} />
                  ) : (
                    <GrowingTextarea aria-label={`${label} ${index + 1}`} readOnly={readOnly} value={String(row[key] ?? '')} placeholder={label} onChange={(value) => edit(index, key, value)} />
                  )}
                </td>
              ))}
              {!readOnly && (
                <td className={styles.remove}>
                  <button type="button" aria-label={`Remove row ${index + 1}`} onClick={() => onChange(rows.length === 1 ? [empty] : rows.filter((_, position) => position !== index))}><TrashCan size={14} /></button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && <button type="button" className={styles.addRow} onClick={() => { markAdded(); onChange([...rows, empty]) }}><Add size={14} /> Add row</button>}
    </div>
  )
}

function Bullets({ items, label, placeholder, onChange, readOnly = false }: { items: string[]; label: string; placeholder: string; onChange: (items: string[]) => void; readOnly?: boolean }) {
  const { container, markAdded } = useFocusAddedRow(items.length)
  return (
    <ul className={styles.bullets} ref={(node) => { container.current = node }}>
      {items.map((item, index) => (
        <li key={index} data-row>
          <input value={item} readOnly={readOnly} placeholder={placeholder} aria-label={`${label} ${index + 1}`} onChange={(event) => onChange(items.map((value, position) => (position === index ? event.target.value : value)))} />
          {!readOnly && <button type="button" aria-label={`Remove item ${index + 1}`} onClick={() => onChange(items.length === 1 ? [''] : items.filter((_, position) => position !== index))}><TrashCan size={14} /></button>}
        </li>
      ))}
      {!readOnly && <li><button type="button" className={styles.addRow} onClick={() => { markAdded(); onChange([...items, '']) }}><Add size={14} /> Add item</button></li>}
    </ul>
  )
}

function ReviewComment({ review }: { review: ProposalReview }) {
  const priority = review.validationIssues.find((issue) => issue.severity === 'BLOCKING') ?? review.validationIssues[0]
  return (
    <div className={styles.comment}>
      <p className={styles.commentWho}>AI proposal review <Tag type={review.readyToSubmit ? 'green' : 'red'} size="sm">{review.readyToSubmit ? 'Ready to submit' : 'Action required'}</Tag></p>
      <dl className={styles.bands}>
        <div><dt>Evidence grounding</dt><dd>{band(review.evidenceGroundingScore)}</dd></div>
        <div><dt>Client alignment</dt><dd>{band(review.clientAlignmentScore)}</dd></div>
        <div><dt>Commercial logic</dt><dd>{band(review.commercialLogicScore)}</dd></div>
      </dl>
      <p>{review.executiveFeedback}</p>
      {priority && <p className={priority.severity === 'BLOCKING' ? styles.blocking : styles.warning}><WarningAlt size={16} /> {priority.message}</p>}
      {review.improvementActions[0] && <p className={styles.improve}><strong>Improve next</strong> {review.improvementActions[0]}</p>}
    </div>
  )
}

export default function ProposalStudioPage() {
  const { engagementId = '' } = useParams<{ engagementId: string }>()
  const navigate = useNavigate()
  const studio = useProposalStudio(engagementId)
  const { data: engagement } = useEngagement(engagementId)
  const { data: scenario } = useScenario(engagement?.scenarioId ?? '')
  const [searchParams, setSearchParams] = useSearchParams()
  const [panel, setPanel] = useState<'evidence' | 'coach'>('evidence')
  const [sourcePage, setSourcePage] = useState(0)

  const { draft, activeSection, updateDraft } = studio
  const sources = useMemo(() => studio.workspace.data?.sources ?? [], [studio.workspace.data?.sources])
  const sourceById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources])
  const sourcePageCount = Math.max(1, Math.ceil(sources.length / SOURCES_PER_PAGE))
  const visibleSources = sources.slice(sourcePage * SOURCES_PER_PAGE, (sourcePage + 1) * SOURCES_PER_PAGE)
  const activeLabel = proposalSections.find((section) => section.id === activeSection)?.label
  const sectionLinks = draft.evidenceLinks.filter((link) => link.section === activeSection).map((link) => link.sourceId)
  const persona = scenario?.personas.find((item) => item.id === engagement?.personaId)
  const contact = persona ?? currentContactOf(engagement)

  const isReviewing = studio.reviewProposal.isPending
  const isSubmitting = studio.submitProposal.isPending
  const hasProposalFailure = studio.submitProposal.isError || studio.saveState === 'error'
  const proposalProblem = hasProposalFailure
    ? getApiProblem(studio.submitProposal.error ?? studio.saveDraft.error, 'Your draft remains in this workspace. Resolve the highlighted findings and try again.')
    : null

  useEffect(() => {
    setSourcePage((current) => Math.min(current, sourcePageCount - 1))
  }, [sourcePageCount])

  // Each section is a new page; opening one halfway down hides its heading.
  const pageScroll = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    pageScroll.current?.scrollTo?.({ top: 0 })
  }, [activeSection])

  const problemReady = draft.problemStatement.trim().length >= 20
  const solutionReady = draft.solutionStrategy.trim().length >= 20 && draft.components.some((component) => filled(component))
  const outcomeReady = draft.businessOutcomes.some((outcome) => filled(outcome.outcome) || filled(outcome.metric) || filled(outcome.target),)
  const evidenceReady = draft.evidenceLinks.length > 0
  // Match the backend's rounded percentage against up to four available sources.
  const coverageTarget = Math.min(4, sources.length)
  const coverageThreshold = studio.workspace.data?.evidenceCoverageThreshold ?? 100
  const requiredSources = Math.max(1, Array.from({ length: coverageTarget + 1 }, (_, count) => count)
    .find((count) => coverageTarget > 0 && Math.round(count * 100 / coverageTarget) >= coverageThreshold) ?? coverageTarget)
  const availableSourceIds = new Set(sources.map((source) => source.id))
  const linkedSourceCount = new Set(draft.evidenceLinks.map((link) => link.sourceId)
    .filter((id) => availableSourceIds.has(id))).size
  const sourcesStillNeeded = Math.max(0, requiredSources - linkedSourceCount)
  const checklist = [
    { label: 'Problem statement is at least 20 characters', done: problemReady },
    { label: 'Solution is at least 20 characters with a component', done: solutionReady },
    { label: 'At least one business outcome or KPI is added', done: outcomeReady },
    { label: 'At least one evidence source is attached', done: evidenceReady },
    {
      label: sourcesStillNeeded
        ? `Attach ${sourcesStillNeeded} more different ${sourcesStillNeeded === 1 ? 'source' : 'sources'} ${studio.workspace.data?.evidenceCoverageThreshold == null ? 'for full evidence coverage' : `to meet the ${coverageThreshold}% evidence requirement`}`
        : 'Evidence draws on enough different sources',
      done: coverageTarget > 0 && sourcesStillNeeded === 0,
    },
    { label: studio.reviewIsStale ? 'Review needs to be rerun after changes' : 'You have run a proposal review', done: Boolean(studio.review) && !studio.reviewIsStale },
  ]

  const readOnly = studio.submitted
  const readingSent = readOnly && searchParams.get('view') === 'proposal'
  const finalResult = studio.submitted && Boolean(studio.proposal
    && (studio.proposal.decision === 'WON'
      || (studio.proposal.decision === 'LOST' && !studio.proposal.revisionAvailable)))

  useEffect(() => {
    if (finalResult && !readingSent) {
      navigate(`/dashboard/engagements/${engagementId}/assessment`, { replace: true })
    }
  }, [engagementId, finalResult, navigate, readingSent])

  useMentor(
    readingSent ? 'This is what you sent. Compare it with what they said.'
      : studio.submitted ? 'Read what they said before the scores. Then open your review.' : !sectionLinks.length
      ? `Attach one source to “${activeLabel}” so the proposal stays traceable.`
      : 'Write this section from the evidence you attached, then run a review.',
  )

  if (studio.workspace.isLoading) return <LoadingState />
  if (studio.workspace.isError) {
    return <LoadError title="Proposal workspace could not be opened" error={studio.workspace.error} reassurance="Your draft is saved." onRetry={() => void studio.workspace.refetch()} />
  }
  if (finalResult && !readingSent) return <LoadingState description="Opening feedback and review…" />
  if (studio.submitted && studio.proposal && !readingSent) {
    return (
      <ProposalOutcomeView
        proposal={studio.proposal}
        engagementId={engagementId}
        onReadProposal={() => setSearchParams({ view: 'proposal' })}
        onRevise={() => { setSearchParams({}); void studio.revise() }}
        revising={studio.reviseProposal.isPending}
        revisionError={studio.reviseProposal.isError}
        client={{ company: engagement?.leadCompanyName, contactName: contact?.name, contactTitle: contact?.jobTitle, subject: engagement?.scenarioTitle }}
      />
    )
  }

  const review = () => {
    setPanel('coach')
    void studio.reviewCurrentDraft()
  }
  const challenge = () => {
    setPanel('coach')
    void studio.challengeCurrentDraft()
  }

  const saveLabel = readOnly ? 'Submitted to the client · read only' : isReviewing ? 'Reviewing proposal…' : isSubmitting ? 'Submitting to client…'
    : studio.saveState === 'saving' ? 'Saving draft…' : studio.saveState === 'saved' ? 'Draft saved'
      : studio.saveState === 'error' ? 'Save failed' : 'Draft changes save automatically'
  const busy = isReviewing || isSubmitting || studio.saveDraft.isPending

  return (
    <ObjectiveTourProvider tourId="proposal-studio" objectives={PROPOSAL_OBJECTIVES}>
      <div className={styles.editorApp}>
        <header className={styles.docBar}>
          <div className={styles.docName}>
            <span className={styles.docIcon} aria-hidden="true" />
            <div>
              <strong>Proposal — {engagement?.leadCompanyName ?? engagement?.scenarioTitle ?? 'Client'}</strong>
              <span className={styles.saveState}>{saveLabel}</span>
            </div>
          </div>
          {readOnly ? (
            <div className={styles.docActions}>
              <Button kind="secondary" size="md" renderIcon={ArrowLeft} onClick={() => setSearchParams({})}>Back to their decision</Button>
            </div>
          ) : (
            <div className={styles.docActions}>
              {studio.saveState === 'error' && <Button kind="ghost" size="sm" renderIcon={Renew} onClick={() => void studio.retrySave()} disabled={studio.saveDraft.isPending}>Retry save</Button>}
              <Button kind="tertiary" size="md" renderIcon={Renew} className="objective-review" onClick={review} disabled={busy}>
                {isReviewing ? 'Reviewing proposal' : 'Review proposal'}
              </Button>
              <GatedButton
                size="md"
                renderIcon={Send}
                notReadyKind="secondary"
                disabled={busy}
                ready={checklist.every((item) => item.done)}
                checklist={checklist}
                title="Before you submit to the client"
                stayLabel="Keep editing"
                onGo={() => void studio.submit()}
              >
                {isSubmitting ? 'Submitting to client' : 'Submit to client'}
              </GatedButton>
            </div>
          )}
        </header>

        {isSubmitting && (
          <div className={styles.submitting} role="status" aria-live="polite">
            <InlineLoading description="Applying the client decision" />
            <span>Persisting the deterministic outcome. The client narrative will continue in the background.</span>
          </div>
        )}

        {proposalProblem && (
          <div className={styles.problem}>
            <InlineNotification kind="error" lowContrast title="Proposal could not be saved or submitted" subtitle={proposalProblem.detail} hideCloseButton />
            {proposalProblem.violations && (
              <ul aria-label="Proposal validation errors">
                {Object.entries(proposalProblem.violations).map(([field, message]) => <li key={field}><strong>{VALIDATION_LABELS[field] ?? 'Review this part of your proposal'}</strong>: {message}</li>)}
              </ul>
            )}
          </div>
        )}

        {studio.reviewProposal.isError && (
          <div className={styles.problem}>
            <InlineNotification kind="error" lowContrast title="Review failed" subtitle="Your draft is saved. Retry the review." hideCloseButton />
          </div>
        )}

        {studio.challengeProposal.isError && (
          <div className={styles.problem}>
            <InlineNotification kind="error" lowContrast title="Challenge failed" subtitle="Your draft is saved. Retry the challenge." hideCloseButton />
          </div>
        )}

        <div className={styles.workspace}>
          <nav className={`${styles.outline} objective-steps`} aria-label="Proposal sections">
            <p className={styles.outlineTitle}>Outline</p>
            {proposalSections.map((section, index) => {
              const linked = draft.evidenceLinks.some((link) => link.section === section.id)
              return (
                <button key={section.id} type="button" className={activeSection === section.id ? styles.outlineActive : styles.outlineItem} onClick={() => studio.setActiveSection(section.id)}>
                  <span>{linked ? <CheckmarkFilled size={14} /> : index + 1}</span>
                  {section.label}
                </button>
              )
            })}
            <section className={styles.health} aria-label={readOnly ? 'What you submitted' : 'Before you submit'}>
              <p className={styles.outlineTitle}>{readOnly ? 'What you submitted' : 'Before you submit'}</p>
              {/* Whether a review was run is not stored with the proposal, so
                  once it is submitted that line cannot be answered honestly. */}
              <ReadinessList items={readOnly ? checklist.slice(0, -1) : checklist} />
            </section>
          </nav>

          {/* Only the page scrolls; the outline and the margin stay put. */}
          <div className={styles.pageScroll} ref={pageScroll}>
            <article className={styles.page}>
              <header className={styles.pageHead}>
                <span className={styles.ibm}>IBM Consulting</span>
                <span>{contact ? `Proposal to ${contact.name}, ${contact.jobTitle}` : 'Proposal'} · {readOnly ? 'Submitted' : 'Draft'}</span>
              </header>

              {activeSection === 'PROBLEM' && (
                <>
                  <h1>1. Proposal foundation</h1>
                  <p className={styles.guide}>State the client problem, then make the recommendation logic clear.</p>
                  <h2>Problem framing</h2>
                  <p className={styles.fieldHelp}>Describe the observed operational, commercial or risk impact. Minimum 20 characters.</p>
                  <textarea className={styles.prose} aria-label="Problem statement" readOnly={readOnly} value={draft.problemStatement} onChange={(event) => updateDraft((current) => ({ ...current, problemStatement: event.target.value }))} />
                  <h2>Recommended solution</h2>
                  <p className={styles.fieldHelp}>Explain how the recommendation addresses the client problem. Minimum 20 characters, plus at least one solution component.</p>
                  <textarea className={styles.prose} aria-label="Recommended solution" readOnly={readOnly} value={draft.solutionStrategy} onChange={(event) => updateDraft((current) => ({ ...current, solutionStrategy: event.target.value }))} />
                  <h2>Solution components</h2>
                  <Bullets readOnly={readOnly} items={draft.components} label="Solution component" placeholder="e.g. Integration pilot and workflow redesign" onChange={(components) => updateDraft((current) => ({ ...current, components }))} />
                </>
              )}

              {activeSection === 'OUTCOMES' && (
                <>
                  <h1>2. Value and commercial logic</h1>
                  <p className={styles.guide}>Make the outcome measurable and distinguish consultant estimates from confirmed client facts.</p>
                  <h2>Expected business outcomes and KPIs</h2>
                  <p className={styles.fieldHelp}>Add at least one measurable business outcome or KPI.</p>
                  <Table
                    readOnly={readOnly}
                    columns={[['outcome', 'Business outcome'], ['metric', 'Metric'], ['target', 'Target']]}
                    rows={draft.businessOutcomes}
                    empty={{ outcome: '', metric: '', target: '' }}
                    onChange={(businessOutcomes) => updateDraft((current) => ({ ...current, businessOutcomes }))}
                  />
                  <h2>Commercials</h2>
                  <div className={styles.commercial}>
                    <label>Estimated budget (USD)<input type="number" min={0} readOnly={readOnly} value={draft.budget} onChange={(event) => updateDraft((current) => ({ ...current, budget: Number(event.target.value) || 0 }))} /></label>
                    <div className={styles.choiceCell}>
                      <Choice id="budget-confidence" label="Confidence" disabled={readOnly} value={draft.budgetConfidence} options={BUDGET_CONFIDENCE} onChange={(budgetConfidence) => updateDraft((current) => ({ ...current, budgetConfidence }))} />
                    </div>
                    <label>Source / basis<input readOnly={readOnly} value={draft.budgetSource} onChange={(event) => updateDraft((current) => ({ ...current, budgetSource: event.target.value }))} /></label>
                  </div>
                </>
              )}

              {activeSection === 'TIMELINE' && (
                <>
                  <h1>3. Timeline and milestones</h1>
                  <p className={styles.guide}>Translate the delivery window into observable milestones the client can evaluate.</p>
                  <div className={styles.commercial}>
                    <label>Total timeline (weeks)<input type="number" min={1} readOnly={readOnly} value={draft.timelineWeeks} onChange={(event) => updateDraft((current) => ({ ...current, timelineWeeks: Number(event.target.value) || 1 }))} /></label>
                  </div>
                  <h2>Milestones</h2>
                  <Table
                    readOnly={readOnly}
                    columns={[['phase', 'Phase / milestone'], ['duration', 'Timing']]}
                    rows={draft.milestones}
                    empty={{ phase: '', duration: '' }}
                    onChange={(milestones) => updateDraft((current) => ({ ...current, milestones }))}
                  />
                </>
              )}

              {activeSection === 'RISKS' && (
                <>
                  <h1>4. Risks and mitigations</h1>
                  <p className={styles.guide}>Show how delivery, operational and adoption risks will be controlled.</p>
                  <Table
                    readOnly={readOnly}
                    columns={[['risk', 'Risk'], ['severity', 'Severity'], ['mitigation', 'Mitigation']]}
                    rows={draft.risks}
                    empty={{ risk: '', severity: 'MEDIUM', mitigation: '' }}
                    onChange={(risks) => updateDraft((current) => ({ ...current, risks }))}
                  />
                </>
              )}

              {activeSection === 'ASSUMPTIONS' && (
                <>
                  <h1>5. Evidence and assumptions</h1>
                  <p className={styles.guide}>Make the conditions behind the recommendation explicit. Attached evidence stays traceable by section.</p>
                  <h2>Assumptions and dependencies</h2>
                  <Bullets readOnly={readOnly} items={draft.assumptions} label="Assumption or dependency" placeholder="e.g. Client SMEs are available for targeted validation" onChange={(assumptions) => updateDraft((current) => ({ ...current, assumptions }))} />
                  <h2>Attached sources</h2>
                  {draft.evidenceLinks.length ? (
                    <ul className={styles.attachedList}>
                      {draft.evidenceLinks.map((link) => (
                        <li key={`${link.section}-${link.sourceId}`}>
                          <span>{proposalSections.find((section) => section.id === link.section)?.label}</span>{' '}
                          {sourceById.get(link.sourceId)?.label ?? (link.sourceId.startsWith('meeting:') ? 'Meeting discovery' : 'Research evidence')}
                        </li>
                      ))}
                    </ul>
                  ) : <p className={styles.fieldHelp}>No sources attached yet. Attach at least one source to the proposal. This scenario requires {coverageThreshold}% evidence coverage across up to {coverageTarget} available sources.</p>}
                </>
              )}

              {sectionLinks.length > 0 && (
                <footer className={styles.footnotes}>
                  <p>Sources for this section</p>
                  <ol>{sectionLinks.map((id) => <li key={id}>{sourceById.get(id)?.label ?? id} — <em>{sourceById.get(id)?.reliability}</em></li>)}</ol>
                </footer>
              )}
            </article>
          </div>

          <aside className={styles.margin} aria-label="Evidence and coach">
            <div className={styles.marginTabs} role="tablist">
              <button type="button" role="tab" className="objective-evidence" aria-selected={panel === 'evidence'} onClick={() => setPanel('evidence')}>Evidence library <span>{sources.length}</span></button>
              <button type="button" role="tab" aria-selected={panel === 'coach'} onClick={() => setPanel('coach')}>Coach</button>
            </div>

            {panel === 'evidence' && (
              <div className={styles.marginBody}>
                <p className={styles.marginHint}>
                  {sources.length === 0
                    ? 'No evidence or discovery facts are available yet.'
                    : <>Showing {sourcePage * SOURCES_PER_PAGE + 1}–{Math.min(sources.length, (sourcePage + 1) * SOURCES_PER_PAGE)} of {sources.length} for <strong>{activeLabel}</strong></>}
                  {sourcePageCount > 1 && (
                    <span className={styles.pager}>
                      <button type="button" disabled={sourcePage === 0} onClick={() => setSourcePage(sourcePage - 1)} aria-label="Previous sources"><ChevronLeft size={14} /></button>
                      {sourcePage + 1}/{sourcePageCount}
                      <button type="button" disabled={sourcePage >= sourcePageCount - 1} onClick={() => setSourcePage(sourcePage + 1)} aria-label="Next sources"><ChevronRight size={14} /></button>
                    </span>
                  )}
                </p>
                {visibleSources.map((source) => {
                  const attached = studio.attachedSourceIds.has(source.id)
                  return (
                    <article key={source.id} className={`${styles.source} ${attached ? styles.sourceAttached : ''}`}>
                      <div className={styles.sourceMeta}>
                        <Tag type={source.type === 'MEETING_DISCOVERY' ? 'purple' : 'cool-gray'} size="sm">{source.type === 'MEETING_DISCOVERY' ? 'Meeting' : 'Evidence'}</Tag>
                        <span>{source.reliability}</span>
                      </div>
                      <h3>{source.label}</h3>
                      <p>{source.content}</p>
                      {readOnly ? (
                        attached && <Tag type="blue" size="sm">Attached to {activeLabel}</Tag>
                      ) : (
                        <Button kind={attached ? 'secondary' : 'tertiary'} size="sm" renderIcon={attached ? Checkmark : Add} onClick={() => (attached ? studio.detach(source.id) : studio.attach(source))}>
                          {attached ? 'Attached' : 'Attach source'}
                        </Button>
                      )}
                    </article>
                  )
                })}
              </div>
            )}

            {panel === 'coach' && readOnly && (
              <div className={styles.marginBody}>
                <p className={styles.marginHint}>This proposal has been submitted, so the coach is closed. Their decision explains how it landed.</p>
              </div>
            )}

            {panel === 'coach' && !readOnly && (
              <div className={styles.marginBody}>
                <p className={styles.marginHint}>The coach reviews your reasoning; it never writes the proposal for you.</p>
                <div className={styles.coachActions}>
                  <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={review} disabled={busy}>Run AI proposal review</Button>
                  <Button kind="ghost" size="sm" onClick={challenge} disabled={studio.challengeProposal.isPending || busy}>Challenge my proposal</Button>
                </div>
                {isReviewing && <div className={styles.comment}><InlineLoading description="Checking evidence, client alignment and delivery risk" /></div>}
                {studio.challengeProposal.isPending && <div className={styles.comment}><InlineLoading description="Preparing client concerns" /></div>}
                {studio.challengeProposal.data?.concerns[0] && (
                  <div className={`${styles.comment} ${styles.commentClient}`}>
                    <p className={styles.commentWho}>Client concern{contact ? ` · as ${contact.name} might put it` : ''}</p>
                    <p>{studio.challengeProposal.data.concerns[0]}</p>
                  </div>
                )}
                {studio.reviewIsStale && studio.review && (
                  <div className={styles.comment}>
                    <p className={styles.commentWho}>Review needs to be rerun</p>
                    <p>This review describes an earlier draft. Run it again to review your changes.</p>
                  </div>
                )}
                {studio.review && !studio.reviewIsStale && <ReviewComment review={studio.review} />}
                {!studio.review && !isReviewing && !studio.challengeProposal.data && (
                  <div className={styles.comment}>
                    <p className={styles.commentWho}>Next best action</p>
                    <p>{draft.evidenceLinks.length ? 'Write the current section using the evidence you attached, then run a review.' : 'Attach one source to the current section so the proposal stays traceable.'}</p>
                  </div>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </ObjectiveTourProvider>
  )
}
