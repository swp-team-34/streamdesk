import { describe, expect, it } from "vitest";
import type { Equipment } from "@shared/schema";
import {
  getEquipmentActivitySummary,
  getEquipmentCategoryLabel,
  getEquipmentOperabilityStatus,
  getEquipmentPhotos,
  getEquipmentPhysicalDestination,
  getEquipmentStatusLabel,
  getEquipmentStorageLocation,
  getSpecificationEntries,
  isEquipmentOperable,
} from "./equipment-view-model";

function equipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: "equipment-1",
    name: "Camera",
    type: "camera",
    status: "available",
    ...overrides,
  } as Equipment;
}

describe("equipment view model", () => {
  it("hides workflow metadata and formats visible specification values", () => {
    expect(getSpecificationEntries({
      companyId: "company-1",
      ports: ["HDMI", { name: "SDI" }],
      resolution: "  4K   UHD  ",
      dimensions: { width: 10, height: 20 },
    })).toEqual([
      ["ports", "HDMI, SDI"],
      ["resolution", "4K UHD"],
      ["dimensions", "width: 10, height: 20"],
    ]);
  });

  it("normalizes persisted photos and excludes local blob previews", () => {
    expect(getEquipmentPhotos(equipment({
      photos: ["camera.jpg", "uploads/nested/photo.png", "/ready.jpg", "https://cdn.test/image.jpg", "blob:preview"],
    }))).toEqual([
      "/uploads/camera.jpg",
      "/uploads/nested/photo.png",
      "/ready.jpg",
      "https://cdn.test/image.jpg",
    ]);
  });

  it("prefers expanded category and storage records over legacy labels", () => {
    const item = equipment({ storageLocation: "Legacy shelf" }) as Equipment & {
      category: { name: string };
      warehouseStorageLocation: { path: string };
    };
    item.category = { name: "Cameras / Cinema" };
    item.warehouseStorageLocation = { path: "Room A / Rack 2" };
    expect(getEquipmentCategoryLabel(item)).toBe("Cameras / Cinema");
    expect(getEquipmentStorageLocation(item)).toBe("Room A / Rack 2");
  });

  it("falls back from legacy status to operability without changing status", () => {
    expect(getEquipmentOperabilityStatus(equipment({ operabilityStatus: null, status: "broken" }))).toBe("broken");
    expect(getEquipmentOperabilityStatus(equipment({ operabilityStatus: null, status: "maintenance" }))).toBe("on_repair");
    expect(isEquipmentOperable(equipment({ operabilityStatus: "working", status: "in-use" }))).toBe(true);
    expect(getEquipmentStatusLabel("in-use")).toBe("Используется");
  });

  it("normalizes physical destination and activity summary fallbacks", () => {
    const item = equipment({ location: "Legacy stage", locationId: "location-1" }) as Equipment & {
      activitySummary: unknown;
      physicalDestination: unknown;
    };
    item.activitySummary = { commentCount: "2", attachmentCount: 1, latestAuthorName: "Tim" };
    item.physicalDestination = { displayName: "Main stage", archived: true };
    expect(getEquipmentPhysicalDestination(item)).toMatchObject({
      locationId: "location-1",
      displayName: "Main stage",
      archived: true,
    });
    expect(getEquipmentActivitySummary(item)).toEqual({
      commentCount: 2,
      attachmentCount: 1,
      latestAt: "",
      latestAuthorName: "Tim",
    });
  });
});
