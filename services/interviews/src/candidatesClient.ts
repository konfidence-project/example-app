import { ROUTING_KEY_HEADER } from "./routingkey.js";
import { resolveServiceHost } from "./openfeature.js";

// Stable deployment-result name of the candidates Service (konfidence.cloud/deployment-result).
const CANDIDATES_RESULT = "candidates";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  notes?: string;
}

// fetchCandidate resolves the candidates address from the vector's deployment results and GETs the candidate.
// Returns the candidate, null if it does not exist (404), or throws if candidates is unreachable.
export async function fetchCandidate(candidateId: string, routingKey: string): Promise<Candidate | null> {
  const authority = await resolveServiceHost(routingKey, CANDIDATES_RESULT);
  const url = `http://${authority}/candidates/${encodeURIComponent(candidateId)}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (routingKey) headers[ROUTING_KEY_HEADER] = routingKey;

  console.log(`[s2s] GET ${url} routingKey=${routingKey}`);
  const res = await fetch(url, { method: "GET", headers });
  console.log(`[s2s] candidates responded status=${res.status} candidateId=${candidateId}`);

  if (res.status === 200) return (await res.json()) as Candidate;
  // Any 4xx (unknown or malformed id) means "no such candidate", not an outage.
  if (res.status >= 400 && res.status < 500) return null;
  throw new Error(`candidates ${res.url} responded ${res.status}`);
}

export async function candidateExists(candidateId: string, routingKey: string): Promise<boolean> {
  return (await fetchCandidate(candidateId, routingKey)) !== null;
}
