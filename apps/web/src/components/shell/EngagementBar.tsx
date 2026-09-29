/**
 * The engagement bar, inside the top navigation on every engagement page.
 *
 * Replaces the ten-dot stepper and the Trust / Interest / Patience meters
 * (SRS FR-14: no numbers during play). It carries where you are (room pips and
 * the office map), how the client feels (a sentence), the case file and the
 * step brief.
 */
import { Folder, Information, Map as MapIcon } from '@carbon/icons-react'
import { useResearch } from '@/api/hooks/useLeads'
import { PHASE_LABEL } from '@/lifecycle/phases'
import { ROOMS, roomIndex } from './rooms'
import { briefKey, useShellStore } from './shellStore'
import { useClientCue } from './useClientCue'
import { useShellEngagement } from './useShellEngagement'
import styles from './shell.module.scss'

export default function EngagementBar() {
  const { engagementId, engagement, viewingPhase } = useShellEngagement()
  const setMapOpen = useShellStore((s) => s.setMapOpen)
  const setCaseFileOpen = useShellStore((s) => s.setCaseFileOpen)
  const briefDismissed = useShellStore((s) => s.briefDismissed)
  const setBriefDismissed = useShellStore((s) => s.setBriefDismissed)
  const { data: evidence } = useResearch(engagementId ?? '')
  const client = useClientCue()

  if (!engagement || !viewingPhase || !client) return null

  const current = roomIndex(viewingPhase)
  const reached = roomIndex(engagement.phase)
  const { who, cue } = client
  const usable = (evidence ?? []).filter((item) => item.evidenceType !== 'HYPOTHESIS' && item.verificationStatus !== 'CONTRADICTED').length
  const key = briefKey(engagement.id, viewingPhase)
  const briefHidden = Boolean(briefDismissed[key])

  return (
    <div className={styles.bar} aria-label="Engagement">
      <button type="button" className={styles.barButton} onClick={() => setMapOpen(true)}>
        <MapIcon size={16} /> <span className={styles.barLabel}>Office map</span>
      </button>

      <div className={styles.where}>
        <span className={styles.whereTitle}>{PHASE_LABEL[viewingPhase]}</span>
        {/* The pips are the position; the office map spells it out. */}
        <span className={styles.pips} role="img" aria-label={`${ROOMS[current]?.name ?? ''}, room ${current + 1} of ${ROOMS.length}`}>
          {ROOMS.map((room, index) => (
            <i key={room.id} className={index === current ? styles.pipHere : index < reached || index < current ? styles.pipDone : undefined} />
          ))}
        </span>
      </div>

      {/* The client cue is the most important line here: it wraps, never
          truncates. On a narrow screen it moves under the mentor's line
          (ClientCueRow in MentorLine). */}
      <p className={`${styles.cue} ${styles[`cue_${cue.tone}`]}`} title={cue.text}>
        <span className={styles.cueDot} aria-hidden="true" />
        <span className={styles.cueLine}>
          <strong>{who}</strong> {cue.text}
        </span>
      </p>

      <button type="button" className={styles.barButton} onClick={() => setCaseFileOpen(true)}>
        <Folder size={16} /> <span className={styles.barLabel}>Case file</span>{' '}
        <span className={styles.count} aria-label={`${usable} evidence items`}>{usable}</span>
      </button>
      <button type="button" className={styles.barButton} aria-pressed={!briefHidden} onClick={() => setBriefDismissed(key, !briefHidden)}>
        <Information size={16} /> <span className={styles.barLabel}>{briefHidden ? 'Show brief' : 'Hide brief'}</span>
      </button>
    </div>
  )
}
