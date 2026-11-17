import { randomUUID } from "node:crypto";
import { resolveServiceHost } from "./discovery.ts";
import { ROUTING_KEY_HEADER } from "./routingkey.ts";
import { record } from "./trace.ts";
import type { Hop, Service } from "#lib/types.ts";

const TIMEOUT_MS = 3000;

export class UpstreamError extends Error {
  constructor(readonly hop: Hop) {
    super(hop.error ?? `${hop.to} responded ${hop.status}`);
  }
  // 4xx from the callee is the user's problem (validation, unknown id); everything else is ours.
  get clientError(): boolean {
    return this.hop.status !== null && this.hop.status >= 400 && this.hop.status < 500;
  }
}

interface Options {
  body?: unknown;
  // Health probes from /routing would drown the app's own traffic in the trace.
  trace?: boolean;
}

// call sends one east-west request from web to a service in the same vector and returns the decoded JSON body.
// It resolves the callee from the vector's deployment results and forwards the routing key, so the request can
// never leave the vector the browser's request was routed to.
export async function call<T>(
  routingKey: string,
  to: Service,
  method: "GET" | "POST",
  path: string,
  { body, trace = true }: Options = {},
): Promise<{ data: T; hop: Hop }> {
  const hop: Hop = {
    id: randomUUID(),
    at: new Date().toISOString(),
    from: "web",
    to,
    method,
    path,
    authority: null,
    status: null,
    ms: null,
    echoedKey: null,
  };
  const started = performance.now();
  let data: unknown = null;

  try {
    hop.authority = await resolveServiceHost(routingKey, to);
    const headers: Record<string, string> = { Accept: "application/json", [ROUTING_KEY_HEADER]: routingKey };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    const res = await fetch(`http://${hop.authority}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    hop.status = res.status;
    hop.echoedKey = res.headers.get(ROUTING_KEY_HEADER);
    data = await res.json().catch(() => null);
    if (!res.ok) hop.error = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
  } catch (err) {
    hop.error = err instanceof Error ? err.message : String(err);
  }

  hop.ms = Math.round(performance.now() - started);
  console.log(
    `[east-west] web -> ${to} ${method} ${path} authority=${hop.authority} status=${hop.status} ms=${hop.ms} routingKey=${routingKey}`,
  );
  if (trace && routingKey) record(routingKey, hop);
  if (hop.error) throw new UpstreamError(hop);
  return { data: data as T, hop };
}
