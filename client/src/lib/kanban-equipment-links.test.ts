import { describe, expect, it } from "vitest";
import {
  getAvailableEquipmentToLink,
  type KanbanEquipmentLinkView,
} from "./kanban-equipment-links";

const linkedEquipment: KanbanEquipmentLinkView = {
  id: "link-1",
  cardId: "card-1",
  source: "manual",
  active: true,
  workflowStatus: "linked",
  equipment: {
    id: "equipment-1",
    name: "Camera",
  },
};

describe("Kanban equipment links", () => {
  it("excludes already linked and archived equipment", () => {
    expect(getAvailableEquipmentToLink([
      { id: "equipment-1", name: "Camera", status: "available" },
      { id: "equipment-2", name: "Archived", status: "archived" },
      { id: "equipment-3", name: "Microphone", status: "in-use" },
    ], [linkedEquipment])).toEqual([
      { id: "equipment-3", name: "Microphone", status: "in-use" },
    ]);
  });

  it("does not mutate the source equipment collection", () => {
    const equipment = [
      { id: "equipment-1", name: "Camera", status: "available" },
      { id: "equipment-3", name: "Microphone", status: "available" },
    ];
    const snapshot = equipment.map((item) => ({ ...item }));
    getAvailableEquipmentToLink(equipment, [linkedEquipment]);
    expect(equipment).toEqual(snapshot);
  });
});
