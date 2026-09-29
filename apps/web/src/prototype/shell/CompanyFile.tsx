/**
 * The company file: the FR-05 profile (size, financial summary, key contacts
 * with roles) plus the five lead-intelligence fields that reveal as evidence
 * accumulates (GET /lead-intelligence — already built, never rendered today).
 */
import { Locked } from '@carbon/icons-react'
import type { IntelligenceField } from '@/api/types'
import { intelligenceFor } from '../data/research'
import { evidenceCode, useProto } from '../state/protoStore'
import styles from './shell.module.scss'

const CONTACTS = [
  { name: 'Sarah Chen', role: 'Chief Operating Officer', tag: 'Can approve above divisional threshold', decider: true },
  { name: 'Dr Alan Whitfield', role: 'Clinical Director', tag: 'Feels the pain, holds no budget', decider: false },
  { name: 'Priya Raman', role: 'Chief Financial Officer', tag: 'Signs off, but will not sponsor', decider: false },
  { name: 'Mark Ellery', role: 'IT Service Manager', tag: 'Operational only', decider: false },
]

function Reveal({ label, field, unlock }: { label: string; field: IntelligenceField; unlock: string }) {
  return (
    <div className={styles.reveal}>
      <dt>{label}</dt>
      {field.value ? (
        <dd>
          {field.value}
          <small>Based on {field.supportingEvidence.map(evidenceCode).join(', ')}</small>
        </dd>
      ) : (
        <dd className={styles.revealLocked}>
          <Locked size={14} /> {unlock}
        </dd>
      )}
    </div>
  )
}

export default function CompanyFile() {
  const evidence = useProto((s) => s.evidence)
  const intel = intelligenceFor(evidence)
  return (
    <div className={styles.company}>
      <h3>{intel.companyName}</h3>
      <p className={styles.companySub}>Healthcare · England · founded 2009</p>

      <p className={styles.blockLabel}>What your research has revealed</p>
      <dl className={styles.reveals}>
        <Reveal label="Decision maker" field={intel.decisionMaker} unlock="Research stakeholders" />
        <Reveal label="Pain severity" field={intel.painSeverity} unlock="Research company news" />
        <Reveal label="Budget signal" field={intel.budgetSignal} unlock="Research financial signals" />
        <Reveal label="Technology" field={intel.technologyStack} unlock="Research technology" />
        <Reveal label="Potential value" field={intel.potentialValueRange} unlock="Needs financial and stakeholder evidence" />
      </dl>

      <p className={styles.blockLabel}>Company size</p>
      <dl className={styles.facts}>
        <div><dt>Sites</dt><dd>12 hospitals</dd></div>
        <div><dt>Staff</dt><dd>~4,800</dd></div>
        <div><dt>Patients / year</dt><dd>~610,000</dd></div>
      </dl>

      <p className={styles.blockLabel}>Financial summary · last filed accounts</p>
      <dl className={styles.facts}>
        <div><dt>Revenue</dt><dd>£412m</dd></div>
        <div><dt>Operating margin</dt><dd className={styles.down}>1.8% (was 3.1%)</dd></div>
        <div><dt>IT capital</dt><dd className={styles.flat}>£6.1m — flat 3 years</dd></div>
      </dl>

      <p className={styles.blockLabel}>Key contacts</p>
      {CONTACTS.map((contact) => (
        <div key={contact.name} className={styles.contact}>
          <strong>{contact.name}</strong>
          <small>{contact.role}</small>
          {/* Who can approve is something research earns, not something the profile gives away. */}
          {intel.decisionMaker.value && (
            <span className={contact.decider ? styles.tagDecider : styles.tagOther}>{contact.tag}</span>
          )}
        </div>
      ))}
      <p className={styles.caveat}>Some of this profile is incomplete on purpose. Judging what matters is the exercise.</p>
    </div>
  )
}
