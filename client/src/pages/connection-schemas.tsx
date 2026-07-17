import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StreamColorPicker } from "@/components/ui/stream-color-picker";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { 
  Network, 
  Plus, 
  Trash2, 
  Edit,
  Square,
  Type,
  Wrench,
  Save,
  Download,
  Share2,
  List,
  Package,
  BrainCircuit,
  Maximize2,
  Minimize2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { SchemaCanvas, type SchemaCanvasRef } from "@/components/connection-schemas/schema-canvas";
import { AddEquipmentDialog } from "@/components/connection-schemas/add-equipment-dialog";
import { DeviceEditForm, ZoneEditForm } from "@/components/connection-schemas/schema-edit-forms";
import {
  normalizeConnections,
  type ConnectionSchema,
  type SchemaCable as Cable,
  type SchemaDevice as Device,
  type SchemaZone as Zone,
} from "@/lib/connection-schema-model";

export default function ConnectionSchemas() {
  const { toast } = useToast();
  const { confirm: confirmAction, prompt: promptAction } = useAppDialog();
  const [selectedSchema, setSelectedSchema] = useState<string | null>(null);
  const [isCreatingSchema, setIsCreatingSchema] = useState(false);
  const [isAddingEquipment, setIsAddingEquipment] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [newSchemaDescription, setNewSchemaDescription] = useState("");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [newlyCreatedSchemaId, setNewlyCreatedSchemaId] = useState<string | null>(null);
  const [drawZoneMode, setDrawZoneMode] = useState(false);
  const [pendingZoneRect, setPendingZoneRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [drawnZoneName, setDrawnZoneName] = useState("");
  const [drawnZoneColor, setDrawnZoneColor] = useState("#3b82f6");
  const schemaCanvasRef = useRef<SchemaCanvasRef>(null);

  // Получение всех схем
  const { data: schemas = [], refetch: refetchSchemas } = useQuery<ConnectionSchema[]>({
    queryKey: ["/api/connection-schemas"],
  });

  useEffect(() => {
    const schemaId = new URLSearchParams(window.location.search).get("schema");
    if (schemaId) {
      setSelectedSchema(schemaId);
      setIsFullScreen(true);
    }
  }, []);

  // Получение выбранной схемы с компонентами
  const { data: selectedSchemaData, refetch: refetchSelectedSchema } = useQuery<ConnectionSchema>({
    queryKey: ["/api/connection-schemas", selectedSchema],
    queryFn: async () => {
      if (!selectedSchema) return null;
      const response = await apiRequest("GET", `/api/connection-schemas/${selectedSchema}`);
      return response.json();
    },
    enabled: !!selectedSchema,
  });

  // Преобразование компонентов в устройства для canvas
  const devices: Device[] = useMemo(() => {
    if (!selectedSchemaData?.components) return [];
    
    return selectedSchemaData.components
      .filter(comp => comp.type !== "zone" && comp.type !== "cable")
      .map(comp => ({
        id: comp.id,
        name: comp.name,
        type: comp.type,
        position: comp.position || { x: 0, y: 0 },
        portsIn: (comp.properties?.portsIn as Device["portsIn"]) || [],
        portsOut: (comp.properties?.portsOut as Device["portsOut"]) || [],
        manufacturer: comp.properties?.manufacturer as string,
        model: comp.properties?.model as string,
        properties: comp.properties,
      }));
  }, [selectedSchemaData]);

  // Преобразование компонентов в зоны
  const zones: Zone[] = useMemo(() => {
    if (!selectedSchemaData?.components) return [];
    
    return selectedSchemaData.components
      .filter(comp => comp.type === "zone")
      .map(comp => ({
        id: comp.id,
        name: comp.name,
        position: comp.position || { x: 0, y: 0 },
        width: comp.properties?.width as number || 300,
        height: comp.properties?.height as number || 200,
        color: comp.properties?.color as string,
      }));
  }, [selectedSchemaData]);

  // Преобразование соединений в кабели (нормализуем connections — с сервера может прийти строка JSON)
  const cables: Cable[] = useMemo(() => {
    if (!selectedSchemaData?.components) return [];
    
    const cableList: Cable[] = [];
    selectedSchemaData.components.forEach(comp => {
      const conns = normalizeConnections(comp.connections);
      if (conns && Array.isArray(conns)) {
        conns.forEach((conn: { componentId?: string; port?: string; fromPortId?: string; cableType?: string; protocol?: string }, index: number) => {
          if (conn.componentId && conn.port) {
            cableList.push({
              id: `${comp.id}-${conn.componentId}-${index}`,
              fromDeviceId: comp.id,
              fromPortId: conn.fromPortId ?? conn.port,
              toDeviceId: conn.componentId,
              toPortId: conn.port,
              cableType: conn.cableType,
              protocol: conn.protocol,
            });
          }
        });
      }
    });
    
    return cableList;
  }, [selectedSchemaData]);

  // Создание схемы
  const createSchemaMutation = useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      try {
        const response = await apiRequest("POST", "/api/connection-schemas", data);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Не удалось создать схему" }));
          throw new Error(errorData.message || "Не удалось создать схему");
        }
        const result = await response.json();
        return result;
      } catch (error: any) {
        console.error("Error creating schema:", error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      toast({ title: "Схема создана", description: "Схема подключения успешно создана" });
      setIsCreatingSchema(false);
      setNewSchemaName("");
      setNewSchemaDescription("");
      queryClient.invalidateQueries({ queryKey: ["/api/connection-schemas"] });
      await queryClient.refetchQueries({ queryKey: ["/api/connection-schemas"] });
      if (data?.id) {
        setSelectedSchema(data.id);
        setNewlyCreatedSchemaId(data.id);
        setIsFullScreen(true);
        setTimeout(() => setNewlyCreatedSchemaId(null), 2500);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать схему",
        variant: "destructive",
      });
    },
  });

  // Удаление схемы
  const deleteSchemaMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/connection-schemas/${id}`);
      if (!response.ok) {
        throw new Error("Не удалось удалить схему");
      }
      return response.json();
    },
    onSuccess: (_data, deletedId) => {
      toast({ title: "Схема удалена", description: "Схема подключения успешно удалена" });
      queryClient.removeQueries({ queryKey: ["/api/connection-schemas", deletedId] });
      queryClient.invalidateQueries({ queryKey: ["/api/connection-schemas"] });
      refetchSchemas();
      if (selectedSchema === deletedId) {
        setSelectedSchema(null);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: "Не удалось удалить схему",
        variant: "destructive",
      });
    },
  });

  const aiGenerateMutation = useMutation({
    mutationFn: async (prompt: string) => {
      if (!selectedSchema) throw new Error("Схема не выбрана");
      const response = await apiRequest("POST", `/api/connection-schemas/${selectedSchema}/ai-generate`, { prompt });
      return response.json();
    },
    onSuccess: async (data) => {
      toast({
        title: "Схема дополнена",
        description: `Добавлено блоков: ${data?.created?.length || 0}. Проверьте порты и поправьте при необходимости.`,
      });
      await refetchSelectedSchema();
    },
    onError: (error: any) => {
      toast({ title: "Не удалось собрать схему", description: error?.message || "Проверьте описание и попробуйте снова", variant: "destructive" });
    },
  });

  // Создание зоны
  const createZoneMutation = useMutation({
    mutationFn: async (data: {
      schemaId: string;
      type: string;
      name: string;
      position: { x: number; y: number };
      properties?: Record<string, any>;
    }) => {
      const response = await apiRequest("POST", `/api/connection-schemas/${data.schemaId}/components`, data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Не удалось создать зону" }));
        throw new Error(errorData.message || "Не удалось создать зону");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Зона создана", description: "Зона успешно добавлена в схему" });
      refetchSelectedSchema();
      setPendingZoneRect(null);
      setSelectedZoneId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось создать зону",
        variant: "destructive",
      });
    },
  });

  // Создание компонента (устройства)
  const createComponentMutation = useMutation({
    mutationFn: async (data: {
      schemaId: string;
      type: string;
      name: string;
      position: { x: number; y: number };
      properties?: Record<string, any>;
      connections?: any[];
    }) => {
      const response = await apiRequest("POST", `/api/connection-schemas/${data.schemaId}/components`, data);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Не удалось создать компонент" }));
        throw new Error(errorData.message || "Не удалось создать компонент");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Оборудование добавлено", description: "Оборудование успешно добавлено в схему" });
      refetchSelectedSchema();
      setIsAddingEquipment(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить оборудование",
        variant: "destructive",
      });
    },
  });

  // Обновление позиции устройства
  const updateDevicePosition = useMutation({
    mutationFn: async ({ id, position }: { id: string; position: { x: number; y: number } }) => {
      const component = selectedSchemaData?.components?.find(c => c.id === id);
      if (!component) throw new Error("Компонент не найден");
      
      const response = await apiRequest("PUT", `/api/connection-schemas/components/${id}`, {
        position,
        properties: component.properties,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Не удалось обновить устройство");
      }
      return response.json();
    },
    onSuccess: () => {
      refetchSelectedSchema();
    },
  });

  // Удаление компонента (устройство или зона)
  const deleteComponentMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/connection-schemas/components/${id}`);
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Не удалось удалить");
      }
    },
    onSuccess: (_data, id) => {
      setSelectedDeviceId((prev) => (prev === id ? null : prev));
      setSelectedZoneId((prev) => (prev === id ? null : prev));
      queryClient.invalidateQueries({ queryKey: ["/api/connection-schemas", selectedSchema] });
      refetchSelectedSchema();
      toast({ title: "Удалено" });
    },
    onError: (e: unknown) => {
      toast({ title: "Ошибка", description: (e as Error)?.message, variant: "destructive" });
    },
  });

  // Обновление компонента (имя, свойства — для зон и устройств)
  const updateComponentMutation = useMutation({
    mutationFn: async ({ id, name, properties }: { id: string; name?: string; properties?: Record<string, unknown> }) => {
      const component = selectedSchemaData?.components?.find(c => c.id === id);
      if (!component) throw new Error("Компонент не найден");
      const response = await apiRequest("PUT", `/api/connection-schemas/components/${id}`, {
        position: component.position,
        name: name !== undefined ? name : component.name,
        properties: properties !== undefined ? properties : component.properties,
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.message || "Не удалось обновить");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connection-schemas", selectedSchema] });
      refetchSelectedSchema();
      toast({ title: "Сохранено" });
    },
    onError: (e: unknown) => {
      toast({ title: "Ошибка", description: (e as Error)?.message, variant: "destructive" });
    },
  });

  // Добавление соединения (кабель) между портами
  const addConnectionMutation = useMutation({
    mutationFn: async (payload: {
      fromDeviceId: string;
      toDeviceId: string;
      fromPortId: string;
      toPortId: string;
      cableType?: string;
      protocol?: string;
    }) => {
      const component = selectedSchemaData?.components?.find(c => c.id === payload.fromDeviceId);
      if (!component) throw new Error("Устройство не найдено");
      const connections = [...normalizeConnections(component.connections)];
      const alreadyExists = connections.some((connection) =>
        connection.componentId === payload.toDeviceId &&
        connection.port === payload.toPortId &&
        (connection.fromPortId ?? connection.port) === payload.fromPortId
      );
      if (alreadyExists) {
        throw new Error("Соединение уже существует");
      }
      connections.push({
        componentId: payload.toDeviceId,
        port: payload.toPortId,
        fromPortId: payload.fromPortId,
        cableType: payload.cableType,
        protocol: payload.protocol,
      });
      const response = await apiRequest("PUT", `/api/connection-schemas/components/${payload.fromDeviceId}`, {
        position: component.position,
        properties: component.properties,
        connections,
      });
      if (!response.ok) throw new Error("Не удалось создать соединение");
      return response.json();
    },
    onMutate: async (payload) => {
      if (!selectedSchema) return;
      await queryClient.cancelQueries({ queryKey: ["/api/connection-schemas", selectedSchema] });
      const prev = queryClient.getQueryData<ConnectionSchema>(["/api/connection-schemas", selectedSchema]);
      if (!prev?.components) return { prev };
      const nextComponents = prev.components.map((c) => {
        if (c.id !== payload.fromDeviceId) return c;
        const connections = [...normalizeConnections(c.connections)];
        const alreadyExists = connections.some((connection) =>
          connection.componentId === payload.toDeviceId &&
          connection.port === payload.toPortId &&
          (connection.fromPortId ?? connection.port) === payload.fromPortId
        );
        if (alreadyExists) return c;
        connections.push({
          componentId: payload.toDeviceId,
          port: payload.toPortId,
          fromPortId: payload.fromPortId,
          cableType: payload.cableType,
          protocol: payload.protocol,
        });
        return { ...c, connections };
      });
      queryClient.setQueryData<ConnectionSchema>(["/api/connection-schemas", selectedSchema], {
        ...prev,
        components: nextComponents,
      });
      return { prev };
    },
    onError: (_e, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["/api/connection-schemas", selectedSchema], context.prev);
      }
      toast({ title: "Ошибка", description: "Не удалось создать соединение", variant: "destructive" });
    },
    onSettled: () => {
      if (selectedSchema) {
        queryClient.invalidateQueries({ queryKey: ["/api/connection-schemas", selectedSchema] });
        refetchSelectedSchema();
      }
    },
    onSuccess: () => {
      toast({ title: "Соединение создано" });
    },
  });

  const handleCreateSchema = () => {
    if (!newSchemaName.trim()) {
      toast({
        title: "Ошибка",
        description: "Введите название схемы",
        variant: "destructive",
      });
      return;
    }
    createSchemaMutation.mutate({
      name: newSchemaName.trim(),
      description: newSchemaDescription.trim() || undefined,
    });
  };

  const handleAddEquipment = (equipment: {
    id?: string;
    name: string;
    manufacturer?: string;
    model?: string;
    type: string;
    portsIn: Array<{ id: string; name: string; type: "in" | "out"; portType?: string }>;
    portsOut: Array<{ id: string; name: string; type: "in" | "out"; portType?: string }>;
    specifications?: Record<string, any>;
  }) => {
    if (!selectedSchema) {
      toast({
        title: "Ошибка",
        description: "Выберите схему",
        variant: "destructive",
      });
      return;
    }

    // Размещаем в центре текущего вида (как в Figma), чтобы не переносить пользователя на другой край
    const center = schemaCanvasRef.current?.getViewportCenter();
    const x = center ? Math.round(center.x - 100) : Math.floor(devices.length / 3) * 250 + 50;
    const y = center ? Math.round(center.y - 40) : (devices.length % 3) * 150 + 50;

    createComponentMutation.mutate({
      schemaId: selectedSchema,
      type: equipment.type,
      name: equipment.name,
      position: { x, y },
      properties: {
        manufacturer: equipment.manufacturer,
        model: equipment.model,
        portsIn: equipment.portsIn.filter((port): port is { id: string; name: string; type: "in"; portType?: string } => port.type === "in"),
        portsOut: equipment.portsOut.filter((port): port is { id: string; name: string; type: "out"; portType?: string } => port.type === "out"),
        ...equipment.specifications,
      },
      connections: [],
    });
  };

  const handleDeviceUpdate = (deviceId: string, position: { x: number; y: number }) => {
    updateDevicePosition.mutate({ id: deviceId, position });
  };

  const handleDeleteComponent = async (id: string) => {
    const component = selectedSchemaData?.components?.find((item) => item.id === id);
    const name = component?.name || "элемент";
    const confirmed = await confirmAction({
      title: `Удалить «${name}» из схемы?`,
      description: "Элемент и связанные с ним соединения будут удалены.",
      confirmLabel: "Удалить",
      destructive: true,
    });
    if (confirmed) deleteComponentMutation.mutate(id);
  };

  const handleAddZone = (zone: Omit<Zone, "id">) => {
    if (!selectedSchema) {
      toast({
        title: "Ошибка",
        description: "Выберите схему",
        variant: "destructive",
      });
      return;
    }

    createZoneMutation.mutate({
      schemaId: selectedSchema,
      type: "zone",
      name: zone.name,
      position: zone.position,
      properties: {
        width: zone.width,
        height: zone.height,
        color: zone.color,
      },
    });
  };

  const handleZoneDrawn = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    setDrawZoneMode(false);
    setPendingZoneRect(rect);
    setDrawnZoneName("Зона");
    setDrawnZoneColor("#3b82f6");
  }, []);

  const handleAddConnection = useCallback(
    (from: { deviceId: string; portId: string }, to: { deviceId: string; portId: string }, protocol?: string) => {
      addConnectionMutation.mutate({
        fromDeviceId: from.deviceId,
        toDeviceId: to.deviceId,
        fromPortId: from.portId,
        toPortId: to.portId,
        protocol,
      });
    },
    [addConnectionMutation]
  );

  const confirmDrawnZone = () => {
    if (!selectedSchema || !pendingZoneRect) return;
    if (!drawnZoneName.trim()) {
      toast({ title: "Ошибка", description: "Введите название зоны", variant: "destructive" });
      return;
    }
    createZoneMutation.mutate({
      schemaId: selectedSchema,
      type: "zone",
      name: drawnZoneName.trim(),
      position: { x: pendingZoneRect.x, y: pendingZoneRect.y },
      properties: {
        width: pendingZoneRect.width,
        height: pendingZoneRect.height,
        color: drawnZoneColor,
      },
    });
    setPendingZoneRect(null);
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] min-w-0 space-y-4 overflow-x-hidden px-2 py-3 sm:px-4 sm:py-4">
      <div className="space-y-4">
        {/* Заголовок */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="truncate text-2xl font-semibold tracking-[-0.02em] text-foreground">
              Схемы подключения
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Создание и управление схемами подключения оборудования
            </p>
          </div>
          <Dialog open={isCreatingSchema} onOpenChange={setIsCreatingSchema}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreatingSchema(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Создать схему
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новая схема подключения</DialogTitle>
                <DialogDescription>
                  Создайте новую схему для визуализации подключений оборудования
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Название схемы *</Label>
                  <Input 
                    placeholder="Например: NEW YEAR" 
                    value={newSchemaName}
                    onChange={(e) => setNewSchemaName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Описание</Label>
                  <Input 
                    placeholder="Описание схемы (опционально)" 
                    value={newSchemaDescription}
                    onChange={(e) => setNewSchemaDescription(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button 
                    className="flex-1" 
                    onClick={handleCreateSchema}
                    disabled={createSchemaMutation.isPending}
                  >
                    {createSchemaMutation.isPending ? "Создание..." : "Создать"}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsCreatingSchema(false)}
                    disabled={createSchemaMutation.isPending}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Полноэкранный холст */}
        {isFullScreen && selectedSchemaData && (
          <div className="fixed inset-0 z-50 flex flex-col bg-surface-base">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-surface-raised px-3 py-2 shadow-xs">
              <span className="truncate font-medium text-foreground">{selectedSchemaData.name} — полноэкранный режим</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <AddEquipmentDialog
                  open={isAddingEquipment}
                  onClose={() => setIsAddingEquipment(false)}
                  onAdd={handleAddEquipment}
                />
                <Button
                  size="sm"
                  onClick={() => setIsAddingEquipment(true)}
                  className="border-border/50 bg-surface-overlay text-foreground hover:bg-surface-subtle"
                >
                  <Package className="w-4 h-4 sm:mr-2" />
                  Оборудование
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={aiGenerateMutation.isPending}
                  onClick={async () => {
                    const prompt = await promptAction({
                      title: "Собрать схему с помощью AI",
                      description: "Опишите оборудование, количество и нужные типы соединений.",
                      label: "Описание схемы",
                      placeholder: "Например: 4 камеры SDI, ATEM Mini, vMix, роутер, 2 микрофона",
                      confirmLabel: "Собрать",
                      required: true,
                    });
                    if (prompt) aiGenerateMutation.mutate(prompt);
                  }}
                  className="border-border/50 bg-surface-raised text-foreground hover:bg-surface-overlay"
                >
                  <BrainCircuit className="w-4 h-4 sm:mr-2" />
                  AI
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDrawZoneMode(true)}
                  className="border-border/50 bg-surface-raised text-foreground hover:bg-surface-overlay"
                  title="Выделить прямоугольник на схеме"
                >
                  <Square className="w-4 h-4 sm:mr-2" />
                  Выделить зону
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsFullScreen(false)}
                  className="border-border/50 bg-surface-raised text-foreground hover:bg-surface-overlay"
                >
                  <Minimize2 className="w-4 h-4 mr-2" />
                  Выйти
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              <SchemaCanvas
                ref={schemaCanvasRef}
                schemaId={selectedSchemaData.id}
                devices={devices}
                zones={zones}
                cables={cables}
                onDeviceUpdate={handleDeviceUpdate}
                onDeviceSelect={setSelectedDeviceId}
                selectedDeviceId={selectedDeviceId}
                fullScreen
                drawZoneMode={drawZoneMode}
                onZoneDrawn={handleZoneDrawn}
                onCancelDrawZone={() => setDrawZoneMode(false)}
                onAddConnection={handleAddConnection}
                onZoneSelect={setSelectedZoneId}
                selectedZoneId={selectedZoneId}
                onDeviceDelete={handleDeleteComponent}
              />
            </div>
            {/* Редактирование зоны или устройства в полноэкранном режиме */}
            {(selectedZoneId || selectedDeviceId) && (
              <div className="absolute bottom-4 left-1/2 z-50 flex min-w-[240px] -translate-x-1/2 flex-col gap-2 rounded-dialog border border-border/60 bg-surface-overlay p-3 shadow-overlay">
                {selectedZoneId && (() => {
                  const zone = zones.find((z) => z.id === selectedZoneId);
                  if (!zone) return null;
                  return (
                    <ZoneEditForm
                      zone={zone}
                      onSave={(name, color) => {
                        const comp = selectedSchemaData?.components?.find((c) => c.id === zone.id);
                        if (!comp || !selectedSchema) return;
                        updateComponentMutation.mutate({
                          id: zone.id,
                          name,
                          properties: { ...comp.properties, width: zone.width, height: zone.height, color },
                        });
                        setSelectedZoneId(null);
                      }}
                      onClose={() => setSelectedZoneId(null)}
                    />
                  );
                })()}
                {selectedDeviceId && !selectedZoneId && (() => {
                  const device = devices.find((d) => d.id === selectedDeviceId);
                  if (!device) return null;
                  return (
                    <DeviceEditForm
                      device={device}
                      onSave={(data) => {
                        const comp = selectedSchemaData?.components?.find((c) => c.id === device.id);
                        if (!comp) return;
                        updateComponentMutation.mutate({
                          id: device.id,
                          name: data.name,
                          properties: {
                            ...comp.properties,
                            width: data.width,
                            height: data.height,
                            portsIn: data.portsIn,
                            portsOut: data.portsOut,
                          },
                        });
                        setSelectedDeviceId(null);
                      }}
                      onClose={() => setSelectedDeviceId(null)}
                    />
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Диалог названия зоны после выделения на схеме */}
        <Dialog open={!!pendingZoneRect} onOpenChange={(open) => !open && setPendingZoneRect(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Название зоны</DialogTitle>
              <DialogDescription>Выделена область на схеме. Введите название и цвет.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Название *</Label>
                <Input
                  value={drawnZoneName}
                  onChange={(e) => setDrawnZoneName(e.target.value)}
                  placeholder="Например: Студия А"
                />
              </div>
              <div>
                <StreamColorPicker
                  id="drawn-zone-color"
                  label="Цвет"
                  ariaLabel="Цвет выделенной зоны"
                  value={drawnZoneColor}
                  onChange={setDrawnZoneColor}
                />
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={confirmDrawnZone}>
                  Создать зону
                </Button>
                <Button variant="outline" onClick={() => setPendingZoneRect(null)}>
                  Отмена
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 min-h-0 h-[calc(100vh-180px)] sm:h-[calc(100vh-200px)]">
          {/* Список схем — на мобильном сверху, компактно */}
          <div className="lg:col-span-1 min-w-0 flex flex-col min-h-[140px] sm:min-h-0">
            <Card className="flex min-h-0 flex-1 flex-col border-border/50 bg-surface-raised shadow-xs">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="text-base sm:text-lg">Схемы</CardTitle>
                <CardDescription className="text-xs sm:text-sm">Выберите схему для редактирования</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 flex-1 overflow-y-auto hide-scrollbar p-3 sm:p-6 pt-0">
                {schemas.length > 0 ? (
                  schemas.map((schema) => (
                    <div
                      key={schema.id}
                      ref={(el) => {
                        if (el && newlyCreatedSchemaId === schema.id) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      }}
                      className={cn(
                        "cursor-pointer rounded-control border p-3 transition-[border-color,background-color,box-shadow] duration-150",
                        selectedSchema === schema.id
                          ? "border-primary/50 bg-primary/10 shadow-xs"
                          : "border-border/40 bg-surface-subtle hover:border-border/70 hover:bg-surface-overlay",
                        newlyCreatedSchemaId === schema.id && "ring-2 ring-primary ring-offset-2 animate-pulse"
                      )}
                      onClick={() => {
                        setSelectedSchema(schema.id);
                        setIsFullScreen(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{schema.name}</h3>
                          {schema.description && (
                            <p className="text-sm text-muted-foreground truncate">{schema.description}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmed = await confirmAction({
                              title: `Удалить схему «${schema.name}»?`,
                              description: "Схема, её оборудование, зоны и соединения будут удалены.",
                              confirmLabel: "Удалить",
                              destructive: true,
                            });
                            if (confirmed) deleteSchemaMutation.mutate(schema.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-error" />
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Нет созданных схем</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Редактор схемы: канвас с перемещением и рисованием */}
          <div className="lg:col-span-3 min-h-0 flex flex-col min-w-0">
            {selectedSchemaData ? (
              <Card className="flex min-h-[320px] flex-1 flex-col border-border/50 bg-surface-raised shadow-xs sm:min-h-[420px] md:min-h-[520px]">
                <CardHeader className="p-3 sm:p-6">
                  <div className="flex flex-col gap-3 sm:gap-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg truncate">{selectedSchemaData.name}</CardTitle>
                      {selectedSchemaData.description && (
                        <CardDescription className="mt-1 truncate">{selectedSchemaData.description}</CardDescription>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 hidden sm:block">
                        Перетаскивайте блоки; зум и панорама — в панели над схемой.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <AddEquipmentDialog
                        open={isAddingEquipment}
                        onClose={() => setIsAddingEquipment(false)}
                        onAdd={handleAddEquipment}
                      />
                      <Button size="sm" className="h-9 touch-manipulation" onClick={() => setIsAddingEquipment(true)}>
                        <Package className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Оборудование</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 touch-manipulation"
                        disabled={aiGenerateMutation.isPending}
                        onClick={async () => {
                          const prompt = await promptAction({
                            title: "Собрать схему с помощью AI",
                            description: "Опишите оборудование, количество и нужные типы соединений.",
                            label: "Описание схемы",
                            placeholder: "Оборудование, количество, SDI/HDMI/LAN/звук",
                            confirmLabel: "Собрать",
                            required: true,
                          });
                          if (prompt) aiGenerateMutation.mutate(prompt);
                        }}
                      >
                        <BrainCircuit className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">AI схема</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 touch-manipulation"
                        onClick={() => setDrawZoneMode(true)}
                        title="Выделить прямоугольник на схеме"
                      >
                        <Square className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Выделить зону</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 touch-manipulation"
                        onClick={() => setIsFullScreen(true)}
                        title="На весь экран"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 touch-manipulation hidden md:inline-flex">
                        <Type className="w-4 h-4 mr-2" />
                        Текст
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 touch-manipulation hidden md:inline-flex">
                        <Wrench className="w-4 h-4 mr-2" />
                        Собрать
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 p-0 overflow-hidden">
                  <SchemaCanvas
                    ref={schemaCanvasRef}
                    schemaId={selectedSchemaData.id}
                    devices={devices}
                    zones={zones}
                    cables={cables}
                    onDeviceUpdate={handleDeviceUpdate}
                    onDeviceSelect={setSelectedDeviceId}
                    selectedDeviceId={selectedDeviceId}
                    fullScreen={false}
                    drawZoneMode={drawZoneMode}
                    onZoneDrawn={handleZoneDrawn}
                    onCancelDrawZone={() => setDrawZoneMode(false)}
                    onAddConnection={handleAddConnection}
                    onZoneSelect={setSelectedZoneId}
                    selectedZoneId={selectedZoneId}
                    onDeviceDelete={handleDeleteComponent}
                  />
                </CardContent>
              </Card>
            ) : (
              <Card className="flex h-full items-center justify-center border-dashed border-border/60 bg-surface-raised shadow-xs">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Network className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Выберите схему для редактирования</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
