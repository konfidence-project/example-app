// Everything the page needs from the backends. It runs on the Next.js server.
//
// serviceFetch() looks the service up in the vector that serves the current
// request and forwards the routing key, so this code only names the service.
// features() reads the feature flags of the same vector.
import { features, serviceFetch } from "@konfidence/next-devtools/server";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  notes?: string | null;
}

export interface Interview {
  id: string;
  candidate_id: string;
  slot_time: string;
  slot_type: string;
  // The interviews service fetches the candidate. Null when that failed.
  candidate: Candidate | null;
}

export interface Flags {
  videoSlots: boolean;
  candidateNotes: boolean;
}

// The two feature flags of the example app. Both stay off when the flags
// cannot be read, so the page still works without its optional parts.
export async function loadFlags(): Promise<Flags> {
  const flags = await features().catch((): Record<string, unknown> => ({}));
  return {
    videoSlots: flags["allow-video-slots"] === true,
    candidateNotes: flags["enable-candidate-notes"] === true,
  };
}

export function listInterviews(): Promise<Interview[]> {
  return call<Interview[]>("interviews", "/interviews");
}

export interface NewInterview {
  name: string;
  email: string;
  notes: string;
  slotTime: string;
  slotType: string;
}

// Creates the candidate, then the interview. The backends check the feature
// flags themselves and reject notes or a video slot when the flag is off.
export async function scheduleInterview(input: NewInterview): Promise<void> {
  const candidate = await call<Candidate>("candidates", "/candidates", {
    name: input.name,
    email: input.email,
    ...(input.notes ? { notes: input.notes } : {}),
  });
  await call("interviews", "/interviews", {
    candidateId: candidate.id,
    slotTime: input.slotTime,
    slotType: input.slotType,
  });
}

// GET without a body, POST with one. Throws the service's error message.
async function call<T>(service: string, path: string, body?: unknown): Promise<T> {
  const res = await serviceFetch(
    service,
    path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  if (!res.ok) throw new Error(data?.error ?? `${service} responded ${res.status}`);
  return data as T;
}
