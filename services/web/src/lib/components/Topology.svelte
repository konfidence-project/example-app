<script lang="ts">
  import type { Hop, RoutingSnapshot } from "#lib/types.ts";

  // Hops older than this no longer light up their wire.
  const WINDOW_MS = 60_000;

  let { snapshot }: { snapshot: RoutingSnapshot } = $props();

  type Link = { id: string; d: string; label: [number, number]; anchor?: "start" | "middle"; hops: Hop[]; always?: boolean };

  const W = 150;
  const H = 64;

  let fresh = $derived(snapshot.hops.filter((h) => Date.parse(snapshot.at) - Date.parse(h.at) < WINDOW_MS));
  const between = (from: string, to: string) => fresh.filter((h) => h.from === from && h.to === to);

  let links: Link[] = $derived([
    { id: "b-e", d: "M160 132 L230 132", label: [195, 122], hops: [], always: true },
    { id: "e-w", d: "M380 132 L450 132", label: [415, 122], hops: [], always: true },
    { id: "w-i", d: "M600 120 C650 120 650 52 700 52", label: [640, 74], hops: between("web", "interviews") },
    { id: "w-c", d: "M600 144 C650 144 650 212 700 212", label: [640, 202], hops: between("web", "candidates") },
    { id: "i-c", d: "M775 84 L775 180", label: [786, 136], anchor: "start", hops: between("interviews", "candidates") },
  ]);

  function state(l: Link): "ok" | "err" | "idle" {
    if (l.always) return "ok";
    if (l.hops.length === 0) return "idle";
    return l.hops.some((h) => h.error) ? "err" : "ok";
  }

  function caption(l: Link): string {
    if (l.always || l.hops.length === 0) return "";
    const timed = l.hops.flatMap((h) => (h.ms === null ? [] : [h.ms]));
    return timed.length ? `${l.hops.length}× · ${Math.max(...timed)} ms` : `${l.hops.length}×`;
  }

  let nodes = $derived([
    { id: "browser", x: 10, y: 100, title: "Browser", sub: "you", up: undefined },
    { id: "edge", x: 230, y: 100, title: "Edge → router", sub: snapshot.stage || "no stage header", up: undefined },
    { id: "web", x: 450, y: 100, title: "web", sub: "SvelteKit SSR", up: undefined },
    { id: "interviews", x: 700, y: 20, title: "interviews", sub: "TypeScript", up: snapshot.services.interviews.reachable },
    { id: "candidates", x: 700, y: 180, title: "candidates", sub: "Go", up: snapshot.services.candidates.reachable },
  ]);
</script>

<svg viewBox="0 0 870 264" role="img" aria-label="Request path from the browser through web to interviews and candidates">
  {#each links as l (l.id)}
    <path class="wire {state(l)}" d={l.d} />
    {#key snapshot.at}
      {#if state(l) !== "idle"}<path class="packet {state(l)}" d={l.d} pathLength="100" />{/if}
    {/key}
    {#if caption(l)}
      <text class="caption" x={l.label[0]} y={l.label[1]} text-anchor={l.anchor ?? "middle"}>{caption(l)}</text>
    {/if}
  {/each}

  {#each nodes as n (n.id)}
    <g class="node" class:accent={n.id === "web"} class:down={n.up === false}>
      <rect x={n.x} y={n.y} width={W} height={H} rx="14" />
      <text class="title" x={n.x + 16} y={n.y + 28}>{n.title}</text>
      <text class="sub" x={n.x + 16} y={n.y + 46}>{n.sub}</text>
      {#if n.up !== undefined}<circle cx={n.x + W - 18} cy={n.y + 22} r="5" class={n.up ? "dot-ok" : "dot-err"} />{/if}
    </g>
  {/each}

  <text class="zone" x="10" y="252">North–south</text>
  <text class="zone" x="450" y="252">East–west, inside the vector</text>
</svg>

<style>
  svg {
    display: block;
    width: 100%;
    max-width: 870px;
    height: auto;
    margin: 0 auto;
    overflow: visible;
  }
  .wire {
    fill: none;
    stroke: var(--border-default);
    stroke-width: 2;
  }
  .wire.ok {
    stroke: var(--status-healthy-solid);
    opacity: 0.55;
  }
  .wire.err {
    stroke: var(--status-error-solid);
    opacity: 0.7;
  }
  .packet {
    fill: none;
    stroke-width: 4;
    stroke-linecap: round;
    stroke-dasharray: 6 100;
    stroke-dashoffset: 6;
    animation: travel 900ms cubic-bezier(var(--ease-out)) forwards;
  }
  .packet.ok {
    stroke: var(--accent-primary);
  }
  .packet.err {
    stroke: var(--status-error-solid);
  }
  @keyframes travel {
    to {
      stroke-dashoffset: -100;
    }
  }
  .node rect {
    fill: var(--surface-default);
    stroke: var(--border-default);
  }
  .node.accent rect {
    fill: var(--selection-bg);
    stroke: var(--accent-primary);
    stroke-width: 1.5;
  }
  .node.down rect {
    stroke: var(--status-error-solid);
    stroke-dasharray: 4 3;
  }
  .title {
    fill: var(--text-primary);
    font-size: 15px;
    font-weight: 600;
  }
  .sub,
  .caption {
    fill: var(--text-secondary);
    font-family: var(--font-mono);
    font-size: 11px;
  }
  .zone {
    fill: var(--text-tertiary);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .dot-ok {
    fill: var(--status-healthy-solid);
  }
  .dot-err {
    fill: var(--status-error-solid);
  }
  @media (prefers-reduced-motion: reduce) {
    .packet {
      display: none;
    }
  }
</style>
