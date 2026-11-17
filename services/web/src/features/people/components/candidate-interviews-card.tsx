import Link from "next/link";

import { InterviewTypeBadge } from "@/components/interview-type-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ChevronRightIcon } from "@/components/ui/icons";
import type { Interview } from "@/types/api";
import { TYPE_LABEL, TYPE_PLACE } from "@/utils/interview";
import { dateKey, formatDayMonth, timeOfDay } from "@/utils/time";

import styles from "./people.module.css";

// The interviews of one candidate. scheduleHref links each row to its week
// in the schedule; the page passes it in, so this feature does not need to
// know the schedule's URLs.
export function CandidateInterviewsCard({
  interviews,
  now,
  timeZone,
  scheduleHref,
}: {
  interviews: Interview[];
  now: Date;
  timeZone: string;
  scheduleHref: (interview: Interview) => string;
}) {
  const upcoming = interviews.filter((i) => new Date(i.slot_time) >= now).length;
  return (
    <Card>
      <CardHeader title="Interviews" aside={<Badge>{upcoming} scheduled</Badge>} />
      {interviews.length === 0 ? (
        <p className={styles.cardEmpty}>No interviews yet.</p>
      ) : (
        <ul className={styles.list}>
          {interviews.map((interview) => {
            const start = new Date(interview.slot_time);
            const end = new Date(start.getTime() + interview.duration_minutes * 60_000);
            return (
              <li key={interview.id}>
                <Link
                  href={scheduleHref(interview)}
                  className={start < now ? `${styles.interview} ${styles.past}` : styles.interview}
                >
                  <time className={styles.day} dateTime={interview.slot_time}>
                    {formatDayMonth(dateKey(start, timeZone))}
                  </time>
                  <span className={styles.who}>
                    <span className={styles.name}>
                      {TYPE_LABEL[interview.slot_type]} · {timeOfDay(start, timeZone)} –{" "}
                      {timeOfDay(end, timeZone)}
                    </span>
                    <span className={styles.email}>
                      {interview.location ?? TYPE_PLACE[interview.slot_type]}
                    </span>
                  </span>
                  <InterviewTypeBadge type={interview.slot_type} />
                  <ChevronRightIcon className={styles.chevronIcon} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
