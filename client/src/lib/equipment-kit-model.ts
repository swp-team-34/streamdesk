import type { Equipment } from "@shared/schema";
import {
  asRecord,
  getEquipmentOperabilityStatus,
  getEquipmentStorageLocation,
} from "./equipment-view-model";

export interface EquipmentBundleComponentView {
  id: string;
  live?: Equipment;
  name: string;
  model: string;
  inventoryNumber: string;
  type: string;
  status: string;
  operabilityStatus: string;
  assignedTo: string;
  location: string;
}

export function isSuperPosition(item: Equipment | null | undefined) {
  const specifications = asRecord(item?.specifications);
  return specifications.isSuperPosition === true || specifications.bundleType === "super_position";
}

export function getParentBundleName(item: Equipment | null | undefined) {
  return String(asRecord(item?.specifications).parentBundleName || "").trim();
}

export function getParentBundleId(item: Equipment | null | undefined) {
  return String(asRecord(item?.specifications).parentBundleId || "").trim();
}

export function getBundleComponents(
  item: Equipment | null | undefined,
  allEquipment: Equipment[],
): EquipmentBundleComponentView[] {
  const specifications = asRecord(item?.specifications);
  const snapshots = Array.isArray(specifications.bundleComponents)
    ? specifications.bundleComponents as any[]
    : [];
  const ids = Array.isArray(specifications.bundleComponentIds)
    ? specifications.bundleComponentIds.map((id) => String(id))
    : [];
  const byId = new Map(allEquipment.map((entry) => [entry.id, entry]));

  const rows = snapshots.length > 0
    ? snapshots.map((entry) => {
        const id = String(entry?.id || "").trim();
        const live = id ? byId.get(id) : undefined;
        return {
          id,
          live,
          name: String(live?.name || entry?.name || "Позиция").trim(),
          model: String(live?.model || entry?.model || "").trim(),
          inventoryNumber: String(live?.inventoryNumber || entry?.inventoryNumber || "").trim(),
          type: String(live?.type || entry?.type || "other").trim(),
          status: String(live?.status || entry?.status || "unknown").trim(),
          operabilityStatus: live
            ? getEquipmentOperabilityStatus(live)
            : String(entry?.operabilityStatus || "working"),
          assignedTo: String(live?.assignedTo || entry?.assignedTo || "").trim(),
          location: getEquipmentStorageLocation(live) || String(entry?.storageLocation || entry?.location || "").trim(),
        };
      })
    : ids.map((id) => {
        const live = byId.get(id);
        return {
          id,
          live,
          name: String(live?.name || "Позиция").trim(),
          model: String(live?.model || "").trim(),
          inventoryNumber: String(live?.inventoryNumber || "").trim(),
          type: String(live?.type || "other").trim(),
          status: String(live?.status || "unknown").trim(),
          operabilityStatus: getEquipmentOperabilityStatus(live),
          assignedTo: String(live?.assignedTo || "").trim(),
          location: getEquipmentStorageLocation(live),
        };
      });

  return rows.filter((entry) => entry.id || entry.name);
}

export function getBundleComponentIds(item: Equipment | null | undefined) {
  const specifications = asRecord(item?.specifications);
  return [...new Set([
    ...(Array.isArray(specifications.bundleComponentIds) ? specifications.bundleComponentIds : []),
    ...(Array.isArray(specifications.bundleComponents)
      ? specifications.bundleComponents.map((entry: any) => entry?.id)
      : []),
  ].map((id) => String(id || "").trim()).filter(Boolean))];
}

export function bundleContainsEquipment(
  bundle: Equipment,
  equipmentId: string,
  allEquipment: Equipment[],
  visited = new Set<string>(),
): boolean {
  if (bundle.id === equipmentId) return true;
  if (visited.has(bundle.id)) return false;
  visited.add(bundle.id);
  const byId = new Map(allEquipment.map((item) => [item.id, item]));
  return getBundleComponentIds(bundle).some((componentId) => {
    if (componentId === equipmentId) return true;
    const component = byId.get(componentId);
    return Boolean(
      component &&
      isSuperPosition(component) &&
      bundleContainsEquipment(component, equipmentId, allEquipment, visited),
    );
  });
}
