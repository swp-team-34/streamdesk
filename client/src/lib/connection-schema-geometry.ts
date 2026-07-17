import type { SchemaDevice as Device, SchemaPort as Port } from "./connection-schema-model";

const DEVICE_WIDTH_MIN = 200;
const DEVICE_WIDTH_DEFAULT = 260;
const PORT_ROW_PADDING = 28;
const PORT_BOX_MIN_WIDTH = 34;
const DEVICE_HEIGHT_BASE = 80;
export const SCHEMA_PORT_HEIGHT = 20;
const PORT_SPACING = 5;
export const SCHEMA_GRID_STEP = 48;
const CABLE_EXIT_OFFSET = 26;
export const SCHEMA_CABLE_LABEL_OFFSET = 14;

export function getSchemaPortBoxWidth(port?: Port) {
  const name = (port?.name || "").trim();
  return Math.max(PORT_BOX_MIN_WIDTH, Math.min(140, name.length * 7 + 16));
}

export function getSchemaDeviceWidth(device: Device) {
  const calculateRowWidth = (ports: Port[] = []) =>
    ports.reduce((sum, port) => sum + getSchemaPortBoxWidth(port), 0) +
    Math.max(0, ports.length - 1) * PORT_SPACING +
    PORT_ROW_PADDING * 2;
  const widthFromPorts = Math.max(
    calculateRowWidth(device.portsIn),
    calculateRowWidth(device.portsOut),
    DEVICE_WIDTH_DEFAULT,
  );
  const customWidth = device.properties?.width as number | undefined;
  const baseWidth = Math.max(DEVICE_WIDTH_DEFAULT, widthFromPorts);
  return customWidth != null && customWidth >= DEVICE_WIDTH_MIN
    ? Math.max(customWidth, baseWidth)
    : baseWidth;
}

export function getSchemaPortLayout(device: Device, type: "in" | "out") {
  const ports = type === "in" ? device.portsIn || [] : device.portsOut || [];
  const widths = ports.map((port) => getSchemaPortBoxWidth(port));
  const contentWidth = widths.reduce((sum, width) => sum + width, 0) +
    Math.max(0, ports.length - 1) * PORT_SPACING;
  let currentX = Math.max(PORT_ROW_PADDING, (getSchemaDeviceWidth(device) - contentWidth) / 2);
  return ports.map((port, index) => {
    const width = widths[index];
    const layout = { port, x: currentX, width, centerX: currentX + width / 2 };
    currentX += width + PORT_SPACING;
    return layout;
  });
}

export function getSchemaDeviceHeight(device: Device) {
  const customHeight = device.properties?.height as number | undefined;
  if (customHeight != null && customHeight >= DEVICE_HEIGHT_BASE) return customHeight;
  const rows = Number((device.portsIn?.length ?? 0) > 0) + Number((device.portsOut?.length ?? 0) > 0) || 1;
  return DEVICE_HEIGHT_BASE + rows * (SCHEMA_PORT_HEIGHT + PORT_SPACING);
}

export function getSchemaPortPosition(
  device: Device,
  port: Port,
  index: number,
  localPositions: Record<string, { x: number; y: number }> = {},
) {
  const position = localPositions[device.id] ?? device.position;
  const layout = getSchemaPortLayout(device, port.type)[index];
  return {
    x: position.x + (layout?.x ?? 0),
    y: port.type === "in" ? position.y : position.y + getSchemaDeviceHeight(device) - SCHEMA_PORT_HEIGHT,
  };
}

export function normalizeSchemaConnectionType(value?: string) {
  const raw = (value || "").trim().toUpperCase();
  if (!raw) return "";
  const cleaned = raw
    .replace(/\b(INPUT|OUTPUT|IN|OUT|PORT|ПОРТ|ВХОД|ВЫХОД)\b/g, " ")
    .replace(/[#:()[\],]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.includes("USB C") || cleaned.includes("USBC") || cleaned.includes("TYPE C")) return "USB-C";
  if (cleaned.includes("DISPLAYPORT") || cleaned === "DP") return "DP";
  if (cleaned.includes("HDMI")) return "HDMI";
  if (cleaned.includes("SDI")) return "SDI";
  if (cleaned.includes("RJ45")) return "RJ45";
  if (cleaned.includes("ETHERNET")) return "ETH";
  if (cleaned.includes("LAN")) return "LAN";
  if (cleaned.includes("USB")) return "USB";
  if (cleaned.includes("BNC")) return "BNC";
  if (cleaned.includes("XLR")) return "XLR";
  if (cleaned.includes("TRS") || cleaned.includes("JACK")) return "TRS";
  if (cleaned.includes("RCA")) return "RCA";
  if (cleaned.includes("WIRELESS") || cleaned.includes("WIFI") || cleaned.includes("RF")) return "WIRELESS";
  if (cleaned.includes("NDI")) return "NDI";
  if (cleaned.includes("AES")) return "AES";
  if (cleaned.includes("MADI")) return "MADI";
  if (cleaned === "AC" || cleaned.includes("220V")) return "AC";
  if (cleaned.includes("DC")) return "DC";
  return cleaned;
}

export function getSchemaCableEndpoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromType: "in" | "out",
  toType?: "in" | "out",
) {
  return {
    start: { x: from.x, y: from.y + (fromType === "out" ? CABLE_EXIT_OFFSET : -CABLE_EXIT_OFFSET) },
    end: { x: to.x, y: to.y + (toType ? (toType === "out" ? CABLE_EXIT_OFFSET : -CABLE_EXIT_OFFSET) : 0) },
  };
}

export function getSchemaCablePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  laneOffset = 0,
) {
  const deltaX = Math.abs(to.x - from.x);
  const deltaY = Math.abs(to.y - from.y);
  const middleX = (from.x + to.x) / 2 + laneOffset;
  const middleY = (from.y + to.y) / 2 + laneOffset;
  return deltaX >= deltaY
    ? `M ${from.x} ${from.y} L ${middleX} ${from.y} L ${middleX} ${to.y} L ${to.x} ${to.y}`
    : `M ${from.x} ${from.y} L ${from.x} ${middleY} L ${to.x} ${middleY} L ${to.x} ${to.y}`;
}

export function getSchemaPortColor(portType?: string) {
  const colors: Record<string, string> = {
    HDMI: "#1a1a1a",
    SDI: "#808080",
    USB: "#0066cc",
    ETH: "#ffd700",
    LAN: "#ffd700",
    "USB-C": "#0066cc",
    BNC: "#808080",
    Wireless: "#7c3aed",
    DC: "#4a5568",
    XLR: "#4b5563",
    TRS: "#4b5563",
    RCA: "#4b5563",
    DP: "#2563eb",
  };
  return colors[normalizeSchemaConnectionType(portType)] || "#666666";
}

export function getSchemaSignalCategory(portType?: string): "video" | "audio" | "network" | "power" | "control" | "other" {
  const type = normalizeSchemaConnectionType(portType);
  if (["HDMI", "SDI", "DP", "DISPLAYPORT"].includes(type)) return "video";
  if (["XLR", "TRS", "RCA", "JACK"].includes(type)) return "audio";
  if (["ETH", "LAN", "RJ45"].includes(type)) return "network";
  if (["DC", "AC"].includes(type)) return "power";
  if (["USB", "USB-C"].includes(type)) return "control";
  return "other";
}

export function isSchemaConnectionValid(fromPort: Port, toPort: Port) {
  if (!(fromPort.type === "out" && toPort.type === "in")) return false;
  const fromCategory = getSchemaSignalCategory(fromPort.portType);
  const toCategory = getSchemaSignalCategory(toPort.portType);
  return fromCategory === "other" ||
    toCategory === "other" ||
    fromCategory === toCategory ||
    fromCategory === "control" ||
    toCategory === "control";
}
