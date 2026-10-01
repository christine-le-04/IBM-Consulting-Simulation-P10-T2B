-- Choose contact: a scenario can have several contacts. Only the decision maker
-- can accept a meeting; distractors decline with a pre-written reply.
ALTER TABLE personas
    ADD COLUMN contact_role VARCHAR(20) NOT NULL DEFAULT 'DECISION_MAKER',
    ADD COLUMN decline_reply TEXT,
    ADD COLUMN hint_reply TEXT;

ALTER TABLE personas
    ADD CONSTRAINT chk_personas_contact_role CHECK (contact_role IN ('DECISION_MAKER', 'DISTRACTOR'));

-- Which contact the learner is emailing now, and which outreach round they are on.
-- A round ends when every contact has used 3 emails without a meeting; the
-- learner then returns to research and every contact gets 3 fresh emails.
ALTER TABLE engagements
    ADD COLUMN contact_persona_id UUID REFERENCES personas(id),
    ADD COLUMN outreach_round INT NOT NULL DEFAULT 1;

-- Attempts are counted per contact within a round. Older attempts have no
-- contact recorded and are not counted against anyone.
ALTER TABLE outreach_attempts
    ADD COLUMN persona_id UUID REFERENCES personas(id),
    ADD COLUMN outreach_round INT NOT NULL DEFAULT 1;

CREATE INDEX idx_outreach_attempts_contact_round
    ON outreach_attempts (engagement_id, outreach_round, persona_id);
