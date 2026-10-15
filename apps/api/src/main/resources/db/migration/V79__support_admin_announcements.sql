-- Extend the saved feed without changing previously applied migrations or scenario messages.
ALTER TABLE announcements
    ALTER COLUMN scenario_id DROP NOT NULL,
    ALTER COLUMN scenario_title DROP NOT NULL,
    ADD COLUMN title varchar(120),
    ADD COLUMN message varchar(4000);

ALTER TABLE announcements DROP CONSTRAINT announcements_kind_check;
ALTER TABLE announcements ADD CONSTRAINT announcements_kind_check
    CHECK (kind IN ('SCENARIO_PUBLISHED', 'SCENARIO_ARCHIVED', 'ADMIN_MESSAGE'));

ALTER TABLE announcements ADD CONSTRAINT announcements_content_check CHECK (
    (kind = 'ADMIN_MESSAGE' AND scenario_id IS NULL AND scenario_title IS NULL
        AND title IS NOT NULL AND length(btrim(title)) > 0
        AND message IS NOT NULL AND length(btrim(message)) > 0)
    OR
    (kind IN ('SCENARIO_PUBLISHED', 'SCENARIO_ARCHIVED')
        AND scenario_id IS NOT NULL AND scenario_title IS NOT NULL)
);
