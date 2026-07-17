import { describe, expect, it } from "vitest";

import {
  formatLocationFileSize,
  getActiveLocationIssueCounts,
  getVisibleLocations,
  type Location,
} from "./location-model";

const locations: Location[] = [
  { id: "2", name: "Studio B", status: "occupied", archivedAt: "2026-07-01", createdAt: "2026-07-02" },
  { id: "1", name: "Studio A", status: "available", address: "Main hall", createdAt: "2026-07-01" },
];

describe("location model", () => {
  it("filters active locations by searchable content", () => {
    expect(getVisibleLocations({
      locations,
      archiveFilter: "active",
      statusFilter: "all",
      search: "hall",
      sort: "name",
    }).map((location) => location.id)).toEqual(["1"]);
  });

  it("sorts the complete archive by newest first", () => {
    expect(getVisibleLocations({
      locations,
      archiveFilter: "all",
      statusFilter: "all",
      search: "",
      sort: "newest",
    }).map((location) => location.id)).toEqual(["2", "1"]);
  });

  it("counts only active issue topics", () => {
    const counts = getActiveLocationIssueCounts([
      { id: "a", locationId: "1", type: "issue", status: "active" },
      { id: "b", locationId: "1", type: "issue", status: "resolved" },
      { id: "c", locationId: "1", type: "note", status: "active" },
    ] as never);
    expect(counts.get("1")).toBe(1);
  });

  it("formats file sizes", () => {
    expect(formatLocationFileSize(1024)).toBe("1 КБ");
    expect(formatLocationFileSize(1.5 * 1024 * 1024)).toBe("1.5 МБ");
  });
});
