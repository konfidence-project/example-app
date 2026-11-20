import { error } from "@sveltejs/kit";
import { cachedAuthority } from "./discovery.ts";
import { call, UpstreamError } from "./eastwest.ts";
import { record } from "./trace.ts";
import type { Candidate, Interview, RoutingSnapshot, Service, ServiceStatus, SlotType } from "#lib/types.ts";

// Typed wrappers around the two backend services. Each function is one east-west request.

export async function listInterviews(key: string): Promise<Interview[]> {
  const { data, hop } = await call<Interview[]>(key, "interviews", "GET", "/interviews");
  // interviews enriches every row by calling candidates itself. Those hops never pass through web, so record what
  // the response implies.
  record(
    key,
    ...data.map((iv, i) => ({
      ...hop,
      id: `${hop.id}-${i}`,
      from: "interviews" as const,
      to: "candidates" as const,
      path: `/candidates/${iv.candidate_id}`,
      authority: null,
      status: iv.candidate ? 200 : null,
      ms: null,
      echoedKey: null,
      error: iv.candidate ? undefined : "enrichment failed",
    })),
  );
  return data;
}

export async function listCandidates(key: string): Promise<Candidate[]> {
  return (await call<Candidate[]>(key, "candidates", "GET", "/candidates")).data;
}

export async function getCandidate(key: string, id: string): Promise<Candidate | null> {
  try {
    return (await call<Candidate>(key, "candidates", "GET", `/candidates/${encodeURIComponent(id)}`)).data;
  } catch (err) {
    if (err instanceof UpstreamError && err.clientError) return null;
    throw err;
  }
}

export async function createCandidate(
  key: string,
  input: { name: string; email: string; notes?: string },
): Promise<Candidate> {
  return (await call<Candidate>(key, "candidates", "POST", "/candidates", { body: input })).data;
}

export async function createInterview(
  key: string,
  input: { candidateId: string; slotTime: string; slotType: SlotType },
): Promise<{ id: string }> {
  return (await call<{ id: string }>(key, "interviews", "POST", "/interviews", { body: input })).data;
}

// Feature flags are part of the vector and immutable per routing key.
const flagCache = new Map<string, Record<string, unknown>>();

export async function flags(key: string, svc: Service): Promise<Record<string, unknown>> {
  const cacheKey = `${key}::${svc}`;
  const hit = flagCache.get(cacheKey);
  if (hit) return hit;
  const { data } = await call<{ flags?: Record<string, unknown> }>(key, svc, "GET", `/${svc}/debug`, { trace: false });
  const value = data.flags ?? {};
  flagCache.set(cacheKey, value);
  return value;
}

export async function flag(key: string, svc: Service, name: string): Promise<boolean> {
  try {
    return (await flags(key, svc))[name] === true;
  } catch {
    // A flag we cannot read is off; the backend enforces it either way.
    return false;
  }
}

// probe checks one service for the /routing page without adding to the trace.
async function probe(key: string, svc: Service): Promise<ServiceStatus> {
  try {
    const { data, hop } = await call<{ flags?: Record<string, unknown> }>(key, svc, "GET", `/${svc}/debug`, {
      trace: false,
    });
    return { reachable: true, authority: hop.authority, flags: data.flags ?? {} };
  } catch (err) {
    const authority = err instanceof UpstreamError ? err.hop.authority : cachedAuthority(key, svc);
    return { reachable: false, authority, flags: {} };
  }
}

export async function routingSnapshot(key: string, stage: string, hops: RoutingSnapshot["hops"]): Promise<RoutingSnapshot> {
  const [interviews, candidates] = await Promise.all([probe(key, "interviews"), probe(key, "candidates")]);
  return { at: new Date().toISOString(), stage, routingKey: key, services: { interviews, candidates }, hops };
}

// orFail turns an upstream failure during page load into an error page that says which service broke.
export async function orFail<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof UpstreamError) {
      error(502, { message: `${err.hop.to} is unavailable: ${err.message}` });
    }
    throw err;
  }
}
