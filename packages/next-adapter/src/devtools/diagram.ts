// The "Request path" diagram: who called whom, with counts and latencies.
// North-south: browser, edge and router, static files. East-west: the
// Next.js server and the services it calls inside the vector.
import { type ReactElement, createElement as h } from "react";

import type { DevtoolsData, StaticOrigin, Traffic } from "../types.js";

interface Point {
  x: number;
  y: number;
}
type Status = "ok" | "bad" | "unknown" | null;

const W = 168;
const H = 56;
const COL = { browser: 10, edge: 280, self: 550, services: 820 };
const ROW = 92;
const VIEW_W = 1000;

const avg = (values: (number | null)[]) => {
  const nums = values.filter((v): v is number => typeof v === "number");
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
};

const label = (count: number, ms: number | null) =>
  count ? `${count}×${ms === null ? "" : ` ${ms} ms`}` : "";

/** Node box with title, subtitle and an optional status dot. */
function node({
  x,
  y,
  title,
  sub,
  self = false,
  status = null,
}: Point & { title: string; sub: string; self?: boolean; status?: Status }): ReactElement {
  return h(
    "g",
    { className: self ? "node self" : "node", key: title },
    h("rect", { x, y, width: W, height: H, rx: 10 }),
    h("text", { className: "t", x: x + 14, y: y + 23 }, title),
    h(
      "text",
      { className: "s", x: x + 14, y: y + 42 },
      sub.length > 22 ? `${sub.slice(0, 21)}…` : sub,
    ),
    status && h("circle", { className: `st-${status}`, cx: x + W - 16, cy: y + 18, r: 5 }),
  );
}

/** Line from a to b with a dot in the middle and a label next to it. */
function edge(
  key: string,
  a: Point,
  b: Point,
  text: string,
  state: "ok" | "idle" | "fail" = "ok",
  labelAt: "above" | "below" = "above",
): ReactElement {
  const midX = (a.x + b.x) / 2;
  const d =
    a.y === b.y
      ? `M${a.x},${a.y} L${b.x},${b.y}`
      : `M${a.x},${a.y} C${midX},${a.y} ${midX},${b.y} ${b.x},${b.y}`;
  const my = (a.y + b.y) / 2;
  const cls = state === "idle" ? "edge idle" : state === "fail" ? "edge fail" : "edge";
  return h(
    "g",
    { key },
    h("path", { className: cls, d }),
    state !== "idle" && h("circle", { className: "pulse", cx: midX, cy: my, r: 4 }),
    text &&
      h(
        "text",
        {
          className: "label",
          // Straight edges get the label centered above, curves to the left of the dot.
          x: a.y === b.y ? midX : midX - 10,
          y: a.y === b.y ? my - 10 : labelAt === "above" ? my - 4 : my + 14,
          textAnchor: a.y === b.y ? "middle" : "end",
        },
        text,
      ),
  );
}

export function RequestPath({
  data,
  traffic,
  staticOrigin,
}: {
  data: DevtoolsData | null;
  traffic: Traffic | null;
  staticOrigin: StaticOrigin | null;
}): ReactElement {
  const services = data?.services ?? [];
  const hops = data?.hops ?? [];
  const self = data?.server?.name ?? "server";
  const n = Math.max(services.length, 1);
  const height = Math.max(300, 40 + n * ROW);

  const selfY = (height - 60) / 2 - H / 2;
  const edgeNode = { x: COL.edge, y: selfY };
  const browserNode = { x: COL.browser, y: selfY };
  const cdnNode = { x: COL.edge, y: height - 60 - H + 10 };
  const serviceY = (i: number) =>
    services.length <= 1 ? selfY : 20 + (i * (height - 80 - H)) / (services.length - 1);

  const els: (ReactElement | null | false)[] = [];
  const zoneY = height - 14;
  els.push(h("text", { key: "z1", className: "zone", x: COL.browser, y: zoneY }, "NORTH-SOUTH"));
  els.push(
    h(
      "text",
      { key: "z2", className: "zone", x: COL.self, y: zoneY },
      "EAST-WEST, INSIDE THE VECTOR",
    ),
  );

  // Browser to edge to this server: page and RSC requests of this tab.
  const pages = traffic?.pages ?? { count: 0, avgMs: null };
  els.push(
    edge(
      "b-e",
      { x: COL.browser + W, y: selfY + H / 2 },
      { x: COL.edge, y: selfY + H / 2 },
      label(pages.count, pages.avgMs),
    ),
  );
  els.push(
    edge("e-s", { x: COL.edge + W, y: selfY + H / 2 }, { x: COL.self, y: selfY + H / 2 }, ""),
  );

  // Browser to static files.
  const assets = traffic?.assets ?? { count: 0, avgMs: null };
  els.push(
    edge(
      "b-c",
      { x: COL.browser + W / 2, y: selfY + H },
      { x: COL.edge, y: cdnNode.y + H / 2 },
      label(assets.count, assets.avgMs),
      assets.count ? "ok" : "idle",
      "below",
    ),
  );

  // This server to each service, from the hop buffer.
  services.forEach((service, i) => {
    const direct = hops.filter((hop) => hop.kind === "direct" && hop.to === service.name);
    const failed = direct[0] !== undefined && direct[0].status === null;
    const y = serviceY(i) + H / 2;
    els.push(
      edge(
        `s-${service.name}`,
        { x: COL.self + W, y: selfY + H / 2 },
        { x: COL.services, y },
        label(direct.length, avg(direct.map((hop) => hop.latencyMs))),
        direct.length === 0 ? "idle" : failed ? "fail" : "ok",
        y < selfY + H / 2 ? "above" : "below",
      ),
    );
  });

  // Calls between services that responses imply.
  const pairs = new Map();
  for (const hop of hops) {
    if (hop.kind !== "implied") continue;
    const key = `${hop.from}>${hop.to}`;
    pairs.set(key, (pairs.get(key) ?? 0) + 1);
  }
  for (const [key, count] of pairs) {
    const [from, to] = key.split(">");
    const a = services.findIndex((s) => s.name === from);
    const b = services.findIndex((s) => s.name === to);
    if (a === -1 || b === -1) continue;
    const x = COL.services + W / 2;
    const top = Math.min(a, b);
    const bottom = Math.max(a, b);
    const y1 = serviceY(top) + H;
    const y2 = serviceY(bottom);
    els.push(
      h(
        "g",
        { key: `i-${key}` },
        h("path", { className: "edge", d: `M${x},${y1} L${x},${y2}` }),
        h("circle", { className: "pulse", cx: x, cy: (y1 + y2) / 2, r: 4 }),
        h("text", { className: "label", x: x + 12, y: (y1 + y2) / 2 + 4 }, `${count}× implied`),
      ),
    );
  }

  const stage = data?.request?.routingKey ?? "no routing key";
  const staticSub =
    staticOrigin?.from === "bucket"
      ? "object storage"
      : staticOrigin?.from === "server"
        ? "served by the server"
        : (data?.static?.[0]?.route ?? "/_next/static");

  els.push(node({ ...browserNode, title: "Browser", sub: "this tab" }));
  els.push(node({ ...edgeNode, title: "Edge → router", sub: stage }));
  els.push(node({ ...cdnNode, title: "CDN · static files", sub: staticSub }));
  els.push(
    node({
      x: COL.self,
      y: selfY,
      title: self,
      sub: data?.server?.runtime ?? "Next.js SSR",
      self: true,
    }),
  );
  services.forEach((service, i) => {
    const probe = service.probe;
    const status = !probe ? "unknown" : probe.reachable && probe.status === 200 ? "ok" : "bad";
    els.push(
      node({
        x: COL.services,
        y: serviceY(i),
        title: service.name,
        sub: probe?.runtime ?? (service.error ? "not resolved" : "service"),
        status,
      }),
    );
  });

  return h(
    "svg",
    {
      className: "diagram",
      viewBox: `0 0 ${VIEW_W} ${height}`,
      role: "img",
      "aria-label": "Request path from the browser through the edge to the server and its services",
    },
    els,
  );
}
