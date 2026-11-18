// Health endpoint for the readiness and liveness probes of the generated
// chart, set as "konfidence.healthPath" in package.json. It calls no service,
// so a slow backend does not take the web pods out of rotation.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" }, { headers: { "cache-control": "no-store" } });
}
