<script lang="ts">
  import { enhance } from "$app/forms";
  import Avatar from "#lib/components/Avatar.svelte";
  import Icon from "#lib/components/Icon.svelte";
  import Modal from "#lib/components/Modal.svelte";
  import { backgroundRefresh } from "#lib/refresh.svelte.ts";
  import { fmtShort } from "#lib/time.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  let submitting = $state(false);

  backgroundRefresh(15_000, () => !data.adding);

  const query = $derived(data.q ? `q=${encodeURIComponent(data.q)}` : "");
  const listHref = $derived(query ? `/people?${query}` : "/people");
  const newHref = $derived(query ? `/people?${query}&new` : "/people?new");
</script>

<svelte:head><title>People · Konfidence example app</title></svelte:head>

<header class="topbar">
  <div>
    <h1>People</h1>
    <p class="sub">{data.total} candidate{data.total === 1 ? "" : "s"}</p>
  </div>
  <a class="btn" href={newHref} data-sveltekit-reset="false">Add candidate</a>
</header>

<div class="content">
  <form class="toolbar" method="GET" data-sveltekit-reset="false" data-sveltekit-replacestate>
    <label class="search">
      <Icon name="search" />
      <input type="search" name="q" value={data.q} placeholder="Search by name or email" aria-label="Search" />
    </label>
    <span class="muted">Sorted by next interview</span>
  </form>

  <section class="card">
    <div class="thead row">
      <span class="c-name">Name</span>
      <span class="c-notes">Notes</span>
      <span class="c-next">Next interview</span>
      <span class="c-count"></span>
    </div>
    {#each data.people as p (p.id)}
      <a class="row" href={`/people/${p.id}`}>
        <span class="c-name">
          <Avatar name={p.name} />
          <span class="who"><strong>{p.name}</strong><span>{p.email}</span></span>
        </span>
        <span class="c-notes muted">{p.notes || "—"}</span>
        <span class="c-next" class:muted={!p.next}>{p.next ? fmtShort(p.next, data.tz) : "Not scheduled"}</span>
        <span class="c-count"><span class="badge">{p.interviews} interview{p.interviews === 1 ? "" : "s"}</span></span>
        <span class="chev"><Icon name="chevron-right" /></span>
      </a>
    {:else}
      <p class="empty">
        {#if data.q}No one matches “{data.q}”.{:else}No candidates yet. <a href={newHref}>Add the first one</a>{/if}
      </p>
    {/each}
  </section>
</div>

{#if data.adding}
  <Modal title="Add candidate" description="They can be scheduled right after." closeHref={listHref}>
    <form
      id="candidate-form"
      method="POST"
      action={`${newHref}&/create`}
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
      <label>Name <input name="name" required autocomplete="off" value={form?.values?.name ?? ""} /></label>
      <label>Email <input name="email" type="email" required autocomplete="off" value={form?.values?.email ?? ""} /></label>
      {#if data.notesEnabled}
        <label>Notes <textarea name="notes" rows="3" placeholder="Optional">{form?.values?.notes ?? ""}</textarea></label>
      {:else}
        <p class="hint">Notes aren't enabled for this stage.</p>
      {/if}
    </form>
    {#snippet footer()}
      <a class="btn secondary" href={listHref} data-sveltekit-reset="false">Cancel</a>
      <button class="btn" type="submit" form="candidate-form" disabled={submitting}>
        {submitting ? "Adding…" : "Add candidate"}
      </button>
    {/snippet}
  </Modal>
{/if}

<style>
  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: min(320px, 100%);
    padding: 0 var(--space-3);
    border: 1px solid var(--input-bd);
    border-radius: var(--input-radius);
    background: var(--input-bg);
    color: var(--text-tertiary);
  }
  .search:focus-within {
    border-color: var(--border-focus);
    box-shadow: var(--focus-ring-teal);
  }
  .search input {
    padding-inline: 0;
    border: 0;
    background: none;
    box-shadow: none;
  }
  .thead {
    border-top: 0;
    background: var(--surface-subtle);
    color: var(--text-tertiary);
    font-size: 11px;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.05em;
    padding-block: 10px;
    text-transform: uppercase;
  }
  .thead::after {
    content: "";
    width: 16px;
  }
  .c-name {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    width: 300px;
    flex: none;
  }
  .c-notes {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .c-next {
    width: 170px;
    flex: none;
  }
  .c-count {
    display: flex;
    justify-content: flex-end;
    width: 110px;
    flex: none;
  }
  .dialog-form {
    display: grid;
    gap: var(--space-4);
  }
  @media (max-width: 900px) {
    .c-notes,
    .c-count,
    .thead {
      display: none;
    }
    .c-name {
      width: auto;
      flex: 1;
      min-width: 0;
    }
  }
</style>
