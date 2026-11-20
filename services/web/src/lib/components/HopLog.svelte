<script lang="ts">
  import { fmtTime } from "#lib/time.ts";
  import type { Hop } from "#lib/types.ts";

  let { hops, routingKey, tz }: { hops: Hop[]; routingKey: string; tz: string } = $props();

  const seconds = (iso: string) => `${fmtTime(iso, tz)}:${new Date(iso).getUTCSeconds().toString().padStart(2, "0")}`;

  function keyCheck(h: Hop): { label: string; cls: string } {
    if (h.from !== "web") return { label: "implied", cls: "" };
    if (!h.echoedKey) return { label: "no echo", cls: "" };
    return h.echoedKey === routingKey ? { label: "same vector", cls: "ok" } : { label: "other vector", cls: "err" };
  }
</script>

<div class="scroll">
  <table>
    <thead>
      <tr><th>Time</th><th>Hop</th><th>Request</th><th>Status</th><th>Latency</th><th>Routing key</th></tr>
    </thead>
    <tbody>
      {#each hops as h (h.id)}
        {@const k = keyCheck(h)}
        <tr class:implied={h.from !== "web"}>
          <td class="mono muted">{seconds(h.at)}</td>
          <td class="hop"><strong>{h.from}</strong> → <strong>{h.to}</strong></td>
          <td class="req">
            <code>{h.method} {h.path}</code>
            {#if h.error}<span class="error">{h.error}</span>
            {:else if h.authority}<span class="mono muted">{h.authority}</span>
            {:else if h.from !== "web"}<span class="mono muted">implied by the interviews response</span>{/if}
          </td>
          <td><span class="badge" class:ok={!h.error && h.status !== null} class:err={!!h.error}>{h.status ?? "—"}</span></td>
          <td class="mono">{h.ms === null ? "—" : `${h.ms} ms`}</td>
          <td><span class="badge {k.cls}">{k.label}</span></td>
        </tr>
      {:else}
        <tr><td colspan="6" class="none muted">No traffic yet. Open Schedule or People and come back.</td></tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .scroll {
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    padding: 10px var(--space-3);
    background: var(--surface-subtle);
    color: var(--text-tertiary);
    font-size: 11px;
    font-weight: var(--weight-semibold);
    letter-spacing: 0.05em;
    text-align: left;
    text-transform: uppercase;
    white-space: nowrap;
  }
  td {
    padding: 10px var(--space-3);
    border-top: 1px solid var(--border-subtle);
    vertical-align: top;
  }
  th:first-child,
  td:first-child {
    padding-left: var(--space-5);
  }
  .hop {
    white-space: nowrap;
  }
  .req {
    display: grid;
    gap: 2px;
    max-width: 420px;
  }
  .req span {
    overflow: hidden;
    font-size: var(--font-size-meta);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .error {
    color: var(--status-error-fg);
  }
  tr.implied td {
    opacity: 0.7;
  }
  .none {
    padding: var(--space-6) var(--space-5);
    text-align: center;
  }
</style>
