"use server";
// The server action behind the form. The browser posts the form to the
// Next.js server, and the server calls the backends, so every call carries
// the routing key of the vector that served the page.
import { revalidatePath } from "next/cache";

import { scheduleInterview } from "./data";

export interface FormState {
  error: string | null;
  // What the user entered, so a failed submit keeps the form filled.
  values: Record<string, string>;
}

export async function schedule(_previous: FormState, form: FormData): Promise<FormState> {
  const values: Record<string, string> = {};
  for (const [key, value] of form) {
    if (typeof value === "string") values[key] = value.trim();
  }
  try {
    await scheduleInterview({
      name: values.name ?? "",
      email: values.email ?? "",
      notes: values.notes ?? "",
      // The form asks for the time in UTC.
      slotTime: new Date(`${values.slotTime}Z`).toISOString(),
      slotType: values.slotType ?? "",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err), values };
  }
  revalidatePath("/");
  return { error: null, values: {} };
}
