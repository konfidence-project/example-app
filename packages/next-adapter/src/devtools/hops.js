// The hop buffer behind the devtools: the last service calls this server
// process made through serviceFetch(). It lives on globalThis, so every
// module copy that Next.js bundles shares it, and it belongs to one pod.
import fs from "node:fs";
import path from "node:path";

export const HOP_BUFFER_SIZE = 40;
const BUFFER = Symbol.for("cloud.konfidence.devtools.hops");
// Responses larger than this are not scanned for implied hops.
const MAX_SCAN_BYTES = 1024 * 1024;

/** True when KONFIDENCE_DEVTOOLS is 1 or true. Read on every call, so it follows the runtime env. */
export function devtoolsEnabled() {
  const value = (process.env.KONFIDENCE_DEVTOOLS ?? "").trim().toLowerCase();
  return value === "1" || value === "true";
}

let cachedSelf;
/**
 * The deployment-result name of this server. The generated chart sets
 * KONFIDENCE_DEPLOYMENT_RESULT. Outside the chart, the "konfidence" settings in
 * package.json name it, and "server" is the last fallback.
 */
export function selfName() {
  if (process.env.KONFIDENCE_DEPLOYMENT_RESULT) return process.env.KONFIDENCE_DEPLOYMENT_RESULT;
  if (cachedSelf) return cachedSelf;
  cachedSelf = "server";
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"));
    const settings = pkg.konfidence ?? {};
    const component = settings.component ?? "";
    cachedSelf =
      settings.deploymentResult ??
      settings.name ??
      (component ? component.slice(component.lastIndexOf("/") + 1) : "server");
  } catch {
    // no package.json next to the server, keep the fallback
  }
  return cachedSelf;
}

function buffer() {
  globalThis[BUFFER] ??= { seq: 0, hops: [] };
  return globalThis[BUFFER];
}

function push(hop) {
  const b = buffer();
  b.seq += 1;
  const entry = { id: b.seq, ...hop };
  b.hops.unshift(entry);
  if (b.hops.length > HOP_BUFFER_SIZE) b.hops.length = HOP_BUFFER_SIZE;
  return entry;
}

/** Newest first. Copies, so a caller cannot change the buffer. */
export function listHops() {
  return buffer().hops.map((hop) => ({ ...hop }));
}

/** Empties the buffer. For tests. */
export function clearHops() {
  globalThis[BUFFER] = { seq: 0, hops: [] };
}

/**
 * Records one call this server made. With a response, the body is read from
 * a clone in the background: an error message for statuses of 400 and up,
 * implied hops for JSON that embeds objects of other services.
 *
 * @param {{to: string, method: string, path: string, host: string|null, status: number|null, routingKey: string, error?: string}} call
 * @param {number} latencyMs
 * @param {Response} [response]
 * @param {string[]} [services] names of the services the vector has, for implied hops
 */
export function recordHop(call, latencyMs, response, services = []) {
  const hop = push({
    at: new Date().toISOString(),
    kind: "direct",
    from: selfName(),
    to: call.to,
    method: call.method,
    path: call.path,
    host: call.host,
    status: call.status,
    latencyMs: Math.round(latencyMs),
    error: call.error ?? null,
    routingKey: call.routingKey || null,
    impliedBy: null,
  });
  if (!response) return hop;
  const isJson = (response.headers.get("content-type") ?? "").includes("json");
  const length = Number(response.headers.get("content-length") ?? 0);
  if (!isJson || length > MAX_SCAN_BYTES) return hop;
  if (response.status < 400 && services.length === 0) return hop;

  let clone;
  try {
    clone = response.clone();
  } catch {
    return hop; // body already used
  }
  clone
    .text()
    .then((text) => {
      if (text.length > MAX_SCAN_BYTES) return;
      const body = JSON.parse(text);
      if (response.status >= 400) {
        hop.error = typeof body?.error === "string" ? body.error : `responded ${response.status}`;
        return;
      }
      for (const implied of impliedHops(hop, body, services)) push(implied);
    })
    .catch(() => {});
  return hop;
}

/**
 * Calls that a response shows the target made on its own. A property `x`
 * whose value is an object with an `id`, in a response of service A, counts
 * as A calling service `xs` with GET /xs/<id>, if the vector has a service
 * named `xs`. A null value counts as a failed call. In the example app, every
 * interview from GET /interviews embeds its `candidate`.
 */
export function impliedHops(parent, body, services) {
  const known = new Set(services);
  const items = Array.isArray(body) ? body : [body];
  const out = [];
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    for (const [key, value] of Object.entries(item)) {
      const target = `${key}s`;
      if (!known.has(target) || target === parent.to) continue;
      const id = value && typeof value === "object" ? value.id : null;
      if (value !== null && typeof id !== "string") continue;
      const idKey = item[`${key}_id`] ?? item[`${key}Id`];
      const pathId = id ?? (typeof idKey === "string" ? idKey : "?");
      out.push({
        at: parent.at,
        kind: "implied",
        from: parent.to,
        to: target,
        method: "GET",
        path: `/${target}/${pathId}`,
        host: null,
        status: value === null ? null : 200,
        latencyMs: null,
        error: value === null ? `no ${key} in the ${parent.to} response` : null,
        routingKey: parent.routingKey,
        impliedBy: parent.id,
      });
    }
  }
  return out;
}
