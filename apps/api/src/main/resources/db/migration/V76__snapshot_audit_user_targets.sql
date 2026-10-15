ALTER TABLE admin_audit_events
    ADD COLUMN target_display_name varchar(80),
    ADD COLUMN target_email varchar(255);

-- Existing entries can recover current account identities; future entries save event-time snapshots.
UPDATE admin_audit_events a
SET target_display_name = left(u.display_name, 80), target_email = u.email
FROM users u
WHERE a.target_type = 'USER' AND a.target_id = u.id::text;

-- Older deleted accounts can still have an email in the existing creation/deletion details.
UPDATE admin_audit_events
SET target_email = details
WHERE target_type = 'USER' AND target_email IS NULL
  AND action IN ('ADMIN_USER_CREATED', 'ADMIN_USER_DELETED')
  AND length(details) <= 255
  AND details ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$';
