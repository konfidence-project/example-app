import type { Interview } from "@/types/api";
import { isInterviewType } from "@/utils/interview";
import { addDays, dateKey, isDateKey, weekStartOf, type DateKey } from "@/utils/time";

import type { ScheduleDay, TypeFilter } from "../types";

/** Reads ?week= and ?type= of the schedule page. Unknown values fall back to this week and all types. */
export function parseScheduleParams(
  params: { week?: string | string[]; type?: string | string[] },
  today: DateKey,
  offered: readonly string[],
): { week: DateKey; type: TypeFilter } {
  const week =
    typeof params.week === "string" && isDateKey(params.week)
      ? weekStartOf(params.week)
      : weekStartOf(today);
  const rawType = typeof params.type === "string" ? params.type : "all";
  const type = isInterviewType(rawType) && offered.includes(rawType) ? rawType : "all";
  return { week, type };
}

/** The interviews of a week, one entry per day that has any, in time order. */
export function groupByDay(interviews: Interview[], timeZone: string): ScheduleDay[] {
  const days = new Map<DateKey, Interview[]>();
  for (const interview of interviews) {
    const key = dateKey(new Date(interview.slot_time), timeZone);
    const list = days.get(key) ?? [];
    list.push(interview);
    days.set(key, list);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, interviews: list }));
}

export const nextWeek = (week: DateKey) => addDays(week, 7);
export const previousWeek = (week: DateKey) => addDays(week, -7);
