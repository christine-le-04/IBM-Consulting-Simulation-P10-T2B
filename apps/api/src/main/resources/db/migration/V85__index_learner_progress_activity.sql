-- Support deterministic paging by most recent learner activity.
CREATE INDEX idx_engagements_activity_desc ON engagements (updated_at DESC, id DESC);
