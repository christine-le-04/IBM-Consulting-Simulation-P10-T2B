-- ═══════════════════════════════════════════════════════════════════════════
-- Generic and Exclusive achievements.
--
-- scenario_lineage_id: NULL for a Generic achievement (counts every scenario);
-- set for an Exclusive one, which only counts runs of that scenario. It refers
-- to the scenario lineage, so a badge keeps working when a new revision of
-- its scenario is published.
--
-- scenario_title_snapshot: the scenario's title when the badge was assigned.
-- Display uses the live title; this is only a fallback.
--
-- unlocked_by_engagement_id: the run whose completion unlocked the badge, so
-- the Review screen can announce it. NULL when awarded retroactively.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE achievements
    ADD COLUMN scenario_lineage_id     UUID REFERENCES scenarios(id),
    ADD COLUMN scenario_title_snapshot VARCHAR(200);

CREATE INDEX idx_achievements_scenario_lineage ON achievements (scenario_lineage_id);

ALTER TABLE user_achievements
    ADD COLUMN unlocked_by_engagement_id UUID REFERENCES engagements(id) ON DELETE SET NULL;
