// Route handler of the devtools data endpoint. An app mounts it with one file,
// for example app/api/konfidence/devtools/route.ts:
//
//   export { GET } from "@konfidence/next-adapter/devtools/route";
//
// The response is a plain JSON document, described in the README under
// "Devtools". The widget reads it, and so could any other client.
import os from "node:os";
import { ROUTING_KEY_HEADER, serviceNames, serviceUrl, vectorData } from "../server.js";
import { HOP_BUFFER_SIZE, devtoolsEnabled, listHops, selfName } from "./hops.js";

export const DEVTOOLS_SCHEMA = "cloud.konfidence.devtools/v1";
const STAGE_HEADER = "x-konfidence-stage";
const PROBE_TIMEOUT_MS = 3000;

const json = (status, body) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/** @param {Request} request */
export async function GET(request) {
  if (!devtoolsEnabled()) return json(404, { error: "not found" });

  const key = request.headers.get(ROUTING_KEY_HEADER) ?? "";
  let vector = null;
  let vectorError = null;
  try {
    vector = await vectorData();
  } catch (err) {
    vectorError = String(err?.message ?? err);
  }

  const names = await serviceNames();
  const services = await Promise.all(names.map((name) => describeService(name, key)));

  return json(200, {
    schema: DEVTOOLS_SCHEMA,
    generatedAt: new Date().toISOString(),
    server: {
      name: selfName(),
      runtime: "Next.js SSR",
      pod: os.hostname(),
      buildId: process.env.NEXT_DEPLOYMENT_ID || null,
      node: process.versions.node,
    },
    request: {
      routingKey: key || null,
      stage: request.headers.get(STAGE_HEADER) || null,
    },
    vector: vector
      ? {
          features: vector.features ?? {},
          authored: vector.authored ?? null,
          deploymentResults: vector.deploymentResults ?? {},
        }
      : null,
    vectorError,
    localFeatures: vector ? null : localFeatures(),
    services,
    static: staticResults(vector),
    hops: listHops(),
    buffer: { size: HOP_BUFFER_SIZE, scope: "pod" },
  });
}

/** Address of one service and the live answer of its /<name>/debug endpoint. */
async function describeService(name, key) {
  const out = { name, url: null, source: null, error: null, probe: null };
  try {
    out.url = await serviceUrl(name);
    out.source = process.env[
      `KONFIDENCE_SERVICE_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`
    ]
      ? "env"
      : "deployment-result";
  } catch (err) {
    out.error = String(err?.message ?? err);
    return out;
  }
  // Called directly, not through serviceFetch(), so polling the endpoint does
  // not fill the hop buffer with its own calls.
  const path = `/${name}/debug`;
  const started = performance.now();
  try {
    const res = await fetch(`${out.url}${path}`, {
      headers: key ? { [ROUTING_KEY_HEADER]: key } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Math.round(performance.now() - started);
    const body = await res.json().catch(() => null);
    out.probe = {
      path,
      status: res.status,
      latencyMs,
      reachable: true,
      runtime: typeof body?.runtime === "string" ? body.runtime : null,
      routingKey: typeof body?.routingKey === "string" ? body.routingKey : null,
      flags: body && typeof body.flags === "object" ? body.flags : null,
      error: res.ok ? null : (body?.error ?? `responded ${res.status}`),
    };
  } catch (err) {
    out.probe = {
      path,
      status: null,
      latencyMs: Math.round(performance.now() - started),
      reachable: false,
      runtime: null,
      routingKey: null,
      flags: null,
      error: String(err?.message ?? err),
    };
  }
  return out;
}

/** Deployment results that describe static content: where the files of a route live. */
function staticResults(vector) {
  return Object.entries(vector?.deploymentResults ?? {}).flatMap(([component, results]) =>
    (results ?? [])
      .filter((r) => typeof r?.spec?.route === "string")
      .map((r) => ({
        component,
        name: r.name,
        type: r.type,
        route: r.spec.route,
        bucket: r.spec.bucket ?? null,
        prefix: r.spec.prefix ?? null,
        endpoint: r.spec.endpoint ?? null,
      })),
  );
}

function localFeatures() {
  try {
    return process.env.KONFIDENCE_FEATURES ? JSON.parse(process.env.KONFIDENCE_FEATURES) : null;
  } catch {
    return null;
  }
}
