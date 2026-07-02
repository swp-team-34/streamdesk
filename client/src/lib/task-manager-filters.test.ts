import { describe, expect, it } from "vitest";
import {
  getTaskManagerLocationValue,
  matchesTaskManagerWorkloadFilter,
} from "./task-manager-filters";

describe("task manager filters", () => {
  const now = new Date("2026-07-02T12:00:00.000Z");

  it("reads location values from location-like custom fields", () => {
    expect(
      getTaskManagerLocationValue(
        {
          field_a: "Студия А",
          field_b: "ignored",
        },
        [
          { id: "field_a", name: "Локация" },
          { id: "field_b", name: "Комментарий" },
        ],
      ),
    ).toBe("Студия А");
  });

  it("matches workload buckets without marking completed cards as overdue", () => {
    expect(
      matchesTaskManagerWorkloadFilter(
        { dueDate: "2026-07-02T10:00:00.000Z", listType: "active" },
        "overdue",
        now,
      ),
    ).toBe(true);

    expect(
      matchesTaskManagerWorkloadFilter(
        { dueDate: "2026-07-02T10:00:00.000Z", listType: "closed" },
        "overdue",
        now,
      ),
    ).toBe(false);

    expect(
      matchesTaskManagerWorkloadFilter(
        { dueDate: "2026-07-03T08:00:00.000Z", listType: "active" },
        "due-soon",
        now,
      ),
    ).toBe(true);
  });
});
