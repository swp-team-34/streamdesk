import { describe, expect, it } from "vitest";
import { formatUserLogDate, getUserLogActionLabel } from "./user-logs-tab";

describe("user logs tab helpers", () => {
  it("uses localized labels and preserves unknown actions", () => {
    expect(getUserLogActionLabel("status_changed")).toBe("Изменен статус");
    expect(getUserLogActionLabel("exported")).toBe("exported");
  });

  it("formats timestamps without losing their calendar date", () => {
    expect(formatUserLogDate("2026-07-17T09:30:00Z")).toContain("17.07.2026");
  });
});
