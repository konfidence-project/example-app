import { fail, redirect } from "@sveltejs/kit";
import { createInterview, flag, listCandidates, listInterviews, orFail } from "#lib/server/api.ts";
import { UpstreamError } from "#lib/server/eastwest.ts";
import { addDays, dayKey, fmtDay, isYmd, mondayOf, relativeDay, zonedToUtc } from "#lib/time.ts";
import type { Interview, SlotType } from "#lib/types.ts";
import type { Actions, PageServerLoad } from "./$types";

const TYPES: SlotType[] = ["onsite", "phone", "video"];
const isType = (v: unknown): v is SlotType => TYPES.includes(v as SlotType);

export const load: PageServerLoad = async ({ locals, url }) => {
  const { routingKey: key, tz } = locals;
  const today = dayKey(new Date(), tz);
  const weekParam = url.searchParams.get("week");
  const week = mondayOf(isYmd(weekParam) ? weekParam : today);
  const typeParam = url.searchParams.get("type");
  const type = isType(typeParam) ? typeParam : null;
  const scheduling = url.searchParams.has("schedule");

  const [interviews, candidates, videoSlots] = await Promise.all([
    orFail(listInterviews(key)),
    // The picker needs every candidate; only fetch them when the dialog is open.
    scheduling ? orFail(listCandidates(key)) : Promise.resolve([]),
    flag(key, "interviews", "allow-video-slots"),
  ]);

  const end = addDays(week, 6);
  const days = new Map<string, Interview[]>();
  for (const iv of interviews.toSorted((a, b) => a.slot_time.localeCompare(b.slot_time))) {
    const d = dayKey(iv.slot_time, tz);
    if (d < week || d > end || (type && iv.slot_type !== type)) continue;
    days.set(d, [...(days.get(d) ?? []), iv]);
  }

  return {
    week,
    today,
    type,
    total: [...days.values()].reduce((n, items) => n + items.length, 0),
    days: [...days].map(([ymd, items]) => ({
      ymd,
      label: relativeDay(ymd, today),
      date: fmtDay(ymd, { weekday: "long", month: "short", day: "numeric" }),
      items,
    })),
    scheduling,
    candidates,
    preselect: url.searchParams.get("candidate") ?? "",
    videoSlots,
  };
};

export const actions: Actions = {
  schedule: async ({ request, locals }) => {
    const form = await request.formData();
    const values = {
      candidateId: String(form.get("candidateId") ?? ""),
      date: String(form.get("date") ?? ""),
      time: String(form.get("time") ?? ""),
      slotType: String(form.get("slotType") ?? ""),
    };
    if (!values.candidateId || !isYmd(values.date) || !/^\d{2}:\d{2}$/.test(values.time) || !isType(values.slotType)) {
      return fail(400, { error: "Pick a candidate, a date, a time and a type.", values });
    }

    try {
      await createInterview(locals.routingKey, {
        candidateId: values.candidateId,
        slotTime: zonedToUtc(values.date, values.time, locals.tz),
        slotType: values.slotType,
      });
    } catch (err) {
      if (err instanceof UpstreamError) {
        return fail(err.clientError ? 400 : 502, { error: err.clientError ? err.message : "Scheduling is unavailable right now.", values });
      }
      throw err;
    }
    redirect(303, `/?week=${mondayOf(values.date)}`);
  },
};
