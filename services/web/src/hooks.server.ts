import type { Handle } from "@sveltejs/kit/hooks";
import { ROUTING_KEY_HEADER, STAGE_HEADER } from "#lib/server/routingkey.ts";
import { validTz } from "#lib/time.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// sameHost is the CSRF check that replaces SvelteKit's built-in one. Browsers send Origin on every state-changing
// request; its host must be the host the request was sent to. The scheme is ignored on purpose: it is the part the
// proxies in front of web rewrite. The Host header passes through them unchanged, and url.host is built from it.
function sameHost(request: Request, url: URL): boolean {
  if (SAFE_METHODS.has(request.method)) return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === url.host;
  } catch {
    return false;
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  const { request, url, locals, cookies } = event;
  locals.routingKey = request.headers.get(ROUTING_KEY_HEADER) ?? "";
  locals.stage = request.headers.get(STAGE_HEADER) ?? "";
  locals.tz = validTz(cookies.get("tz"));

  if (url.pathname !== "/healthz") {
    console.log(`web: incoming request ${request.method} ${url.pathname} routingKey=${JSON.stringify(locals.routingKey)}`);
  }

  if (!sameHost(request, url)) {
    console.log(`web: rejected cross-site ${request.method} ${url.pathname} origin=${request.headers.get("origin")}`);
    return new Response("Cross-site requests are not allowed", { status: 403 });
  }

  const response = await resolve(event);
  // Echo the key like the other services do, so devtools show which vector answered.
  if (locals.routingKey) response.headers.set(ROUTING_KEY_HEADER, locals.routingKey);
  return response;
};
