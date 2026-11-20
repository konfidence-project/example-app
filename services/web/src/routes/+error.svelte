<script lang="ts">
  import { page } from "$app/state";
  import Icon from "#lib/components/Icon.svelte";
</script>

<header class="topbar">
  <div>
    <h1>{page.status === 404 ? "Not found" : "Something went wrong"}</h1>
  </div>
</header>
<div class="content">
  <div class="card problem">
    <Icon name="alert" size={20} />
    <div>
      <strong>{page.error?.message}</strong>
      {#if !page.data.routingKey}
        <p class="muted">
          This request carries no <code>X-Konfidence-Routing-Key</code>, so <code>web</code> cannot find the services of
          its vector. Open the app through the edge, e.g. <code>http://dev-eu12.example.kden.local:9090/</code>.
        </p>
      {:else}
        <p class="muted">See <a href="/routing">Routing</a> for which service is unreachable.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .problem {
    display: flex;
    gap: var(--space-3);
    color: var(--status-error-fg);
  }
  .problem p {
    margin: var(--space-1) 0 0;
  }
  strong {
    color: var(--text-primary);
  }
</style>
