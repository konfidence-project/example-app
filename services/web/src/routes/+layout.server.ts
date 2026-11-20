import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = ({ locals }) => ({
  stage: locals.stage,
  routingKey: locals.routingKey,
  tz: locals.tz,
});
