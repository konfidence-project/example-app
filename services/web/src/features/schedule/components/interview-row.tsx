import Link from "next/link";

import { InterviewTypeBadge } from "@/components/interview-type-badge";
import { Avatar } from "@/components/ui/avatar";
import { ChevronRightIcon } from "@/components/ui/icons";
import { paths } from "@/config/paths";
import type { Interview } from "@/types/api";
import { timeOfDay } from "@/utils/time";

import styles from "./schedule.module.css";

export function InterviewRow({
  interview,
  timeZone,
  past,
}: {
  interview: Interview;
  timeZone: string;
  past: boolean;
}) {
  const name = interview.candidate?.name ?? "Unknown candidate";
  return (
    <li>
      <Link
        href={paths.candidate.getHref(interview.candidate_id)}
        className={past ? `${styles.row} ${styles.past}` : styles.row}
      >
        <time className={styles.time} dateTime={interview.slot_time}>
          {timeOfDay(new Date(interview.slot_time), timeZone)}
        </time>
        <Avatar name={name} />
        <span className={styles.who}>
          <span className={styles.name}>{name}</span>
          <span className={styles.email}>
            {interview.candidate?.email ?? "Details could not be loaded"}
          </span>
        </span>
        <InterviewTypeBadge type={interview.slot_type} />
        <ChevronRightIcon className={styles.chevron} />
      </Link>
    </li>
  );
}
