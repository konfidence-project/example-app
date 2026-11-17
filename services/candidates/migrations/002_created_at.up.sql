-- Rows that existed before this migration get the migration time.
ALTER TABLE candidates ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS candidates_created_at_idx ON candidates (created_at);
