import type { AdminAuditEvent } from '@/api/hooks/useAdminAuditEvents'
import { announcementAuditContent, formatAnnouncementAuditDetails } from './announcementAudit'

const actions: Record<string, { label: string; summary: string }> = {
  ADMIN_ANNOUNCEMENT_PUBLISHED: { label: 'Announcement published', summary: 'An announcement was published.' },
  ADMIN_ANNOUNCEMENT_SCHEDULED: { label: 'Announcement scheduled', summary: 'An announcement was scheduled for later publication.' },
  ADMIN_ANNOUNCEMENT_WITHDRAWN: { label: 'Announcement withdrawn', summary: 'The announcement was withdrawn from recipient feeds.' },
  ADMIN_USER_CREATED: { label: 'User created', summary: 'A user account was created.' },
  ADMIN_USER_DELETED: { label: 'User deleted', summary: 'The user account was deleted.' },
  ADMIN_USER_ROLE_CHANGED: { label: 'User role changed', summary: 'The user’s role was updated.' },
  ADMIN_USER_DEACTIVATED: { label: 'User deactivated', summary: 'The user account was deactivated.' },
  ADMIN_USER_REACTIVATED: { label: 'User reactivated', summary: 'The user account was reactivated.' },
  ADMIN_SCENARIO_CREATED: { label: 'Scenario created', summary: 'A draft scenario was created.' },
  ADMIN_SCENARIO_PUBLISHED: { label: 'Scenario published', summary: 'The scenario was published for learners.' },
  ADMIN_SCENARIO_ARCHIVED: { label: 'Scenario archived', summary: 'The scenario was archived.' },
  ADMIN_SCENARIO_PERSONA_ADDED: { label: 'Scenario contact added', summary: 'A client contact was added to the scenario.' },
  ADMIN_SCENARIO_RUBRIC_CHANGED: { label: 'Scoring weights changed', summary: 'The scenario’s scoring weights were updated.' },
  ADMIN_SCENARIO_DIFFICULTY_CHANGED: { label: 'Difficulty settings changed', summary: 'The scenario’s difficulty settings were updated.' },
  ADMIN_SCENARIO_DOCUMENT_ADDED: { label: 'Document added', summary: 'A scenario document was added.' },
  ADMIN_SCENARIO_DOCUMENT_UPDATED: { label: 'Document updated', summary: 'A scenario document was updated.' },
  ADMIN_SCENARIO_DOCUMENT_DELETED: { label: 'Document deleted', summary: 'A scenario document was deleted.' },
  ADMIN_SCENARIO_BLUEPRINT_UPDATED: { label: 'Scenario details updated', summary: 'The scenario’s description and learning objectives were updated.' },
  ADMIN_SCENARIO_AUTHORING_CONFIG_CHANGED: { label: 'Scenario rules updated', summary: 'The scenario’s facts and learning rules were updated.' },
  ADMIN_SCENARIO_REVISION_CREATED: { label: 'Draft revision created', summary: 'A new draft revision was created from an existing scenario.' },
  ADMIN_SCENARIO_LEAD_DELETED: { label: 'Company profile deleted', summary: 'The company profile was deleted from its scenario.' },
  ADMIN_SCENARIO_ASSIGNMENTS_UPDATED: { label: 'Scenario assignments updated', summary: 'The scenario’s learner assignments were updated.' },
  ADMIN_ACHIEVEMENT_CREATED: { label: 'Badge created', summary: 'A badge was created.' },
  ADMIN_ACHIEVEMENT_UPDATED: { label: 'Badge updated', summary: 'The badge’s details or earning rules were updated.' },
  ADMIN_ACHIEVEMENT_DEACTIVATED: { label: 'Badge deactivated', summary: 'The badge was deactivated.' },
  ADMIN_ACHIEVEMENT_REACTIVATED: { label: 'Badge reactivated', summary: 'The badge was reactivated.' },
}
const resources: Record<string, string> = {
  USER: 'User', SCENARIO: 'Scenario', LEAD: 'Company profile', KNOWLEDGE_DOCUMENT: 'Document', ACHIEVEMENT: 'Badge', ANNOUNCEMENT: 'Announcement',
}
const roles: Record<string, string> = {
  LEARNER: 'Learner', SCENARIO_AUTHOR: 'Scenario author', REVIEWER: 'Reviewer', ADMINISTRATOR: 'Administrator',
}
export const auditActionLabel = (value: string) => actions[value]?.label ?? 'Administrative change'
export const auditResourceLabel = (value: string) => Object.hasOwn(resources, value) ? resources[value] : 'Resource'
export const auditRoleLabel = (value: string) => Object.hasOwn(roles, value) ? roles[value] : 'Role unavailable'

/** Identifiers remain in the audit record, but never need to appear as visible text. */
export function auditText(value: string | null | undefined) {
  return (value ?? '').replace(/\b[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}\b/gi, '')
    .replace(/\b[\da-f]{32}\b/gi, '').replace(/ {2,}/g, ' ').replace(/[ \t]+$/gm, '').trim()
}

export function auditEmail(value: string | null | undefined) {
  const email = value?.trim() ?? ''
  return auditText(email) === email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : ''
}

function documentTitle(details: string | null) {
  return details ? auditText(/^scenario [^,]+, title: ([\s\S]*)$/.exec(details)?.[1]) : ''
}
export function auditTargetName(item: AdminAuditEvent) {
  if (item.action === 'ADMIN_ANNOUNCEMENT_WITHDRAWN') return auditText(item.details)
  if (item.targetType === 'ANNOUNCEMENT' && ['ADMIN_ANNOUNCEMENT_PUBLISHED', 'ADMIN_ANNOUNCEMENT_SCHEDULED'].includes(item.action) && item.details) {
    return auditText(announcementAuditContent(item.details).message)
  }
  if (item.targetType === 'KNOWLEDGE_DOCUMENT') return documentTitle(item.details)
  return auditText(item.targetDisplayName)
}

const difficultyFields: [string, string, string][] = [
  ['researchArtifactsPerAction', 'Research sources per action', ''],
  ['distractorArtifactsPerAction', 'Distractor sources per action', ''],
  ['contradictionCount', 'Contradictory sources', ''],
  ['initialTrust', 'Starting trust', '/100'], ['initialInterest', 'Starting interest', '/100'],
  ['initialPatience', 'Starting patience', '/100'], ['meetingTurnLimit', 'Meeting limit', ' turns'],
  ['timelinePressureDays', 'Timeline', ' days'], ['requiredEvidenceCount', 'Evidence required', ' items'],
  ['requiredConfidencePercent', 'Required confidence', '%'], ['outreachAcceptanceThreshold', 'Outreach acceptance score', '%'],
  ['proposalEvidenceCoverageThreshold', 'Proposal evidence coverage', '%'], ['personaResistance', 'Client resistance', '/100'],
  ['scoringTolerance', 'Scoring tolerance', '%'],
]
function difficultyDetails(details: string) {
  const lines: string[] = []
  const level = /\blevel=(EASY|MEDIUM|HARD)\b/.exec(details)?.[1]
  if (level) lines.push(`Difficulty: ${level[0]}${level.slice(1).toLowerCase()}`)
  for (const [field, label, unit] of difficultyFields) {
    const value = new RegExp(`\\b${field}=(\\d+)\\b`).exec(details)?.[1]
    if (value) lines.push(`${label}: ${value}${unit}`)
  }
  const visible = /\bbudgetVisible=(true|false)\b/.exec(details)?.[1]
  if (visible) lines.push(`Budget shown: ${visible === 'true' ? 'Yes' : 'No'}`)
  return lines.join('\n')
}

function assignmentDetails(details: string) {
  try {
    const value: unknown = JSON.parse(details)
    if (!value || typeof value !== 'object') return ''
    const record = value as { scenario?: unknown; assigned?: unknown; unassigned?: unknown }
    if (typeof record.scenario !== 'string' || !Array.isArray(record.assigned) || !Array.isArray(record.unassigned)) return ''
    const formatUsers = (users: unknown[]): { displayName: string; email: string }[] => users.flatMap((user) => {
      if (!user || typeof user !== 'object') return []
      const assignee = user as { displayName?: unknown; email?: unknown }
      if (typeof assignee.displayName !== 'string' || typeof assignee.email !== 'string') return []
      return [{ displayName: auditText(assignee.displayName), email: auditEmail(assignee.email) }]
    })
    const assigned = formatUsers(record.assigned)
    const unassigned = formatUsers(record.unassigned)
    const scenario = auditText(record.scenario)
    const lines: string[] = []

    if (assigned.length === 1) {
      lines.push(`Assigned ${scenario} to ${assigned[0].displayName} (${assigned[0].email})`)
    } else if (assigned.length > 1) {
      lines.push(`Assigned to ${assigned.length} users.`)
      lines.push(...assigned.map((user) => `• Assigned ${scenario} to ${user.displayName} (${user.email})`))
    }

    if (unassigned.length === 1) {
      lines.push(`Unassigned ${scenario} from ${unassigned[0].displayName} (${unassigned[0].email})`)
    } else if (unassigned.length > 1) {
      lines.push(`Unassigned from ${unassigned.length} users.`)
      lines.push(...unassigned.map((user) => `• Unassigned ${scenario} from ${user.displayName} (${user.email})`))
    }

    return lines.join('\n') || 'No assignments changed.'
  } catch {
    return ''
  }
}

export function auditDetails(item: AdminAuditEvent) {
  const fallback = actions[item.action]?.summary ?? 'An administrative change was recorded.'
  if (!item.details) return item.action === 'ADMIN_ANNOUNCEMENT_PUBLISHED' ? 'No additional details' : fallback
  switch (item.action) {
    case 'ADMIN_ANNOUNCEMENT_SCHEDULED':
    case 'ADMIN_ANNOUNCEMENT_PUBLISHED': return auditText(formatAnnouncementAuditDetails(item.details)) || fallback
    case 'ADMIN_USER_CREATED':
    case 'ADMIN_USER_DELETED': {
      const email = auditEmail(item.targetEmail || item.details)
      return email ? `Email: ${email}` : fallback
    }
    case 'ADMIN_USER_ROLE_CHANGED': return Object.hasOwn(roles, item.details) ? `New role: ${roles[item.details]}` : fallback
    case 'ADMIN_SCENARIO_DOCUMENT_ADDED':
    case 'ADMIN_SCENARIO_DOCUMENT_UPDATED':
    case 'ADMIN_SCENARIO_DOCUMENT_DELETED': return documentTitle(item.details) ? `Document: ${documentTitle(item.details)}` : fallback
    case 'ADMIN_SCENARIO_ASSIGNMENTS_UPDATED': {
      const detailed = assignmentDetails(item.details)
      if (detailed) return detailed
      const counts = /^assigned (\d+), unassigned (\d+)$/.exec(item.details)
      if (!counts) return fallback
      const lines = []
      if (Number(counts[1])) lines.push(`Assigned to ${counts[1]} learner${counts[1] === '1' ? '' : 's'}.`)
      if (Number(counts[2])) lines.push(`Removed ${counts[2]} learner assignment${counts[2] === '1' ? '' : 's'}.`)
      return lines.join('\n') || 'No assignments changed.'
    }
    case 'ADMIN_SCENARIO_RUBRIC_CHANGED': {
      const weights = /^\{(.*)\}$/.exec(item.details)?.[1].split(',').map((entry) => /^\s*([^=]+)=(\d+)\s*$/.exec(entry))
      if (!weights?.length || weights.some((entry) => !entry)) return fallback
      const lines = weights.flatMap((entry) => {
        if (!entry) return []
        const name = auditText(entry[1]).replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll('_', ' ').trim().toLowerCase()
        return name ? [`${name[0].toUpperCase()}${name.slice(1)}: ${entry[2]}%`] : []
      })
      return lines.join('\n') || fallback
    }
    case 'ADMIN_SCENARIO_DIFFICULTY_CHANGED': return difficultyDetails(item.details) || fallback
    default: return fallback
  }
}
