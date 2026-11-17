import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import {
  HOP_BUFFER_SIZE,
  clearHops,
  devtoolsEnabled,
  impliedHops,
  listHops,
  recordHop,
  selfName,
} from "../src/devtools/hops.js";

const call = (i = 0) => ({
  to: "interviews",
  method: "GET",
  path: `/interviews?i=${i}`,
  host: "interviews.dev.svc.cluster.local:80",
  status: 200,
  routingKey: "dev-abc",
});

beforeEach(() => {
  clearHops();
  process.env.KONFIDENCE_DEPLOYMENT_RESULT = "web";
});
afterEach(() => {
  delete process.env.KONFIDENCE_DEVTOOLS;
  delete process.env.KONFIDENCE_DEPLOYMENT_RESULT;
});

test("devtools are off unless KONFIDENCE_DEVTOOLS is 1 or true", () => {
  assert.equal(devtoolsEnabled(), false);
  for (const value of ["1", "true", " TRUE "]) {
    process.env.KONFIDENCE_DEVTOOLS = value;
    assert.equal(devtoolsEnabled(), true, value);
  }
  process.env.KONFIDENCE_DEVTOOLS = "0";
  assert.equal(devtoolsEnabled(), false);
});

test("the server names itself after its deployment result", () => {
  assert.equal(selfName(), "web");
});

test("the buffer keeps the newest hops, newest first", () => {
  for (let i = 0; i < HOP_BUFFER_SIZE + 5; i++) recordHop(call(i), 12.4);
  const hops = listHops();
  assert.equal(hops.length, HOP_BUFFER_SIZE);
  assert.equal(hops[0].path, `/interviews?i=${HOP_BUFFER_SIZE + 4}`);
  assert.deepEqual(
    {
      from: hops[0].from,
      kind: hops[0].kind,
      latencyMs: hops[0].latencyMs,
      routingKey: hops[0].routingKey,
    },
    { from: "web", kind: "direct", latencyMs: 12, routingKey: "dev-abc" },
  );
});

test("listHops returns copies", () => {
  recordHop(call(), 1);
  listHops()[0].status = 500;
  assert.equal(listHops()[0].status, 200);
});

test("an error response records the error message of its body", async () => {
  const response = new Response(JSON.stringify({ error: "notes field is not enabled" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
  recordHop(
    { ...call(), to: "candidates", method: "POST", path: "/candidates", status: 400 },
    7,
    response,
    [],
  );
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(listHops()[0].error, "notes field is not enabled");
});

test("embedded objects of another service become implied hops", async () => {
  const body = [
    { id: "i1", candidate_id: "c1", candidate: { id: "c1", name: "Ada Example" } },
    { id: "i2", candidate_id: "c2", candidate: null },
    { id: "i3", owner: { id: "x" } },
  ];
  const response = new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
  const parent = recordHop(call(), 14, response, ["candidates", "interviews"]);
  await new Promise((resolve) => setTimeout(resolve, 10));
  const implied = listHops().filter((hop) => hop.kind === "implied");
  assert.equal(implied.length, 2);
  const byPath = Object.fromEntries(implied.map((hop) => [hop.path, hop]));
  assert.equal(byPath["/candidates/c1"].status, 200);
  assert.equal(byPath["/candidates/c1"].from, "interviews");
  assert.equal(byPath["/candidates/c1"].impliedBy, parent.id);
  assert.equal(byPath["/candidates/c2"].status, null);
  assert.match(byPath["/candidates/c2"].error, /no candidate/);
});

test("a service does not imply calls to itself", () => {
  const parent = { id: 1, at: "", to: "candidates", routingKey: null };
  assert.deepEqual(impliedHops(parent, [{ candidate: { id: "c1" } }], ["candidates"]), []);
});
