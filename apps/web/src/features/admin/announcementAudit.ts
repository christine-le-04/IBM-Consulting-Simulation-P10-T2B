const roleLabels: Record<string, string> = {
  LEARNER: 'learners',
  SCENARIO_AUTHOR: 'scenario authors',
  REVIEWER: 'reviewers',
  ADMINISTRATOR: 'administrators',
}

/** The audit writer stores the title, optionally followed by "; roles: [ENUM, ...]". */
export function announcementAuditContent(details: string) {
  const targeted = /^([\s\S]*); roles: \[([A-Z_, ]+)\]$/.exec(details)
  if (!targeted) return { message: details, audience: 'All users' }
  const selected = targeted[2].split(',').map((role) => role.trim())
  const known = selected.every((role) => Object.hasOwn(roleLabels, role))
  const audience = known
    ? Object.keys(roleLabels).filter((role) => selected.includes(role)).map((role) => roleLabels[role]).join(', ')
    : 'Unknown audience'
  return { message: targeted[1], audience: audience.replace(/^./, (first) => first.toUpperCase()) }
}

export function formatAnnouncementAuditDetails(details: string) {
  const { message, audience } = announcementAuditContent(details)
  return `Message: ${message}\nSent to: ${audience}`
}
