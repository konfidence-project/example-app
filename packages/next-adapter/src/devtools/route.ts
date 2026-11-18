// Route handler of the devtools data endpoint. An app mounts it with one file,
// for example app/api/konfidence/devtools/route.ts:
//
//   export { GET } from "@konfidence/next-adapter/devtools/route";
//
// The response is a plain JSON document, described in the README under
// "Devtools". The widget reads it, and so could any other client.
//
// Hops are limited to the ones that carried the caller's own routing key.
import os from "node:os";
import {
  ROUTING_KEY_HEADER,
  localFeatures,
  serviceNames,
  serviceUrl,
  vectorData,
} from "../server.js";
import type { DevtoolsData, ServiceInfo, StaticResult, VectorData } from "../types.js";
import { HOP_BUFFER_SIZE, devtoolsEnabled, listHops, selfName } from "./hops.js";

export const DEVTOOLS_SCHEMA = "cloud.konfidence.devtools/v1" as const;
const PROBE_TIMEOUT_MS = 3000;

// Only the message leaves the server, never a stack trace.
const errorMessage = (err: unknown) => (err instanceof Error ? err.message : "unknown error");

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

/** Devtools data endpoint. Answers 404 unless KONFIDENCE_DEVTOOLS is 1 or true. */
export async function GET(request: Request): Promise<Response> {
  if (!devtoolsEnabled()) return json(404, { error: "not found" });

  const key = request.headers.get(ROUTING_KEY_HEADER) ?? "";
  let vector: VectorData | null = null;
  let vectorError: string | null = null;
  try {
    vector = await vectorData();
  } catch (err) {
    vectorError = errorMessage(err);
  }

  const names = await serviceNames();
  const services = await Promise.all(names.map((name) => describeService(name, key)));

  const data: DevtoolsData = {
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
    },
    vector: vector
      ? {
          features: vector.features ?? {},
          authored: vector.authored ?? null,
          deploymentResults: vector.deploymentResults ?? {},
        }
      : null,
    vectorError,
    localFeatures: vector ? null : localFeaturesOrNull(),
    services,
    static: staticResults(vector),
    // Only the calls made for the caller's vector. Without a routing key,
    // only calls that carried none.
    hops: listHops().filter((hop) => (hop.routingKey ?? "") === key),
    buffer: { size: HOP_BUFFER_SIZE, scope: "pod+routing-key" },
  };
  return json(200, data);
}

/** How one service was resolved and the live answer of its /<name>/debug endpoint. */
async function describeService(name: string, key: string): Promise<ServiceInfo> {
  const out: ServiceInfo = { name, url: null, source: null, error: null, probe: null };
  let url: string;
  try {
    url = out.url = await serviceUrl(name);
    out.source = process.env[
      `KONFIDENCE_SERVICE_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`
    ]
      ? "env"
      : "deployment-result";
  } catch (err) {
    out.error = errorMessage(err);
    return out;
  }
  // Called directly, not through serviceFetch(), so polling the endpoint does
  // not fill the hop buffer with its own calls.
  const path = `/${name}/debug`;
  const started = performance.now();
  try {
    const res = await fetch(`${url}${path}`, {
      headers: key ? { [ROUTING_KEY_HEADER]: key } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    const latencyMs = Math.round(performance.now() - started);
    const body = (await res.json().catch(() => null)) as {
      runtime?: unknown;
      routingKey?: unknown;
      flags?: unknown;
    } | null;
    out.probe = {
      path,
      status: res.status,
      latencyMs,
      reachable: true,
      runtime: typeof body?.runtime === "string" ? body.runtime : null,
      routingKey: typeof body?.routingKey === "string" ? body.routingKey : null,
      flags:
        body?.flags && typeof body.flags === "object" && !Array.isArray(body.flags)
          ? (body.flags as Record<string, unknown>)
          : null,
      error: res.ok ? null : `responded ${res.status}`,
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
      error: errorMessage(err),
    };
  }
  return out;
}

/** Deployment results that describe static content: which component serves a route. */
function staticResults(vector: VectorData | null): StaticResult[] {
  return Object.entries(vector?.deploymentResults ?? {}).flatMap(([component, results]) =>
    (results ?? []).flatMap((r) => {
      const spec = (r?.spec ?? {}) as Record<string, unknown>;
      if (typeof spec.route !== "string") return [];
      const text = (value: unknown) => (typeof value === "string" ? value : null);
      return [
        {
          component,
          name: r.name,
          type: r.type,
          route: spec.route,
          bucket: text(spec.bucket),
          prefix: text(spec.prefix),
          endpoint: text(spec.endpoint),
        },
      ];
    }),
  );
}

function localFeaturesOrNull() {
  try {
    return process.env.KONFIDENCE_FEATURES ? localFeatures() : null;
  } catch {
    return null;
  }
}
