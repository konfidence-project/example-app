CREATE TABLE IF NOT EXISTS candidates (
    id    UUID PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT NOT NULL,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS candidates_email_idx ON candidates (email);
