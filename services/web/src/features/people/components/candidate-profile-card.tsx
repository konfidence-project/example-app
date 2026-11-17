import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import type { Candidate } from "@/types/api";
import { dateKey, formatLongDate } from "@/utils/time";

import { CandidateNotes } from "./candidate-notes";
import styles from "./people.module.css";

export function CandidateProfileCard({
  candidate,
  notesEnabled,
  timeZone,
}: {
  candidate: Candidate;
  notesEnabled: boolean;
  timeZone: string;
}) {
  return (
    <Card>
      <div className={styles.profile}>
        <Avatar name={candidate.name} size="lg" />
        <p className={styles.profileName}>{candidate.name}</p>
        <a className={styles.profileEmail} href={`mailto:${candidate.email}`}>
          {candidate.email}
        </a>
      </div>
      <dl className={styles.facts}>
        <div>
          <dt>Candidate ID</dt>
          <dd className={styles.mono}>{candidate.id}</dd>
        </div>
        <div>
          <dt>Added</dt>
          <dd>{formatLongDate(dateKey(new Date(candidate.created_at), timeZone))}</dd>
        </div>
        <div>
          <dt>Notes</dt>
          <dd>
            {notesEnabled ? (
              <CandidateNotes candidateId={candidate.id} notes={candidate.notes ?? ""} />
            ) : (
              <span className={styles.muted}>Notes aren&apos;t available.</span>
            )}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
