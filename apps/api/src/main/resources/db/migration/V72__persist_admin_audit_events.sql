CREATE TABLE admin_audit_events (
    id uuid PRIMARY KEY,
    occurred_at timestamptz NOT NULL,
    actor_id uuid,
    actor_display_name varchar(80),
    actor_email varchar(255),
    actor_role varchar(40),
    action varchar(64) NOT NULL,
    target_type varchar(40) NOT NULL,
    target_id varchar(100) NOT NULL,
    details text
);
-- No cascading actor/target foreign keys: the historical record must survive deletion.
CREATE INDEX idx_admin_audit_time ON admin_audit_events (occurred_at DESC, id DESC);
CREATE INDEX idx_admin_audit_action_time ON admin_audit_events (action, occurred_at DESC);
CREATE INDEX idx_admin_audit_target_time ON admin_audit_events (target_type, occurred_at DESC);
