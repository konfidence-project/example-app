// Readiness and liveness probe of the chart. It calls no backend, so a slow
// service does not take the web pods out of rotation.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ status: "ok" });
}
