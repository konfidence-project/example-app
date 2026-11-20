import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCreateBody, parseListQuery } from "../src/query.ts";

const ID = "3f2a9c1e-5b7d-4c1a-9e2f-0123456789ab";

test("list query without parameters has no filter", () => {
  assert.deepEqual(parseListQuery({}), { ok: true, value: {} });
  assert.deepEqual(parseListQuery(undefined), { ok: true, value: {} });
});

test("list query normalizes the time range and keeps the candidate id", () => {
  const parsed = parseListQuery({
    candidate_id: ID,
    from: "2026-11-16T00:00:00+01:00",
    to: "2026-11-23",
  });
  assert.deepEqual(parsed, {
    ok: true,
    value: { candidateId: ID, from: "2026-11-15T23:00:00.000Z", to: "2026-11-23T00:00:00.000Z" },
  });
});

test("list query rejects bad input", () => {
  assert.equal(parseListQuery({ candidate_id: "nope" }).ok, false);
  assert.equal(parseListQuery({ from: "yesterday" }).ok, false);
  assert.equal(parseListQuery({ from: "2026-11-23", to: "2026-11-16" }).ok, false);
});

test("create body defaults the duration and drops an empty location", () => {
  const parsed = parseCreateBody({
    candidateId: ID,
    slotTime: "2026-11-18T10:00:00Z",
    slotType: "onsite",
    location: " ",
  });
  assert.deepEqual(parsed, {
    ok: true,
    value: {
      candidateId: ID,
      slotTime: "2026-11-18T10:00:00.000Z",
      slotType: "onsite",
      durationMinutes: 60,
      location: null,
    },
  });
});

test("create body validates duration, location and required fields", () => {
  const base = { candidateId: ID, slotTime: "2026-11-18T10:00:00Z", slotType: "video" };
  assert.equal(parseCreateBody({ ...base, durationMinutes: 45, location: "Room 1" }).ok, true);
  assert.equal(parseCreateBody({ ...base, durationMinutes: 2 }).ok, false);
  assert.equal(parseCreateBody({ ...base, durationMinutes: "45" }).ok, false);
  assert.equal(parseCreateBody({ ...base, location: "x".repeat(201) }).ok, false);
  assert.equal(parseCreateBody({ ...base, slotTime: "soon" }).ok, false);
  assert.equal(parseCreateBody({ slotType: "phone" }).ok, false);
});
