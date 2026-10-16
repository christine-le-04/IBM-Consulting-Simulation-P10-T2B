ALTER TABLE announcements DROP CONSTRAINT announcements_audience_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_audience_check CHECK (audience IN ('ALL', 'ROLES', 'USERS'));

CREATE TABLE announcement_recipients (
    announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (announcement_id, user_id)
);
CREATE INDEX announcement_recipients_user_idx ON announcement_recipients (user_id, announcement_id);

ALTER TABLE announcements DROP CONSTRAINT announcements_kind_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_kind_check
    CHECK (kind IN ('SCENARIO_PUBLISHED', 'SCENARIO_ARCHIVED', 'ADMIN_MESSAGE', 'SCENARIO_ASSIGNED'));

ALTER TABLE announcements DROP CONSTRAINT announcements_content_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_content_check CHECK (
    (kind = 'ADMIN_MESSAGE' AND scenario_id IS NULL AND scenario_title IS NULL
        AND title IS NOT NULL AND length(btrim(title)) > 0
        AND message IS NOT NULL AND length(btrim(message)) > 0)
    OR
    (kind IN ('SCENARIO_PUBLISHED', 'SCENARIO_ARCHIVED')
        AND scenario_id IS NOT NULL AND scenario_title IS NOT NULL)
    OR
    (kind = 'SCENARIO_ASSIGNED' AND audience = 'USERS' AND scenario_id IS NOT NULL
        AND scenario_title IS NOT NULL AND message IS NOT NULL)
);
