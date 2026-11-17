import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageBody, PageHeader } from "@/components/layouts/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { env } from "@/config/env";
import { paths } from "@/config/paths";
import { getCandidate } from "@/features/people/api/get-candidates";
import { CandidateActivityCard } from "@/features/people/components/candidate-activity-card";
import { CandidateInterviewsCard } from "@/features/people/components/candidate-interviews-card";
import { CandidateProfileCard } from "@/features/people/components/candidate-profile-card";
import {
  CandidateBreadcrumb,
  CandidateDetailLayout,
} from "@/features/people/components/people-layout";
import { activityOf } from "@/features/people/utils/people";
import { getInterviews } from "@/features/schedule/api/get-interviews";
import { ScheduleInterviewDialog } from "@/features/schedule/components/schedule-interview-dialog";
import { errorMessage } from "@/lib/api-client";
import { getFeatureFlags } from "@/lib/flags";
import type { Interview } from "@/types/api";
import { offeredTypes } from "@/utils/interview";
import { dateKey, weekStartOf } from "@/utils/time";

type Params = { params: Promise<{ id: string }> };

// A static title on purpose: a title with the name would cost a request to
// the candidates service for every prefetched link to this page.
export const metadata: Metadata = { title: "Candidate" };

export default async function CandidatePage({ params }: Params) {
  const { id } = await params;
  const timeZone = env.timeZone;
  const now = new Date();
  const [candidate, interviews, flags] = await Promise.all([
    getCandidate(id),
    getInterviews({ candidateId: id }).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error: errorMessage(error) }),
    ),
    getFeatureFlags(),
  ]);
  if (!candidate) notFound();

  const scheduleHref = (interview: Interview) =>
    paths.schedule.getHref({ week: weekStartOf(dateKey(new Date(interview.slot_time), timeZone)) });

  return (
    <>
      <PageHeader
        title={candidate.name}
        subtitle={<CandidateBreadcrumb name={candidate.name} />}
        actions={
          <ScheduleInterviewDialog
            candidates={[{ id: candidate.id, name: candidate.name, email: candidate.email }]}
            candidateId={candidate.id}
            offeredTypes={offeredTypes(flags.videoSlots)}
            defaultDate={dateKey(now, timeZone)}
            defaultTime="10:00"
            timeZone={timeZone}
          />
        }
      />
      <PageBody>
        <CandidateDetailLayout
          main={
            interviews.ok ? (
              <>
                <CandidateInterviewsCard
                  interviews={interviews.value}
                  now={now}
                  timeZone={timeZone}
                  scheduleHref={scheduleHref}
                />
                <CandidateActivityCard
                  entries={activityOf(candidate, interviews.value, timeZone)}
                  timeZone={timeZone}
                />
              </>
            ) : (
              <Card>
                <CardHeader title="Interviews" />
                <ErrorState title="Interviews could not be loaded" message={interviews.error} />
              </Card>
            )
          }
          aside={
            <CandidateProfileCard
              candidate={candidate}
              notesEnabled={flags.candidateNotes}
              timeZone={timeZone}
            />
          }
        />
      </PageBody>
    </>
  );
}
