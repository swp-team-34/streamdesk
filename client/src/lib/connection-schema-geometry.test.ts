import { describe, expect, it } from "vitest";
import {
  getSchemaCablePath,
  getSchemaDeviceHeight,
  getSchemaDeviceWidth,
  getSchemaPortPosition,
  isSchemaConnectionValid,
  normalizeSchemaConnectionType,
} from "./connection-schema-geometry";
import type { SchemaDevice, SchemaPort } from "./connection-schema-model";

describe("connection schema geometry", () => {
  const input: SchemaPort = { id: "in-1", name: "HDMI IN", type: "in", portType: "HDMI input" };
  const output: SchemaPort = { id: "out-1", name: "HDMI OUT", type: "out", portType: "HDMI output" };
  const device: SchemaDevice = {
    id: "device-1",
    name: "Switcher",
    type: "video",
    position: { x: 100, y: 200 },
    portsIn: [input],
    portsOut: [output],
  };

  it("normalizes compatible port types", () => {
    expect(normalizeSchemaConnectionType("HDMI input #1")).toBe("HDMI");
    expect(isSchemaConnectionValid(output, input)).toBe(true);
    expect(isSchemaConnectionValid(input, output)).toBe(false);
  });

  it("calculates stable card and port bounds", () => {
    expect(getSchemaDeviceWidth(device)).toBeGreaterThanOrEqual(260);
    expect(getSchemaDeviceHeight(device)).toBe(130);
    expect(getSchemaPortPosition(device, output, 0).y).toBe(310);
  });

  it("builds orthogonal cable paths", () => {
    expect(getSchemaCablePath({ x: 0, y: 0 }, { x: 100, y: 20 })).toBe(
      "M 0 0 L 50 0 L 50 20 L 100 20",
    );
  });
});
