-- ═══════════════════════════════════════════════════════════════════════════
-- One company per scenario ("Choose a lead" is removed).
--
-- Each scenario had 3-4 copies of its company at different difficulties.
-- Difficulty now belongs to the scenario, so each keeps one copy: the easy one
-- (lowest id if there are several). Anything pointing at another copy is moved
-- onto the kept one first, then the other copies are deleted.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TEMP TABLE v53_kept_lead ON COMMIT DROP AS
SELECT DISTINCT ON (scenario_id) scenario_id, id AS kept_id
FROM leads
ORDER BY scenario_id,
         CASE difficulty WHEN 'EASY' THEN 0 WHEN 'MEDIUM' THEN 1 ELSE 2 END,
         id;

CREATE TEMP TABLE v53_removed_lead ON COMMIT DROP AS
SELECT l.id AS removed_id, k.kept_id
FROM leads l
JOIN v53_kept_lead k ON k.scenario_id = l.scenario_id
WHERE l.id <> k.kept_id;

-- Move engagements and saved evidence onto the kept copy.
UPDATE engagements e
SET selected_lead_id = r.kept_id, updated_at = NOW(), version = e.version + 1
FROM v53_removed_lead r
WHERE e.selected_lead_id = r.removed_id;

UPDATE research_evidence ev
SET lead_id = r.kept_id
FROM v53_removed_lead r
WHERE ev.lead_id = r.removed_id;

-- Engagements still waiting at "Choose a lead" go straight into research.
UPDATE engagements e
SET selected_lead_id = k.kept_id, state = 'CLIENT_INTELLIGENCE', updated_at = NOW(), version = e.version + 1
FROM v53_kept_lead k
WHERE e.scenario_id = k.scenario_id AND e.state = 'QUALIFYING';

-- Delete the other copies.
DELETE FROM lead_signals s USING v53_removed_lead r WHERE s.lead_id = r.removed_id;
DELETE FROM leads l USING v53_removed_lead r WHERE l.id = r.removed_id;

-- From now on: one company profile per scenario.
CREATE UNIQUE INDEX uq_leads_one_per_scenario ON leads (scenario_id);
