import { Card, CardHeader } from "@/components/ui/card";
import { formatDateTime } from "@/utils/time";

import type { ActivityEntry } from "../types";

import styles from "./people.module.css";

export function CandidateActivityCard({
  entries,
  timeZone,
}: {
  entries: ActivityEntry[];
  timeZone: string;
}) {
  return (
    <Card>
      <CardHeader title="Activity" />
      <ol className={styles.activity}>
        {entries.map((entry, i) => (
          <li key={i}>
            <time dateTime={entry.at.toISOString()}>{formatDateTime(entry.at, timeZone)}</time>
            <span>{entry.text}</span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
