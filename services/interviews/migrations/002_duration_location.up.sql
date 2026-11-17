-- Rows that existed before this migration get the migration time and one hour.
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 60;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE interviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS interviews_slot_time_idx ON interviews (slot_time);
