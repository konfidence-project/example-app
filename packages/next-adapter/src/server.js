// Server-side helpers for code that runs inside the Next.js server.
//
// Konfidence routes a request to one vector and tags it with a routing key.
// A service that calls another service forwards that key and looks the target
// up in the vector's deployment results, so the whole request stays inside one
// vector. These helpers do both, so application code only names the service.
import { headers } from "next/headers";

export const ROUTING_KEY_HEADER = "x-konfidence-routing-key";

const VECTOR_CONFIG_URL = () => process.env.VECTOR_CONFIG_URL ?? "http://vector-data-service";

// Vector data is immutable per routing key, so it is cached for the process lifetime.
/** @type {Map<string, Promise<any>>} */
const vectorDataCache = new Map();

/** The routing key of the current request, or '' outside Konfidence. */
export async function routingKey() {
  return (await headers()).get(ROUTING_KEY_HEADER) ?? "";
}

/** Features, authored configuration and deployment results of the vector serving this request. */
export async function vectorData() {
  const key = await routingKey();
  if (!key) return null;
  let pending = vectorDataCache.get(key);
  if (!pending) {
    pending = loadVectorData(key);
    vectorDataCache.set(key, pending);
    pending.catch(() => vectorDataCache.delete(key));
  }
  return pending;
}

async function loadVectorData(key) {
  // The vector data service speaks OFREP. Evaluating the routing key itself
  // as the flag key returns the whole vector document.
  const url = `${VECTOR_CONFIG_URL()}/ofrep/v1/evaluate/flags/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ context: { targetingKey: key } }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`vector data for ${key}: ${url} responded ${res.status}`);
  const body = await res.json();
  return body.value ?? {};
}

/** Feature flags of the current vector. Falls back to KONFIDENCE_FEATURES (JSON) for local development. */
export async function features() {
  const data = await vectorData();
  if (data) return data.features ?? {};
  return process.env.KONFIDENCE_FEATURES ? JSON.parse(process.env.KONFIDENCE_FEATURES) : {};
}

/**
 * Base URL of a service in the current vector, by its deployment-result name.
 * For local development, KONFIDENCE_SERVICE_<NAME>_URL overrides the lookup.
 */
export async function serviceUrl(name) {
  const override =
    process.env[`KONFIDENCE_SERVICE_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`];
  if (override) return override.replace(/\/+$/, "");

  const data = await vectorData();
  if (!data) {
    throw new Error(
      `cannot resolve service "${name}": the request carries no ${ROUTING_KEY_HEADER} header`,
    );
  }
  const results = Object.values(data.deploymentResults ?? {}).flat();
  const match = results.find((r) => r.name === name);
  if (!match) throw new Error(`the current vector exposes no deployment result named "${name}"`);
  const { Namespace, K8sName, ServicePorts } = match.spec;
  if (!ServicePorts?.length) throw new Error(`deployment result "${name}" exposes no port`);
  return `http://${K8sName}.${Namespace}.svc.cluster.local:${ServicePorts[0].port}`;
}

/** fetch() against a service of the current vector. Forwards the routing key and never caches. */
export async function serviceFetch(name, path, init = {}) {
  const base = await serviceUrl(name);
  const key = await routingKey();
  const requestHeaders = new Headers(init.headers);
  if (key) requestHeaders.set(ROUTING_KEY_HEADER, key);
  return fetch(`${base}${path}`, { cache: "no-store", ...init, headers: requestHeaders });
}
