CREATE TABLE announcement_publish_requests (
    actor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id uuid NOT NULL,
    payload_hash varchar(64) NOT NULL,
    announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    PRIMARY KEY (actor_id, request_id)
);
