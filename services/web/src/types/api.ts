// Shapes of the candidates and interviews APIs, shared by every feature.

export type InterviewType = "onsite" | "phone" | "video";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  notes?: string | null;
  /** ISO 8601 */
  created_at: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  /** ISO 8601 */
  slot_time: string;
  slot_type: InterviewType;
  duration_minutes: number;
  location: string | null;
  /** ISO 8601 */
  created_at: string;
  /** Embedded by the interviews service. Null when candidates could not answer. */
  candidate: Candidate | null;
}

/** What a server action returns to the form that called it. */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Feature flags the UI acts on, by product meaning. */
export interface FeatureFlags {
  videoSlots: boolean;
  candidateNotes: boolean;
}
