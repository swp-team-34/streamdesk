import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StreamColorPicker } from "@/components/ui/stream-color-picker";
import type { SchemaDevice, SchemaZone } from "@/lib/connection-schema-model";

export function ZoneEditForm({
  zone,
  onSave,
  onClose,
}: {
  zone: SchemaZone;
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(zone.name);
  const [color, setColor] = useState(zone.color || "#3b82f6");
  return (
    <>
      <span className="text-sm font-medium text-foreground">Редактирование зоны</span>
      <Input
        placeholder="Название"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="h-8 border-border/50 bg-surface-raised text-foreground"
      />
      <StreamColorPicker
        id="schema-zone-edit-color"
        value={color}
        onChange={setColor}
        ariaLabel="Цвет зоны"
        className="h-8 border-border/50 bg-surface-raised text-foreground hover:bg-surface-subtle"
      />
      <div className="flex gap-2">
        <Button size="sm" className="h-8 flex-1" onClick={() => onSave(name.trim(), color)}>
          Сохранить
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </>
  );
}

export function DeviceEditForm({
  device,
  onSave,
  onClose,
}: {
  device: SchemaDevice;
  onSave: (data: {
    name: string;
    width?: number;
    height?: number;
    portsIn?: SchemaDevice["portsIn"];
    portsOut?: SchemaDevice["portsOut"];
  }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(device.name);
  const [width, setWidth] = useState(device.properties?.width ?? 260);
  const [height, setHeight] = useState(device.properties?.height ?? 80);
  const [portsInText, setPortsInText] = useState(
    (device.portsIn || []).map((port) => port.name || port.id).join("\n"),
  );
  const [portsOutText, setPortsOutText] = useState(
    (device.portsOut || []).map((port) => port.name || port.id).join("\n"),
  );

  const handleSave = () => {
    const portsIn: SchemaDevice["portsIn"] = portsInText
      .split("\n")
      .filter((value) => value.trim())
      .map((value, index) => ({ id: `in-${index}`, name: value.trim(), type: "in" as const }));
    const portsOut: SchemaDevice["portsOut"] = portsOutText
      .split("\n")
      .filter((value) => value.trim())
      .map((value, index) => ({ id: `out-${index}`, name: value.trim(), type: "out" as const }));
    onSave({
      name: name.trim(),
      width: Number(width) || 260,
      height: Number(height) || 80,
      portsIn,
      portsOut,
    });
  };

  return (
    <>
      <span className="text-sm font-medium text-foreground">Редактирование оборудования</span>
      <Input
        placeholder="Название"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="h-8 border-border/50 bg-surface-raised text-foreground"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-muted-foreground">Ширина</label>
          <Input
            type="number"
            min={100}
            max={600}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            className="h-8 border-border/50 bg-surface-raised text-foreground"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Высота</label>
          <Input
            type="number"
            min={60}
            max={400}
            value={height}
            onChange={(event) => setHeight(Number(event.target.value))}
            className="h-8 border-border/50 bg-surface-raised text-foreground"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Входы (каждый с новой строки)</label>
        <textarea
          className="mt-1 min-h-[60px] w-full resize-y rounded-control border border-border/50 bg-surface-raised p-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          value={portsInText}
          onChange={(event) => setPortsInText(event.target.value)}
          placeholder={"HDMI 1\nSDI\n..."}
        />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Выходы (каждый с новой строки)</label>
        <textarea
          className="mt-1 min-h-[60px] w-full resize-y rounded-control border border-border/50 bg-surface-raised p-2 text-sm text-foreground outline-none transition-colors focus:border-primary/60 focus:ring-2 focus:ring-primary/15"
          value={portsOutText}
          onChange={(event) => setPortsOutText(event.target.value)}
          placeholder={"HDMI\nSDI\n..."}
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-8 flex-1" onClick={handleSave}>
          Сохранить
        </Button>
        <Button size="sm" variant="outline" className="h-8" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </>
  );
}
