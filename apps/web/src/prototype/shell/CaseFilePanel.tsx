/**
 * 3 · The side panel — opens in place, closes again (design doc §5.3, R5).
 *
 * Replaces the floating lightbulb (EngagementEvidenceHint) with the same
 * content: the current problem hypothesis, the usable evidence register, and
 * the company file (lead intelligence + FR-05 profile). Nothing needed
 * mid-step lives only in the hub.
 */
import { useState } from 'react'
import { Tag } from '@carbon/react'
import { Close } from '@carbon/icons-react'
import { evidenceCode, useProto } from '../state/protoStore'
import CompanyFile from './CompanyFile'
import EvidenceRegister from './EvidenceRegister'
import styles from './shell.module.scss'

export default function CaseFilePanel() {
  const open = useProto((s) => s.caseFileOpen)
  const set = useProto((s) => s.set)
  const evidence = useProto((s) => s.evidence)
  const [tab, setTab] = useState<'evidence' | 'company'>('evidence')
  const problem = [...evidence].filter((item) => item.evidenceType === 'HYPOTHESIS').sort((a, b) => b.sequenceNo - a.sequenceNo)[0]
  const codeById = new Map(evidence.map((item) => [item.id, evidenceCode(item.sequenceNo)]))

  if (!open) return null
  return (
    <>
      <div className={styles.scrim} onClick={() => set({ caseFileOpen: false })} aria-hidden="true" />
      <aside className={styles.drawer} aria-label="Case file">
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>Working brief</p>
            <h2>Case file</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={() => set({ caseFileOpen: false })} aria-label="Close case file">
            <Close size={20} />
          </button>
        </header>

        <section className={styles.problem}>
          <div className={styles.problemHead}>
            <p className={styles.eyebrow}>Problem identified</p>
            {problem && <Tag type="blue" size="sm">Hypothesis</Tag>}
          </div>
          {problem ? (
            <>
              <p className={styles.problemText}>{problem.hypothesis ?? problem.note}</p>
              {problem.supportingEvidenceIds.length > 0 && (
                <p className={styles.problemSupport}>
                  Grounded in {problem.supportingEvidenceIds.map((id) => codeById.get(id) ?? 'evidence').join(', ')}
                </p>
              )}
            </>
          ) : (
            <p className={styles.muted}>No problem hypothesis saved yet. Gather signals, then name the client problem when the pattern is clear.</p>
          )}
        </section>

        <div className={styles.drawerTabs} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'evidence'} onClick={() => setTab('evidence')}>Evidence</button>
          <button type="button" role="tab" aria-selected={tab === 'company'} onClick={() => setTab('company')}>Company file</button>
        </div>
        <div className={styles.drawerBody}>
          {tab === 'evidence' ? <EvidenceRegister /> : <CompanyFile />}
        </div>
      </aside>
    </>
  )
}
