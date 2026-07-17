import { describe, expect, it } from "vitest";
import { normalizeConnections } from "./connection-schema-model";

describe("connection schema model", () => {
  it("keeps valid connection arrays", () => {
    expect(normalizeConnections([
      { componentId: "device-2", port: "in-1" },
      { componentId: "device-3", protocol: "SDI" },
    ])).toHaveLength(2);
  });

  it("normalizes serialized connections and rejects malformed entries", () => {
    expect(normalizeConnections(JSON.stringify([
      { componentId: "device-2", port: "in-1" },
      { port: "missing-component" },
    ]))).toEqual([{ componentId: "device-2", port: "in-1" }]);
    expect(normalizeConnections("{")).toEqual([]);
    expect(normalizeConnections(null)).toEqual([]);
  });
});
