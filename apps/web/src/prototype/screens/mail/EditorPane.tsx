/**
 * OutreachSelfCheck, dressed as the "Editor" pane a real mail client shows
 * beside a draft. Same four dimensions the assessment uses, same framing: it
 * is the learner's own pre-flight check, never a prediction of the reply.
 */
import { CheckmarkFilled, CircleDash } from '@carbon/icons-react'
import type { RubricCheck } from '@/lifecycle/coaching/outreachRubric'
import styles from './mail.module.scss'

export default function EditorPane({ checks, metCount, words, explain }: { checks: RubricCheck[]; metCount: number; words: number; explain: boolean }) {
  return (
    <aside className={styles.editor} aria-live="polite" aria-label="Editor">
      <header>
        <strong>Editor</strong>
        <span>{metCount} of 4 · {words} {words === 1 ? 'word' : 'words'}</span>
      </header>
      {explain && (
        <p className={styles.editorExplain}>
          These are the four things the client’s team looks for. This is your own check before you send — the client still decides.
        </p>
      )}
      <ul>
        {checks.map((check) => (
          <li key={check.dimension} className={check.met ? styles.checkMet : undefined}>
            {check.met ? <CheckmarkFilled size={16} /> : <CircleDash size={16} />}
            <span>
              <strong>{check.label}</strong>
              {!check.met && <small>{check.advice}</small>}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}
