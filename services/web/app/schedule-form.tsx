"use client";
import { useActionState } from "react";

import { type FormState, schedule } from "./actions";

const empty: FormState = { error: null, values: {} };

// The flags decide which fields exist. The page reads them per request from
// the vector, so a promotion that changes a flag changes the form without a
// rebuild.
export function ScheduleForm({
  videoSlots,
  candidateNotes,
}: {
  videoSlots: boolean;
  candidateNotes: boolean;
}) {
  const [state, action, pending] = useActionState(schedule, empty);
  const { values } = state;

  return (
    <form action={action} className="form">
      <label>
        Name
        <input name="name" required autoComplete="off" defaultValue={values.name} />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          required
          autoComplete="off"
          placeholder="name@example.com"
          defaultValue={values.email}
        />
      </label>
      <label>
        Time (UTC)
        <input name="slotTime" type="datetime-local" required defaultValue={values.slotTime} />
      </label>
      <label>
        Type
        <select name="slotType" defaultValue={values.slotType ?? "onsite"}>
          <option value="onsite">On site</option>
          <option value="phone">Phone</option>
          {videoSlots && <option value="video">Video</option>}
        </select>
      </label>
      {candidateNotes && (
        <label className="wide">
          Notes
          <input name="notes" autoComplete="off" defaultValue={values.notes} />
        </label>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Scheduling" : "Schedule"}
      </button>
      {state.error && <p className="error wide">{state.error}</p>}
    </form>
  );
}
