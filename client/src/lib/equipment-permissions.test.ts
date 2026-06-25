import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@shared/schema";
import {
  canCreateEquipment,
  canEditEquipment,
  canReserveEquipment,
} from "./equipment-permissions";

describe("equipment permissions", () => {
  it("allows equipment super users to create, edit, and reserve equipment", () => {
    const superUsers = [
      { role: "admin" },
      { role: "tech_director" },
      { workspaceMode: "company_owner" },
    ];

    for (const user of superUsers) {
      expect(canCreateEquipment(user)).toBe(true);
      expect(canEditEquipment(user)).toBe(true);
      expect(canReserveEquipment(user)).toBe(true);
    }
  });

  it("allows actions only when matching equipment permissions are present", () => {
    expect(canCreateEquipment({ permissions: [PERMISSIONS.EQUIPMENT_CREATE] })).toBe(true);
    expect(canEditEquipment({ permissions: [PERMISSIONS.EQUIPMENT_EDIT] })).toBe(true);
    expect(canReserveEquipment({ permissions: [PERMISSIONS.EQUIPMENT_RESERVE] })).toBe(true);
  });

  it("allows equipment editors to reserve equipment", () => {
    expect(canReserveEquipment({ permissions: [PERMISSIONS.EQUIPMENT_EDIT] })).toBe(true);
  });

  it("denies actions for missing, unrelated, or malformed permissions", () => {
    const users = [
      null,
      undefined,
      { role: "viewer" },
      { permissions: [PERMISSIONS.EQUIPMENT_VIEW] },
      { permissions: [PERMISSIONS.EQUIPMENT_CREATE, 42, null] },
      { permissions: "equipment:create" },
    ];

    for (const user of users) {
      expect(canCreateEquipment(user)).toBe(user === users[4]);
      expect(canEditEquipment(user)).toBe(false);
      expect(canReserveEquipment(user)).toBe(false);
    }
  });
});
