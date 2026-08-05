CREATE TABLE IF NOT EXISTS interviews (
    id           UUID PRIMARY KEY,
    candidate_id UUID NOT NULL,
    slot_time    TIMESTAMPTZ NOT NULL,
    slot_type    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS interviews_candidate_idx ON interviews (candidate_id);
