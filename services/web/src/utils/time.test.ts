import { describe, expect, test } from "vitest";

import { addDays, isDateKey, weekStartOf, zonedToUtc } from "./time";

describe("isDateKey", () => {
  test("accepts real calendar days only", () => {
    expect(isDateKey("2026-11-18")).toBe(true);
    expect(isDateKey("2028-02-29")).toBe(true);
    for (const bad of [
      "2026-02-29",
      "2026-02-30",
      "2026-13-01",
      "2026-11-31",
      "2026-1-1",
      20261118,
    ]) {
      expect(isDateKey(bad)).toBe(false);
    }
  });
});

describe("zonedToUtc", () => {
  test("reads the wall time in the given time zone", () => {
    expect(zonedToUtc("2026-11-18", "10:00", "Europe/Berlin")).toEqual(
      new Date("2026-11-18T09:00:00Z"),
    );
    expect(zonedToUtc("2026-11-18", "10:00", "Asia/Kolkata")).toEqual(
      new Date("2026-11-18T04:30:00Z"),
    );
  });
});

describe("calendar arithmetic", () => {
  test("weeks start on Monday and days roll over months and years", () => {
    expect(weekStartOf("2026-11-18")).toBe("2026-11-16");
    expect(weekStartOf("2026-11-22")).toBe("2026-11-16");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
  });
});
