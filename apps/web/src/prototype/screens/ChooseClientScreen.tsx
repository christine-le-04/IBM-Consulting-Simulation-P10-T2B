/**
 * Choose a client — revised flow (28 Sep): the scenario is the company, and
 * the client is the person you decide to contact, chosen *after* research.
 * This is SRS FR-06: "pick a lead and contact to pursue".
 *
 * Only the scenario's personas can be chosen, because each one is an AI client
 * the backend can play. Each card shows what is public about the person and
 * what your own research says about them — nothing that gives away who can
 * approve spend, since working that out is the decision being assessed.
 *
 * Backend note: today the persona is fixed when the engagement starts
 * (POST /engagements { personaId }), so choosing it here needs a new endpoint.
 */
import { Button, InlineNotification } from '@carbon/react'
import { ArrowRight } from '@carbon/icons-react'
import { PHASE_LABEL } from '@/lifecycle/phases'
import { SCENARIO } from '../data/scenario'
import { evidenceCode, useProto } from '../state/protoStore'
import { SCREEN_ORDER } from '../state/stages'
import styles from './chooseClient.module.scss'

export default function ChooseClientScreen() {
  const reached = useProto((s) => s.reached)
  const contactId = useProto((s) => s.contactId)
  const evidence = useProto((s) => s.evidence)
  const set = useProto((s) => s.set)
  const go = useProto((s) => s.go)
  const locked = reached > SCREEN_ORDER.indexOf('LEAD') && Boolean(contactId)
  const chosen = SCENARIO.personas.find((persona) => persona.id === contactId)

  const choose = (personaId: string) => {
    set({ contactId: personaId })
    go('OUTREACH')
  }

  return (
    <div className={styles.desk}>
      <div className={styles.intro}>
        <h1>Who at MediCare will you write to?</h1>
        <p>You get one person. Choose the one your research says can act on the problem.</p>
      </div>

      {locked && chosen && (
        <div className={styles.notice}>
          <InlineNotification
            kind="info"
            lowContrast
            hideCloseButton
            title={`You are already emailing ${chosen.name}`}
            subtitle={`You work with one contact at a time. You can choose someone else if ${chosen.name.split(' ')[0]} has not agreed to meet after three emails.`}
          />
          <Button kind="ghost" size="sm" renderIcon={ArrowRight} onClick={() => go('OUTREACH')}>
            Continue to {PHASE_LABEL.OUTREACH}
          </Button>
        </div>
      )}

      <div className={styles.cards}>
        {SCENARIO.personas.map((persona) => {
          const surname = persona.name.split(' ').slice(-1)[0]
          const notes = evidence.filter((item) => item.evidenceType !== 'HYPOTHESIS'
            && `${item.note} ${item.sourceTitle ?? ''}`.includes(surname))
          const isChosen = locked && persona.id === contactId
          return (
            <article key={persona.id} className={`${styles.card} ${isChosen ? styles.cardChosen : ''} ${locked && !isChosen ? styles.cardDimmed : ''}`}>
              <header className={styles.cardHead}>
                <span className={styles.monogram} aria-hidden="true">{persona.name.split(' ').map((part) => part[0]).join('').slice(-2)}</span>
                <div>
                  <h2>{persona.name}</h2>
                  <p>{persona.jobTitle}</p>
                  <p className={styles.org}>{persona.organisation}</p>
                </div>
              </header>

              <div className={styles.section}>
                <p className={styles.label}>On record as caring about</p>
                <p>{persona.visibleConcerns}</p>
              </div>

              <div className={styles.section}>
                <p className={styles.label}>What your research says</p>
                {notes.length ? (
                  <ul className={styles.notes}>
                    {notes.map((item) => (
                      <li key={item.id}>
                        <span>{evidenceCode(item.sequenceNo)}</span>
                        {item.note.split('\n\n')[0]}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.empty}>Nothing yet. You have not saved any evidence about {persona.name.replace('Dr ', '')}.</p>
                )}
              </div>

              <footer className={styles.cardFoot}>
                {isChosen && <span className={styles.chosenNote}>Your contact for this engagement</span>}
                {!isChosen && locked && <span className={styles.lockedNote}>Another contact already chosen</span>}
                {!locked && (
                  <Button size="md" renderIcon={ArrowRight} onClick={() => choose(persona.id)}>
                    Contact {persona.name.replace('Dr ', '').split(' ')[0]}
                  </Button>
                )}
              </footer>
            </article>
          )
        })}
      </div>

      <p className={styles.back}>
        Not sure yet? <button type="button" onClick={() => go('RESEARCH')}>Go back to your research</button>
      </p>
    </div>
  )
}
