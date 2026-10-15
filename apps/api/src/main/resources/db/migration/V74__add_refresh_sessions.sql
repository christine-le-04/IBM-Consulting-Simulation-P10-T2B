CREATE TABLE refresh_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    secret_hash VARCHAR(255) NOT NULL,
    previous_secret_hash VARCHAR(255),
    previous_valid_until TIMESTAMPTZ,
    credential_fingerprint VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT
);
CREATE INDEX idx_refresh_sessions_expiry ON refresh_sessions (expires_at);
CREATE INDEX idx_refresh_sessions_user ON refresh_sessions (user_id);

CREATE TABLE refresh_session_used_secrets (
    session_id UUID NOT NULL REFERENCES refresh_sessions(id) ON DELETE CASCADE,
    secret_hash VARCHAR(255) NOT NULL,
    PRIMARY KEY (session_id, secret_hash)
);
