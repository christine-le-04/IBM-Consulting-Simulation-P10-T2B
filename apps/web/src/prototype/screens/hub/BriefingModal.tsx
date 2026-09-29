/** Scenario briefing, field for field from CommandCentrePage's ScenarioBriefingModal. */
import { Modal } from '@carbon/react'
import type { ScenarioSummary } from '@/api/types'
import styles from './hub.module.scss'

function Stars({ value }: { value: number }) {
  return <span className={styles.stars}>{value}/5</span>
}

export default function BriefingModal({ scenario, onCancel, onConfirm }: {
  scenario: ScenarioSummary | null
  onCancel: () => void
  onConfirm: () => void
}) {
  if (!scenario) return null
  const { briefing, difficultyProfile } = scenario
  return (
    <Modal
      open
      modalHeading={scenario.title}
      modalLabel="Scenario Briefing"
      primaryButtonText="Start Engagement"
      secondaryButtonText="Cancel"
      onRequestClose={onCancel}
      onRequestSubmit={onConfirm}
      size="md"
    >
      <div className={styles.briefMeta}>
        <div><span>Your role</span><strong>{briefing.consultantRole}</strong></div>
        <div><span>Industry</span><strong>{scenario.industry}</strong></div>
        <div><span>Simulated time</span><strong>{briefing.simulatedDays} days</strong></div>
      </div>
      <section className={styles.briefSection}>
        <h5>Client problem briefing</h5>
        <div className={styles.problemGrid}>
          <div><span>Business situation</span><p>{briefing.businessSituation}</p></div>
          <div><span>Observable symptom</span><p>{briefing.observableSymptom}</p></div>
          <div><span>Consulting mandate</span><p>{briefing.consultingMandate}</p></div>
          <div><span>Unknowns to validate</span><ul>{briefing.unknownsToValidate.map((item) => <li key={item}>{item}</li>)}</ul></div>
        </div>
      </section>
      <section className={styles.briefSection}>
        <h5>Learning objective</h5>
        <p>{briefing.objective}</p>
      </section>
      <section className={styles.briefSection}>
        <h5>Success criteria</h5>
        <ul>{briefing.successCriteria.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className={styles.briefSection}>
        <h5>Difficulty</h5>
        <div className={styles.difficulty}>
          <div><span>Information ambiguity</span><Stars value={difficultyProfile.informationAmbiguity} /></div>
          <div><span>Stakeholder complexity</span><Stars value={difficultyProfile.stakeholderComplexity} /></div>
          <div><span>Commercial pressure</span><Stars value={difficultyProfile.commercialPressure} /></div>
        </div>
      </section>
    </Modal>
  )
}
