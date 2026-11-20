import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

const post = vi.fn(async () => ({ id: "i1" }));
vi.mock("@/lib/api-client", () => ({
  api: { post },
  errorMessage: (err: unknown) => String(err),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let createInterview: typeof import("./create-interview").createInterview;
beforeAll(async () => {
  vi.stubEnv("APP_TIME_ZONE", "Europe/Berlin");
  ({ createInterview } = await import("./create-interview"));
});

afterEach(() => post.mockClear());

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  const all = { candidateId: "c1", type: "phone", duration: "60", ...fields };
  for (const [key, value] of Object.entries(all)) data.set(key, value);
  return data;
};

describe("createInterview", () => {
  test("sends the instant of the wall time in the app's time zone", async () => {
    expect(await createInterview(null, form({ date: "2026-11-18", time: "10:00" }))).toEqual({
      ok: true,
    });
    expect(post).toHaveBeenCalledWith(
      "interviews",
      "/interviews",
      expect.objectContaining({ slotTime: "2026-11-18T09:00:00.000Z" }),
    );
  });

  test("rejects a day that does not exist", async () => {
    const result = await createInterview(null, form({ date: "2026-02-30", time: "10:00" }));
    expect(result).toEqual({ ok: false, error: "Enter a valid date." });
    expect(post).not.toHaveBeenCalled();
  });
});
