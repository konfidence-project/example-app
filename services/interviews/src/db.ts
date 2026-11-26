import { randomUUID } from "node:crypto";
import pg from "pg";

const { Pool } = pg;

function dsn(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const user = process.env.PGUSER ?? "postgres";
  const pw = process.env.PGPASSWORD ?? "";
  const host = process.env.PGHOST ?? "postgres";
  const port = process.env.PGPORT ?? "5432";
  const db = process.env.PGDATABASE ?? "example";
  const ssl = process.env.PGSSLMODE ?? "disable";
  return `postgres://${user}:${pw}@${host}:${port}/${db}?sslmode=${ssl}`;
}

export const pool = new Pool({ connectionString: dsn() });

export async function insertInterview(candidateId: string, slotTime: string, slotType: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    "INSERT INTO interviews (id, candidate_id, slot_time, slot_type) VALUES ($1, $2, $3, $4)",
    [id, candidateId, slotTime, slotType],
  );
  return id;
}

export interface InterviewRow {
  id: string;
  candidate_id: string;
  slot_time: string;
  slot_type: string;
}

export async function listInterviews(): Promise<InterviewRow[]> {
  const { rows } = await pool.query<InterviewRow>(
    "SELECT id, candidate_id, slot_time, slot_type FROM interviews ORDER BY slot_time",
  );
  return rows;
}
