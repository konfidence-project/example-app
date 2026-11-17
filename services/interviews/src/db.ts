import { randomUUID } from "node:crypto";
import pg from "pg";
import type { CreateInterview, ListFilter } from "./query.js";

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

const COLUMNS = "id, candidate_id, slot_time, slot_type, duration_minutes, location, created_at";

export interface InterviewRow {
  id: string;
  candidate_id: string;
  slot_time: string;
  slot_type: string;
  duration_minutes: number;
  location: string | null;
  created_at: string;
}

export async function insertInterview(input: CreateInterview): Promise<InterviewRow> {
  const { rows } = await pool.query<InterviewRow>(
    `INSERT INTO interviews (id, candidate_id, slot_time, slot_type, duration_minutes, location)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLUMNS}`,
    [
      randomUUID(),
      input.candidateId,
      input.slotTime,
      input.slotType,
      input.durationMinutes,
      input.location,
    ],
  );
  return rows[0];
}

export async function listInterviews(filter: ListFilter): Promise<InterviewRow[]> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (column: string, op: string, value: unknown) => {
    params.push(value);
    where.push(`${column} ${op} $${params.length}`);
  };
  if (filter.candidateId) add("candidate_id", "=", filter.candidateId);
  if (filter.from) add("slot_time", ">=", filter.from);
  if (filter.to) add("slot_time", "<", filter.to);
  const conditions = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const { rows } = await pool.query<InterviewRow>(
    `SELECT ${COLUMNS} FROM interviews ${conditions} ORDER BY slot_time, id`,
    params,
  );
  return rows;
}
