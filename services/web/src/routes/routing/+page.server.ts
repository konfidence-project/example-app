import { routingSnapshot } from "#lib/server/api.ts";
import { recent } from "#lib/server/trace.ts";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals }) => ({
  snapshot: await routingSnapshot(locals.routingKey, locals.stage, recent(locals.routingKey)),
});
