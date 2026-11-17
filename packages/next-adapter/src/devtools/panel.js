// The devtools widget. Loaded on demand by loader.js, mounted into a shadow
// root with its own React root. Reads the data endpoint and a few browser
// APIs (resource timing, one HEAD request for a static file). Writes nothing
// but its own UI state to localStorage.
import { Fragment, createElement as h, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { RequestPath } from "./diagram.js";
import { STYLES } from "./styles.js";

const STORAGE_KEY = "konfidence-devtools";
const POLL_MS = 3000;
const STATIC_ROUTE = "/_next/static/";
const TABS = [
  ["path", "Request path"],
  ["vector", "Vector"],
  ["hops", "Hops"],
  ["static", "Static files"],
];
const DEFAULT_STATE = { open: false, tab: "path", live: true, height: 360 };

export function mountDevtools({ endpoint, position }) {
  const host = document.createElement("konfidence-devtools");
  host.setAttribute("data-konfidence-devtools", "");
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLES;
  const container = document.createElement("div");
  shadow.append(style, container);
  document.body.appendChild(host);
  const root = createRoot(container);
  root.render(h(Devtools, { endpoint, position }));
  return () => {
    root.unmount();
    host.remove();
  };
}

function loadState() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    return { ...DEFAULT_STATE, ...(saved && typeof saved === "object" ? saved : {}) };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // private mode or blocked storage: the widget just forgets
  }
}

function Mark({ size = 18 }) {
  return h(
    "svg",
    { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": "true" },
    h("circle", { cx: 12, cy: 12, r: 8.5, fill: "none", stroke: "currentColor", strokeWidth: 2.4 }),
    h("path", { d: "M3 12h18", stroke: "currentColor", strokeWidth: 3.2, strokeLinecap: "round" }),
  );
}

function Devtools({ endpoint, position }) {
  const [state, setState] = useState(loadState);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loadedAt, setLoadedAt] = useState(null);
  const [traffic, setTraffic] = useState(null);
  const [staticOrigin, setStaticOrigin] = useState({ from: "unknown" });

  const update = useCallback((patch) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      saveState(next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setTraffic(measureTraffic(endpoint));
    try {
      const res = await fetch(endpoint, {
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`${endpoint} responded ${res.status}`);
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(String(err?.message ?? err));
    }
    setLoadedAt(new Date());
  }, [endpoint]);

  useEffect(() => {
    if (!state.open) return undefined;
    refresh();
    if (!state.live) return undefined;
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [state.open, state.live, refresh]);

  useEffect(() => {
    if (state.open && staticOrigin.from === "unknown") probeStaticOrigin().then(setStaticOrigin);
  }, [state.open, staticOrigin.from]);

  const side = position === "bottom-left" ? "left" : "right";
  if (!state.open) {
    return h(
      "button",
      {
        type: "button",
        className: `fab ${side}`,
        title: "Konfidence devtools",
        "aria-label": "Open Konfidence devtools",
        onClick: () => update({ open: true }),
      },
      h(Mark, { size: 22 }),
    );
  }

  const tabBody =
    {
      path: () => h(PathTab, { data, traffic, staticOrigin }),
      vector: () => h(VectorTab, { data }),
      hops: () => h(HopsTab, { data }),
      static: () => h(StaticTab, { data, staticOrigin, traffic }),
    }[state.tab] ?? (() => null);

  return h(
    "section",
    {
      className: "panel",
      style: { height: `${state.height}px` },
      role: "region",
      "aria-label": "Konfidence devtools",
    },
    h(ResizeHandle, { height: state.height, onResize: (height) => update({ height }) }),
    h(
      "header",
      { className: "bar" },
      h("span", { className: "brand" }, h(Mark), "Konfidence", h("small", null, "devtools")),
      h(
        "nav",
        { className: "tabs", role: "tablist", "aria-label": "Devtools sections" },
        TABS.map(([id, text]) =>
          h(
            "button",
            {
              key: id,
              type: "button",
              role: "tab",
              className: "tab",
              "aria-selected": state.tab === id,
              onClick: () => update({ tab: id }),
            },
            text,
          ),
        ),
      ),
      h(
        "div",
        { className: "actions" },
        h(
          "span",
          { className: "meta", title: "Pod that answered the last refresh" },
          data?.server?.pod ? `${data.server.pod}` : "",
          loadedAt ? ` · ${clock(loadedAt)}` : "",
        ),
        h(
          "button",
          {
            type: "button",
            className: "btn",
            "aria-pressed": state.live,
            title: `Refresh every ${POLL_MS / 1000} s while open`,
            onClick: () => update({ live: !state.live }),
          },
          h("span", { className: "dot" }),
          "Live",
        ),
        h(
          "button",
          {
            type: "button",
            className: "btn",
            onClick: () => {
              setStaticOrigin({ from: "unknown" });
              refresh();
            },
          },
          "Refresh",
        ),
        h(
          "button",
          {
            type: "button",
            className: "btn icon",
            "aria-label": "Close Konfidence devtools",
            onClick: () => update({ open: false }),
          },
          "×",
        ),
      ),
    ),
    h(
      "div",
      { className: "body", role: "tabpanel" },
      error && h("p", { className: "error" }, `Could not load ${endpoint}: ${error}`),
      !data && !error && h("p", { className: "note" }, "Loading"),
      data && tabBody(),
    ),
  );
}

function ResizeHandle({ height, onResize }) {
  const start = useRef(null);
  return h("div", {
    className: "resize",
    role: "separator",
    "aria-orientation": "horizontal",
    "aria-label": "Resize devtools",
    onPointerDown: (event) => {
      start.current = { y: event.clientY, height };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove: (event) => {
      if (!start.current) return;
      const max = Math.round(window.innerHeight * 0.85);
      const next = start.current.height + (start.current.y - event.clientY);
      onResize(Math.max(160, Math.min(max, Math.round(next))));
    },
    onPointerUp: () => {
      start.current = null;
    },
  });
}

// --- tabs -------------------------------------------------------------------

function PodNote({ data }) {
  return h(
    "p",
    { className: "note" },
    `Hops come from the server process that answered this refresh (pod `,
    h("code", null, data.server?.pod ?? "?"),
    `) and cover its last ${data.buffer?.size ?? 40} service calls. Other pods keep their own buffer.`,
  );
}

function PathTab({ data, traffic, staticOrigin }) {
  const direct = data.hops.filter((hop) => hop.kind === "direct").length;
  return h(
    Fragment,
    null,
    h(
      "p",
      { className: "note" },
      `${data.hops.length} hops in the buffer, ${direct} made by ${data.server?.name ?? "the server"}. `,
      `Browser counts are this tab's page, RSC and static file requests.`,
    ),
    h(RequestPath, { data, traffic, staticOrigin }),
    h(PodNote, { data }),
  );
}

function FlagChips({ flags, reference }) {
  const entries = Object.entries(flags ?? {});
  if (entries.length === 0)
    return h("div", { className: "chips" }, h("span", { className: "badge" }, "no flags"));
  return h(
    "div",
    { className: "chips" },
    entries.map(([name, value]) => {
      const differs = reference && name in reference && reference[name] !== value;
      return h(
        "span",
        {
          key: name,
          className: `chip${value === true ? " on" : ""}${differs ? " differs" : ""}`,
          title: differs ? "Differs from the vector data the server read" : undefined,
        },
        name,
        h("span", { className: "v" }, JSON.stringify(value)),
      );
    }),
  );
}

function VectorTab({ data }) {
  const vectorFlags = data.vector?.features ?? null;
  return h(
    Fragment,
    null,
    h(
      "dl",
      { className: "facts" },
      fact("Stage", data.request.stage ?? "not set by the edge"),
      fact("Routing key", data.request.routingKey ?? "none, not behind Konfidence"),
      fact("Server", `${data.server.name} · ${data.server.runtime}`),
      fact("Build", data.server.buildId ?? "unversioned"),
    ),
    data.vectorError && h("p", { className: "error" }, data.vectorError),
    h("h3", null, "Feature flags as each service sees them"),
    h(
      "div",
      { className: "services" },
      h(
        "div",
        { className: "service" },
        h(
          "div",
          { className: "service-head" },
          h("strong", null, data.server.name),
          h("span", { className: "sub" }, data.vector ? "vector data" : "KONFIDENCE_FEATURES"),
          h(
            "span",
            { className: data.vector ? "badge ok" : "badge" },
            data.vector ? "loaded" : "local",
          ),
        ),
        h(FlagChips, { flags: vectorFlags ?? data.localFeatures ?? {} }),
      ),
      data.services.map((service) => {
        const probe = service.probe;
        const badge = !probe
          ? h("span", { className: "badge bad" }, "not resolved")
          : !probe.reachable
            ? h("span", { className: "badge bad", title: probe.error }, "unreachable")
            : probe.status === 200
              ? h("span", { className: "badge ok" }, `reachable · ${probe.latencyMs} ms`)
              : h(
                  "span",
                  { className: "badge bad", title: probe.error ?? "" },
                  `${probe.path} ${probe.status}`,
                );
        return h(
          "div",
          { className: "service", key: service.name },
          h(
            "div",
            { className: "service-head" },
            h("strong", null, service.name),
            h("span", { className: "sub" }, probe?.runtime ?? ""),
            probe?.routingKey && probe.routingKey !== data.request.routingKey
              ? h("span", { className: "badge bad" }, `other key ${probe.routingKey}`)
              : null,
            badge,
          ),
          service.error && h("p", { className: "error" }, service.error),
          probe?.flags && h(FlagChips, { flags: probe.flags, reference: vectorFlags }),
        );
      }),
    ),
    h("h3", null, "Resolved from deployment results"),
    data.services.length === 0
      ? h(
          "p",
          { className: "note" },
          "No services. The request has no routing key and no KONFIDENCE_SERVICE_<NAME>_URL is set.",
        )
      : h(
          "ul",
          { className: "urls" },
          data.services.map((service) =>
            h(
              "li",
              { key: service.name },
              `${service.name} `,
              h("span", null, "→ "),
              service.url ?? service.error,
              service.source === "env" ? h("span", null, "  (env override)") : null,
            ),
          ),
        ),
  );
}

function orderHops(hops) {
  // Newest first, with the hops a response implied right below that response.
  const children = new Map();
  for (const hop of hops) {
    if (
      hop.kind === "implied" &&
      hop.impliedBy !== null &&
      hops.some((p) => p.id === hop.impliedBy)
    ) {
      if (!children.has(hop.impliedBy)) children.set(hop.impliedBy, []);
      children.get(hop.impliedBy).push(hop);
    }
  }
  const out = [];
  for (const hop of hops) {
    if (hop.kind === "implied" && children.get(hop.impliedBy)?.includes(hop)) continue;
    out.push(hop);
    for (const child of (children.get(hop.id) ?? []).sort((a, b) => a.id - b.id)) out.push(child);
  }
  return out;
}

function HopsTab({ data }) {
  const key = data.request.routingKey;
  if (data.hops.length === 0) {
    return h(
      Fragment,
      null,
      h("p", { className: "note" }, "No service calls yet. Use the app, then refresh."),
      h(PodNote, { data }),
    );
  }
  return h(
    Fragment,
    null,
    h(PodNote, { data }),
    h(
      "table",
      null,
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          ["Time", "Hop", "Request", "Status", "Latency", "Routing key"].map((t) =>
            h("th", { key: t }, t),
          ),
        ),
      ),
      h(
        "tbody",
        null,
        orderHops(data.hops).map((hop) => {
          const implied = hop.kind === "implied";
          const second = hop.error
            ? h("span", { className: "line2 err" }, hop.error)
            : implied
              ? h("span", { className: "line2" }, `implied by the ${hop.from} response`)
              : h("span", { className: "line2", title: hop.host ?? "" }, hop.host ?? "");
          const status =
            hop.status === null
              ? h("span", { className: "badge bad" }, "failed")
              : h(
                  "span",
                  { className: hop.status < 400 ? "badge ok" : "badge bad" },
                  String(hop.status),
                );
          const vector = implied
            ? h("span", { className: "badge" }, "implied")
            : !hop.routingKey
              ? h("span", { className: "badge" }, "no key")
              : hop.routingKey === key
                ? h("span", { className: "badge ok", title: hop.routingKey }, "same vector")
                : h("span", { className: "badge info", title: hop.routingKey }, "other vector");
          return h(
            "tr",
            { key: hop.id, className: implied ? "implied" : undefined },
            h("td", { className: "mono" }, clock(new Date(hop.at))),
            h("td", null, h("span", { className: "hop" }, `${hop.from} → ${hop.to}`)),
            h("td", null, h("span", { className: "mono" }, `${hop.method} ${hop.path}`), second),
            h("td", null, status),
            h("td", { className: "mono" }, hop.latencyMs === null ? "–" : `${hop.latencyMs} ms`),
            h("td", null, vector),
          );
        }),
      ),
    ),
  );
}

function StaticTab({ data, staticOrigin, traffic }) {
  const expected = data.static ?? [];
  const pageBuild = pageDeploymentId();
  const served =
    staticOrigin.from === "unknown"
      ? "checking"
      : staticOrigin.from === "bucket"
        ? "object storage, through the static handler"
        : staticOrigin.from === "none"
          ? "no static file on this page"
          : "the Next.js server";
  const vectorBadge =
    staticOrigin.from === "bucket"
      ? staticOrigin.vector === data.request.routingKey
        ? h("span", { className: "badge ok" }, "same vector as the server")
        : h("span", { className: "badge bad" }, "other vector than the server")
      : null;
  return h(
    Fragment,
    null,
    h(
      "dl",
      { className: "facts" },
      fact("Served by", served),
      staticOrigin.from === "bucket" && fact("Origin directory", staticOrigin.location),
      staticOrigin.from === "bucket" &&
        fact("Vector of the files", h(Fragment, null, staticOrigin.vector, " ", vectorBadge)),
      fact(
        "Files in this tab",
        traffic ? `${traffic.assets.count} · ${formatBytes(traffic.assets.bytes)}` : "–",
      ),
      fact("Build of the server", data.server.buildId ?? "unversioned"),
      fact(
        "Build of this page",
        h(
          Fragment,
          null,
          pageBuild ?? "unversioned",
          " ",
          pageBuild && data.server.buildId
            ? h(
                "span",
                { className: pageBuild === data.server.buildId ? "badge ok" : "badge bad" },
                pageBuild === data.server.buildId ? "same build" : "other build",
              )
            : null,
        ),
      ),
      fact("Pod", data.server.pod),
    ),
    h("h3", null, "Static content in the vector"),
    expected.length === 0
      ? h(
          "p",
          { className: "note" },
          "The vector has no static content results. The server answers /_next/static itself.",
        )
      : h(
          "ul",
          { className: "urls" },
          expected.map((r) =>
            h(
              "li",
              { key: `${r.component}/${r.name}` },
              `${r.route} `,
              h("span", null, "→ "),
              r.bucket ? `s3://${r.bucket}/${r.prefix ?? ""}` : r.type,
              h("span", null, `  (${r.component})`),
            ),
          ),
        ),
    h(
      "p",
      { className: "note" },
      "The handler in front of the bucket names the vector and the object in the response headers ",
      h("code", null, "x-konfidence-vector"),
      " and ",
      h("code", null, "x-konfidence-static-origin"),
      ". The Next.js server sends neither.",
    ),
  );
}

function fact(term, value) {
  if (value === false || value === null || value === undefined) return null;
  return h("div", { key: term }, h("dt", null, term), h("dd", null, value));
}

// --- browser measurements ----------------------------------------------------

/** Page, RSC and static file requests this tab made, from the resource timing buffer. */
function measureTraffic(endpoint) {
  const result = {
    pages: { count: 0, avgMs: null },
    assets: { count: 0, avgMs: null, bytes: 0 },
  };
  try {
    const pageTimes = [];
    const assetTimes = [];
    for (const entry of performance.getEntriesByType("navigation")) pageTimes.push(entry.duration);
    for (const entry of performance.getEntriesByType("resource")) {
      const url = new URL(entry.name, location.href);
      if (url.origin !== location.origin) continue;
      if (url.pathname.startsWith(STATIC_ROUTE)) {
        assetTimes.push(entry.duration);
        result.assets.bytes += entry.transferSize || entry.encodedBodySize || 0;
      } else if (url.searchParams.has("_rsc") && !url.pathname.startsWith(endpoint)) {
        pageTimes.push(entry.duration);
      }
    }
    const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
    result.pages = { count: pageTimes.length, avgMs: mean(pageTimes) };
    result.assets = { ...result.assets, count: assetTimes.length, avgMs: mean(assetTimes) };
  } catch {
    // no resource timing in this browser
  }
  return result;
}

/** Asks for one of the page's own scripts and reads where it came from. */
async function probeStaticOrigin() {
  const script = document.querySelector(`script[src*="${STATIC_ROUTE}"]`);
  if (!script) return { from: "none" };
  const asset = new URL(script.src);
  try {
    const response = await fetch(asset, { method: "HEAD", cache: "no-store" });
    const vector = response.headers.get("x-konfidence-vector");
    const object = response.headers.get("x-konfidence-static-origin");
    if (!vector || !object) return { from: "server" };
    // Cut the file off the object URL to get the directory of the bundle.
    const file = asset.pathname.slice(asset.pathname.indexOf(STATIC_ROUTE) + STATIC_ROUTE.length);
    const location = object.endsWith(file) ? object.slice(0, -file.length) : object;
    return { from: "bucket", vector, location };
  } catch {
    return { from: "server" };
  }
}

/**
 * The deployment id the page was built with. Next.js puts it on <html> as
 * data-dpl-id, which hydration can drop, and on static file URLs as ?dpl=.
 */
function pageDeploymentId() {
  const fromHtml = document.documentElement.getAttribute("data-dpl-id");
  if (fromHtml) return fromHtml;
  for (const el of document.querySelectorAll(
    `script[src*="${STATIC_ROUTE}"], link[href*="${STATIC_ROUTE}"]`,
  )) {
    const url = new URL(el.getAttribute("src") ?? el.getAttribute("href"), location.href);
    const dpl = url.searchParams.get("dpl");
    if (dpl) return dpl;
  }
  return null;
}

const clock = (date) => date.toLocaleTimeString("en-GB", { hour12: false });

function formatBytes(n) {
  if (!n) return "0 kB";
  return n < 1024 * 1024
    ? `${Math.max(1, Math.round(n / 1024))} kB`
    : `${(n / 1024 / 1024).toFixed(1)} MB`;
}
