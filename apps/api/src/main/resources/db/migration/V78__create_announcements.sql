CREATE TABLE announcements (
    id uuid PRIMARY KEY,
    scenario_id uuid NOT NULL,
    kind varchar(30) NOT NULL CHECK (kind IN ('SCENARIO_PUBLISHED', 'SCENARIO_ARCHIVED')),
    scenario_title varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- Keep the announcement snapshot even if its scenario is later removed.
CREATE INDEX announcements_newest_idx ON announcements (created_at DESC, id DESC);

CREATE TABLE announcement_reads (
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, announcement_id)
);
