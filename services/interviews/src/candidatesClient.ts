import { VECTOR_ID_HEADER } from "./vectorid.js";

// The candidates address is taken from CANDIDATES_URL for now. The intended
// end-state is service discovery via the vector-data-service: evaluate the
// vector-id to fetch its deployment results and resolve the address from there,
// so no address is hardcoded. That contract isn't finalized yet, so until then
// we use the env var and a stopgap ExternalName alias created at deploy time.
const BASE_URL = process.env.CANDIDATES_URL ?? "http://candidates.example-landscape.svc.cluster.local";

export async function candidateExists(candidateId: string, vectorId: string): Promise<boolean> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (vectorId) headers[VECTOR_ID_HEADER] = vectorId;

  const res = await fetch(`${BASE_URL}/candidates/${encodeURIComponent(candidateId)}`, {
    method: "GET",
    headers,
  });
  if (res.status === 200) return true;
  if (res.status === 404) return false;
  throw new Error(`candidates ${res.url} responded ${res.status}`);
}
