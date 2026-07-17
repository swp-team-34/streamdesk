import { describe, expect, it } from "vitest";
import {
  getEquipmentEstimatePrice,
  getEquipmentInventoryPrefix,
  getEquipmentOperabilityStatus,
  isInternalEquipmentSpecificationKey,
  normalizeEquipmentInventoryPart,
  parseEquipmentSpecifications,
  serializeEquipmentSpecifications,
} from "./equipment-form-model";

describe("equipment form model", () => {
  it("keeps internal metadata out of editable specification text", () => {
    expect(serializeEquipmentSpecifications({
      companyId: "company-1",
      estimatePrice: "1500",
      Resolution: "4K",
      Ports: { hdmi: 2 },
    })).toBe('Resolution: 4K\nPorts: {"hdmi":2}');
    expect(isInternalEquipmentSpecificationKey("companyId")).toBe(true);
  });

  it("parses the supported human-readable separators", () => {
    expect(parseEquipmentSpecifications("Resolution: 4K\nPorts = 2\nPortable")).toEqual({
      Resolution: "4K",
      Ports: "2",
      "Характеристика 3": "Portable",
    });
  });

  it("normalizes pricing, status and generated inventory parts", () => {
    expect(getEquipmentEstimatePrice({ "Цена для сметы": 2500 })).toBe("2500");
    expect(getEquipmentOperabilityStatus({ status: "maintenance" })).toBe("on_repair");
    expect(getEquipmentInventoryPrefix("Камера")).toBe("cam");
    expect(normalizeEquipmentInventoryPart(" Sony FX-3 ", "EQP")).toBe("SONY-FX-3");
  });
});
