/**
 * Proposal — not in the design doc's diet, so every field ProposalStudioPage
 * has is kept: the five sections and their inputs, the evidence library with
 * per-section attach, autosave states, AI review, "Challenge my proposal" and
 * Submit. Three changes follow the rules: review scores become words (R4),
 * the coach's output sits in the margin as comments instead of a third rail,
 * and the outline's counters become a word-only "Before you submit" checklist
 * (FR-14). Submit is never locked; pressed early, it shows what is missing.
 *
 * Skin: a document editor — outline, page, margin comments.
 */
import { useEffect, useMemo, useState } from 'react'
import { Button, InlineLoading, Tag } from '@carbon/react'
import { Add, Checkmark, CheckmarkFilled, ChevronLeft, ChevronRight, Renew, Send, TrashCan, WarningAlt } from '@carbon/icons-react'
import type { ProposalSource } from '@/api/types'
import { proposalSections, type ProposalSection } from '@/features/proposal/services/proposalDraftService'
import { PROPOSAL_CHALLENGE, PROPOSAL_REVIEW, PROPOSAL_SOURCES } from '../data/engagementFlow'
import { useProto } from '../state/protoStore'
import Choice from '../shell/Choice'
import GatedButton from '../shell/GatedButton'
import ReadinessList from '../shell/ReadinessList'
import styles from './proposal.module.scss'

type Row = Record<string, string>
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const PAGE = 4
const SEVERITY = [{ value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' }, { value: 'HIGH', label: 'High' }]

function band(score: number) {
  return score >= 75 ? 'Strong' : score >= 60 ? 'Adequate' : 'Needs work'
}

function Table({ columns, rows, onChange, empty }: { columns: [string, string][]; rows: Row[]; onChange: (rows: Row[]) => void; empty: Row }) {
  return (
    <div className={styles.table}>
      <table>
        <thead><tr>{columns.map(([, label]) => <th key={label}>{label}</th>)}<th aria-label="Remove" /></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map(([key, label]) => (
                <td key={key}>
                  {key === 'severity' ? (
                    <Choice id={`severity-${index}`} label={label} hideLabel size="sm" value={row[key]} options={SEVERITY} onChange={(value) => onChange(rows.map((item, position) => position === index ? { ...item, [key]: value } : item))} />
                  ) : (
                    <input aria-label={label} value={row[key]} placeholder={label} onChange={(event) => onChange(rows.map((item, position) => position === index ? { ...item, [key]: event.target.value } : item))} />
                  )}
                </td>
              ))}
              <td className={styles.remove}>
                <button type="button" aria-label="Remove row" onClick={() => onChange(rows.length === 1 ? [empty] : rows.filter((_, position) => position !== index))}><TrashCan size={14} /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className={styles.addRow} onClick={() => onChange([...rows, empty])}><Add size={14} /> Add row</button>
    </div>
  )
}

function Bullets({ items, onChange, placeholder }: { items: string[]; onChange: (items: string[]) => void; placeholder: string }) {
  return (
    <ul className={styles.bullets}>
      {items.map((item, index) => (
        <li key={index}>
          <input value={item} placeholder={placeholder} aria-label={placeholder} onChange={(event) => onChange(items.map((value, position) => position === index ? event.target.value : value))} />
          <button type="button" aria-label="Remove item" onClick={() => onChange(items.length === 1 ? [''] : items.filter((_, position) => position !== index))}><TrashCan size={14} /></button>
        </li>
      ))}
      <li><button type="button" className={styles.addRow} onClick={() => onChange([...items, ''])}><Add size={14} /> Add item</button></li>
    </ul>
  )
}

export default function ProposalScreen() {
  const go = useProto((s) => s.go)
  const set = useProto((s) => s.set)
  const [active, setActive] = useState<ProposalSection>('PROBLEM')
  const [problem, setProblem] = useState('Emergency admissions register the same patient up to three times, costing ward nurses time the network cannot spare before the autumn review.')
  const [solution, setSolution] = useState('Measure ward re-entry at Ashford for two weeks, then remove the worst duplicate step with a narrow interface — funded from divisional budget.')
  const [components, setComponents] = useState(['Two-week time-and-motion measurement', 'Single-step interface pilot'])
  const [outcomes, setOutcomes] = useState<Row[]>([{ outcome: 'Release nursing time on admission', metric: 'Minutes of re-entry per admission', target: '−50% at Ashford' }])
  const [budget, setBudget] = useState('185000')
  const [budgetConfidence, setBudgetConfidence] = useState('MEDIUM')
  const [budgetSource, setBudgetSource] = useState('Consultant estimate from comparable trust')
  const [weeks, setWeeks] = useState('10')
  const [milestones, setMilestones] = useState<Row[]>([{ phase: 'Measurement at Ashford', duration: 'Weeks 1–2' }, { phase: 'Interface pilot', duration: 'Weeks 3–10' }])
  const [risks, setRisks] = useState<Row[]>([{ risk: 'Ward staff unavailable during winter pressures', severity: 'HIGH', mitigation: '' }])
  const [assumptions, setAssumptions] = useState(['Client SMEs are available for targeted validation'])
  const [links, setLinks] = useState<{ section: ProposalSection; sourceId: string }[]>([
    { section: 'PROBLEM', sourceId: 'ev-1' }, { section: 'PROBLEM', sourceId: 'meeting:emergency' }, { section: 'OUTCOMES', sourceId: 'meeting:nocapital' },
  ])
  const [save, setSave] = useState<SaveState>('saved')
  const [panel, setPanel] = useState<'evidence' | 'coach'>('evidence')
  const [page, setPage] = useState(0)
  const [reviewing, setReviewing] = useState(false)
  const [reviewed, setReviewed] = useState(false)
  const [challenging, setChallenging] = useState(false)
  const [challenged, setChallenged] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Autosave, 900 ms after the last edit — same as useProposalStudio.
  const touch = <T,>(setter: (value: T) => void) => (value: T) => { setter(value); setSave('idle') }
  useEffect(() => {
    if (save !== 'idle') return
    const timer = window.setTimeout(() => { setSave('saving'); window.setTimeout(() => setSave('saved'), 600) }, 900)
    return () => window.clearTimeout(timer)
  }, [save, problem, solution, components, outcomes, budget, budgetConfidence, budgetSource, weeks, milestones, risks, assumptions, links])

  const sectionLinks = links.filter((link) => link.section === active).map((link) => link.sourceId)
  const grounded = new Set(links.map((link) => link.section)).size
  const filled = (value: string) => value.trim().length > 0
  const written = filled(problem) && filled(solution)
    && outcomes.every((row) => filled(row.outcome) && filled(row.metric)) && filled(budget)
    && filled(weeks) && milestones.every((row) => filled(row.phase))
    && risks.every((row) => filled(row.risk)) && assumptions.some(filled)
  const checklist = [
    { label: 'Every section is written', done: written },
    { label: 'Every section cites evidence', done: grounded === proposalSections.length },
    { label: 'Every risk has a mitigation', done: risks.every((row) => filled(row.mitigation)) },
    { label: 'You have run a proposal review', done: reviewed },
  ]
  const readyToSubmit = checklist.every((item) => item.done)
  const pages = Math.max(1, Math.ceil(PROPOSAL_SOURCES.length / PAGE))
  const visible = PROPOSAL_SOURCES.slice(page * PAGE, (page + 1) * PAGE)
  const activeLabel = proposalSections.find((section) => section.id === active)?.label
  const sourceById = useMemo(() => new Map(PROPOSAL_SOURCES.map((source) => [source.id, source])), [])

  const line = !links.some((link) => link.section === active)
    ? `Attach one source to “${activeLabel}” so the proposal stays traceable.`
    : 'Write this section from the evidence you attached, then run a review.'
  useEffect(() => { set({ liveLine: line }) }, [line, set])

  const toggle = (source: ProposalSource) => {
    setLinks((current) => sectionLinks.includes(source.id)
      ? current.filter((link) => !(link.section === active && link.sourceId === source.id))
      : [...current, { section: active, sourceId: source.id }])
    setSave('idle')
  }

  const runReview = () => {
    setPanel('coach')
    setReviewing(true)
    window.setTimeout(() => { setReviewing(false); setReviewed(true) }, 1600)
  }
  const runChallenge = () => {
    setPanel('coach')
    setChallenging(true)
    window.setTimeout(() => { setChallenging(false); setChallenged(true) }, 1200)
  }
  const submit = () => {
    setSubmitting(true)
    window.setTimeout(() => go('DECISION'), 1600)
  }

  const priority = PROPOSAL_REVIEW.validationIssues.find((issue) => issue.severity === 'BLOCKING') ?? PROPOSAL_REVIEW.validationIssues[0]

  return (
    <div className={styles.editorApp}>
      <header className={styles.docBar}>
        <div className={styles.docName}>
          <span className={styles.docIcon} aria-hidden="true" />
          <div>
            <strong>Proposal — MediCare Regional Hospital Network</strong>
            <span className={styles.saveState}>
              {reviewing ? 'Reviewing proposal…' : submitting ? 'Submitting to client…'
                : save === 'saving' ? 'Saving draft…' : save === 'saved' ? 'Draft saved' : save === 'error' ? 'Save failed' : 'Draft changes save automatically'}
            </span>
          </div>
        </div>
        <div className={styles.docActions}>
          {save === 'error' && <Button kind="ghost" size="sm" renderIcon={Renew} onClick={() => setSave('idle')}>Retry save</Button>}
          <Button kind="tertiary" size="md" renderIcon={Renew} onClick={runReview} disabled={reviewing || submitting}>Review proposal</Button>
          <GatedButton
            size="md"
            renderIcon={Send}
            notReadyKind="secondary"
            disabled={reviewing || submitting}
            ready={readyToSubmit}
            checklist={checklist}
            title="Before you submit to the client"
            stayLabel="Keep editing"
            onGo={submit}
          >
            {submitting ? 'Submitting to client' : 'Submit to client'}
          </GatedButton>
        </div>
      </header>

      <div className={styles.workspace}>
        <nav className={styles.outline} aria-label="Proposal sections">
          <p className={styles.outlineTitle}>Outline</p>
          {proposalSections.map((section, index) => {
            const linked = links.some((link) => link.section === section.id)
            return (
              <button key={section.id} type="button" className={active === section.id ? styles.outlineActive : styles.outlineItem} onClick={() => setActive(section.id)}>
                <span>{linked ? <CheckmarkFilled size={14} /> : index + 1}</span>
                {section.label}
              </button>
            )
          })}
          <section className={styles.health} aria-label="Before you submit">
            <p className={styles.outlineTitle}>Before you submit</p>
            <ReadinessList items={checklist} />
          </section>
        </nav>

        {/* Only the page scrolls; the outline and the margin stay put. */}
        <div className={styles.pageScroll}>
        <article className={styles.page}>
          <header className={styles.pageHead}>
            <span className={styles.ibm}>IBM Consulting</span>
            <span>Proposal to Sarah Chen, Chief Operating Officer · Draft</span>
          </header>

          {active === 'PROBLEM' && (
            <>
              <h1>1. Proposal foundation</h1>
              <p className={styles.guide}>State the client problem, then make the recommendation logic clear.</p>
              <h2>Problem framing</h2>
              <p className={styles.fieldHelp}>Describe the observed operational, commercial or risk impact.</p>
              <textarea className={styles.prose} value={problem} onChange={(event) => touch(setProblem)(event.target.value)} aria-label="Problem statement" />
              <h2>Recommended solution</h2>
              <p className={styles.fieldHelp}>Explain how the recommendation addresses the client problem.</p>
              <textarea className={styles.prose} value={solution} onChange={(event) => touch(setSolution)(event.target.value)} aria-label="Recommended solution" />
              <h2>Solution components</h2>
              <Bullets items={components} onChange={touch(setComponents)} placeholder="e.g. Integration pilot and workflow redesign" />
            </>
          )}

          {active === 'OUTCOMES' && (
            <>
              <h1>2. Value and commercial logic</h1>
              <p className={styles.guide}>Make the outcome measurable and distinguish consultant estimates from confirmed client facts.</p>
              <h2>Expected business outcomes and KPIs</h2>
              <Table columns={[['outcome', 'Business outcome'], ['metric', 'Metric'], ['target', 'Target']]} rows={outcomes} onChange={touch(setOutcomes)} empty={{ outcome: '', metric: '', target: '' }} />
              <h2>Commercials</h2>
              <div className={styles.commercial}>
                <label>Estimated budget (USD)<input type="number" min={0} value={budget} onChange={(event) => touch(setBudget)(event.target.value)} /></label>
                <div className={styles.choiceCell}>
                  <Choice id="budget-confidence" label="Confidence" value={budgetConfidence} onChange={touch(setBudgetConfidence)} options={[{ value: 'UNCONFIRMED', label: 'Unconfirmed' }, ...SEVERITY]} />
                </div>
                <label>Source / basis<input value={budgetSource} onChange={(event) => touch(setBudgetSource)(event.target.value)} /></label>
              </div>
            </>
          )}

          {active === 'TIMELINE' && (
            <>
              <h1>3. Timeline and milestones</h1>
              <p className={styles.guide}>Translate the delivery window into observable milestones the client can evaluate.</p>
              <div className={styles.commercial}>
                <label>Total timeline (weeks)<input type="number" min={1} value={weeks} onChange={(event) => touch(setWeeks)(event.target.value)} /></label>
              </div>
              <h2>Milestones</h2>
              <Table columns={[['phase', 'Phase / milestone'], ['duration', 'Timing']]} rows={milestones} onChange={touch(setMilestones)} empty={{ phase: '', duration: '' }} />
            </>
          )}

          {active === 'RISKS' && (
            <>
              <h1>4. Risks and mitigations</h1>
              <p className={styles.guide}>Show how delivery, operational and adoption risks will be controlled.</p>
              <Table columns={[['risk', 'Risk'], ['severity', 'Severity'], ['mitigation', 'Mitigation']]} rows={risks} onChange={touch(setRisks)} empty={{ risk: '', severity: 'MEDIUM', mitigation: '' }} />
            </>
          )}

          {active === 'ASSUMPTIONS' && (
            <>
              <h1>5. Evidence and assumptions</h1>
              <p className={styles.guide}>Make the conditions behind the recommendation explicit. Attached evidence stays traceable by section.</p>
              <h2>Assumptions and dependencies</h2>
              <Bullets items={assumptions} onChange={touch(setAssumptions)} placeholder="e.g. Client SMEs are available for targeted validation" />
              <h2>Attached sources</h2>
              {links.length ? (
                <ul className={styles.attachedList}>
                  {links.map((link) => <li key={`${link.section}-${link.sourceId}`}><span>{proposalSections.find((section) => section.id === link.section)?.label}</span> {sourceById.get(link.sourceId)?.label}</li>)}
                </ul>
              ) : <p className={styles.fieldHelp}>No sources attached yet. Select a source from the evidence panel for each section.</p>}
            </>
          )}

          {sectionLinks.length > 0 && (
            <footer className={styles.footnotes}>
              <p>Sources for this section</p>
              <ol>{sectionLinks.map((id) => <li key={id}>{sourceById.get(id)?.label} — <em>{sourceById.get(id)?.reliability}</em></li>)}</ol>
            </footer>
          )}
        </article>
        </div>

        <aside className={styles.margin} aria-label="Evidence and coach">
          <div className={styles.marginTabs} role="tablist">
            <button type="button" role="tab" aria-selected={panel === 'evidence'} onClick={() => setPanel('evidence')}>Evidence library <span>{PROPOSAL_SOURCES.length}</span></button>
            <button type="button" role="tab" aria-selected={panel === 'coach'} onClick={() => setPanel('coach')}>Coach</button>
          </div>

          {panel === 'evidence' && (
            <div className={styles.marginBody}>
              <p className={styles.marginHint}>
                Showing {page * PAGE + 1}–{Math.min(PROPOSAL_SOURCES.length, (page + 1) * PAGE)} of {PROPOSAL_SOURCES.length} for <strong>{activeLabel}</strong>
                {pages > 1 && (
                  <span className={styles.pager}>
                    <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous sources"><ChevronLeft size={14} /></button>
                    {page + 1}/{pages}
                    <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} aria-label="Next sources"><ChevronRight size={14} /></button>
                  </span>
                )}
              </p>
              {visible.map((source) => {
                const attached = sectionLinks.includes(source.id)
                return (
                  <article key={source.id} className={`${styles.source} ${attached ? styles.sourceAttached : ''}`}>
                    <div className={styles.sourceMeta}>
                      <Tag type={source.type === 'MEETING_DISCOVERY' ? 'purple' : 'cool-gray'} size="sm">{source.type === 'MEETING_DISCOVERY' ? 'Meeting' : 'Evidence'}</Tag>
                      <span>{source.reliability}</span>
                    </div>
                    <h3>{source.label}</h3>
                    <p>{source.content}</p>
                    <Button kind={attached ? 'secondary' : 'tertiary'} size="sm" renderIcon={attached ? Checkmark : Add} onClick={() => toggle(source)}>
                      {attached ? 'Attached' : 'Attach source'}
                    </Button>
                  </article>
                )
              })}
            </div>
          )}

          {panel === 'coach' && (
            <div className={styles.marginBody}>
              <p className={styles.marginHint}>The coach reviews your reasoning; it never writes the proposal for you.</p>
              <div className={styles.coachActions}>
                <Button kind="tertiary" size="sm" renderIcon={Renew} onClick={runReview} disabled={reviewing}>Run AI proposal review</Button>
                <Button kind="ghost" size="sm" onClick={runChallenge} disabled={challenging}>Challenge my proposal</Button>
              </div>
              {reviewing && <div className={styles.comment}><InlineLoading description="Checking evidence, client alignment and delivery risk" /></div>}
              {challenging && <div className={styles.comment}><InlineLoading description="Preparing client concerns" /></div>}
              {challenged && (
                <div className={`${styles.comment} ${styles.commentClient}`}>
                  <p className={styles.commentWho}>Client concern · as Sarah might put it</p>
                  <p>{PROPOSAL_CHALLENGE.concerns[0]}</p>
                </div>
              )}
              {reviewed && (
                <div className={styles.comment}>
                  <p className={styles.commentWho}>AI proposal review <Tag type={PROPOSAL_REVIEW.readyToSubmit ? 'green' : 'red'} size="sm">{PROPOSAL_REVIEW.readyToSubmit ? 'Ready to submit' : 'Action required'}</Tag></p>
                  <dl className={styles.bands}>
                    <div><dt>Evidence grounding</dt><dd>{band(PROPOSAL_REVIEW.evidenceGroundingScore)}</dd></div>
                    <div><dt>Client alignment</dt><dd>{band(PROPOSAL_REVIEW.clientAlignmentScore)}</dd></div>
                    <div><dt>Commercial logic</dt><dd>{band(PROPOSAL_REVIEW.commercialLogicScore)}</dd></div>
                  </dl>
                  <p>{PROPOSAL_REVIEW.executiveFeedback}</p>
                  {priority && <p className={priority.severity === 'BLOCKING' ? styles.blocking : styles.warning}><WarningAlt size={16} /> {priority.message}</p>}
                  <p className={styles.improve}><strong>Improve next</strong> {PROPOSAL_REVIEW.improvementActions[0]}</p>
                </div>
              )}
              {!reviewed && !reviewing && !challenged && (
                <div className={styles.comment}>
                  <p className={styles.commentWho}>Next best action</p>
                  <p>{links.length ? 'Write the current section using the evidence you attached, then run a review.' : 'Attach one source to the current section so the proposal stays traceable.'}</p>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
