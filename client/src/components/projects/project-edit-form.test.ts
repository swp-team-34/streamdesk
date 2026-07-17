import { describe, expect, it } from "vitest";

import {
  normalizeProjectParticipantIds,
  toggleProjectSelection,
} from "./project-edit-form";

describe("project edit form helpers", () => {
  it("normalizes participant identifiers", () => {
    expect(normalizeProjectParticipantIds([" user-1 ", "", "user-1", null, "user-2"]))
      .toEqual(["user-1", "user-2"]);
    expect(normalizeProjectParticipantIds(null)).toEqual([]);
  });

  it("toggles a selected identifier", () => {
    expect(toggleProjectSelection(["user-1"], "user-2")).toEqual(["user-1", "user-2"]);
    expect(toggleProjectSelection(["user-1", "user-2"], "user-1")).toEqual(["user-2"]);
  });
});
