ALTER TABLE meetings ADD COLUMN performance_score INTEGER CHECK (performance_score BETWEEN 0 AND 100);
ALTER TABLE assessment_competency_scores ADD COLUMN stage VARCHAR(255);
ALTER TABLE assessment_competency_scores ADD COLUMN attempt_count INTEGER;
ALTER TABLE assessment_competency_scores ADD COLUMN current_cycle_attempts INTEGER;
ALTER TABLE assessment_competency_scores ADD COLUMN checkpoint_resets INTEGER;
ALTER TABLE assessment_competency_scores ADD COLUMN score_history_complete BOOLEAN;

-- Only the latest completed meeting still has its corresponding persona state.
-- Earlier retry scores cannot be reconstructed reliably after relationship resets.
UPDATE meetings m SET performance_score = (s.trust + s.interest + s.patience) / 3
FROM persona_states s
WHERE s.engagement_id = m.engagement_id AND m.status = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM meetings newer
                  WHERE newer.engagement_id = m.engagement_id AND newer.created_at > m.created_at);
