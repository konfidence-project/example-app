import type { Candidate, Interview } from "@/types/api";

/** One row of the people table. */
export interface PersonRow {
  candidate: Candidate;
  /** The next interview from now on, if any. */
  next: Interview | null;
  /** Interviews from now on. */
  upcoming: number;
}

export interface ActivityEntry {
  at: Date;
  text: string;
}
