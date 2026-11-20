// Parsing and validation of request input. Kept free of imports so the tests
// can run it without a database or a feature flag provider.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 8 * 60;
const MAX_LOCATION_LENGTH = 200;

export interface ListFilter {
  candidateId?: string;
  /** Inclusive lower bound of slot_time, ISO 8601. */
  from?: string;
  /** Exclusive upper bound of slot_time, ISO 8601. */
  to?: string;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function single(value: unknown): string | undefined {
  if (Array.isArray(value)) return single(value[0]);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function isoTime(value: string): string | undefined {
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? undefined : new Date(ms).toISOString();
}

/** Query of GET /interviews: candidate_id, from and to, all optional. */
export function parseListQuery(query: Record<string, unknown> | undefined): Parsed<ListFilter> {
  const filter: ListFilter = {};
  const candidateId = single(query?.candidate_id);
  if (candidateId !== undefined) {
    if (!UUID.test(candidateId)) return { ok: false, error: "candidate_id must be a UUID" };
    filter.candidateId = candidateId;
  }
  for (const bound of ["from", "to"] as const) {
    const raw = single(query?.[bound]);
    if (raw === undefined) continue;
    const parsed = isoTime(raw);
    if (!parsed) return { ok: false, error: `${bound} must be an ISO 8601 time` };
    filter[bound] = parsed;
  }
  if (filter.from && filter.to && filter.from >= filter.to) {
    return { ok: false, error: "from must be before to" };
  }
  return { ok: true, value: filter };
}

export interface CreateInterview {
  candidateId: string;
  slotTime: string;
  slotType: string;
  durationMinutes: number;
  location: string | null;
}

/** Body of POST /interviews. Checks shape only, not whether a slot type is enabled. */
export function parseCreateBody(body: unknown): Parsed<CreateInterview> {
  const b = (body ?? {}) as Record<string, unknown>;
  const { candidateId, slotTime, slotType } = b;
  if (
    typeof candidateId !== "string" ||
    typeof slotTime !== "string" ||
    typeof slotType !== "string" ||
    !candidateId ||
    !slotTime ||
    !slotType
  ) {
    return { ok: false, error: "candidateId, slotTime and slotType are required" };
  }
  const time = isoTime(slotTime);
  if (!time) return { ok: false, error: "slotTime must be an ISO 8601 time" };

  let durationMinutes = DEFAULT_DURATION_MINUTES;
  if (b.durationMinutes !== undefined && b.durationMinutes !== null) {
    const d = b.durationMinutes;
    if (typeof d !== "number" || !Number.isInteger(d) || d < 5 || d > MAX_DURATION_MINUTES) {
      return {
        ok: false,
        error: `durationMinutes must be a whole number from 5 to ${MAX_DURATION_MINUTES}`,
      };
    }
    durationMinutes = d;
  }

  let location: string | null = null;
  if (b.location !== undefined && b.location !== null) {
    if (typeof b.location !== "string") return { ok: false, error: "location must be a string" };
    const trimmed = b.location.trim();
    if (trimmed.length > MAX_LOCATION_LENGTH) {
      return { ok: false, error: `location is longer than ${MAX_LOCATION_LENGTH} characters` };
    }
    location = trimmed || null;
  }

  return { ok: true, value: { candidateId, slotTime: time, slotType, durationMinutes, location } };
}
