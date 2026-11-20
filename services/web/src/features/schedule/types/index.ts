import type { Interview } from "@/types/api";

export const DURATIONS = [30, 45, 60, 90] as const;

export type TypeFilter = "all" | Interview["slot_type"];

export interface CandidateOption {
  id: string;
  name: string;
  email: string;
}

export interface ScheduleDay {
  /** YYYY-MM-DD */
  key: string;
  interviews: Interview[];
}
