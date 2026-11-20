import type { Metadata } from "next";

import { PageBody, PageHeader } from "@/components/layouts/page-header";
import { ErrorState } from "@/components/ui/states";
import { env } from "@/config/env";
import { getCandidates } from "@/features/people/api/get-candidates";
import { getInterviews } from "@/features/schedule/api/get-interviews";
import { ScheduleInterviewDialog } from "@/features/schedule/components/schedule-interview-dialog";
import { ScheduleList } from "@/features/schedule/components/schedule-list";
import { ScheduleToolbar } from "@/features/schedule/components/schedule-toolbar";
import { parseScheduleParams } from "@/features/schedule/utils/week";
import { errorMessage } from "@/lib/api-client";
import { getFeatureFlags } from "@/lib/flags";
import { plural } from "@/utils/format";
import { offeredTypes } from "@/utils/interview";
import { addDays, dateKey, weekStartOf, zonedToUtc } from "@/utils/time";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; type?: string }>;
}) {
  const timeZone = env.timeZone;
  const now = new Date();
  const today = dateKey(now, timeZone);
  const thisWeek = weekStartOf(today);
  const flags = await getFeatureFlags();
  const offered = offeredTypes(flags.videoSlots);
  const { week, type } = parseScheduleParams(await searchParams, today, offered);

  const [interviews, candidates] = await Promise.allSettled([
    getInterviews({
      from: zonedToUtc(week, "00:00", timeZone),
      to: zonedToUtc(addDays(week, 7), "00:00", timeZone),
    }),
    getCandidates(),
  ]);

  let subtitle = "";
  if (interviews.status === "fulfilled") {
    const all = interviews.value;
    subtitle =
      week === thisWeek
        ? `${plural(all.filter((i) => new Date(i.slot_time) >= now).length, "upcoming interview")} this week`
        : `${plural(all.length, "interview")} this week`;
  }

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={subtitle}
        actions={
          <ScheduleInterviewDialog
            candidates={
              candidates.status === "fulfilled"
                ? candidates.value.map(({ id, name, email }) => ({ id, name, email }))
                : []
            }
            candidatesError={
              candidates.status === "rejected" ? errorMessage(candidates.reason) : undefined
            }
            offeredTypes={offered}
            defaultDate={week === thisWeek ? today : week}
            defaultTime="10:00"
            timeZone={timeZone}
          />
        }
      />
      <PageBody>
        <ScheduleToolbar week={week} thisWeek={thisWeek} type={type} offered={offered} />
        {interviews.status === "rejected" ? (
          <ErrorState
            title="Interviews could not be loaded"
            message={errorMessage(interviews.reason)}
          />
        ) : (
          <ScheduleList
            interviews={
              type === "all"
                ? interviews.value
                : interviews.value.filter((i) => i.slot_type === type)
            }
            timeZone={timeZone}
            today={today}
            now={now}
            type={type}
          />
        )}
      </PageBody>
    </>
  );
}
