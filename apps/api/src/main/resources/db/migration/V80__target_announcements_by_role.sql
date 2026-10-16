ALTER TABLE announcements ADD COLUMN audience varchar(20) NOT NULL DEFAULT 'ALL';
ALTER TABLE announcements ADD CONSTRAINT announcements_audience_check CHECK (audience IN ('ALL', 'ROLES'));

CREATE TABLE announcement_roles (
    announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    role varchar(40) NOT NULL CHECK (role IN ('LEARNER', 'SCENARIO_AUTHOR', 'REVIEWER', 'ADMINISTRATOR')),
    PRIMARY KEY (announcement_id, role)
);
