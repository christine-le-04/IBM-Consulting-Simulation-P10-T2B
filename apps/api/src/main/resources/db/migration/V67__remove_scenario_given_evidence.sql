-- ═══════════════════════════════════════════════════════════════════════════
-- Remove the pre-made evidence created when a learner started a scenario:
-- the company profile's public signals, copied into the evidence board as
-- "Scenario briefing" items (origin SCENARIO_GIVEN). New runs no longer get
-- them, so they are removed from every existing run, in progress or finished.
--
-- Links between evidence items are deleted with them (ON DELETE CASCADE).
-- Pre-made items were always numbered first (E-01, E-02), so each affected
-- run's remaining evidence is renumbered from 1 in its existing order.
-- Without this, the next item a learner adds (numbered count + 1) would
-- duplicate an existing number.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TEMP TABLE v67_affected_engagement ON COMMIT DROP AS
SELECT DISTINCT engagement_id
FROM research_evidence
WHERE origin = 'SCENARIO_GIVEN';

DELETE FROM research_evidence
WHERE origin = 'SCENARIO_GIVEN';

WITH ordered AS (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY engagement_id ORDER BY sequence_no, created_at, id) AS rn
    FROM research_evidence
    WHERE engagement_id IN (SELECT engagement_id FROM v67_affected_engagement)
)
UPDATE research_evidence r
SET sequence_no = ordered.rn, updated_at = NOW(), version = r.version + 1
FROM ordered
WHERE r.id = ordered.id
  AND r.sequence_no <> ordered.rn;
