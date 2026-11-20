import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const requestHeaders = new Headers();
vi.mock("next/headers.js", () => ({ headers: async () => requestHeaders }));

const { features, serviceFetch, serviceUrl, vectorData } = await import("./server.js");

let key = 0;
beforeEach(() => {
  // A fresh routing key per test, so the vector data cache starts empty.
  key += 1;
  requestHeaders.set("x-konfidence-routing-key", `key-${key}`);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  for (const name of [
    "VECTOR_CONFIG_URL",
    "KONFIDENCE_FEATURES",
    "KONFIDENCE_SERVICE_CANDIDATES_URL",
  ]) {
    delete process.env[name];
  }
});

describe("configuration", () => {
  test("a service override wins over the vector", async () => {
    process.env.KONFIDENCE_SERVICE_CANDIDATES_URL = "http://localhost:8081/";
    expect(await serviceUrl("candidates")).toBe("http://localhost:8081");
  });
});

describe("vector data", () => {
  test("a failed lookup is not cached, and its error names neither URL nor key", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("down", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ value: { features: { a: true } } }));
    vi.stubGlobal("fetch", fetch);
    const error = await vectorData().catch((err: unknown) => err as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("the vector data service responded 503");
    expect(await features()).toEqual({ a: true });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test("the lookup has a deadline, and a timed-out lookup is retried", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return Promise.reject(new DOMException("timed out", "TimeoutError"));
    });
    vi.stubGlobal("fetch", fetch);
    await expect(vectorData()).rejects.toThrow(/timed out/);
    await expect(vectorData()).rejects.toThrow(/timed out/);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("serviceFetch", () => {
  test("forwards the routing key and sets a deadline", async () => {
    process.env.KONFIDENCE_SERVICE_CANDIDATES_URL = "http://localhost:8081";
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => Response.json([]));
    vi.stubGlobal("fetch", fetch);
    await serviceFetch("candidates", "/candidates");
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("http://localhost:8081/candidates");
    expect(new Headers(init.headers).get("x-konfidence-routing-key")).toBe(`key-${key}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
