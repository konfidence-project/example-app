import "server-only";
import { serviceFetch } from "@konfidence/next-adapter/server";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  notes?: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  slot_time: string;
  slot_type: string;
  candidate: Candidate | null;
}

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

// Server-to-server call. The adapter's helper finds the interviews service of
// the vector that serves this request and forwards the routing key, so this
// code names the service and nothing else.
export async function loadInterviews(): Promise<Loaded<Interview[]>> {
  try {
    const res = await serviceFetch("interviews", "/interviews");
    if (!res.ok) return { ok: false, error: `interviews responded ${res.status}` };
    return { ok: true, data: (await res.json()) as Interview[] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
