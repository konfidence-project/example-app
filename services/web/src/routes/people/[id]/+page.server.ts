import { error } from "@sveltejs/kit";
import { flag, getCandidate, listInterviews, orFail } from "#lib/server/api.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, params }) => {
  const key = locals.routingKey;
  const [candidate, interviews, notesEnabled] = await Promise.all([
    orFail(getCandidate(key, params.id)),
    orFail(listInterviews(key)),
    flag(key, "candidates", "enable-candidate-notes"),
  ]);
  if (!candidate) error(404, { message: "No candidate with this ID." });

  const mine = interviews
    .filter((iv) => iv.candidate_id === candidate.id)
    .toSorted((a, b) => a.slot_time.localeCompare(b.slot_time));
  const now = new Date().toISOString();
  return {
    candidate,
    upcoming: mine.filter((iv) => iv.slot_time >= now),
    past: mine.filter((iv) => iv.slot_time < now).toReversed(),
    notesEnabled,
  };
};
