<script lang="ts">
  import HopLog from "#lib/components/HopLog.svelte";
  import Topology from "#lib/components/Topology.svelte";
  import { fmtTime } from "#lib/time.ts";
  import type { RoutingSnapshot } from "#lib/types.ts";
  import type { PageProps } from "./$types";

  const POLL_MS = 3000;

  let { data }: PageProps = $props();

  // Seeded from SSR, then replaced by background polls.
  let polled: RoutingSnapshot | null = $state(null);
  let snapshot = $derived(polled ?? data.snapshot);
  let live = $state(true);
  let busy = $state(false);
  let pollError = $state("");

  async function poll() {
    if (busy || document.hidden) return;
    busy = true;
    try {
      const res = await fetch("/api/routing", { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      polled = await res.json();
      pollError = "";
    } catch (err) {
      pollError = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  $effect(() => {
    if (!live) return;
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  });

  const services = ["interviews", "candidates"] as const;
</script>

<svelte:head><title>Routing · Konfidence example app</title></svelte:head>

<header class="topbar">
  <div>
    <h1>Routing</h1>
    <p class="sub">Server-side calls web made inside this vector</p>
  </div>
</header>

<div class="content">
  <section class="card pad">
    <div class="head">
      <div>
        <h2>Request path</h2>
        <p class="muted small">Probed {fmtTime(snapshot.at, data.tz)} · wires light up for hops in the last minute</p>
      </div>
      <div class="controls">
        {#if pollError}<span class="badge err">poll failed: {pollError}</span>{/if}
        <button class="btn secondary" onclick={() => (live = !live)} aria-pressed={live}>
          <span class="pulse" class:on={live}></span>{live ? "Live" : "Paused"}
        </button>
        <button class="btn secondary" onclick={poll} disabled={busy}>Refresh</button>
      </div>
    </div>
    <Topology {snapshot} />
  </section>

  <section class="card">
    <div class="card-head"><h2>Vector</h2><span class="mono muted small">{snapshot.routingKey || "no routing key"}</span></div>
    {#each services as svc (svc)}
      {@const s = snapshot.services[svc]}
      <div class="svc">
        <div class="svc-head">
          <strong>{svc}</strong>
          <span class="badge" class:ok={s.reachable} class:err={!s.reachable}>{s.reachable ? "reachable" : "unreachable"}</span>
        </div>
        <span class="mono muted small">{s.authority ?? "not resolved"}</span>
        <div class="flags">
          {#each Object.entries(s.flags) as [name, value] (name)}
            <span class="badge mono" class:ok={value === true}>{name} {String(value)}</span>
          {:else}
            <span class="muted small">no flags reported</span>
          {/each}
        </div>
      </div>
    {/each}
  </section>

  <section class="card">
    <div class="card-head"><h2>Recent hops</h2><span class="muted small">newest first</span></div>
    <HopLog hops={snapshot.hops} routingKey={snapshot.routingKey} tz={data.tz} />
  </section>
</div>

<style>
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-4);
  }
  .head h2 {
    font-size: 0.9375rem;
  }
  .small {
    font-size: var(--font-size-meta);
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
  }
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--status-queued-solid);
  }
  .pulse.on {
    background: var(--status-healthy-solid);
    animation: breathe 1.6s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      opacity: 0.35;
    }
  }
  .svc {
    display: grid;
    gap: 6px;
    padding: 14px var(--space-5);
    border-top: 1px solid var(--border-subtle);
  }
  .svc-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .flags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
</style>
