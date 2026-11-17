<script lang="ts">
  import Avatar from "#lib/components/Avatar.svelte";
  import { backgroundRefresh } from "#lib/refresh.svelte.ts";
  import { dayKey, fmtDay, fmtTime } from "#lib/time.ts";
  import type { Interview } from "#lib/types.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  backgroundRefresh(15_000);

  const c = $derived(data.candidate);
  const day = (iv: Interview) => fmtDay(dayKey(iv.slot_time, data.tz), { day: "numeric", month: "short" });
  const weekday = (iv: Interview) => fmtDay(dayKey(iv.slot_time, data.tz), { weekday: "long" });
</script>

<svelte:head><title>{c.name} · Konfidence example app</title></svelte:head>

<header class="topbar">
  <div>
    <h1>{c.name}</h1>
    <p class="sub"><a href="/people">People</a> / {c.name}</p>
  </div>
  <a class="btn" href={`/?schedule&candidate=${c.id}`}>Schedule interview</a>
</header>

<div class="content detail">
  <div class="stack">
    {#each [["Upcoming", data.upcoming], ["Past", data.past]] as const as [title, list] (title)}
      {#if title === "Upcoming" || list.length > 0}
        <section class="card">
          <div class="card-head">
            <h2>{title}</h2>
            <span class="badge">{list.length}</span>
          </div>
          {#each list as iv (iv.id)}
            <a class="row" href={`/?week=${dayKey(iv.slot_time, data.tz)}`}>
              <span class="time">{day(iv)}</span>
              <span class="who"><strong>{weekday(iv)} · {fmtTime(iv.slot_time, data.tz)}</strong><span>{iv.slot_type} interview</span></span>
              <span class="badge {iv.slot_type}">{iv.slot_type}</span>
            </a>
          {:else}
            <p class="empty">Nothing scheduled. <a href={`/?schedule&candidate=${c.id}`}>Schedule an interview</a></p>
          {/each}
        </section>
      {/if}
    {/each}
  </div>

  <aside class="card profile">
    <div class="identity">
      <Avatar name={c.name} size="lg" />
      <div>
        <h2>{c.name}</h2>
        <a href={`mailto:${c.email}`}>{c.email}</a>
      </div>
    </div>
    <dl>
      <dt>Candidate ID</dt>
      <dd class="mono">{c.id}</dd>
      <dt>Notes</dt>
      <dd>
        {#if c.notes}
          {c.notes}
        {:else if data.notesEnabled}
          <span class="muted">No notes.</span>
        {:else}
          <span class="muted">Notes aren't enabled for this stage.</span>
        {/if}
      </dd>
    </dl>
  </aside>
</div>

<style>
  .detail {
    grid-template-columns: minmax(0, 1fr) 320px;
    align-items: start;
  }
  .stack {
    display: grid;
    gap: var(--space-5);
  }
  .time {
    width: 72px;
  }
  .identity {
    display: grid;
    gap: var(--space-3);
    padding: var(--space-5);
  }
  .identity h2 {
    font-size: 1.0625rem;
  }
  dl {
    margin: 0;
  }
  dt {
    padding: var(--space-3) var(--space-5) 0;
    border-top: 1px solid var(--border-subtle);
    color: var(--text-tertiary);
    font-size: var(--font-size-meta);
    font-weight: var(--weight-medium);
  }
  dd {
    margin: 0;
    padding: 2px var(--space-5) var(--space-3);
    overflow-wrap: anywhere;
  }
  @media (max-width: 900px) {
    .detail {
      grid-template-columns: 1fr;
    }
    .profile {
      order: -1;
    }
  }
</style>
