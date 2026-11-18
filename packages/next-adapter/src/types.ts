// Shapes shared by the server helpers, the devtools endpoint and the widget.

/** A deployment result of the vector, as the vector data service returns it. */
export interface DeploymentResult {
  name: string;
  type: string;
  spec: Record<string, unknown>;
}

/** The spec of a deployment result for a Kubernetes Service. */
export interface ServiceResultSpec {
  Namespace: string;
  K8sName: string;
  ServicePorts?: { name?: string; port: number }[];
}

export interface VectorData {
  features?: Record<string, unknown>;
  authored?: Record<string, unknown>;
  /** Keyed by the last path segment of the artifact's component name. */
  deploymentResults?: Record<string, DeploymentResult[] | undefined>;
}

/** One service call in the hop buffer. */
export interface Hop {
  id: number;
  at: string;
  kind: "direct" | "implied";
  from: string;
  to: string;
  method: string;
  path: string;
  /** Resolved host:port. */
  host: string | null;
  status: number | null;
  latencyMs: number | null;
  error: string | null;
  routingKey: string | null;
  impliedBy: number | null;
}

export interface ServiceProbe {
  path: string;
  status: number | null;
  latencyMs: number;
  reachable: boolean;
  runtime: string | null;
  routingKey: string | null;
  flags: Record<string, unknown> | null;
  error: string | null;
}

export interface ServiceInfo {
  name: string;
  url: string | null;
  source: "env" | "deployment-result" | null;
  error: string | null;
  probe: ServiceProbe | null;
}

export interface StaticResult {
  component: string;
  name: string;
  type: string;
  route: string;
  bucket: string | null;
  prefix: string | null;
  endpoint: string | null;
}

/** The document the devtools endpoint returns, schema cloud.konfidence.devtools/v1. */
export interface DevtoolsData {
  schema: string;
  generatedAt: string;
  server: {
    name: string;
    runtime: string;
    pod: string;
    buildId: string | null;
    node: string;
  };
  request: { routingKey: string | null };
  vector: {
    features: Record<string, unknown>;
    authored: Record<string, unknown> | null;
    deploymentResults: VectorData["deploymentResults"];
  } | null;
  vectorError: string | null;
  localFeatures: Record<string, unknown> | null;
  services: ServiceInfo[];
  static: StaticResult[];
  hops: Hop[];
  buffer: { size: number; scope: string };
}

/** Which runtime answers which route, as build.json records it. */
export interface RouteClassification {
  compute: string[];
  edge: string[];
  prerendered: string[];
  middleware: { runtime: string; matchers: string[] } | null;
}

/** <distDir>/konfidence/build.json, schema cloud.konfidence.nextjs.build/v1. */
export interface BuildManifest {
  schema: string;
  adapter: string;
  version: string | null;
  settings: import("./settings.js").Settings;
  next: { version: string; buildId: string; deploymentId: string | null; basePath: string };
  server: { entry: string; port: number };
  static: { dir: string; route: string; files: number; bytes: number };
  targets: {
    target: "static" | "compute";
    match: { pathPrefix: string };
    headers?: Record<string, string>;
  }[];
  routes: RouteClassification;
}

/** Requests this browser tab made, measured by the widget. */
export interface Traffic {
  pages: { count: number; avgMs: number | null };
  assets: { count: number; avgMs: number | null; bytes: number };
}

/** Where the widget's probe of a static file says the file came from. */
export type StaticOrigin =
  | { from: "unknown" }
  | { from: "none" }
  | { from: "server" }
  | { from: "bucket"; vector: string; location: string };
