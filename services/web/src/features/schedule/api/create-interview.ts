"use server";

import { revalidatePath } from "next/cache";

import { env } from "@/config/env";
import { api, errorMessage } from "@/lib/api-client";
import type { ActionResult } from "@/types/api";
import { isInterviewType } from "@/utils/interview";
import { isDateKey, isTime, zonedToUtc } from "@/utils/time";

import { DURATIONS } from "../types";

// Server action behind the "Schedule interview" dialog. The server calls the
// interviews service of its own vector, which checks the candidate and
// whether the slot type is enabled.
export async function createInterview(
  _previous: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const candidateId = String(form.get("candidateId") ?? "");
  const date = form.get("date");
  const time = form.get("time");
  const type = form.get("type");
  const duration = Number(form.get("duration"));
  const location = String(form.get("location") ?? "").trim();

  if (!candidateId) return { ok: false, error: "Choose a candidate." };
  if (!isDateKey(date)) return { ok: false, error: "Enter a valid date." };
  if (!isTime(time)) return { ok: false, error: "Enter a time as HH:MM." };
  if (!isInterviewType(type)) return { ok: false, error: "Choose a type." };
  if (!(DURATIONS as readonly number[]).includes(duration))
    return { ok: false, error: "Choose a length." };

  try {
    await api.post("interviews", "/interviews", {
      candidateId,
      slotTime: zonedToUtc(date, time, env.timeZone).toISOString(),
      slotType: type,
      durationMinutes: duration,
      ...(type === "onsite" && location ? { location } : {}),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
