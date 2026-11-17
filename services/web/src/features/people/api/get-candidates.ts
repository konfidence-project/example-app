import "server-only";

import { ApiError, api } from "@/lib/api-client";
import type { Candidate } from "@/types/api";

/** All candidates, or those whose name or email contains q. */
export function getCandidates(q = ""): Promise<Candidate[]> {
  const query = q.trim();
  return api.get<Candidate[]>(
    "candidates",
    query ? `/candidates?q=${encodeURIComponent(query)}` : "/candidates",
  );
}

/** One candidate, or null when the id is unknown or malformed. */
export async function getCandidate(id: string): Promise<Candidate | null> {
  try {
    return await api.get<Candidate>("candidates", `/candidates/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
}
