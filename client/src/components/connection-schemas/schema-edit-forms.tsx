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
      <span className="text-sm font-medium text-white">Редактирование зоны</span>
      <Input
        placeholder="Название"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="h-8 border-slate-600 bg-slate-700 text-white"
      />
      <StreamColorPicker
        id="schema-zone-edit-color"
        value={color}
        onChange={setColor}
        ariaLabel="Цвет зоны"
        className="h-8 border-slate-600 bg-slate-700 text-white hover:bg-slate-600"
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
      <span className="text-sm font-medium text-white">Редактирование оборудования</span>
      <Input
        placeholder="Название"
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="h-8 border-slate-600 bg-slate-700 text-white"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-400">Ширина</label>
          <Input
            type="number"
            min={100}
            max={600}
            value={width}
            onChange={(event) => setWidth(Number(event.target.value))}
            className="h-8 border-slate-600 bg-slate-700 text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">Высота</label>
          <Input
            type="number"
            min={60}
            max={400}
            value={height}
            onChange={(event) => setHeight(Number(event.target.value))}
            className="h-8 border-slate-600 bg-slate-700 text-white"
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-400">Входы (каждый с новой строки)</label>
        <textarea
          className="mt-1 min-h-[60px] w-full resize-y rounded border border-slate-600 bg-slate-700 p-2 text-sm text-white"
          value={portsInText}
          onChange={(event) => setPortsInText(event.target.value)}
          placeholder={"HDMI 1\nSDI\n..."}
        />
      </div>
      <div>
        <label className="text-xs text-slate-400">Выходы (каждый с новой строки)</label>
        <textarea
          className="mt-1 min-h-[60px] w-full resize-y rounded border border-slate-600 bg-slate-700 p-2 text-sm text-white"
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
