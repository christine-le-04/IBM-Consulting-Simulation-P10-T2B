import { Tag } from '@carbon/react'
import type { EvidenceVerificationStatus, ResearchEvidence } from '@/api/types'
import { evidenceCode, usableEvidence } from './evidence'
import styles from './shell.module.scss'

const VERIFICATION_TAG: Record<EvidenceVerificationStatus, 'green' | 'cyan' | 'warm-gray' | 'red'> = {
  VERIFIED: 'green',
  CORROBORATED: 'cyan',
  UNVERIFIED: 'warm-gray',
  CONTRADICTED: 'red',
}

/** Usable evidence, newest first, with verification, reasoning lane and confidence. */
export default function EvidenceRegister({ evidence }: { evidence: ResearchEvidence[] | undefined }) {
  const usable = usableEvidence(evidence)
  if (usable.length === 0) {
    return <p className={styles.muted}>No usable evidence yet. Evidence you save during research and the meeting appears here.</p>
  }

  return (
    <div className={styles.register}>
      {usable.map((item) => {
        const [finding, takeaway] = item.note.split('\n\nConsulting takeaway: ')
        return (
          <article key={item.id} className={styles.registerItem}>
            <div className={styles.registerMeta}>
              <span className={styles.code}>{evidenceCode(item.sequenceNo)}</span>
              <span className={styles.registerSource}>{item.sourceTitle ?? item.evidenceType.replace(/_/g, ' ')}</span>
              <Tag type={VERIFICATION_TAG[item.verificationStatus]} size="sm">{item.verificationStatus.toLowerCase()}</Tag>
            </div>
            <q className={styles.registerQuote}>{finding}</q>
            {takeaway && <p className={styles.registerTakeaway}><strong>Takeaway</strong> {takeaway}</p>}
            <div className={styles.registerFoot}>
              <span>{item.reasoningLane?.replace(/_/g, ' ').toLowerCase() ?? 'general signal'}</span>
              <span>{item.confidence.toLowerCase()} confidence</span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
