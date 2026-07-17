import type { EquipmentWorkflowStatus } from "@/lib/kanban-presentation";

export interface EquipmentSummaryView {
  id: string;
  name: string;
  model?: string | null;
  status?: string | null;
}

export interface KanbanEquipmentLinkView {
  id: string;
  linkId?: string | null;
  cardId: string;
  projectId?: string | null;
  source: "manual" | "checkout";
  active: boolean;
  workflowStatus: EquipmentWorkflowStatus;
  linkedAt?: string | Date | null;
  equipment: {
    id: string;
    name: string;
    model?: string | null;
    status?: string | null;
    operabilityStatus?: string | null;
    inventoryNumber?: string | null;
  };
  request?: {
    id: string;
    status: string;
    requestType?: string | null;
    requestedBy: string;
    quantity?: number | null;
    location?: string | null;
    note?: string | null;
    createdAt?: string | Date | null;
    reviewedAt?: string | Date | null;
  } | null;
}

export interface KanbanBoardEquipmentLinksResponse {
  cards: Record<string, KanbanEquipmentLinkView[]>;
}

export function getAvailableEquipmentToLink(
  equipment: EquipmentSummaryView[],
  links: KanbanEquipmentLinkView[],
) {
  const linkedEquipmentIds = new Set(
    links.map((link) => String(link.equipment.id)),
  );
  return equipment.filter((item) =>
    item.status !== "archived" && !linkedEquipmentIds.has(String(item.id)),
  );
}
