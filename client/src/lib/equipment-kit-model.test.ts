import { describe, expect, it } from "vitest";
import type { Equipment } from "@shared/schema";
import {
  bundleContainsEquipment,
  getBundleComponentIds,
  getBundleComponents,
  getParentBundleId,
  isSuperPosition,
} from "./equipment-kit-model";

function equipment(id: string, overrides: Partial<Equipment> = {}): Equipment {
  return {
    id,
    name: id,
    type: "other",
    status: "available",
    ...overrides,
  } as Equipment;
}

describe("equipment kit model", () => {
  it("merges snapshot order with current component values", () => {
    const component = equipment("camera-1", {
      name: "Live camera",
      inventoryNumber: "INV-2",
      storageLocation: "Rack B",
      operabilityStatus: "on_repair",
    });
    const bundle = equipment("kit-1", {
      specifications: {
        bundleComponents: [{
          id: "camera-1",
          name: "Snapshot camera",
          inventoryNumber: "INV-1",
          storageLocation: "Rack A",
        }],
      },
    });

    expect(getBundleComponents(bundle, [bundle, component])).toEqual([
      expect.objectContaining({
        id: "camera-1",
        live: component,
        name: "Live camera",
        inventoryNumber: "INV-2",
        location: "Rack B",
        operabilityStatus: "on_repair",
      }),
    ]);
  });

  it("deduplicates component ids across legacy and snapshot fields", () => {
    const bundle = equipment("kit-1", {
      specifications: {
        bundleComponentIds: ["camera-1", "camera-1", "audio-1"],
        bundleComponents: [{ id: "audio-1" }, { id: "light-1" }, { id: "" }],
      },
    });
    expect(getBundleComponentIds(bundle)).toEqual(["camera-1", "audio-1", "light-1"]);
  });

  it("detects nested membership and terminates cyclic bundle graphs", () => {
    const outer = equipment("outer", {
      specifications: { isSuperPosition: true, bundleComponentIds: ["inner"] },
    });
    const inner = equipment("inner", {
      specifications: { bundleType: "super_position", bundleComponentIds: ["outer", "camera"] },
    });
    const camera = equipment("camera", {
      specifications: { parentBundleId: "inner" },
    });
    const all = [outer, inner, camera];

    expect(isSuperPosition(outer)).toBe(true);
    expect(getParentBundleId(camera)).toBe("inner");
    expect(bundleContainsEquipment(outer, "camera", all)).toBe(true);
    expect(bundleContainsEquipment(outer, "missing", all)).toBe(false);
  });
});
