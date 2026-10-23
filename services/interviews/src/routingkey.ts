import type { FastifyRequest } from "fastify";

export const ROUTING_KEY_HEADER = "X-Konfidence-Routing-Key";

const HEADER_LOWER = ROUTING_KEY_HEADER.toLowerCase();

export function getRoutingKey(req: FastifyRequest): string {
  const raw = req.headers[HEADER_LOWER];
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}
