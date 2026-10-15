ALTER TABLE admin_audit_events ADD COLUMN target_role varchar(40);

-- Recover current roles where legacy records did not save an event-time snapshot.
UPDATE admin_audit_events a
SET target_role = u.role
FROM users u
WHERE a.target_type = 'USER' AND a.target_id = u.id::text;

-- Role-change details contain the exact new role at the time of the event.
UPDATE admin_audit_events
SET target_role = details
WHERE target_type = 'USER' AND action = 'ADMIN_USER_ROLE_CHANGED'
  AND details IN ('LEARNER', 'SCENARIO_AUTHOR', 'REVIEWER', 'ADMINISTRATOR');
