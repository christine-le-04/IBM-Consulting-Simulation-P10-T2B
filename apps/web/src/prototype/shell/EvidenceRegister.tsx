import { Tag } from '@carbon/react'
import type { EvidenceVerificationStatus } from '@/api/types'
import { evidenceCode, useProto } from '../state/protoStore'
import styles from './shell.module.scss'

const VERIFICATION_TAG: Record<EvidenceVerificationStatus, 'green' | 'cyan' | 'warm-gray' | 'red'> = {
  VERIFIED: 'green',
  CORROBORATED: 'cyan',
  UNVERIFIED: 'warm-gray',
  CONTRADICTED: 'red',
}

/** The evidence register from EngagementEvidenceHint: usable items only,
 *  newest first, with verification, reasoning lane and confidence. */
export default function EvidenceRegister({ compact = false }: { compact?: boolean }) {
  const evidence = useProto((s) => s.evidence)
  const usable = evidence
    .filter((item) => item.evidenceType !== 'HYPOTHESIS' && item.verificationStatus !== 'CONTRADICTED')
    .sort((a, b) => b.sequenceNo - a.sequenceNo)

  if (usable.length === 0) {
    return <p className={styles.muted}>Nothing saved yet. Use Save beside a paragraph, or select a passage.</p>
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
            {takeaway && !compact && <p className={styles.registerTakeaway}><strong>Takeaway</strong> {takeaway}</p>}
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
