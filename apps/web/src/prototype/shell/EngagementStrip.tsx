/**
 * 1 · The strip — always on screen (design doc §5.3).
 *
 * Replaces the ten-dot stepper, the three Trust/Interest/Patience meters and
 * every in-page readiness figure. It carries four of the five payloads:
 * where you are (stage pips + Office map), relationship state (a cue, FR-14),
 * what is still missing (the manager's line, Option C) and the brief (Show brief).
 *
 * It lives inside the top navigation bar (EngagementBar) with the manager's
 * line as one thin row beneath (ManagerLine), so an engagement page gives up
 * one header's height instead of two.
 */
import { Map as MapIcon, Folder, Information } from '@carbon/icons-react'
import { ENGAGEMENT, SCENARIO } from '../data/scenario'
import { MANAGER, meetingCue, preMeetingCue, type ClientCue } from '../data/voice'
import { MOOD_STATE, useProto } from '../state/protoStore'
import { STAGES, SCREEN_LABEL, screenIndex, stageIndex } from '../state/stages'
import { useBriefOpen, useManagerLine } from './managerLine'
import DanaAvatar from './DanaAvatar'
import NextStepButton from './NextStepButton'
import styles from './shell.module.scss'

function useClientCue(): ClientCue {
  const screen = useProto((s) => s.screen)
  const mood = useProto((s) => s.mood)
  const outreach = useProto((s) => s.outreachVariant)
  const beforeMeeting = screenIndex(screen) < screenIndex('MEETING')
  if (!beforeMeeting) return meetingCue(MOOD_STATE[mood])
  if (screenIndex(screen) < screenIndex('OUTREACH')) {
    return { tone: 'unmet', text: 'You have not chosen who to contact yet. Nobody at MediCare knows you.' }
  }
  return preMeetingCue(screen === 'OUTREACH' ? outreach : 'MEETING_SECURED')
}

/** Sits in the top navigation bar on every engagement screen. */
export function EngagementBar() {
  const screen = useProto((s) => s.screen)
  const set = useProto((s) => s.set)
  const evidence = useProto((s) => s.evidence)
  const briefDismissed = useProto((s) => s.briefDismissed)
  const contactId = useProto((s) => s.contactId)
  const cue = useClientCue()
  const contact = SCENARIO.personas.find((persona) => persona.id === contactId)
  const choosing = screenIndex(screen) < screenIndex('OUTREACH')
  const who = choosing || !contact ? ENGAGEMENT.leadCompanyName : contact.name
  const current = stageIndex(screen)
  const usable = evidence.filter((item) => item.evidenceType !== 'HYPOTHESIS' && item.verificationStatus !== 'CONTRADICTED').length

  return (
    <div className={styles.bar} aria-label="Engagement">
      <button type="button" className={styles.barButton} onClick={() => set({ mapOpen: true })}>
        <MapIcon size={16} /> <span className={styles.barLabel}>Office map</span>
      </button>

      <div className={styles.where}>
        <span className={styles.whereTitle}>{SCREEN_LABEL[screen]}</span>
        {/* The pips are the position; the Office map spells it out. */}
        <span className={styles.pips} role="img" aria-label={`Stage ${current + 1} of ${STAGES.length}`}>
          {STAGES.map((item, index) => (
            <i key={item.id} className={index < current ? styles.pipDone : index === current ? styles.pipHere : undefined} />
          ))}
        </span>
      </div>

      {/* The client cue is the most important line here: it wraps, never truncates. */}
      <p className={`${styles.cue} ${styles[`cue_${cue.tone}`]}`}>
        <span className={styles.cueDot} aria-hidden="true" />
        <span className={styles.cueLine}>
          <strong>{who}</strong> {cue.text}
        </span>
      </p>

      <button type="button" className={styles.barButton} onClick={() => set({ caseFileOpen: true })}>
        <Folder size={16} /> <span className={styles.barLabel}>Case file</span> <span className={styles.count}>{usable}</span>
      </button>
      <button
        type="button"
        className={styles.barButton}
        aria-pressed={!briefDismissed[screen]}
        onClick={() => set({ briefDismissed: { ...briefDismissed, [screen]: !briefDismissed[screen] } })}
      >
        <Information size={16} /> <span className={styles.barLabel}>{briefDismissed[screen] ? 'Show brief' : 'Hide brief'}</span>
      </button>
    </div>
  )
}

/**
 * The manager's one line (Option C), as a thin row under the header. While the
 * step brief is open the line moves inside it, so the two never stack.
 */
export function ManagerLine() {
  const line = useManagerLine()
  const briefOpen = useBriefOpen()
  if (!line || briefOpen) return null
  return (
    <p className={styles.managerLine}>
      <DanaAvatar size={24} />
      <span className={styles.managerName}>{MANAGER.name}</span>
      <span className={styles.managerText}>“{line}”</span>
      <NextStepButton />
    </p>
  )
}
