/**
 * Prepare — design doc §4 screen 5. The readiness score and its advice panels
 * become one sentence from the manager plus a word-only checklist (FR-14).
 * The three items are the real rule's essentials (objective 20, agenda 10
 * each, questions 8 each, meeting opens at 70): with all three met the score
 * is at least 74. The learner is never shown the arithmetic, and Join is never
 * locked — pressing it early shows what is missing first.
 *
 * Skin: the meeting as it sits in a calendar, with the plan written into it,
 * and a notepad for the questions only you will see.
 */
import { useEffect, useState } from 'react'
import { Button, Tag } from '@carbon/react'
import { Add, ArrowRight, Calendar, TrashCan } from '@carbon/icons-react'
import { PREPARATION } from '../data/engagementFlow'
import { useProto } from '../state/protoStore'
import GatedButton from '../shell/GatedButton'
import ReadinessList from '../shell/ReadinessList'
import styles from './prepare.module.scss'

function ListEditor({ items, onChange, placeholder, itemLabel, lined = false }: {
  items: string[]
  onChange: (items: string[]) => void
  placeholder: string
  itemLabel: string
  lined?: boolean
}) {
  return (
    <div className={lined ? styles.linedList : styles.agendaList}>
      <ol>
        {items.map((value, index) => (
          <li key={index}>
            <span className={styles.itemNumber}>{index + 1}</span>
            <input
              value={value}
              placeholder={placeholder}
              aria-label={`${itemLabel} ${index + 1}`}
              onChange={(event) => onChange(items.map((item, position) => position === index ? event.target.value : item))}
            />
            <button type="button" aria-label={`Remove ${itemLabel.toLowerCase()} ${index + 1}`} onClick={() => onChange(items.length === 1 ? [''] : items.filter((_, position) => position !== index))}>
              <TrashCan size={16} />
            </button>
          </li>
        ))}
      </ol>
      <button type="button" className={styles.addItem} onClick={() => onChange([...items, ''])}>
        <Add size={16} /> Add {itemLabel.toLowerCase()}
      </button>
    </div>
  )
}

export default function PrepareScreen() {
  const set = useProto((s) => s.set)
  const go = useProto((s) => s.go)
  const [objective, setObjective] = useState(PREPARATION.objective ?? '')
  const [agenda, setAgenda] = useState<string[]>([...PREPARATION.agenda, ''])
  const [questions, setQuestions] = useState<string[]>([...PREPARATION.discoveryQuestions, ''])
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved'>('idle')

  const agendaCount = agenda.filter((item) => item.trim()).length
  const questionCount = questions.filter((item) => item.trim()).length
  const objectiveReady = objective.trim().length > 0
  const checklist = [
    { label: 'A clear outcome you need from the meeting', done: objectiveReady },
    { label: 'An agenda with at least three points', done: agendaCount >= 3 },
    { label: 'At least three open questions to ask', done: questionCount >= 3 },
  ]
  const ready = checklist.every((item) => item.done)

  // One sentence, said at the door — replaces five readiness statements.
  const line = !objectiveReady
    ? 'Write the business outcome you need to validate in this conversation.'
    : agendaCount < 3
      ? 'Give Sarah a clear shape for the half hour — three agenda points is enough.'
      : questionCount < 3
        ? 'Add open questions that uncover impact, constraints and who decides.'
        : 'Your plan covers the essentials. Join when you are prepared.'
  useEffect(() => { set({ liveLine: line }) }, [line, set])

  const save = () => {
    setSaved('saving')
    window.setTimeout(() => setSaved('saved'), 700)
  }

  return (
    <div className={styles.page}>
      <div className={styles.event}>
        <header className={styles.eventBar}>
          <div className={styles.eventTitle}>
            <Calendar size={20} />
            <div>
              <h1>Meeting with Sarah Chen</h1>
              <p>Chief Operating Officer · MediCare Regional Hospital Network <Tag type="green" size="sm">Accepted</Tag></p>
            </div>
          </div>
          <div className={styles.eventActions}>
            <span className={styles.saveState}>
              {saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Plan saved' : 'Saved in this browser as you type'}
            </span>
            <Button kind="tertiary" onClick={save}>Save plan</Button>
            <GatedButton
              renderIcon={ArrowRight}
              notReadyKind="secondary"
              ready={ready}
              checklist={checklist}
              title="Before you join the meeting"
              stayLabel="Keep preparing"
              onGo={() => go('MEETING')}
            >
              Join meeting
            </GatedButton>
          </div>
        </header>


        <div className={styles.columns}>
          <section className={styles.invite} aria-label="Meeting plan">
            <label className={styles.objective}>
              <span className={styles.label}>What you need to leave with</span>
              <textarea
                maxLength={300}
                rows={3}
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                placeholder="e.g. Validate the operational problem, quantify its impact and agree a low-risk next step."
              />
              <small>{objective.trim().length}/300</small>
            </label>

            <div className={styles.block}>
              <span className={styles.label}>Agenda — shared with Sarah</span>
              <ListEditor items={agenda} onChange={setAgenda} itemLabel="Agenda item" placeholder="e.g. Confirm meeting objectives" />
            </div>

            <section className={styles.readiness} aria-label="Before you join the meeting">
              <span className={styles.label}>Before you join the meeting</span>
              <ReadinessList items={checklist} />
            </section>
          </section>

          <section className={styles.notepad} aria-label="Discovery questions">
            <p className={styles.notepadTitle}>Questions to ask</p>
            <p className={styles.notepadHint}>Only you see these. Open questions reveal what the brief did not.</p>
            <ListEditor lined items={questions} onChange={setQuestions} itemLabel="Question" placeholder="e.g. Which operational issue has the highest impact?" />
          </section>
        </div>
      </div>
    </div>
  )
}
