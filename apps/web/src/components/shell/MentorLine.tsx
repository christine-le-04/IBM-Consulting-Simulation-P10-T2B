/**
 * The mentor's one line, as a thin row under the header. A page sets it from
 * its own state; otherwise it reads the engagement's next action. While the
 * step brief is open the line moves inside it, so the two never stack.
 */
import DanaAvatar from './DanaAvatar'
import { MENTOR } from './mentor'
import NextStepButton from './NextStepButton'
import { useBriefOpen, useMentorLine } from './mentorHooks'
import { useClientCue } from './useClientCue'
import styles from './shell.module.scss'

/** The client cue in full, on screens too narrow to hold it in the header. */
function ClientCueRow() {
  const client = useClientCue()
  if (!client) return null
  return (
    <p className={`${styles.cueRow} ${styles[`cue_${client.cue.tone}`]}`}>
      <span className={styles.cueDot} aria-hidden="true" />
      <span className={styles.cueLine}>
        <strong>{client.who}</strong> {client.cue.text}
      </span>
    </p>
  )
}

export default function MentorLine() {
  const line = useMentorLine()
  const briefOpen = useBriefOpen()
  return (
    <>
      {line && !briefOpen && (
        <p className={styles.mentorLine}>
          <DanaAvatar size={24} />
          <span className={styles.mentorName}>{MENTOR.name}</span>
          <span className={styles.mentorText}>“{line}”</span>
          <NextStepButton />
        </p>
      )}
      <ClientCueRow />
    </>
  )
}
