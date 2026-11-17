"use server";

import { revalidatePath } from "next/cache";

import { paths } from "@/config/paths";
import { api, errorMessage } from "@/lib/api-client";
import type { ActionResult } from "@/types/api";

const MAX_NOTES = 2000;

export async function updateCandidateNotes(
  _previous: ActionResult | null,
  form: FormData,
): Promise<ActionResult> {
  const id = String(form.get("candidateId") ?? "");
  const notes = String(form.get("notes") ?? "").trim();
  if (!id) return { ok: false, error: "Missing candidate." };
  if (notes.length > MAX_NOTES)
    return { ok: false, error: `Notes are limited to ${MAX_NOTES} characters.` };
  try {
    await api.patch("candidates", `/candidates/${encodeURIComponent(id)}`, {
      notes: notes || null,
    });
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
  revalidatePath(paths.candidate.getHref(id));
  revalidatePath(paths.people.href);
  return { ok: true };
}
