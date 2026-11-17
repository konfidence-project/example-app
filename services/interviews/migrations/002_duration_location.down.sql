DROP INDEX IF EXISTS interviews_slot_time_idx;
ALTER TABLE interviews DROP COLUMN IF EXISTS created_at;
ALTER TABLE interviews DROP COLUMN IF EXISTS location;
ALTER TABLE interviews DROP COLUMN IF EXISTS duration_minutes;
