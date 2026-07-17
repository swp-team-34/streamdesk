import { beforeEach, describe, expect, it } from "vitest";
import type { Equipment } from "@shared/schema";
import {
  buildCatalog,
  buildLineFromCatalog,
  calculateDelivery,
  getPortId,
  groupEstimateItems,
  inferPortsForEstimateLine,
  loadEstimateHistory,
  parseMoneyValue,
  persistEstimateHistory,
  recalculateTotals,
  type EstimateHistoryEntry,
  type EstimateLine,
} from "./estimate-model";

const equipment = (overrides: Partial<Equipment>): Equipment => ({
  id: "equipment-1",
  name: "ATEM Mini",
  type: "video",
  model: "Pro",
  status: "available",
  condition: "working",
  location: "Shelf A",
  specifications: { estimatePrice: "12 500,50 ₽" },
  ...overrides,
} as Equipment);

const estimateLine = (overrides: Partial<EstimateLine> = {}): EstimateLine => ({
  lineId: "line-1",
  catalogId: "catalog-1",
  equipmentIds: ["equipment-1"],
  name: "ATEM Mini",
  type: "video",
  model: "Pro",
  quantity: 2,
  availableQty: 2,
  totalQty: 2,
  unitPrice: 100,
  baseTotal: 200,
  shiftFactor: 1,
  total: 200,
  priceSource: "estimatePrice",
  availability: "in_stock",
  priceStatus: "priced",
  confidence: 1,
  reason: "Test",
  locations: ["Shelf A"],
  ...overrides,
});

describe("estimate model", () => {
  beforeEach(() => window.localStorage.clear());

  it("normalizes supported money formats", () => {
    expect(parseMoneyValue("12 500,50 ₽")).toBe(12500.5);
    expect(parseMoneyValue("1.250")).toBe(1250);
    expect(parseMoneyValue(-10)).toBe(-10);
    expect(parseMoneyValue("invalid")).toBe(0);
  });

  it("groups equivalent equipment into a reusable catalog item", () => {
    const catalog = buildCatalog([
      equipment({ id: "equipment-1" }),
      equipment({ id: "equipment-2", status: "in_use" }),
    ]);

    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      availableQty: 1,
      totalQty: 2,
      unitPrice: 12500.5,
      equipmentIds: ["equipment-1", "equipment-2"],
    });
  });

  it("builds lines, totals, ordered groups and delivery from one model", () => {
    const line = buildLineFromCatalog({
      id: "catalog-1",
      equipmentIds: ["equipment-1"],
      name: "Camera",
      type: "camera",
      model: "C1",
      unitPrice: 1000,
      priceSource: "price",
      availableQty: 1,
      totalQty: 1,
      locations: ["A"],
    }, 0, 1.5);
    const other = estimateLine({ lineId: "line-2", type: "audio", total: 200, quantity: 2 });

    expect(line.total).toBe(1500);
    expect(recalculateTotals([line, other])).toMatchObject({ subtotal: 1700, lines: 2, quantity: 3 });
    expect(groupEstimateItems([line, other]).map((group) => group.key)).toEqual(["audio", "video"]);
    expect(calculateDelivery([line, other], "45")).toMatchObject({ quantity: 3, vehicles: 1, distanceKm: 45 });
  });

  it("infers connection ports and consumes matching ports once", () => {
    const ports = inferPortsForEstimateLine(estimateLine({ name: "ATEM Mini Pro", type: "video" }));
    const used = new Set<string>();

    expect(ports.portsIn.filter((port) => port.portType === "HDMI")).toHaveLength(4);
    expect(getPortId(ports.portsOut, "HDMI", used)).toBe("out-1");
    expect(getPortId(ports.portsOut, "USB", used)).toBe("out-2");
  });

  it("caps persisted history at forty entries", () => {
    const entries = Array.from({ length: 45 }, (_, index) => ({
      id: String(index),
      title: `Estimate ${index}`,
      savedAt: "2026-07-17T00:00:00Z",
      deliveryDistanceKm: "0",
      estimate: {
        title: `Estimate ${index}`,
        source: "heuristic" as const,
        summary: "",
        items: [],
        missing: [],
        warnings: [],
        totals: { subtotal: 0, lines: 0, quantity: 0, missingPrices: 0, availabilityIssues: 0 },
      },
    })) satisfies EstimateHistoryEntry[];

    persistEstimateHistory(entries);

    expect(loadEstimateHistory()).toHaveLength(40);
  });
});
