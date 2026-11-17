DROP INDEX IF EXISTS candidates_created_at_idx;
ALTER TABLE candidates DROP COLUMN IF EXISTS created_at;
