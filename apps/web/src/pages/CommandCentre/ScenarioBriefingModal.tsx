import { Modal } from '@carbon/react'
import type { ScenarioSummary } from '@/api/types'
import styles from './CommandCentrePage.module.scss'

export default function ScenarioBriefingModal({
  scenario,
  onCancel,
  onConfirm,
  isPending,
}: {
  scenario: ScenarioSummary
  onCancel: () => void
  onConfirm: () => void
  isPending: boolean
}) {
  const { briefing, difficultyProfile } = scenario
  // Local/dev API instances can still return the pre-problem-frame briefing while
  // a rolling backend deploy is in progress. Keep the start flow usable for both shapes.
  const problemBrief = {
    businessSituation: briefing.businessSituation || scenario.description,
    observableSymptom: briefing.observableSymptom || scenario.description,
    consultingMandate: briefing.consultingMandate || briefing.objective,
    unknownsToValidate: briefing.unknownsToValidate ?? briefing.successCriteria ?? [],
  }
  return (
    <Modal
      open
      modalHeading={scenario.title}
      modalLabel="Scenario Briefing"
      primaryButtonText="Start Engagement"
      secondaryButtonText="Cancel"
      onRequestClose={onCancel}
      onRequestSubmit={onConfirm}
      primaryButtonDisabled={isPending}
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
          <div><span>Business situation</span><p>{problemBrief.businessSituation}</p></div>
          <div><span>Observable symptom</span><p>{problemBrief.observableSymptom}</p></div>
          <div><span>Consulting mandate</span><p>{problemBrief.consultingMandate}</p></div>
          <div><span>Unknowns to validate</span><ul>{problemBrief.unknownsToValidate.map((unknown) => <li key={unknown}>{unknown}</li>)}</ul></div>
        </div>
      </section>

      <section className={styles.briefSection}>
        <h5>Learning objective</h5>
        <p>{briefing.objective}</p>
      </section>

      {(briefing.successCriteria ?? []).length > 0 && (
        <section className={styles.briefSection}>
          <h5>Success criteria</h5>
          <ul>{(briefing.successCriteria ?? []).map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
        </section>
      )}

      <section className={styles.briefSection}>
        <h5>Difficulty</h5>
        <div className={styles.difficulty}>
          <div><span>Information ambiguity</span><span className={styles.stars}>{difficultyProfile.informationAmbiguity}/5</span></div>
          <div><span>Stakeholder complexity</span><span className={styles.stars}>{difficultyProfile.stakeholderComplexity}/5</span></div>
          <div><span>Commercial pressure</span><span className={styles.stars}>{difficultyProfile.commercialPressure}/5</span></div>
        </div>
      </section>
    </Modal>
  )
}
