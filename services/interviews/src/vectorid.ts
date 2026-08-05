import type { FastifyRequest } from "fastify";

export const VECTOR_ID_HEADER = process.env.VECTOR_ID_HEADER ?? "X-Vector-ID";

const HEADER_LOWER = VECTOR_ID_HEADER.toLowerCase();

export function getVectorId(req: FastifyRequest): string {
  const raw = req.headers[HEADER_LOWER];
  return (Array.isArray(raw) ? raw[0] : raw) ?? "";
}
