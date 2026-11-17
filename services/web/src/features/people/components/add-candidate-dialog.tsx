"use client";

import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Input, Textarea } from "@/components/ui/field";
import type { ActionResult } from "@/types/api";
import { submitTo } from "@/utils/form";

import { createCandidate } from "../api/create-candidate";

export function AddCandidateDialog({ allowNotes }: { allowNotes: boolean }) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setSession((n) => n + 1);
          setOpen(true);
        }}
      >
        Add candidate
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Add candidate"
        description="You can schedule interviews once they're saved."
      >
        <CandidateForm key={session} allowNotes={allowNotes} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function CandidateForm({ allowNotes, onDone }: { allowNotes: boolean; onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (previous, form) => {
      const result = await createCandidate(previous, form);
      if (result.ok) onDone();
      return result;
    },
    null,
  );
  const id = useId();

  return (
    <form onSubmit={submitTo(action)}>
      <DialogBody>
        <Field label="Name" htmlFor={`${id}-name`}>
          <Input
            id={`${id}-name`}
            name="name"
            required
            autoComplete="off"
            maxLength={200}
            data-autofocus
          />
        </Field>
        <Field label="Email" htmlFor={`${id}-email`}>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            autoComplete="off"
            maxLength={320}
          />
        </Field>
        {allowNotes && (
          <Field label="Notes" htmlFor={`${id}-notes`}>
            <Textarea id={`${id}-notes`} name="notes" placeholder="Optional" maxLength={2000} />
          </Field>
        )}
        {state && !state.ok && <FormError>{state.error}</FormError>}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Adding" : "Add candidate"}
        </Button>
      </DialogFooter>
    </form>
  );
}
