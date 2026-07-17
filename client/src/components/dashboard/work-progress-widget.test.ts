import { describe, expect, it } from "vitest";
import { resolveWorkItemTags } from "./work-progress-widget";

describe("resolveWorkItemTags", () => {
  it("uses human-readable Kanban label names instead of label ids", () => {
    expect(resolveWorkItemTags({
      labelIds: ["da8b5912-8c9a-40b6-9bc6-8220143ed352"],
      labels: [{ id: "da8b5912-8c9a-40b6-9bc6-8220143ed352", name: "123" }],
    })).toEqual(["123"]);
  });

  it("does not expose raw UUIDs when label metadata is unavailable", () => {
    expect(resolveWorkItemTags({
      labelIds: ["da8b5912-8c9a-40b6-9bc6-8220143ed352"],
    })).toEqual([]);
  });
});
