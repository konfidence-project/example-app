import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { DevtoolsData } from "../types.js";
import { clearHops, recordHop } from "./hops.js";
import { GET } from "./route.js";

const requestHeaders = new Headers();
vi.mock("next/headers.js", () => ({ headers: async () => requestHeaders }));

const KEY = "dev-abc";
const vector = {
  features: { "allow-video-slots": true },
  authored: { secret: "authored config" },
  deploymentResults: {
    interviews: [
      {
        name: "interviews",
        type: "http-k8s-service",
        spec: { Namespace: "ns", K8sName: "interviews-x", ServicePorts: [{ port: 80 }] },
      },
    ],
    "web-static": [
      {
        name: "next-static",
        type: "s3.konfidence.cloud/v1alpha1",
        spec: { route: "/_next/static", bucket: "b", prefix: "p/", endpoint: "http://minio" },
      },
    ],
  },
};

const call = (routingKey: string, path: string) => ({
  to: "interviews",
  method: "GET",
  path,
  host: "interviews-x.ns.svc.cluster.local:80",
  status: 200,
  routingKey,
});

beforeEach(() => {
  clearHops();
  process.env.KONFIDENCE_DEVTOOLS = "1";
  process.env.KONFIDENCE_DEPLOYMENT_RESULT = "web";
  requestHeaders.set("x-konfidence-routing-key", KEY);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/ofrep/")) return Response.json({ value: vector });
      return Response.json({ runtime: "Node", routingKey: KEY, flags: { a: true } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.KONFIDENCE_DEVTOOLS;
  delete process.env.KONFIDENCE_DEPLOYMENT_RESULT;
});

const get = (headers: Record<string, string> = {}) =>
  GET(
    new Request("http://web/api/konfidence/devtools", {
      headers: { "x-konfidence-routing-key": KEY, ...headers },
    }),
  );

describe("devtools endpoint", () => {
  test("answers 404 while devtools are off", async () => {
    delete process.env.KONFIDENCE_DEVTOOLS;
    expect((await get()).status).toBe(404);
  });

  test("describes the vector, its services and static results", async () => {
    const data = (await (await get()).json()) as DevtoolsData;
    expect(data.vector?.features).toEqual({ "allow-video-slots": true });
    expect(data.request).toEqual({ routingKey: KEY });
    expect(data.services[0]).toMatchObject({
      name: "interviews",
      url: "http://interviews-x.ns.svc.cluster.local:80",
      source: "deployment-result",
    });
    expect(data.static[0]).toMatchObject({ route: "/_next/static", bucket: "b", prefix: "p/" });
  });

  test("returns only the hops of the caller's routing key", async () => {
    recordHop(call(KEY, "/interviews?from=2026-11-16"), 3);
    recordHop(call("prod-xyz", "/interviews"), 3);
    const data = (await (await get()).json()) as DevtoolsData;
    expect(data.hops).toHaveLength(1);
    expect(data.hops[0]).toMatchObject({ routingKey: KEY, path: "/interviews?from=2026-11-16" });
  });
});
