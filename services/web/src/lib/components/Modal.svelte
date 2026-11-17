<script lang="ts">
  import type { Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import Icon from "./Icon.svelte";

  // The modal is driven by the URL (closeHref drops the query param that opened it), so it renders on the server,
  // survives reloads and works without JavaScript.
  let {
    title,
    description,
    closeHref,
    children,
    footer,
  }: { title: string; description?: string; closeHref: string; children: Snippet; footer: Snippet } = $props();

  function onkeydown(e: KeyboardEvent) {
    if (e.key === "Escape") goto(closeHref, { reset: false });
  }
</script>

<svelte:window {onkeydown} />

<a class="scrim" href={closeHref} aria-label="Close" data-sveltekit-reset="false"></a>
<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="modal-title">
  <header>
    <div>
      <h2 id="modal-title">{title}</h2>
      {#if description}<p>{description}</p>{/if}
    </div>
    <a class="close" href={closeHref} aria-label="Close" data-sveltekit-reset="false"><Icon name="x" /></a>
  </header>
  <div class="body">{@render children()}</div>
  <footer>{@render footer()}</footer>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 40;
    background: var(--scrim);
    backdrop-filter: blur(var(--scrim-blur));
  }
  .dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 41;
    width: min(520px, calc(100vw - 32px));
    max-height: calc(100vh - 32px);
    overflow: auto;
    transform: translate(-50%, -50%);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-xl);
    background: var(--surface-default);
    box-shadow: var(--shadow-overlay);
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-6) var(--space-4);
  }
  h2 {
    font-size: 1.125rem;
  }
  header p {
    margin: var(--space-1) 0 0;
    color: var(--text-secondary);
    font-size: var(--font-size-compact);
  }
  .close {
    color: var(--text-secondary);
  }
  .body {
    display: grid;
    gap: var(--space-4);
    padding: 0 var(--space-6) var(--space-6);
  }
  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: 14px var(--space-6);
    border-top: 1px solid var(--border-subtle);
    background: var(--surface-subtle);
  }
</style>
