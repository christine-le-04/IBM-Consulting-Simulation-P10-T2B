import { CheckmarkFilled, CircleDash } from '@carbon/icons-react'
import styles from './shell.module.scss'

/** A word-only checklist: ticked or not yet, never a score. */
export default function ReadinessList({ items }: { items: { label: string; done: boolean }[] }) {
  return (
    <ul className={styles.readiness}>
      {items.map((item) => (
        <li key={item.label} className={item.done ? styles.readinessDone : ''}>
          {item.done ? <CheckmarkFilled size={16} aria-label="Done" /> : <CircleDash size={16} aria-label="Not yet" />}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  )
}
