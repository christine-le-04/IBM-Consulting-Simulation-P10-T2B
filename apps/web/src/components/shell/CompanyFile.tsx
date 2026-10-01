/**
 * The company file: company size and financial summary (shown from the start),
 * the five intelligence fields revealed as evidence accumulates
 * (GET /lead-intelligence), and the people at the client.
 */
import { InlineLoading } from '@carbon/react'
import { Locked } from '@carbon/icons-react'
import { useLeadIntelligence } from '@/api/hooks/useLeads'
import { useScenario } from '@/api/hooks/useScenarios'
import type { CompanyFact, Engagement, IntelligenceField } from '@/api/types'
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

const TONE_CLASS: Record<CompanyFact['tone'], string | undefined> = {
  NORMAL: undefined,
  WARNING: styles.factWarning,
  ALERT: styles.factAlert,
}

function Facts({ title, facts }: { title: string; facts: CompanyFact[] }) {
  if (facts.length === 0) return null
  return (
    <>
      <p className={styles.blockLabel}>{title}</p>
      <dl className={styles.facts}>
        {facts.map((fact) => (
          <div key={fact.label} className={styles.fact}>
            <dt>{fact.label}</dt>
            <dd className={TONE_CLASS[fact.tone]}>{fact.value}</dd>
          </div>
        ))}
      </dl>
    </>
  )
}

export default function CompanyFile({ engagement }: { engagement: Engagement }) {
  const { data: intel, isLoading } = useLeadIntelligence(engagement.id)
  const { data: scenario } = useScenario(engagement.scenarioId)

  return (
    <div className={styles.company}>
      <h3>{intel?.companyName ?? engagement.leadCompanyName ?? engagement.scenarioTitle}</h3>
      <p className={styles.companySub}>{intel?.industry ?? engagement.scenarioIndustry}</p>

      <Facts title="Company size" facts={(intel?.companyFacts ?? []).filter((f) => f.section === 'SIZE')} />
      <Facts title="Financial summary · last filed accounts" facts={(intel?.companyFacts ?? []).filter((f) => f.section === 'FINANCIAL')} />

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
      {!isLoading && !intel && <p className={styles.muted}>The file fills in as you research the company.</p>}

      {scenario && scenario.personas.length > 0 && (
        <>
          <p className={styles.blockLabel}>Key contacts</p>
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
