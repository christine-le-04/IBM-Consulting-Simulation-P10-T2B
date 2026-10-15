-- ═══════════════════════════════════════════════════════════════════════════
-- Starter Generic achievements, so learners see progression from their first
-- run. Admins can edit or deactivate them like any other achievement.
-- Learners who already qualify receive them the next time their achievements
-- are loaded (the learner endpoint re-evaluates before listing).
-- rule_json is the serialised ConditionNode tree used by the rule builder.
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO achievements (id, name, description, icon_key, active, rule_json, created_at, updated_at, version)
VALUES
    ('69000000-0000-0000-0000-000000000001', 'First Engagement',
     'Complete your first consulting engagement.', 'flag', TRUE,
     '{"kind":"LEAF","type":"MIN_ENGAGEMENTS_COMPLETED","threshold":1.0}', NOW(), NOW(), 0),
    ('69000000-0000-0000-0000-000000000002', 'Deal Closer',
     'Win an engagement: the client accepts your proposal.', 'trophy', TRUE,
     '{"kind":"LEAF","type":"MIN_ENGAGEMENTS_WON","threshold":1.0}', NOW(), NOW(), 0),
    ('69000000-0000-0000-0000-000000000003', 'Explorer',
     'Complete engagements in three different scenarios.', 'compass', TRUE,
     '{"kind":"LEAF","type":"MIN_DISTINCT_SCENARIOS_COMPLETED","threshold":3.0}', NOW(), NOW(), 0),
    ('69000000-0000-0000-0000-000000000004', 'Consistent Consultant',
     'Complete three engagements with an average score of 70 or more.', 'chart', TRUE,
     '{"kind":"GROUP","operator":"AND","children":[{"kind":"LEAF","type":"MIN_ENGAGEMENTS_COMPLETED","threshold":3.0},{"kind":"LEAF","type":"MIN_AVERAGE_OVERALL_SCORE","threshold":70.0}]}',
     NOW(), NOW(), 0),
    ('69000000-0000-0000-0000-000000000005', 'Trusted Advisor',
     'Score 85 or more in Relationship Building.', 'handshake', TRUE,
     '{"kind":"LEAF","type":"MIN_COMPETENCY_SCORE","competencyName":"Relationship Building","threshold":85.0}', NOW(), NOW(), 0),
    ('69000000-0000-0000-0000-000000000006', 'Top Performer',
     'Achieve an overall score of 90 or more in an engagement.', 'star', TRUE,
     '{"kind":"LEAF","type":"MIN_BEST_OVERALL_SCORE","threshold":90.0}', NOW(), NOW(), 0)
ON CONFLICT (id) DO NOTHING;
