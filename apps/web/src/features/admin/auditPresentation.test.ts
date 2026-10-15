import { describe, expect, it } from 'vitest'
import type { AdminAuditEvent } from '@/api/hooks/useAdminAuditEvents'
import { auditActionLabel, auditDetails, auditEmail, auditResourceLabel, auditRoleLabel, auditTargetName, auditText } from './auditPresentation'

const id = 'a97e41af-e8c9-4d72-8153-2c8bc721ec1f'
const event = (action: string, details: string | null): AdminAuditEvent => ({
  id, occurredAt: '2026-10-16T00:00:00Z', actorId: id, actorDisplayName: null, actorEmail: null, actorRole: null,
  action, targetType: 'SCENARIO', targetId: id, targetDisplayName: null, targetEmail: null, targetRole: null, details,
})

describe('audit presentation', () => {
  it.each([
    ['ADMIN_ANNOUNCEMENT_PUBLISHED', 'Notice; roles: [LEARNER]', 'Sent to: Learners'],
    ['ADMIN_USER_CREATED', 'learner@example.com', 'Email: learner@example.com'],
    ['ADMIN_USER_DELETED', 'learner@example.com', 'Email: learner@example.com'],
    ['ADMIN_USER_ROLE_CHANGED', 'SCENARIO_AUTHOR', 'New role: Scenario author'],
    ['ADMIN_USER_DEACTIVATED', id, 'deactivated'],
    ['ADMIN_USER_REACTIVATED', id, 'reactivated'],
    ['ADMIN_SCENARIO_CREATED', id, 'draft scenario'],
    ['ADMIN_SCENARIO_PUBLISHED', id, 'published for learners'],
    ['ADMIN_SCENARIO_ARCHIVED', id, 'archived'],
    ['ADMIN_SCENARIO_PERSONA_ADDED', id, 'client contact'],
    ['ADMIN_SCENARIO_RUBRIC_CHANGED', '{Communication=50, CommercialAwareness=50}', 'Commercial awareness: 50%'],
    ['ADMIN_SCENARIO_DIFFICULTY_CHANGED', 'DifficultyProfile[level=HARD, meetingTurnLimit=12, budgetVisible=false]', 'Difficulty: Hard'],
    ['ADMIN_SCENARIO_DOCUMENT_ADDED', `scenario ${id}, title: Market research`, 'Document: Market research'],
    ['ADMIN_SCENARIO_DOCUMENT_UPDATED', `scenario ${id}, title: Market research`, 'Document: Market research'],
    ['ADMIN_SCENARIO_DOCUMENT_DELETED', `scenario ${id}, title: Market research`, 'Document: Market research'],
    ['ADMIN_SCENARIO_BLUEPRINT_UPDATED', id, 'learning objectives'],
    ['ADMIN_SCENARIO_AUTHORING_CONFIG_CHANGED', id, 'facts and learning rules'],
    ['ADMIN_SCENARIO_REVISION_CREATED', `forked from ${id}`, 'draft revision'],
    ['ADMIN_SCENARIO_LEAD_DELETED', `scenario ${id}`, 'company profile'],
    ['ADMIN_SCENARIO_ASSIGNMENTS_UPDATED', 'assigned 2, unassigned 1', 'Assigned to 2 learners.\nRemoved 1 learner assignment.'],
    ['ADMIN_ACHIEVEMENT_CREATED', id, 'badge was created'],
    ['ADMIN_ACHIEVEMENT_UPDATED', id, 'earning rules'],
    ['ADMIN_ACHIEVEMENT_DEACTIVATED', id, 'deactivated'],
    ['ADMIN_ACHIEVEMENT_REACTIVATED', id, 'reactivated'],
  ])('presents %s without raw identifiers or implementation syntax', (action, details, expected) => {
    const text = auditDetails(event(action, details))
    expect(text).toContain(expected)
    expect(text).not.toContain(id)
    expect(text).not.toMatch(/DifficultyProfile|SCENARIO_AUTHOR|\{|\}|forked from|=/)
    expect(auditActionLabel(action)).not.toBe('Administrative change')
    expect(auditActionLabel(action)).not.toContain('_')
  })

  it('uses readable fallbacks for unknown actions, missing details and malformed technical values', () => {
    expect(auditDetails(event('UNKNOWN_INTERNAL_ACTION', `InternalClass[id=${id}]`))).toBe('An administrative change was recorded.')
    expect(auditActionLabel('UNKNOWN_INTERNAL_ACTION')).toBe('Administrative change')
    expect(auditDetails(event('ADMIN_SCENARIO_RUBRIC_CHANGED', '{bad value}'))).toContain('scoring weights were updated')
    expect(auditDetails(event('ADMIN_SCENARIO_DIFFICULTY_CHANGED', 'InternalProfile[]'))).toContain('difficulty settings were updated')
    expect(auditDetails(event('ADMIN_SCENARIO_CREATED', null))).toContain('draft scenario')
    expect(auditDetails(event('ADMIN_SCENARIO_ASSIGNMENTS_UPDATED', 'assigned 0, unassigned 0'))).toBe('No assignments changed.')
  })

  it('uses known titles for document targets without their scenario IDs', () => {
    const document = { ...event('ADMIN_SCENARIO_DOCUMENT_DELETED', `scenario ${id}, title: Research report`), targetType: 'KNOWLEDGE_DOCUMENT' }
    expect(auditTargetName(document)).toBe('Research report')
    expect(auditResourceLabel('KNOWLEDGE_DOCUMENT')).toBe('Document')
    expect(auditResourceLabel('LEAD')).toBe('Company profile')
    expect(auditResourceLabel('ACHIEVEMENT')).toBe('Badge')
    expect(auditRoleLabel('SCENARIO_AUTHOR')).toBe('Scenario author')
    expect(auditRoleLabel('UNKNOWN_ROLE')).toBe('Role unavailable')
  })

  it('removes identifiers from authored titles while preserving readable announcement context', () => {
    const announcement = { ...event('ADMIN_ANNOUNCEMENT_PUBLISHED', `Notice ${id}; roles: [ADMINISTRATOR, LEARNER]`), targetType: 'ANNOUNCEMENT' }
    expect(auditTargetName(announcement)).toBe('Notice')
    expect(auditDetails(announcement)).toBe('Message: Notice\nSent to: Learners, administrators')
    expect(auditText(id)).toBe('')
    expect(auditEmail(`${id}@example.com`)).toBe('')
    expect(auditEmail('learner@example.com')).toBe('learner@example.com')
  })
})
