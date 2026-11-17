declare global {
  namespace App {
    interface Locals {
      routingKey: string;
      // Set by the edge route; empty when the request bypassed the edge.
      stage: string;
      // IANA zone of the viewer, from the tz cookie; UTC until the browser has set it.
      tz: string;
    }
  }
}

export {};
