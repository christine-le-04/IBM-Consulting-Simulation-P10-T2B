import { Button, InlineNotification } from '@carbon/react'
import { ArrowRight } from '@carbon/icons-react'
import type { PersonaSummary } from '@/api/types'
import type { ContactStatus } from '@/lifecycle/contactSelection'
import styles from './ChooseContactPage.module.scss'

const stripTitle = (name: string) => name.replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, '')
export const firstName = (name: string) => stripTitle(name).split(/\s+/)[0]
const initials = (name: string) =>
  stripTitle(name).split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()

export interface ChooseContactViewProps {
  company: string
  contacts: PersonaSummary[]
  chosenId: string | null
  status: ContactStatus
  onChoose: (personaId: string) => void
  onContinue: () => void
  onBackToResearch: () => void
}

/**
 * Choose contact: the last part of the Research step. The learner decides who
 * at the company can actually say yes. Props only, so it can be previewed.
 */
export function ChooseContactView({
  company, contacts, chosenId, status, onChoose, onContinue, onBackToResearch,
}: ChooseContactViewProps) {
  const chosen = contacts.find((c) => c.id === chosenId)
  const canChoose = status !== 'LOCKED'

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Who at {company} will you write to?</h1>
      <p className={styles.lede}>
        Choose the person your research says has the authority to act on the problem.
      </p>

      {chosen && status === 'CHANGEABLE' && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={`You chose ${chosen.name}`}
          subtitle="You can still change your mind until you send your first email."
        />
      )}
      {chosen && status === 'LOCKED' && (
        <InlineNotification
          kind="info"
          lowContrast
          hideCloseButton
          title={`You are emailing ${chosen.name}`}
          subtitle={`You work with one contact at a time. You can choose someone else if ${firstName(chosen.name)} has not agreed to meet after three emails.`}
        />
      )}
      {chosen && status === 'REOPENED' && (
        <InlineNotification
          kind="warning"
          lowContrast
          hideCloseButton
          title={`${chosen.name} did not agree to meet after three emails`}
          subtitle="Choose someone else at the company. Your research is kept."
        />
      )}

      <div className={styles.cards}>
        {contacts.map((contact) => {
          const isChosen = contact.id === chosenId
          const locked = !canChoose && !isChosen
          return (
            <article
              key={contact.id}
              className={[styles.card, isChosen && status !== 'REOPENED' ? styles.chosen : '', locked ? styles.locked : ''].join(' ')}
            >
              <header className={styles.cardHead}>
                <span className={styles.avatar} aria-hidden>{initials(contact.name)}</span>
                <div>
                  <h2 className={styles.name}>{contact.name}</h2>
                  <p className={styles.role}>{contact.jobTitle}</p>
                  <p className={styles.org}>{contact.organisation}</p>
                </div>
              </header>

              <div className={styles.cardBody}>
                <p className={styles.eyebrow}>On record as caring about</p>
                <p>{contact.visibleConcerns}</p>
              </div>

              <footer className={styles.cardFoot}>
                {isChosen && status === 'REOPENED' && <span className={styles.muted}>Three emails used</span>}
                {isChosen && status !== 'REOPENED' && <strong className={styles.chosenLabel}>Your contact</strong>}
                {locked && <span className={styles.muted}>Another contact already chosen</span>}
                {canChoose && !isChosen && (
                  <Button size="sm" kind={chosen ? 'tertiary' : 'primary'} onClick={() => onChoose(contact.id)}>
                    {chosen && status === 'CHANGEABLE' ? `Choose ${firstName(contact.name)} instead` : `Choose ${firstName(contact.name)}`}
                  </Button>
                )}
              </footer>
            </article>
          )
        })}
      </div>

      <div className={styles.footer}>
        <Button kind="ghost" size="sm" onClick={onBackToResearch}>Back to your research</Button>
        {chosen && status !== 'REOPENED' && (
          <Button renderIcon={ArrowRight} onClick={onContinue}>Write to {firstName(chosen.name)}</Button>
        )}
      </div>
    </main>
  )
}
