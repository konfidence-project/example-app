export const ROUTING_KEY_HEADER: "x-konfidence-routing-key";

export interface DeploymentResult {
  name: string;
  type: string;
  spec: Record<string, unknown>;
}

export interface VectorData {
  features?: Record<string, unknown>;
  authored?: Record<string, unknown>;
  /** Keyed by the last path segment of the artifact's component name. */
  deploymentResults?: Record<string, DeploymentResult[]>;
}

/** The routing key of the current request, or '' outside Konfidence. */
export function routingKey(): Promise<string>;

/** Data of the vector serving this request, or null outside Konfidence. */
export function vectorData(): Promise<VectorData | null>;

/** Feature flags of the current vector. */
export function features(): Promise<Record<string, unknown>>;

/** Base URL of a service in the current vector, by its deployment-result name. */
export function serviceUrl(name: string): Promise<string>;

/** fetch() against a service of the current vector. Forwards the routing key and never caches. */
export function serviceFetch(name: string, path: string, init?: RequestInit): Promise<Response>;
