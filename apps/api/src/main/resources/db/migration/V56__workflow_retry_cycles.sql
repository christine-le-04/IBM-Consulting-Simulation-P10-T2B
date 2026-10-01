ALTER TABLE engagements ADD COLUMN meeting_retry_baseline INTEGER NOT NULL DEFAULT 0;
ALTER TABLE proposals ADD COLUMN submission_count INTEGER NOT NULL DEFAULT 0;
UPDATE proposals p SET submission_count = CASE WHEN e.state IN ('REVIEW', 'COMPLETED') AND p.decision = 'LOST' THEN 3 ELSE 1 END
FROM engagements e WHERE p.engagement_id = e.id AND p.status = 'SUBMITTED';
UPDATE proposals SET decision = 'PENDING' WHERE status = 'SUBMITTED' AND decision = 'LOST' AND submission_count < 3;
CREATE TABLE proposal_submission_history (
    proposal_id UUID NOT NULL REFERENCES proposals(id),
    position INTEGER NOT NULL,
    snapshot TEXT NOT NULL,
    PRIMARY KEY (proposal_id, position)
);
