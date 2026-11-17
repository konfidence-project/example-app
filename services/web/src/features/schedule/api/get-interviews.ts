import "server-only";

import { api } from "@/lib/api-client";
import type { Interview } from "@/types/api";

export interface InterviewQuery {
  candidateId?: string;
  /** Inclusive. */
  from?: Date;
  /** Exclusive. */
  to?: Date;
}

/** Interviews ordered by time, each with its candidate embedded. */
export function getInterviews(query: InterviewQuery = {}): Promise<Interview[]> {
  const params = new URLSearchParams();
  if (query.candidateId) params.set("candidate_id", query.candidateId);
  if (query.from) params.set("from", query.from.toISOString());
  if (query.to) params.set("to", query.to.toISOString());
  const qs = params.toString();
  return api.get<Interview[]>("interviews", qs ? `/interviews?${qs}` : "/interviews");
}
