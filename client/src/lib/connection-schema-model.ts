export interface ConnectionSchema {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  components?: ConnectionSchemaComponent[];
}

export interface ComponentConnection {
  componentId: string;
  port?: string;
  fromPortId?: string;
  cableType?: string;
  protocol?: string;
}

export interface ConnectionSchemaComponent {
  id: string;
  schemaId: string;
  type: string;
  name: string;
  position: { x: number; y: number };
  properties: Record<string, any>;
  connections: ComponentConnection[];
  createdAt: string;
  updatedAt: string;
}

export interface SchemaPort {
  id: string;
  name: string;
  type: "in" | "out";
  portType?: string;
}

export interface SchemaDevice {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  portsIn: Array<SchemaPort & { type: "in" }>;
  portsOut: Array<SchemaPort & { type: "out" }>;
  manufacturer?: string;
  model?: string;
  properties?: Record<string, any>;
}

export interface SchemaZone {
  id: string;
  name: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  color?: string;
}

export interface SchemaCable {
  id: string;
  fromDeviceId: string;
  fromPortId: string;
  toDeviceId: string;
  toPortId: string;
  cableType?: string;
  protocol?: string;
}

export function normalizeConnections(
  connections: ConnectionSchemaComponent["connections"] | string | null | undefined,
): ComponentConnection[] {
  if (Array.isArray(connections)) {
    return connections.filter((connection) => typeof connection.componentId === "string");
  }
  if (typeof connections === "string") {
    try {
      const parsed = JSON.parse(connections);
      return Array.isArray(parsed)
        ? (parsed as ComponentConnection[]).filter((connection) => typeof connection.componentId === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
}
