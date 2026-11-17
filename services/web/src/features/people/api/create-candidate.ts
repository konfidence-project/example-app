"use server";

import { revalidatePath } from "next/cache";

import { api, errorMessage } from "@/lib/api-client";
import { getFeatureFlags } from "@/lib/flags";
import type { ActionResult } from "@/types/api";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createCandidate(
  _previous: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const notes = String(form.get("notes") ?? "").trim();
  if (!name) return { ok: false, error: "Enter a name." };
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address." };

  // The candidates service rejects notes unless they are enabled, so only
  // send them when this stage offers them.
  const { candidateNotes } = await getFeatureFlags();
  try {
    await api.post("candidates", "/candidates", {
      name,
      email,
      ...(candidateNotes && notes ? { notes } : {}),
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
