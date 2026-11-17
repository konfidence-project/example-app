"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

// Runs in the browser. It calls the backend services on the page's own origin
// with plain relative paths. Which service instance answers is decided by
// Konfidence routing, not by this code.
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${path} responded ${res.status}`);
  return data as T;
}

export function ScheduleForm({
  allowVideo,
  allowNotes,
}: {
  allowVideo: boolean;
  allowNotes: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const notes = String(values.get("notes") ?? "").trim();
      const candidate = await post<{ id: string }>("/candidates", {
        name: values.get("name"),
        email: values.get("email"),
        ...(allowNotes && notes ? { notes } : {}),
      });
      await post("/interviews", {
        candidateId: candidate.id,
        slotTime: new Date(String(values.get("slotTime"))).toISOString(),
        slotType: values.get("slotType"),
      });
      form.reset();
      router.refresh(); // re-render the server component with the new list
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="schedule">
      <label>
        Name
        <input name="name" required placeholder="Ada Example" autoComplete="off" />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          placeholder="ada@example.com"
          autoComplete="off"
        />
      </label>
      <label>
        Slot
        <input name="slotTime" type="datetime-local" required />
      </label>
      <label>
        Type
        <select name="slotType" defaultValue="onsite">
          <option value="onsite">On site</option>
          <option value="phone">Phone</option>
          {allowVideo && <option value="video">Video</option>}
        </select>
      </label>
      {allowNotes && (
        <label className="wide">
          Notes
          <input name="notes" placeholder="Optional" autoComplete="off" />
        </label>
      )}
      <button type="submit" disabled={busy}>
        {busy ? "Scheduling" : "Schedule"}
      </button>
      {error && <p className="error wide">{error}</p>}
    </form>
  );
}
