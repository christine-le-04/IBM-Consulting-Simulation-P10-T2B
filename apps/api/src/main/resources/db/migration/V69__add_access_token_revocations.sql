CREATE TABLE revoked_access_tokens (
    token_hash VARCHAR(64) PRIMARY KEY,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_revoked_access_tokens_expiry ON revoked_access_tokens (expires_at);
