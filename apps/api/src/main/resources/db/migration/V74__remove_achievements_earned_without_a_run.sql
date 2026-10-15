-- ═══════════════════════════════════════════════════════════════════════════
-- Remove achievements awarded to learners who never completed a run in the
-- achievement's scope. A rule with a threshold of 0 (e.g. "average score at
-- least 0") counted as met with no runs at all, so learners could earn an
-- Exclusive badge for a scenario they had never started.
--
-- The evaluator now requires at least one completed run in scope, and new
-- rules can't use a threshold of 0. Completed = CLIENT_DECISION, REVIEW or
-- COMPLETED, as in AchievementFactSheetBuilder. Exclusive scope = any revision
-- of the badge's scenario lineage.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM user_achievements ua
USING achievements a
WHERE a.id = ua.achievement_id
  AND NOT EXISTS (
      SELECT 1
      FROM engagements e
      WHERE e.user_id = ua.user_id
        AND e.state IN ('CLIENT_DECISION', 'REVIEW', 'COMPLETED')
        AND (a.scenario_lineage_id IS NULL
             OR e.scenario_id IN (SELECT s.id FROM scenarios s
                                  WHERE s.scenario_lineage_id = a.scenario_lineage_id)));
