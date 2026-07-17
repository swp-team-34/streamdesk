import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { StreamMultiSelect } from "@/components/ui/stream-multi-select";
import { insertEquipmentSchema } from "@shared/schema";
import { canCreateEquipment, canEditEquipment, canReserveEquipment } from "@/lib/equipment-permissions";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PhotoUpload } from "@/components/equipment/photo-upload";
import { useState, useEffect, useRef } from "react";
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";
import { z } from "zod";
import { QrCode, Download, Printer, RefreshCw, ScanBarcode, MapPin, AlertTriangle } from "lucide-react";
import {
  downloadBarcodeLabelPng,
  openBarcodePrintWindow,
  renderCompactBarcodeLabel,
  sanitizeBarcodeFilePart,
} from "@/lib/barcode-label";
import {
  asEquipmentRecord as asRecord,
  getEquipmentEstimatePrice as getEstimatePriceValue,
  getEquipmentInventoryPrefix as getInventoryPrefix,
  getEquipmentOperabilityStatus,
  isInternalEquipmentSpecificationKey as isInternalSpecificationKey,
  parseEquipmentSpecifications as parseSpecifications,
  readCurrentEquipmentUser as getCurrentUser,
  serializeEquipmentSpecifications as serializeSpecifications,
  type EquipmentFormProps,
} from "@/lib/equipment-form-model";

const equipmentFormSchema = insertEquipmentSchema.extend({
  specifications: z.record(z.string()).optional(),
});

export function EquipmentForm({
  isOpen,
  onClose,
  onOpenParentBundle,
  parentBundleExists,
  equipment,
  mode = "full",
  companyManager = false,
  companyId = "",
  categories = [],
  storageLocations = [],
  locations = [],
  projects = [],
  kanbanCards = [],
}: EquipmentFormProps) {
  const [photos, setPhotos] = useState<string[]>(equipment?.photos || []);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [barcodeValue, setBarcodeValue] = useState("");
  const [specificationsText, setSpecificationsText] = useState("");
  const [estimatePrice, setEstimatePrice] = useState("");
  const [destinationChoice, setDestinationChoice] = useState("");
  const [manualLocation, setManualLocation] = useState("");
  const [contextProjectId, setContextProjectId] = useState("none");
  const [contextCardIds, setContextCardIds] = useState<Set<string>>(new Set());
  const [autosaveReady, setAutosaveReady] = useState(false);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  useEffect(() => {
    setAutosaveReady(false);
    if (!isOpen) return;
    if (equipment) {
      setPhotos(equipment.photos || []);
      const existingBarcode = equipment.barcode || equipment.inventoryNumber || equipment.serialNumber || "";
      setBarcodeValue(existingBarcode);
      setSpecificationsText(serializeSpecifications(equipment.specifications));
      setEstimatePrice(getEstimatePriceValue(equipment.specifications));
      const destination = asRecord(equipment.physicalDestination);
      const locationId = String(destination.locationId || equipment.locationId || "").trim();
      const currentManualLocation = String(
        destination.manualLocation ||
        equipment.manualLocation ||
        (!locationId ? destination.legacyLocation || equipment.location : "") ||
        "",
      ).trim();
      setDestinationChoice(locationId || (currentManualLocation ? "manual" : ""));
      setManualLocation(currentManualLocation);
      const activeManualLinks = Array.isArray(asRecord(equipment.workContext).links)
        ? (asRecord(equipment.workContext).links as any[])
            .filter((link) => link.active && link.source === "manual")
        : [];
      const projectId = String(activeManualLinks.find((link) => link.projectId)?.projectId || "").trim();
      setContextProjectId(projectId || "none");
      setContextCardIds(new Set(
        activeManualLinks.map((link) => String(link.kanbanCardId || "").trim()).filter(Boolean),
      ));
    } else {
      setPhotos([]);
      setBarcodeValue("");
      setSpecificationsText("");
      setEstimatePrice("");
      setDestinationChoice("");
      setManualLocation("");
      setContextProjectId("none");
      setContextCardIds(new Set());
    }
    const readyTimer = window.setTimeout(() => setAutosaveReady(true), 0);
    return () => window.clearTimeout(readyTimer);
  }, [isOpen, equipment]);

  useEffect(() => {
    if (!isOpen || !barcodeRef.current || !barcodeValue || barcodeValue.length < 3) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      if (!barcodeRef.current) return;
      try {
        renderCompactBarcodeLabel(barcodeRef.current, barcodeValue);
      } catch (error) {
        console.error("Error generating barcode:", error);
      }
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, barcodeValue]);

  const form = useForm<z.infer<typeof equipmentFormSchema>>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: equipment?.name || "",
      type: equipment?.type || "other",
      categoryId: equipment?.categoryId || null,
      model: equipment?.model || "",
      serialNumber: equipment?.serialNumber || "",
      inventoryNumber: equipment?.inventoryNumber || "",
      specifications: equipment?.specifications || {},
      notes: equipment?.notes || "",
      status: equipment?.status || "available",
      operabilityStatus: equipment?.operabilityStatus || (equipment?.status === "broken" ? "broken" : equipment?.status === "maintenance" ? "on_repair" : "working"),
      location: equipment?.location || "",
      storageLocation: equipment?.storageLocation || "",
      storageLocationId: equipment?.storageLocationId || null,
      responsiblePerson: equipment?.responsiblePerson || "",
      responsibleContact: equipment?.responsibleContact || "",
    },
  });

  useEffect(() => {
    if (equipment && isOpen) {
      form.reset({
        name: equipment.name || "",
        type: equipment.type || "other",
        categoryId: equipment.categoryId || null,
        model: equipment.model || "",
        serialNumber: equipment.serialNumber || "",
        inventoryNumber: equipment.inventoryNumber || "",
        specifications: equipment.specifications || {},
        notes: equipment.notes || "",
        status: equipment.status || "available",
        operabilityStatus: equipment.operabilityStatus || (equipment.status === "broken" ? "broken" : equipment.status === "maintenance" ? "on_repair" : "working"),
        location: equipment.location || "",
        storageLocation: equipment.storageLocation || "",
        storageLocationId: equipment.storageLocationId || null,
        responsiblePerson: equipment.responsiblePerson || "",
        responsibleContact: equipment.responsibleContact || "",
      });
    } else if (!equipment && isOpen) {
      form.reset({
        name: "",
        type: "other",
        categoryId: null,
        model: "",
        serialNumber: "",
        inventoryNumber: "",
        specifications: {},
        notes: "",
        status: "available",
        operabilityStatus: "working",
        location: "",
        storageLocation: "",
        storageLocationId: null,
        responsiblePerson: "",
        responsibleContact: "",
      });
    }
  }, [equipment, isOpen, form]);

  const inventoryNumber = form.watch("inventoryNumber");
  const serialNumber = form.watch("serialNumber");

  useEffect(() => {
    const newBarcodeValue = inventoryNumber || serialNumber || "";
    if (newBarcodeValue !== barcodeValue) {
      setBarcodeValue(newBarcodeValue);
    }
  }, [inventoryNumber, serialNumber]);

  const userCanCreate = canCreateEquipment(currentUser) || companyManager;
  const userCanEdit = canEditEquipment(currentUser) || companyManager;
  const userCanReserve = canReserveEquipment(currentUser) || companyManager;
  const canManageBarcode = userCanEdit || (!equipment && userCanCreate);
  const equipmentCompanyId = String(asRecord(equipment?.specifications).companyId || companyId || "").trim();
  const currentDestination = asRecord(equipment?.physicalDestination);
  const currentLocationId = String(currentDestination.locationId || equipment?.locationId || "").trim();
  const currentCategoryId = String(equipment?.categoryId || "").trim();
  const currentStorageLocationId = String(equipment?.storageLocationId || "").trim();
  const categoryById = new Map(categories.map((category) => [String(category.id), category]));
  const availableCategories = categories.filter((category) =>
    !category.archivedAt || String(category.id) === currentCategoryId,
  );
  const availableStorageLocations = storageLocations.filter((location) =>
    !location.archivedAt || String(location.id) === currentStorageLocationId,
  );
  const availableLocations = locations.filter((location) =>
    (!equipmentCompanyId || String(location.companyId || "") === equipmentCompanyId) &&
    (!location.archivedAt || String(location.id) === currentLocationId),
  );
  const availableProjects = projects.filter((project) =>
    (!equipmentCompanyId || String(project.companyId || "") === equipmentCompanyId) &&
    String(project.status || "") !== "archived",
  );
  const cardProjectId = (card: NonNullable<EquipmentFormProps["kanbanCards"]>[number]) =>
    String(card.projectId || card.boardProjectId || "").trim();
  const availableKanbanCards = kanbanCards.filter((card) =>
    (!equipmentCompanyId || String(card.companyId || "") === equipmentCompanyId) &&
    (contextProjectId === "none" || cardProjectId(card) === contextProjectId),
  );

  const changeContextProject = (projectId: string) => {
    setContextProjectId(projectId);
    if (projectId === "none") return;
    setContextCardIds((current) => new Set(
      [...current].filter((cardId) => {
        const card = kanbanCards.find((entry) => entry.id === cardId);
        return card && cardProjectId(card) === projectId;
      }),
    ));
  };

  const changeContextCards = (nextCardIds: string[]) => {
    const addedCardId = nextCardIds.find((cardId) => !contextCardIds.has(cardId));
    const addedCard = addedCardId ? kanbanCards.find((card) => card.id === addedCardId) : null;
    const projectId = addedCard ? cardProjectId(addedCard) : "";
    if (addedCard && contextProjectId === "none" && projectId) {
      setContextProjectId(projectId);
      setContextCardIds(new Set(
        nextCardIds.filter((cardId) => {
          const selectedCard = kanbanCards.find((entry) => entry.id === cardId);
          return selectedCard && cardProjectId(selectedCard) === projectId;
        }),
      ));
      return;
    }
    setContextCardIds(new Set(nextCardIds));
  };

  const physicalDestinationPayload = () => destinationChoice === "manual"
    ? { manualLocation: manualLocation.trim() || null, locationId: null }
    : destinationChoice
      ? { locationId: destinationChoice, manualLocation: null }
      : { locationId: null, manualLocation: null };

  const workContextPayload = () => ({
    projectId: contextProjectId === "none" ? null : contextProjectId,
    kanbanCardIds: [...contextCardIds],
  });

  const buildGeneratedInventoryNumber = (data: z.infer<typeof equipmentFormSchema>) => {
    const prefix = getInventoryPrefix(data.type);
    const suffix = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    return `${prefix}_${suffix}`;
  };

  const buildEquipmentPayload = (data: z.infer<typeof equipmentFormSchema>) => {
    const inventoryNumber = String(data.inventoryNumber ?? "").trim() ||
      String(equipment?.inventoryNumber || "").trim() ||
      buildGeneratedInventoryNumber(data);
    const nextBarcode = canManageBarcode ? (barcodeValue.trim() || inventoryNumber) : equipment?.barcode;
    const preservedInternalSpecifications = Object.fromEntries(
      Object.entries(asRecord(equipment?.specifications)).filter(([key]) => isInternalSpecificationKey(key)),
    );
    return {
      ...data,
      inventoryNumber,
      specifications: {
        ...preservedInternalSpecifications,
        ...parseSpecifications(specificationsText),
        ...(estimatePrice.trim() ? { estimatePrice: estimatePrice.trim(), estimateCurrency: "RUB" } : {}),
      },
      notes: String(data.notes ?? "").trim(),
      photos,
      barcode: nextBarcode,
      physicalDestination: physicalDestinationPayload(),
      workContext: workContextPayload(),
    };
  };

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof equipmentFormSchema>) => {
      const payload = buildEquipmentPayload(data);
      const response = await apiRequest("POST", "/api/equipment", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.refetchQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Успешно",
        description: "Оборудование добавлено",
      });
      onClose();
      form.reset();
      setPhotos([]);
      setBarcodeValue("");
      setSpecificationsText("");
      setEstimatePrice("");
    },
    onError: (error: any) => {
      console.error("Error creating equipment:", error);
      let errorMessage = "Не удалось добавить оборудование";
      
      if (error.message) {
        if (error.message.includes("timeout") || error.message.includes("время ожидания")) {
          errorMessage = "Операция заняла слишком много времени. Попробуйте снова или проверьте подключение к серверу.";
        } else if (error.message.includes("400")) {
          errorMessage = "Неверные данные. Проверьте заполнение всех обязательных полей.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Ошибка",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ payload }: { payload: Record<string, unknown>; silent?: boolean }) => {
      const response = await apiRequest("PUT", `/api/equipment/${equipment.id}`, payload);
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (!variables.silent) {
        toast({ title: "Успешно", description: "Оборудование обновлено" });
      }
    },
    onError: (error: any, variables) => {
      if (!variables.silent) {
        toast({
          title: "Ошибка",
          description: error.message || "Не удалось обновить оборудование",
          variant: "destructive",
        });
      }
    },
  });

  const watchedEquipmentValues = form.watch();
  const parsedAutosaveValues = equipmentFormSchema.safeParse(watchedEquipmentValues);
  const equipmentAutosaveValue = {
    formValues: watchedEquipmentValues,
    barcodeValue,
    specificationsText,
    estimatePrice,
    photos,
    destinationChoice,
    manualLocation,
    contextProjectId,
    contextCardIds: [...contextCardIds].sort(),
    payload: parsedAutosaveValues.success ? buildEquipmentPayload(parsedAutosaveValues.data) : null,
    validationError: parsedAutosaveValues.success
      ? ""
      : parsedAutosaveValues.error.issues[0]?.message || "Проверьте данные оборудования",
  };
  const equipmentAutosave = useDebouncedAutosave({
    enabled: autosaveReady && isOpen && mode === "full" && Boolean(equipment?.id),
    resetKey: `${equipment?.id || "new"}:${isOpen ? "open" : "closed"}`,
    source: `equipment:${equipment?.id || "new"}`,
    value: equipmentAutosaveValue,
    validate: (snapshot) => {
      if (!snapshot.payload || !String(snapshot.formValues.name || "").trim()) {
        return { ok: false as const, error: snapshot.validationError || "Введите название оборудования" };
      }
      if (snapshot.destinationChoice === "manual" && !snapshot.manualLocation.trim()) {
        return { ok: false as const, error: "Укажите ручное местоположение" };
      }
      return { ok: true as const, payload: snapshot.payload };
    },
    save: async (payload) => {
      await updateMutation.mutateAsync({ payload, silent: true });
    },
  });

  const takeReturnMutation = useMutation({
    mutationFn: async (data: { action: 'take' | 'return' }) => {
      const response = await apiRequest("PUT", `/api/equipment/${equipment.id}`, {
        status: data.action === 'take' ? 'in-use' : 'available',
        ...(data.action === "take"
          ? {
              physicalDestination: physicalDestinationPayload(),
              workContext: workContextPayload(),
            }
          : {
              storageLocationId: form.getValues("storageLocationId") || null,
              storageLocation: String(form.getValues("storageLocation") || "").trim() || null,
            }),
        assignedTo: data.action === 'take' ? currentUser?.id : null,
        lastUsed: new Date(),
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.refetchQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Успешно",
        description: variables.action === 'take' ? "Оборудование взято" : "Оборудование возвращено",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить оборудование",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: z.infer<typeof equipmentFormSchema>) => {
    if (destinationChoice === "manual" && !manualLocation.trim()) {
      toast({
        title: "Укажите местоположение",
        description: "Заполните ручное местоположение или выберите площадку.",
        variant: "destructive",
      });
      return;
    }
    if (equipment) {
      await equipmentAutosave.flush();
      return;
    }
    createMutation.mutate(data);
  };

  const requestClose = async () => {
    if (equipment && mode === "full") {
      const saved = await equipmentAutosave.flush();
      if (!saved) {
        toast({
          title: "Изменения не сохранены",
          description: equipmentAutosave.error || "Исправьте данные или повторите сохранение.",
          variant: "destructive",
        });
        return;
      }
    }
    onClose();
  };

  const handleTakeReturn = (action: 'take' | 'return') => {
    if (action === "take" && getEquipmentOperabilityStatus(equipment) !== "working") {
      toast({
        title: "Недоступно для выдачи",
        description: getEquipmentOperabilityStatus(equipment) === "broken"
          ? "Оборудование помечено как неисправное."
          : "Оборудование находится в ремонте.",
        variant: "destructive",
      });
      return;
    }
    if (action === "take" && (!destinationChoice || (destinationChoice === "manual" && !manualLocation.trim()))) {
      toast({
        title: "Укажите локацию",
        description: "Выберите площадку или укажите место вручную.",
        variant: "destructive",
      });
      return;
    }
    if (
      action === "return" &&
      !String(form.getValues("storageLocationId") || "").trim() &&
      !String(form.getValues("storageLocation") || "").trim()
    ) {
      toast({
        title: "Укажите место хранения",
        description: "Выберите полку или стеллаж либо укажите место вручную.",
        variant: "destructive",
      });
      return;
    }
    takeReturnMutation.mutate({ action });
  };

  const generateBarcode = () => {
    if (!canManageBarcode) return;
    const newValue = buildGeneratedInventoryNumber(form.getValues());
    setBarcodeValue(newValue);
    form.setValue("inventoryNumber", newValue);
  };

  const handleDownloadBarcode = () => {
    if (!barcodeRef.current) return;
    downloadBarcodeLabelPng(barcodeRef.current, `barcode-${sanitizeBarcodeFilePart(barcodeValue)}.png`);
  };

  const handlePrintBarcode = () => {
    if (!barcodeRef.current) return;
    const name = form.getValues("name") || "Оборудование";
    const model = form.getValues("model") || "";
    openBarcodePrintWindow({ svg: barcodeRef.current, name, model });
  };

  const isTakeReturnMode = mode === "take_return" && userCanReserve;
  const equipmentSpecifications = asRecord(equipment?.specifications);
  const parentBundleId = String(equipmentSpecifications.parentBundleId || "").trim();
  const parentBundleName = String(equipmentSpecifications.parentBundleName || "Комплект").trim();
  const returnViaParentBundle = equipment?.status === "in-use" &&
    Boolean(parentBundleId) &&
    parentBundleExists !== false;

  const renderDestinationAndContext = (includeWorkContext: boolean) => (
    <div className="space-y-4 rounded-surface border border-border/50 bg-surface-subtle p-4">
      <div className="space-y-2">
        <div className="text-sm font-medium text-foreground">
          <MapPin className="mr-1 inline h-4 w-4" />
          Физическое местоположение
        </div>
        <Select
          value={destinationChoice || "none"}
          onValueChange={(value) => {
            setDestinationChoice(value === "none" ? "" : value);
            if (value !== "manual") setManualLocation("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Выберите площадку или ручной ввод" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Не указано</SelectItem>
            {availableLocations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}{location.archivedAt ? " · в архиве" : ""}
              </SelectItem>
            ))}
            <SelectItem value="manual">Указать место вручную</SelectItem>
          </SelectContent>
        </Select>
        {destinationChoice === "manual" && (
          <Input
            value={manualLocation}
            onChange={(event) => setManualLocation(event.target.value)}
            placeholder="Например: выездная площадка, монтажная 2"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Это место назначения оборудования. Полка или стеллаж указываются отдельно в поле хранения.
        </p>
      </div>

      {includeWorkContext && (
        <div className="space-y-3 border-t border-border/50 pt-4">
          <div className="text-sm font-medium text-foreground">
            Рабочий контекст
          </div>
          <Select value={contextProjectId} onValueChange={changeContextProject}>
            <SelectTrigger>
              <SelectValue placeholder="Без проекта" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Без проекта</SelectItem>
              {availableProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <StreamMultiSelect
            ariaLabel="Карточки рабочего контекста"
            title="Выберите карточки Kanban V2"
            values={[...contextCardIds]}
            options={availableKanbanCards.slice(0, 100).map((card) => ({
              value: card.id,
              label: card.title || "Карточка",
              description: [card.boardName, card.listName].filter(Boolean).join(" · "),
            }))}
            onValuesChange={changeContextCards}
            placeholder={contextProjectId === "none"
              ? "Выберите карточки компании"
              : "Выберите карточки проекта"}
            searchPlaceholder="Поиск по карточкам"
            emptyMessage={contextProjectId === "none"
              ? "Нет доступных карточек Kanban V2"
              : "У проекта нет доступных карточек Kanban V2"}
          />
        </div>
      )}
    </div>
  );

  const renderWarehouseStorageSelection = (required = false) => (
    <FormField
      control={form.control}
      name="storageLocationId"
      render={({ field }) => {
        const manualValue = String(form.watch("storageLocation") || "").trim();
        const selectValue = String(field.value || "").trim() || (manualValue ? "manual" : "none");
        return (
          <FormItem className="space-y-3 rounded-surface border border-border/50 bg-surface-subtle p-4">
            <FormLabel className="text-foreground">
              <MapPin className="mr-1 inline h-4 w-4" />
              Место хранения{required ? " *" : ""}
            </FormLabel>
            <Select
              value={selectValue}
              onValueChange={(value) => {
                if (value === "none") {
                  field.onChange(null);
                  form.setValue("storageLocation", "", { shouldDirty: true });
                  return;
                }
                if (value === "manual") {
                  field.onChange(null);
                  return;
                }
                const selected = availableStorageLocations.find((location) => location.id === value);
                field.onChange(value);
                form.setValue(
                  "storageLocation",
                  String(selected?.path || selected?.name || ""),
                  { shouldDirty: true },
                );
              }}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите комнату, стеллаж или полку" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {required
                  ? <SelectItem value="none" disabled>Выберите место хранения</SelectItem>
                  : <SelectItem value="none">Не указано</SelectItem>}
                {availableStorageLocations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.path || location.name}{location.archivedAt ? " · в архиве" : ""}
                  </SelectItem>
                ))}
                <SelectItem value="manual">Указать вручную</SelectItem>
              </SelectContent>
            </Select>
            {selectValue === "manual" && (
              <FormField
                control={form.control}
                name="storageLocation"
                render={({ field: storageField }) => (
                  <FormControl>
                    <Input
                      placeholder="Комната 204, стеллаж B, полка 3"
                      {...storageField}
                      value={storageField.value || ""}
                    />
                  </FormControl>
                )}
              />
            )}
            {availableStorageLocations.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Справочник пока пуст. Можно указать место вручную или создать его в настройках склада.
              </p>
            )}
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );

  if (isTakeReturnMode && equipment) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => {
        if (!open) onClose();
      }}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {returnViaParentBundle
                ? "Возврат через сборку"
                : equipment.status === 'in-use' ? 'Вернуть оборудование' : 'Взять оборудование'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="rounded-surface border border-border/50 bg-surface-subtle p-4">
              <h3 className="font-semibold text-foreground">{equipment.name}</h3>
              {equipment.model && (
                <p className="text-sm text-muted-foreground">{equipment.model}</p>
              )}
              <Badge className={`mt-2 ${equipment.status === 'available' ? 'bg-success-muted text-success' : 'bg-warning-muted text-warning'}`}>
                {equipment.status === 'available' ? 'Доступно' : 'Используется'}
              </Badge>
            </div>

            {returnViaParentBundle && (
              <div className="rounded-control border border-warning/30 bg-warning-muted p-3 text-sm text-warning">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-medium">Компонент входит в сборку «{parentBundleName}»</div>
                    <p className="mt-1 text-xs">
                      Верните всю сборку либо сначала извлеките компонент из её состава.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Form {...form}>
              <div className="space-y-4">
                {!returnViaParentBundle && (
                  equipment.status === "in-use"
                    ? renderWarehouseStorageSelection(true)
                    : renderDestinationAndContext(true)
                )}

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                  >
                    Отмена
                  </Button>
                  {returnViaParentBundle ? (
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => onOpenParentBundle?.(equipment)}
                      disabled={!onOpenParentBundle}
                    >
                      Открыть сборку
                    </Button>
                  ) : equipment.status === 'in-use' ? (
                    <Button
                      type="button"
                      className="flex-1 bg-success text-white hover:bg-success/90"
                      onClick={() => handleTakeReturn('return')}
                      disabled={takeReturnMutation.isPending}
                    >
                      {takeReturnMutation.isPending ? "..." : "Вернуть"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      className="flex-1"
                      onClick={() => handleTakeReturn('take')}
                      disabled={takeReturnMutation.isPending}
                    >
                      {takeReturnMutation.isPending ? "..." : "Взять"}
                    </Button>
                  )}
                </div>
              </div>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) void requestClose();
    }}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>
            {equipment ? "Редактировать оборудование" : "Добавить оборудование"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="rounded-surface border border-border/50 bg-surface-subtle p-4">
              <div className="mb-4 text-sm font-semibold text-foreground">Основные сведения</div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Sony FX3 Camera #1" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Категория</FormLabel>
                    <Select
                      value={String(field.value || "") || "none"}
                      onValueChange={(value) => {
                        const categoryId = value === "none" ? null : value;
                        field.onChange(categoryId);
                        const category = categoryId ? categoryById.get(categoryId) : null;
                        if (category) {
                          form.setValue("type", category.name, { shouldDirty: true });
                        }
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите категорию" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Без категории</SelectItem>
                        {availableCategories.map((category) => {
                          const parent = category.parentId ? categoryById.get(category.parentId) : null;
                          return (
                            <SelectItem key={category.id} value={category.id}>
                              {parent ? `${parent.name} / ` : ""}{category.name}
                              {category.archivedAt ? " · в архиве" : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Модель</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Sony FX3" 
                        {...field}
                        value={field.value || ""} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel>Стоимость для сметы</FormLabel>
                <FormControl>
                  <Input
                    inputMode="decimal"
                    placeholder="15000"
                    value={estimatePrice}
                    onChange={(event) => setEstimatePrice(event.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormField
                control={form.control}
                name="serialNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Серийный номер</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="SN001234" 
                        {...field}
                        value={field.value || ""} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="inventoryNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <ScanBarcode className="w-4 h-4" />
                      Инвентарный номер / Штрих-код
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="INV-2024-001 или сканируйте" 
                          className="font-mono"
                          {...field}
                          value={field.value || ""} 
                        />
                      </FormControl>
                      {canManageBarcode ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={generateBarcode}
                          title="Сгенерировать штрих-код"
                          className="shrink-0"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          disabled
                          title="Недостаточно прав для генерации штрих-кода"
                          className="shrink-0 opacity-50 cursor-not-allowed"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Статус</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите статус" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="available">Доступно</SelectItem>
                        <SelectItem value="in-use">Используется</SelectItem>
                        <SelectItem value="maintenance">На обслуживании</SelectItem>
                        <SelectItem value="broken">Сломано</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="operabilityStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Исправность</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "working"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите исправность" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="working">Исправно</SelectItem>
                        <SelectItem value="broken">Неисправно</SelectItem>
                        <SelectItem value="on_repair">В ремонте</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t border-border/50 pt-4 md:col-span-2">
                <div className="text-sm font-semibold text-foreground">Размещение и рабочий контекст</div>
              </div>

              <div className="md:col-span-2">
                {renderDestinationAndContext(true)}
              </div>

              <div className="md:col-span-2">
                {renderWarehouseStorageSelection(false)}
              </div>

              <div className="border-t border-border/50 pt-4 md:col-span-2">
                <div className="text-sm font-semibold text-foreground">Ответственность</div>
              </div>

              <FormField
                control={form.control}
                name="responsiblePerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ответственный</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Имя ответственного"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="responsibleContact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Контакт ответственного</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+7 900 000-00-00, Telegram или email"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
            </div>

            {barcodeValue && barcodeValue.length >= 3 && (
              <div className="rounded-surface border border-border/50 bg-surface-subtle p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      Предпросмотр штрих-кода
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadBarcode}
                      className="h-8"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Скачать
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePrintBarcode}
                      className="h-8"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      Печать
                    </Button>
                  </div>
                </div>
                <div className="flex justify-center overflow-hidden rounded-control border border-border/50 bg-white p-3">
                  <svg ref={barcodeRef} data-testid="barcode-preview" />
                </div>
              </div>
            )}

            <section className="space-y-4 rounded-surface border border-border/50 bg-surface-subtle p-4">
              <div className="text-sm font-semibold text-foreground">Описание и файлы</div>
              <div className="space-y-2">
              <FormLabel>Тех. характеристики</FormLabel>
              <Textarea
                value={specificationsText}
                onChange={(event) => setSpecificationsText(event.target.value)}
                placeholder={"Порт HDMI: 2\nПитание: USB-C\nКомплектация: кейс"}
                className="min-h-[110px] font-mono text-sm"
              />
              </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Примечания</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Дополнительная информация об оборудовании..."
                      className="min-h-[80px]"
                      {...field}
                      value={field.value || ""} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PhotoUpload
              equipmentId={equipment?.id}
              existingPhotos={photos}
              onPhotosChange={setPhotos}
            />
            </section>

            <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
              {equipment ? (
                <div
                  className={`text-sm ${
                    equipmentAutosave.status === "error" || (equipmentAutosave.status === "dirty" && equipmentAutosave.error)
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                  role="status"
                >
                  {equipmentAutosave.status === "saving"
                    ? "Сохранение изменений..."
                    : equipmentAutosave.status === "dirty"
                      ? equipmentAutosave.error || "Изменения будут сохранены автоматически"
                      : equipmentAutosave.status === "error"
                        ? equipmentAutosave.error || "Не удалось сохранить изменения"
                        : "Все изменения сохранены"}
                </div>
              ) : (
                <div />
              )}
              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void requestClose()}
                >
                  {equipment ? "Закрыть" : "Отмена"}
                </Button>
                {!equipment && (
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? "Сохранение..." : "Добавить"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
