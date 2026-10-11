-- Recover learners created after assignment-based access was introduced.
-- Existing assignments are preserved; each unassigned learner receives one
-- randomly selected Live scenario. Administrators can subsequently replace it.
WITH candidates AS (
    SELECT learner.id AS user_id, scenario.scenario_lineage_id,
           row_number() OVER (PARTITION BY learner.id ORDER BY random()) AS choice
    FROM users learner
    CROSS JOIN scenarios scenario
    WHERE learner.role = 'LEARNER' AND scenario.status = 'ACTIVE'
      AND NOT EXISTS (SELECT 1 FROM scenario_assignments assignment WHERE assignment.user_id = learner.id)
)
INSERT INTO scenario_assignments (id, scenario_lineage_id, user_id, created_at, updated_at)
SELECT gen_random_uuid(), scenario_lineage_id, user_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM candidates WHERE choice = 1
ON CONFLICT (scenario_lineage_id, user_id) DO NOTHING;
