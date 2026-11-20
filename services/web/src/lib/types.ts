// Shapes shared by server and pages. Everything here crosses the SSR boundary, so keep it serialisable.

export type Service = "interviews" | "candidates";
export type SlotType = "onsite" | "phone" | "video";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  notes?: string;
}

export interface Interview {
  id: string;
  candidate_id: string;
  slot_time: string;
  slot_type: SlotType;
  candidate: Candidate | null;
}

// One request between two services, as recorded by web.
export interface Hop {
  id: string;
  at: string;
  from: "web" | Service;
  to: Service;
  method: string;
  path: string;
  // Cluster DNS name resolved from the vector; null when discovery failed or the hop was not made by web.
  authority: string | null;
  status: number | null;
  ms: number | null;
  // Routing key the callee echoed. Equal to the caller's key means the request stayed inside the vector.
  echoedKey: string | null;
  error?: string;
}

export interface ServiceStatus {
  reachable: boolean;
  authority: string | null;
  flags: Record<string, unknown>;
}

export interface RoutingSnapshot {
  at: string;
  stage: string;
  routingKey: string;
  services: Record<Service, ServiceStatus>;
  hops: Hop[];
}
