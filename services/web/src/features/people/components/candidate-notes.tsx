"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { FormError, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/types/api";
import { submitTo } from "@/utils/form";

import { updateCandidateNotes } from "../api/update-candidate-notes";

import styles from "./people.module.css";

export function CandidateNotes({ candidateId, notes }: { candidateId: string; notes: string }) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (previous, form) => {
      const result = await updateCandidateNotes(previous, form);
      if (result.ok) setEditing(false);
      return result;
    },
    null,
  );

  if (!editing) {
    return (
      <div className={styles.notesView}>
        {notes ? (
          <p className={styles.notesText}>{notes}</p>
        ) : (
          <p className={styles.muted}>No notes yet.</p>
        )}
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          {notes ? "Edit notes" : "Add notes"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submitTo(action)} className={styles.notesForm}>
      <input type="hidden" name="candidateId" value={candidateId} />
      <label htmlFor="candidate-notes" className="visually-hidden">
        Notes
      </label>
      {/* The editor opens after a click on "Edit", so focus follows that click. */}
      {/* oxlint-disable-next-line jsx-a11y/no-autofocus */}
      <Textarea id="candidate-notes" name="notes" defaultValue={notes} maxLength={2000} autoFocus />
      {state && !state.ok && <FormError>{state.error}</FormError>}
      <div className={styles.notesActions}>
        <Button size="sm" onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </Button>
        <Button size="sm" type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving" : "Save"}
        </Button>
      </div>
    </form>
  );
}
