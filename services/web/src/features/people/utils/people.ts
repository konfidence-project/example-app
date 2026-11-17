import type { Candidate, Interview } from "@/types/api";
import { TYPE_LABEL } from "@/utils/interview";
import { formatDateTime } from "@/utils/time";

import type { ActivityEntry, PersonRow } from "../types";

/**
 * Joins candidates with their upcoming interviews and sorts them by the next
 * interview. Candidates without one come last, by name.
 */
export function toPersonRows(candidates: Candidate[], upcoming: Interview[]): PersonRow[] {
  const byCandidate = new Map<string, Interview[]>();
  for (const interview of upcoming) {
    const list = byCandidate.get(interview.candidate_id) ?? [];
    list.push(interview);
    byCandidate.set(interview.candidate_id, list);
  }
  const rows = candidates.map((candidate) => {
    const list = (byCandidate.get(candidate.id) ?? []).sort((a, b) =>
      a.slot_time.localeCompare(b.slot_time),
    );
    return { candidate, next: list[0] ?? null, upcoming: list.length };
  });
  return rows.sort((a, b) => {
    if (a.next && b.next) return a.next.slot_time.localeCompare(b.next.slot_time);
    if (a.next) return -1;
    if (b.next) return 1;
    return a.candidate.name.localeCompare(b.candidate.name);
  });
}

/** What happened to a candidate, oldest first, from created timestamps. */
export function activityOf(
  candidate: Candidate,
  interviews: Interview[],
  timeZone: string,
): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    { at: new Date(candidate.created_at), text: "Candidate created" },
  ];
  for (const interview of interviews) {
    entries.push({
      at: new Date(interview.created_at),
      text: `${TYPE_LABEL[interview.slot_type]} interview scheduled for ${formatDateTime(new Date(interview.slot_time), timeZone)}`,
    });
  }
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}
