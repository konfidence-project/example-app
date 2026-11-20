import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import type { Interview } from "@/types/api";
import { plural } from "@/utils/format";
import { TYPE_LABEL } from "@/utils/interview";
import { formatMonthDay, formatWeekday, relativeDayLabel, type DateKey } from "@/utils/time";

import type { TypeFilter } from "../types";
import { groupByDay } from "../utils/week";

import { InterviewRow } from "./interview-row";
import styles from "./schedule.module.css";

export function ScheduleList({
  interviews,
  timeZone,
  today,
  now,
  type,
}: {
  interviews: Interview[];
  timeZone: string;
  today: DateKey;
  now: Date;
  type: TypeFilter;
}) {
  const days = groupByDay(interviews, timeZone);
  if (days.length === 0) {
    return (
      <EmptyState
        title={
          type === "all"
            ? "No interviews this week"
            : `No ${TYPE_LABEL[type].toLowerCase()} interviews this week`
        }
      >
        Pick another week or schedule an interview.
      </EmptyState>
    );
  }
  return (
    <div className={styles.days}>
      {days.map((day) => {
        const label = relativeDayLabel(day.key, today);
        const isWeekday = label === formatWeekday(day.key);
        const headingId = `day-${day.key}`;
        return (
          <section key={day.key} className={styles.day} aria-labelledby={headingId}>
            <header className={styles.dayHeader}>
              <h2 id={headingId} className={styles.dayTitle}>
                {label}
                <span className={styles.dayDate}>
                  {isWeekday
                    ? formatMonthDay(day.key)
                    : `${formatWeekday(day.key)}, ${formatMonthDay(day.key)}`}
                </span>
              </h2>
              <Badge>{plural(day.interviews.length, "interview")}</Badge>
            </header>
            <ul className={styles.rows}>
              {day.interviews.map((interview) => (
                <InterviewRow
                  key={interview.id}
                  interview={interview}
                  timeZone={timeZone}
                  past={new Date(interview.slot_time) < now}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
