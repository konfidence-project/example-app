"use client";

import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Dialog, DialogBody, DialogFooter } from "@/components/ui/dialog";
import { Field, FormError, Input, Select } from "@/components/ui/field";
import { paths } from "@/config/paths";
import type { ActionResult, InterviewType } from "@/types/api";
import { submitTo } from "@/utils/form";
import { TYPE_HINT, TYPE_LABEL } from "@/utils/interview";

import { createInterview } from "../api/create-interview";
import { DURATIONS, type CandidateOption } from "../types";

import styles from "./schedule.module.css";

export interface ScheduleInterviewDialogProps {
  candidates: CandidateOption[];
  offeredTypes: InterviewType[];
  defaultDate: string;
  defaultTime: string;
  timeZone: string;
  /** Preselects a candidate, for example on the candidate's own page. */
  candidateId?: string;
  /** Set when the candidate list could not be loaded. */
  candidatesError?: string;
}

export function ScheduleInterviewDialog(props: ScheduleInterviewDialogProps) {
  const [open, setOpen] = useState(false);
  // A new key per opening gives the form fresh state every time.
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
        Schedule interview
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule interview"
        description="Adds the interview to the schedule. The app sends no invitation."
      >
        <ScheduleForm key={session} {...props} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function ScheduleForm({
  candidates,
  offeredTypes,
  defaultDate,
  defaultTime,
  timeZone,
  candidateId,
  candidatesError,
  onDone,
}: ScheduleInterviewDialogProps & { onDone: () => void }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async (previous, form) => {
      const result = await createInterview(previous, form);
      if (result.ok) onDone();
      return result;
    },
    null,
  );
  const [type, setType] = useState<InterviewType>(offeredTypes[0] ?? "onsite");
  const id = useId();

  if (candidates.length === 0) {
    return (
      <>
        <DialogBody>
          {candidatesError ? (
            <FormError>Candidates could not be loaded: {candidatesError}</FormError>
          ) : (
            <p className={styles.dialogText}>
              There is no candidate to schedule yet.{" "}
              <Link href={paths.people.href}>Add a candidate</Link> first.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button onClick={onDone}>Close</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submitTo(action)}>
      <DialogBody>
        <Field label="Candidate" htmlFor={`${id}-candidate`}>
          <Select
            id={`${id}-candidate`}
            name="candidateId"
            defaultValue={candidateId ?? candidates[0]?.id}
            required
            data-autofocus
          >
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.email}
              </option>
            ))}
          </Select>
        </Field>
        <div className={styles.formRow}>
          <Field label="Date" htmlFor={`${id}-date`}>
            <Input id={`${id}-date`} name="date" type="date" defaultValue={defaultDate} required />
          </Field>
          <Field label={`Time (${timeZone})`} htmlFor={`${id}-time`}>
            <Input
              id={`${id}-time`}
              name="time"
              type="time"
              step={300}
              defaultValue={defaultTime}
              required
            />
          </Field>
          <Field label="Length" htmlFor={`${id}-duration`}>
            <Select id={`${id}-duration`} name="duration" defaultValue="60">
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} min
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <ChoiceCards
          name="type"
          legend="Type"
          value={type}
          onChange={setType}
          choices={offeredTypes.map((t) => ({
            value: t,
            label: TYPE_LABEL[t],
            hint: TYPE_HINT[t],
          }))}
        />
        {type === "onsite" && (
          <Field label="Room" htmlFor={`${id}-location`}>
            <Input
              id={`${id}-location`}
              name="location"
              placeholder="Optional, for example Room 2, 3rd floor"
              maxLength={200}
              autoComplete="off"
            />
          </Field>
        )}
        {state && !state.ok && <FormError>{state.error}</FormError>}
      </DialogBody>
      <DialogFooter>
        <Button onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Scheduling" : "Schedule interview"}
        </Button>
      </DialogFooter>
    </form>
  );
}
