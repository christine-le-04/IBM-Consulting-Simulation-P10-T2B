-- ═══════════════════════════════════════════════════════════════════════════
-- Scenario assignments: a Live scenario is shown only to the consultants
-- (LEARNER accounts) an administrator has assigned to it.
--
-- Assignments belong to the scenario lineage, not to a single revision, so
-- publishing a new revision keeps every existing assignment.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE scenario_assignments (
    id                  UUID PRIMARY KEY,
    scenario_lineage_id UUID        NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by         UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at          TIMESTAMPTZ NOT NULL,
    updated_at          TIMESTAMPTZ NOT NULL,
    version             BIGINT      NOT NULL DEFAULT 0,
    CONSTRAINT uq_scenario_assignments_lineage_user UNIQUE (scenario_lineage_id, user_id)
);

-- The learner catalogue looks assignments up by user.
CREATE INDEX idx_scenario_assignments_user ON scenario_assignments (user_id, scenario_lineage_id);

-- Keep today's behaviour on deploy: every existing learner stays assigned to
-- every scenario that is currently Live. New learners must be assigned.
INSERT INTO scenario_assignments (id, scenario_lineage_id, user_id, created_at, updated_at)
SELECT gen_random_uuid(), live.scenario_lineage_id, learner.id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (SELECT DISTINCT scenario_lineage_id FROM scenarios WHERE status = 'ACTIVE') live
CROSS JOIN users learner
WHERE learner.role = 'LEARNER';
