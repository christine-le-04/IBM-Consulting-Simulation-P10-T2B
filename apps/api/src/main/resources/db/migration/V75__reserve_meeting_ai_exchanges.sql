-- Reservations commit before AI generation and are fenced by a unique request ID.
-- Expiry permits recovery after process failure without retaining a row lock.
ALTER TABLE meetings ADD COLUMN turn_request_id uuid;
ALTER TABLE meetings ADD COLUMN turn_request_expires_at timestamptz;
ALTER TABLE meetings ADD CONSTRAINT meetings_turn_request_pair CHECK (
    (turn_request_id IS NULL) = (turn_request_expires_at IS NULL)
);
