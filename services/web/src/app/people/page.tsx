import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";

import { PageBody, PageHeader } from "@/components/layouts/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { env } from "@/config/env";
import { getCandidates } from "@/features/people/api/get-candidates";
import { AddCandidateDialog } from "@/features/people/components/add-candidate-dialog";
import { PeopleToolbar } from "@/features/people/components/people-layout";
import { PeopleSearch } from "@/features/people/components/people-search";
import { PeopleTable } from "@/features/people/components/people-table";
import { toPersonRows } from "@/features/people/utils/people";
import { getInterviews } from "@/features/schedule/api/get-interviews";
import { errorMessage } from "@/lib/api-client";
import { getFeatureFlags } from "@/lib/flags";
import { plural } from "@/utils/format";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 200) : "";
  const now = new Date();
  const [flags, candidates, upcoming] = await Promise.all([
    getFeatureFlags(),
    getCandidates(q).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error: errorMessage(error) }),
    ),
    // Without interviews the table still works, it just shows no dates.
    getInterviews({ from: now }).catch((err: unknown) => {
      unstable_rethrow(err);
      return null;
    }),
  ]);

  let body;
  if (!candidates.ok) {
    body = <ErrorState title="Candidates could not be loaded" message={candidates.error} />;
  } else if (candidates.value.length === 0) {
    body = q ? (
      <EmptyState title={`No one matches "${q}"`}>
        Search by part of a name or an email address.
      </EmptyState>
    ) : (
      <EmptyState title="No candidates yet">
        Add a candidate to start scheduling interviews.
      </EmptyState>
    );
  } else {
    body = (
      <>
        {upcoming === null && <ErrorState title="Upcoming interviews could not be loaded" />}
        <PeopleTable
          rows={toPersonRows(candidates.value, upcoming ?? [])}
          showNotes={flags.candidateNotes}
          timeZone={env.timeZone}
        />
      </>
    );
  }

  const subtitle = candidates.ok
    ? q
      ? `${plural(candidates.value.length, "match", "matches")} for "${q}"`
      : plural(candidates.value.length, "candidate")
    : "";

  return (
    <>
      <PageHeader
        title="People"
        subtitle={subtitle}
        actions={<AddCandidateDialog allowNotes={flags.candidateNotes} />}
      />
      <PageBody>
        <PeopleToolbar>
          <PeopleSearch initial={q} />
        </PeopleToolbar>
        {body}
      </PageBody>
    </>
  );
}
