import { json } from "@sveltejs/kit";
import { routingSnapshot } from "#lib/server/api.ts";
import { recent } from "#lib/server/trace.ts";
import type { RequestHandler } from "./$types";

// Polled by /routing in the background. Each poll probes both services east-west.
export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  setHeaders({ "cache-control": "no-store" });
  return json(await routingSnapshot(locals.routingKey, locals.stage, recent(locals.routingKey)));
};
