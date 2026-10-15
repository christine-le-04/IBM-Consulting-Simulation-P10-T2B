ALTER TABLE announcements
    ADD COLUMN publish_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN expires_at timestamptz,
    ADD COLUMN delivered_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN expiry_notified_at timestamptz;

UPDATE announcements SET publish_at = created_at, delivered_at = created_at;
ALTER TABLE announcements ADD CONSTRAINT announcement_expiry_after_publication
    CHECK (expires_at IS NULL OR expires_at > publish_at);
CREATE INDEX announcements_publication_order ON announcements (publish_at DESC, id DESC);
CREATE INDEX announcements_pending_publication ON announcements (publish_at)
    WHERE delivered_at IS NULL AND withdrawn_at IS NULL;
CREATE INDEX announcements_pending_expiry ON announcements (expires_at)
    WHERE expires_at IS NOT NULL AND expiry_notified_at IS NULL AND withdrawn_at IS NULL;
