import type { Hop } from "#lib/types.ts";

const LIMIT = 50;

// Recent hops per routing key, newest first. In-memory and per replica: it feeds the /routing debug page, nothing
// depends on it being complete.
const buffers = new Map<string, Hop[]>();

export function record(routingKey: string, ...hops: Hop[]): void {
  const buf = buffers.get(routingKey) ?? [];
  buf.unshift(...hops.toReversed());
  buf.length = Math.min(buf.length, LIMIT);
  buffers.set(routingKey, buf);
}

export function recent(routingKey: string): Hop[] {
  return buffers.get(routingKey) ?? [];
}
