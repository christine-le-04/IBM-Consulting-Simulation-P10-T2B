/**
 * The case file — opens in place, closes again. Replaces the floating
 * lightbulb (EngagementEvidenceHint) with the same content: the current
 * problem hypothesis and the usable evidence register, plus the company file.
 */
import { useState } from 'react'
import { InlineLoading, Tag } from '@carbon/react'
import { Close } from '@carbon/icons-react'
import { useResearch } from '@/api/hooks/useLeads'
import CompanyFile from './CompanyFile'
import { currentHypothesis, evidenceCode } from './evidence'
import EvidenceRegister from './EvidenceRegister'
import { useShellStore } from './shellStore'
import { useShellEngagement } from './useShellEngagement'
import styles from './shell.module.scss'

export default function CaseFilePanel() {
  const open = useShellStore((s) => s.caseFileOpen)
  const setCaseFileOpen = useShellStore((s) => s.setCaseFileOpen)
  const { engagementId, engagement } = useShellEngagement()
  const { data: evidence, isLoading } = useResearch(engagementId ?? '')
  const [tab, setTab] = useState<'evidence' | 'company'>('evidence')

  if (!open || !engagement) return null
  const problem = currentHypothesis(evidence)
  const codeById = new Map((evidence ?? []).map((item) => [item.id, evidenceCode(item.sequenceNo)]))
  const close = () => setCaseFileOpen(false)

  return (
    <>
      <div className={styles.scrim} onClick={close} aria-hidden="true" />
      <aside className={styles.drawer} aria-label="Case file">
        <header className={styles.drawerHeader}>
          <div>
            <p className={styles.eyebrow}>Working brief</p>
            <h2>Case file</h2>
          </div>
          <button type="button" className={styles.iconButton} onClick={close} aria-label="Close case file">
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
          {tab === 'evidence'
            ? isLoading ? <InlineLoading description="Loading evidence" /> : <EvidenceRegister evidence={evidence} />
            : <CompanyFile engagement={engagement} />}
        </div>
      </aside>
    </>
  )
}
