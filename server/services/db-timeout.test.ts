import { describe, expect, it } from "vitest";
import { withDbTimeout } from "./db-timeout";

describe("withDbTimeout", () => {
  it("returns successful values", async () => {
    await expect(withDbTimeout(async () => ["ok"], 50, [])).resolves.toEqual(["ok"]);
  });

  it("falls back after a database timeout or failure", async () => {
    await expect(withDbTimeout(() => new Promise<string>(() => undefined), 1, "fallback")).resolves.toBe("fallback");
    await expect(withDbTimeout(async () => { throw new Error("query failed"); }, 50, "fallback")).resolves.toBe("fallback");
  });
});
