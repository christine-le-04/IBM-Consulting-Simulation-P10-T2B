/**
 * The company file: the five lead-intelligence fields, revealed as evidence
 * accumulates (GET /lead-intelligence), and the people at the client.
 */
import { InlineLoading } from '@carbon/react'
import { Locked } from '@carbon/icons-react'
import { useLeadIntelligence } from '@/api/hooks/useLeads'
import { useScenario } from '@/api/hooks/useScenarios'
import type { Engagement, IntelligenceField } from '@/api/types'
import { evidenceCode } from './evidence'
import styles from './shell.module.scss'

function Reveal({ label, field, unlock }: { label: string; field: IntelligenceField; unlock: string }) {
  return (
    <div className={styles.reveal}>
      <dt>{label}</dt>
      {field.value ? (
        <dd>
          {field.value}
          {field.supportingEvidence.length > 0 && <small>Based on {field.supportingEvidence.map(evidenceCode).join(', ')}</small>}
        </dd>
      ) : (
        <dd className={styles.revealLocked}>
          <Locked size={14} /> {unlock}
        </dd>
      )}
    </div>
  )
}

export default function CompanyFile({ engagement }: { engagement: Engagement }) {
  const { data: intel, isLoading } = useLeadIntelligence(engagement.id)
  const { data: scenario } = useScenario(engagement.scenarioId)

  return (
    <div className={styles.company}>
      <h3>{intel?.companyName ?? engagement.leadCompanyName ?? engagement.scenarioTitle}</h3>
      <p className={styles.companySub}>{intel?.industry ?? engagement.scenarioIndustry}</p>

      <p className={styles.blockLabel}>What your research has revealed</p>
      {isLoading && <InlineLoading description="Loading the company file" />}
      {intel && (
        <dl className={styles.reveals}>
          <Reveal label="Decision maker" field={intel.decisionMaker} unlock="Research stakeholders" />
          <Reveal label="Pain severity" field={intel.painSeverity} unlock="Research company news" />
          <Reveal label="Budget signal" field={intel.budgetSignal} unlock="Research financial signals" />
          <Reveal label="Technology" field={intel.technologyStack} unlock="Research technology" />
          <Reveal label="Potential value" field={intel.potentialValueRange} unlock="Needs financial and stakeholder evidence" />
        </dl>
      )}
      {!isLoading && !intel && <p className={styles.muted}>Choose a lead first — the file fills in as you research them.</p>}

      {scenario && scenario.personas.length > 0 && (
        <>
          <p className={styles.blockLabel}>People at the client</p>
          {scenario.personas.map((person) => (
            <div key={person.id} className={styles.contact}>
              <strong>{person.name}</strong>
              <small>{person.jobTitle}</small>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
