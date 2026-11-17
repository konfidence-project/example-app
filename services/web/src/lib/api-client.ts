import "server-only";
import { serviceFetch } from "@konfidence/next-adapter/server";

// Server-side client for the backend services. serviceFetch() finds the
// service in the vector that serves the current request and forwards the
// routing key, so this code only names the service.

export type ServiceName = "candidates" | "interviews";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly service: ServiceName,
    readonly status: number | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(service: ServiceName, path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await serviceFetch(service, path, init);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ApiError(`The ${service} service is not reachable (${reason})`, service, null);
  }
  const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
  if (!res.ok) {
    const message =
      typeof body?.error === "string" ? body.error : `${service} responded ${res.status}`;
    throw new ApiError(message, service, res.status);
  }
  return body as T;
}

export const api = {
  get: <T>(service: ServiceName, path: string) => request<T>(service, path),
  post: <T>(service: ServiceName, path: string, body: unknown) =>
    request<T>(service, path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  patch: <T>(service: ServiceName, path: string, body: unknown) =>
    request<T>(service, path, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
};

/** A message for the user, from any error a request can throw. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return String(err);
}
