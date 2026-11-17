import Link from "next/link";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronRightIcon } from "@/components/ui/icons";
import { paths } from "@/config/paths";
import { plural } from "@/utils/format";
import { dateKey, formatShortDate, timeOfDay } from "@/utils/time";

import type { PersonRow } from "../types";

import styles from "./people.module.css";

export function PeopleTable({
  rows,
  showNotes,
  timeZone,
}: {
  rows: PersonRow[];
  showNotes: boolean;
  timeZone: string;
}) {
  return (
    <div className={styles.tableCard}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Name</th>
            {showNotes && <th scope="col">Notes</th>}
            <th scope="col">Next interview</th>
            <th scope="col">
              <span className="visually-hidden">Upcoming interviews</span>
            </th>
            <th scope="col" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ candidate, next, upcoming }) => {
            const when = next ? new Date(next.slot_time) : null;
            return (
              <tr key={candidate.id} className={styles.tr}>
                <td>
                  <Link href={paths.candidate.getHref(candidate.id)} className={styles.person}>
                    <Avatar name={candidate.name} />
                    <span className={styles.who}>
                      <span className={styles.name}>{candidate.name}</span>
                      <span className={styles.email}>{candidate.email}</span>
                    </span>
                  </Link>
                </td>
                {showNotes && (
                  <td className={styles.notes} title={candidate.notes ?? undefined}>
                    {candidate.notes || (
                      <span className={styles.none} aria-label="No notes">
                        –
                      </span>
                    )}
                  </td>
                )}
                <td className={styles.next}>
                  {when ? (
                    <time dateTime={next!.slot_time}>
                      {formatShortDate(dateKey(when, timeZone))} · {timeOfDay(when, timeZone)}
                    </time>
                  ) : (
                    <span className={styles.muted}>Not scheduled</span>
                  )}
                </td>
                <td className={styles.count}>
                  <Badge>{plural(upcoming, "interview")}</Badge>
                </td>
                <td className={styles.chevron} aria-hidden="true">
                  <ChevronRightIcon />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
