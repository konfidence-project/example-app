<script lang="ts">
  import { enhance } from "$app/forms";
  import { page } from "$app/state";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import { backgroundRefresh } from "#lib/refresh.svelte.ts";
  import { addDays, fmtDay, fmtTime, mondayOf } from "#lib/time.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let submitting = $state(false);

  backgroundRefresh(15_000, () => !data.scheduling);

  // Builds a link to this page with some query params changed; null removes a param.
  function href(changes: Record<string, string | null>): string {
    const q = new URLSearchParams(page.url.search);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString().replace(/=(?=&|$)/g, "");
    return s ? `/?${s}` : "/";
  }

  const weekLabel = $derived(
    `${fmtDay(data.week, { month: "short", day: "numeric" })} – ${fmtDay(addDays(data.week, 6), { month: "short", day: "numeric", year: "numeric" })}`,
  );
  const filters = [
    { label: "All", value: null },
    { label: "Onsite", value: "onsite" },
    { label: "Phone", value: "phone" },
    { label: "Video", value: "video" },
  ] as const;

  const values = $derived(form?.values);
  const nextHour = $derived(`${String((new Date().getHours() + 1) % 24).padStart(2, "0")}:00`);
</script>

<svelte:head><title>Schedule · Konfidence example app</title></svelte:head>

<header class="topbar">
  <div>
    <h1>Schedule</h1>
    <p class="sub">{data.total} {data.type ?? ""} interview{data.total === 1 ? "" : "s"} this week</p>
  </div>
  <a class="btn" href={href({ schedule: "" })} data-sveltekit-reset="false">Schedule interview</a>
</header>

<div class="content">
  <div class="toolbar">
    <nav class="seg" aria-label="Interview type">
      {#each filters as f (f.label)}
        <a href={href({ type: f.value })} aria-current={data.type === f.value}>{f.label}</a>
      {/each}
    </nav>
    <div class="week">
      <a class="btn secondary icon" href={href({ week: addDays(data.week, -7) })} aria-label="Previous week">
        <Icon name="chevron-left" />
      </a>
      <span>{weekLabel}</span>
      <a class="btn secondary icon" href={href({ week: addDays(data.week, 7) })} aria-label="Next week">
        <Icon name="chevron-right" />
      </a>
      {#if data.week !== mondayOf(data.today)}
        <a class="btn secondary" href={href({ week: null })}>Today</a>
      {/if}
    </div>
  </div>

  {#each data.days as day (day.ymd)}
    <section class="card">
      <div class="card-head">
        <h2>{day.label} <span class="meta">{day.date}</span></h2>
        <span class="badge">{day.items.length} interview{day.items.length === 1 ? "" : "s"}</span>
      </div>
      {#each day.items as iv (iv.id)}
        <a class="row" href={`/people/${iv.candidate_id}`}>
          <span class="time">{fmtTime(iv.slot_time, data.tz)}</span>
          {#if iv.candidate}
            <Avatar name={iv.candidate.name} />
            <span class="who"><strong>{iv.candidate.name}</strong><span>{iv.candidate.email}</span></span>
          {:else}
            <span class="who"><strong>Unknown candidate</strong><span class="mono">{iv.candidate_id}</span></span>
          {/if}
          <span class="badge {iv.slot_type}">{iv.slot_type}</span>
          <span class="chev"><Icon name="chevron-right" /></span>
        </a>
      {/each}
    </section>
  {:else}
    <section class="card">
      <p class="empty">
        No {data.type ?? ""} interviews this week.
        <a href={href({ schedule: "" })} data-sveltekit-reset="false">Schedule one</a>
      </p>
    </section>
  {/each}
</div>

{#if data.scheduling}
  <Modal title="Schedule interview" description="The candidate gets the invite once it's saved." closeHref={href({ schedule: null, candidate: null })}>
    <form
      id="schedule-form"
      method="POST"
      action={`${href({})}${page.url.search ? "&" : "?"}/schedule`}
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          await update();
          submitting = false;
        };
      }}
      class="dialog-form"
    >
      {#if form?.error}<p class="form-error">{form.error}</p>{/if}
      <label>
        Candidate
        <select name="candidateId" required>
          <option value="" disabled selected={!(values?.candidateId ?? data.preselect)}>Choose a candidate</option>
          {#each data.candidates as c (c.id)}
            <option value={c.id} selected={(values?.candidateId ?? data.preselect) === c.id}>{c.name} — {c.email}</option>
          {/each}
        </select>
        {#if data.candidates.length === 0}
          <span class="hint">No candidates yet. <a href="/people?new">Add one first.</a></span>
        {/if}
      </label>
      <div class="grid-2">
        <label>Date <input type="date" name="date" required value={values?.date ?? data.today} /></label>
        <label>Time <input type="time" name="time" required value={values?.time ?? nextHour} /></label>
      </div>
      <fieldset>
        <legend class="label">Type</legend>
        <div class="types">
          {#each [["onsite", "Onsite", "In the office"], ["phone", "Phone", "We call them"], ["video", "Video", "Link in the invite"]] as [value, label, desc] (value)}
            {@const disabled = value === "video" && !data.videoSlots}
            <label class="type" class:disabled>
              <input type="radio" name="slotType" {value} {disabled} checked={(values?.slotType ?? "onsite") === value} />
              <strong>{label}</strong>
              <span>{disabled ? "Not enabled for this stage" : desc}</span>
            </label>
          {/each}
        </div>
      </fieldset>
    </form>
    {#snippet footer()}
      <a class="btn secondary" href={href({ schedule: null, candidate: null })} data-sveltekit-reset="false">Cancel</a>
      <button class="btn" type="submit" form="schedule-form" disabled={submitting}>
        {submitting ? "Scheduling…" : "Schedule interview"}
      </button>
    {/snippet}
  </Modal>
{/if}

<style>
  .week {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-weight: var(--weight-medium);
  }
  .dialog-form {
    display: grid;
    gap: var(--space-4);
  }
  fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }
  .types {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-2);
    margin-top: var(--space-1);
  }
  .type {
    position: relative;
    gap: 2px;
    padding: 10px var(--space-3);
    border: 1px solid var(--input-bd);
    border-radius: var(--radius-md);
    background: var(--input-bg);
    cursor: pointer;
  }
  .type input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .type strong {
    color: var(--text-primary);
    font-size: var(--font-size-body);
  }
  .type span {
    color: var(--text-secondary);
    font-size: var(--font-size-meta);
    font-weight: var(--weight-regular);
  }
  .type:has(input:checked) {
    border-color: var(--accent-primary);
    background: var(--selection-bg);
    box-shadow: 0 0 0 0.5px var(--accent-primary);
  }
  .type:has(input:focus-visible) {
    box-shadow: var(--focus-ring);
  }
  .type.disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
  @media (max-width: 760px) {
    .types {
      grid-template-columns: 1fr;
    }
  }
</style>
