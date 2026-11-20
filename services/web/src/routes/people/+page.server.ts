import { fail, redirect } from "@sveltejs/kit";
import { createCandidate, flag, listCandidates, listInterviews, orFail } from "#lib/server/api.ts";
import { UpstreamError } from "#lib/server/eastwest.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals, url }) => {
  const key = locals.routingKey;
  const [candidates, interviews, notesEnabled] = await Promise.all([
    orFail(listCandidates(key)),
    orFail(listInterviews(key)),
    flag(key, "candidates", "enable-candidate-notes"),
  ]);

  const now = new Date().toISOString();
  const q = (url.searchParams.get("q") ?? "").trim();
  const needle = q.toLowerCase();

  const people = candidates
    .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.email.toLowerCase().includes(needle))
    .map((c) => {
      const mine = interviews.filter((iv) => iv.candidate_id === c.id);
      const next = mine
        .map((iv) => iv.slot_time)
        .filter((t) => t >= now)
        .sort()[0];
      return { ...c, interviews: mine.length, next: next ?? null };
    })
    // Upcoming first, soonest at the top; people without an interview after them by name.
    .sort((a, b) => (a.next ?? "~").localeCompare(b.next ?? "~") || a.name.localeCompare(b.name));

  return { people, total: candidates.length, q, adding: url.searchParams.has("new"), notesEnabled };
};

export const actions: Actions = {
  create: async ({ request, locals }) => {
    const form = await request.formData();
    const values = {
      name: String(form.get("name") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      notes: String(form.get("notes") ?? "").trim(),
    };
    if (!values.name || !values.email) return fail(400, { error: "Name and email are required.", values });

    let id: string;
    try {
      ({ id } = await createCandidate(locals.routingKey, {
        name: values.name,
        email: values.email,
        ...(values.notes ? { notes: values.notes } : {}),
      }));
    } catch (err) {
      if (err instanceof UpstreamError) {
        return fail(err.clientError ? 400 : 502, { error: err.clientError ? err.message : "Adding candidates is unavailable right now.", values });
      }
      throw err;
    }
    redirect(303, `/people/${id}`);
  },
};
