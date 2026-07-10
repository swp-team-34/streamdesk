import { describe, expect, it } from "vitest";
import {
  filterRecordingPlacesByStatus,
  isPlanningLimited,
  normalizeRecordingPlaceStatus,
} from "./recording-place-status";

describe("recording place status helpers", () => {
  it("falls back to available for missing or unknown statuses", () => {
    expect(normalizeRecordingPlaceStatus(undefined)).toBe("available");
    expect(normalizeRecordingPlaceStatus("broken")).toBe("available");
    expect(normalizeRecordingPlaceStatus("maintenance")).toBe("maintenance");
  });

  it("marks non-available places as planning-limited", () => {
    expect(isPlanningLimited("available")).toBe(false);
    expect(isPlanningLimited("occupied")).toBe(true);
    expect(isPlanningLimited("reserved")).toBe(true);
    expect(isPlanningLimited("maintenance")).toBe(true);
    expect(isPlanningLimited("unavailable")).toBe(true);
  });

  it("filters locations by normalized status", () => {
    const locations = [
      { id: "a", status: "available" },
      { id: "b", status: "reserved" },
      { id: "c", status: "unknown" },
    ];

    expect(filterRecordingPlacesByStatus(locations, "all").map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(filterRecordingPlacesByStatus(locations, "available").map((item) => item.id)).toEqual(["a", "c"]);
    expect(filterRecordingPlacesByStatus(locations, "reserved").map((item) => item.id)).toEqual(["b"]);
  });
});
