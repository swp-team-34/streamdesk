import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Clock,
  FileText,
  History,
  MapPin,
  Package,
  PackageCheck,
  Plus,
  ScanBarcode,
  Send,
  Settings,
  ShoppingCart,
  Trash2,
  User,
  X,
} from "lucide-react";
import { EquipmentForm } from "@/components/forms/equipment-form";
import { BarcodeScanner } from "@/components/equipment/barcode-scanner";
import { EquipmentBarcodeModal } from "@/components/equipment/barcode-generator";
import { EquipmentBundleCreateDialog } from "@/components/equipment/equipment-bundle-create-dialog";
import { EquipmentCard } from "@/components/equipment/equipment-card";
import { EquipmentCheckoutRequestDialog } from "@/components/equipment/equipment-checkout-request-dialog";
import { EquipmentDetailsDialog } from "@/components/equipment/equipment-details-dialog";
import { EquipmentKitAddDialog } from "@/components/equipment/equipment-kit-add-dialog";
import {
  EquipmentKitSafetyDialog,
  type EquipmentKitSafetyEntry as KitSafetyEntry,
} from "@/components/equipment/equipment-kit-safety-dialog";
import { WarehouseFilters } from "@/components/equipment/warehouse-filters";
import { WarehouseCartSheet } from "@/components/equipment/warehouse-cart-sheet";
import { WarehouseHistorySheet } from "@/components/equipment/warehouse-history-sheet";
import {
  WarehousePendingRequests,
  type WarehousePendingRequestGroupView,
} from "@/components/equipment/warehouse-pending-requests";
import {
  WarehouseSettings,
  type WarehouseCategoryOption,
  type WarehouseStorageLocationOption,
} from "@/components/equipment/warehouse-settings";
import { WarehouseReturnDialog } from "@/components/equipment/warehouse-return-dialog";
import { canCreateEquipment, canEditEquipment, canReserveEquipment } from "@/lib/equipment-permissions";
import {
  buildWarehouseCategoryFilterOptions,
  countActiveEquipmentFilters,
  matchesAssignedUser,
  matchesEquipmentBaseFilters,
  matchesEquipmentEmployeeFilter,
} from "@/lib/equipment-filters";
import {
  bundleContainsEquipment,
  getParentBundleId,
  getParentBundleName,
  isSuperPosition,
} from "@/lib/equipment-kit-model";
import {
  asRecord,
  formatEquipmentDateTime as formatDateTime,
  getEquipmentCategoryLabel,
  getEquipmentCompanyId,
  getEquipmentOperabilityClass as getOperabilityColor,
  getEquipmentOperabilityLabel as getOperabilityText,
  getEquipmentOperabilityStatus,
  getEquipmentResponsibleContact,
  getEquipmentResponsiblePerson,
  getEquipmentStatusClass as getStatusColor,
  getEquipmentStatusLabel as getStatusText,
  getEquipmentStorageLocation,
  getInoperableEquipmentMessage as getInoperableMessage,
  getSpecificationEntries,
  isEquipmentOperable,
  toLocalDateTimeInputValue,
} from "@/lib/equipment-view-model";
import { buildBarcodeLabelBitmapPayload, renderCompactBarcodeLabel } from "@/lib/barcode-label";
import { apiRequest, apiUrl, encodeUserHeader } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { useRealtimeSubscriptions } from "@/hooks/use-websocket";
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";
import type { Equipment } from "@shared/schema";

function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('streamstudio_user') || '{}');
  } catch {
    return null;
  }
}

type KitExtractionPayload = {
  confirmed: true;
  override: boolean;
  bundleName: string;
  reason: string;
  context: string;
};

export default function EquipmentPage() {
  const { confirm: confirmAction } = useAppDialog();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [operabilityFilter, setOperabilityFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"full" | "take_return">("full");
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [barcodeEquipment, setBarcodeEquipment] = useState<Equipment | null>(null);
  const [detailsEquipment, setDetailsEquipment] = useState<Equipment | null>(null);
  const [detailsNote, setDetailsNote] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cart, setCart] = useState<Equipment[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [warehouseSettingsOpen, setWarehouseSettingsOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sendToProjectId, setSendToProjectId] = useState<string>("");
  const [handoffAt, setHandoffAt] = useState<string>(() => toLocalDateTimeInputValue());
  const [returnDate, setReturnDate] = useState<string>("");
  const [returnTime, setReturnTime] = useState<string>("18:00");
  const [passDirection, setPassDirection] = useState<"in" | "out">("out");
  const [passBasis, setPassBasis] = useState<string>("");
  const [passResponsiblePhone, setPassResponsiblePhone] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [requestEquipment, setRequestEquipment] = useState<Equipment | null>(null);
  const [requestLocationChoice, setRequestLocationChoice] = useState<string>("");
  const [requestManualLocation, setRequestManualLocation] = useState<string>("");
  const [requestNote, setRequestNote] = useState<string>("");
  const [requestQuantity, setRequestQuantity] = useState<string>("1");
  const [requestProjectId, setRequestProjectId] = useState<string>("none");
  const [requestCardIds, setRequestCardIds] = useState<Set<string>>(new Set());
  const [bundleDialogOpen, setBundleDialogOpen] = useState(false);
  const [bundleName, setBundleName] = useState("");
  const [bundleCategoryId, setBundleCategoryId] = useState("none");
  const [kitAddBundle, setKitAddBundle] = useState<Equipment | null>(null);
  const [kitAddSelectedIds, setKitAddSelectedIds] = useState<Set<string>>(new Set());
  const [kitAddSearch, setKitAddSearch] = useState("");
  const [kitAddReason, setKitAddReason] = useState("");
  const [kitAddApprovalPhrase, setKitAddApprovalPhrase] = useState("");
  const [expandedBundleIds, setExpandedBundleIds] = useState<Set<string>>(new Set());
  const [detailsReturnBundleId, setDetailsReturnBundleId] = useState<string | null>(null);
  const [projectReturnEquipment, setProjectReturnEquipment] = useState<Equipment | null>(null);
  const [projectReturnMode, setProjectReturnMode] = useState<"direct" | "project">("direct");
  const [projectReturnStorageId, setProjectReturnStorageId] = useState("none");
  const [projectReturnManualStorage, setProjectReturnManualStorage] = useState("");
  const [kitSafetyEntries, setKitSafetyEntries] = useState<KitSafetyEntry[]>([]);
  const [kitSafetyActionLabel, setKitSafetyActionLabel] = useState("");
  const [kitSafetyContext, setKitSafetyContext] = useState("");
  const [kitSafetyReason, setKitSafetyReason] = useState("");
  const [kitOverridePhrase, setKitOverridePhrase] = useState("");
  const pendingKitActionRef = useRef<((payloads: Record<string, KitExtractionPayload>) => void) | null>(null);
  const initialEquipmentIdRef = useRef<string | null>(
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("equipmentId"),
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    setCurrentUser(getCurrentUser());
  }, []);

  useEffect(() => {
    setDetailsNote(String(detailsEquipment?.notes ?? ""));
  }, [detailsEquipment?.id, detailsEquipment?.notes]);

  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  useEffect(() => {
    setDetailsEquipment((current) => {
      if (!current) return null;
      return equipment.find((item) => item.id === current.id) || current;
    });
  }, [equipment]);

  useEffect(() => {
    const equipmentId = initialEquipmentIdRef.current;
    if (!equipmentId) return;
    const linkedEquipment = equipment.find((item) => String(item.id) === equipmentId);
    if (!linkedEquipment) return;
    setDetailsEquipment(linkedEquipment);
    initialEquipmentIdRef.current = null;
  }, [equipment]);

  const { data: companyData } = useQuery<any>({
    queryKey: ["/api/companies/me"],
    enabled: Boolean(currentUser?.id),
  });

  const { data: projects = [] } = useQuery<Array<{
    id: string;
    name: string;
    companyId?: string | null;
    status?: string | null;
  }>>({
    queryKey: ["/api/projects"],
  });

  const { data: locations = [] } = useQuery<Array<{
    id: string;
    name: string;
    companyId?: string | null;
    archivedAt?: string | null;
    status?: string | null;
  }>>({
    queryKey: ["/api/locations", { archive: "all" }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/locations?archive=all");
      return response.json();
    },
    enabled: Boolean(currentUser?.id),
  });

  const { data: warehouseCategories = [] } = useQuery<WarehouseCategoryOption[]>({
    queryKey: ["/api/warehouse/categories", { archive: "all" }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/warehouse/categories?archive=all");
      return response.json();
    },
    enabled: Boolean(currentUser?.id),
  });

  const { data: warehouseStorageLocations = [] } = useQuery<WarehouseStorageLocationOption[]>({
    queryKey: ["/api/warehouse/storage-locations", { archive: "all" }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/warehouse/storage-locations?archive=all");
      return response.json();
    },
    enabled: Boolean(currentUser?.id),
  });

  const { data: kanbanCards = [] } = useQuery<Array<{
    id: string;
    title: string;
    boardName?: string | null;
    boardId?: string | null;
    projectId?: string | null;
    boardProjectId?: string | null;
    companyId?: string | null;
    listName?: string | null;
    listType?: string | null;
  }>>({
    queryKey: ["/api/kanban/cards"],
    enabled: Boolean(currentUser?.id),
  });

  const { data: equipmentOnProjects = [] } = useQuery<Array<{
    equipmentId: string;
    projectId: string;
    projectName?: string;
    sentAt?: string;
    returnDate: string;
    returnTime?: string;
    assignedByName: string;
    assignedByUserId?: string;
    sources?: string[];
    kanbanCardIds?: string[];
  }>>({
    queryKey: ["/api/equipment-on-projects"],
  });

  const equipmentCountByProject = equipmentOnProjects.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.projectId || "").trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const { data: users = [] } = useQuery<Array<{ id: string; name?: string | null; username?: string | null }>>({
    queryKey: ["/api/users"],
  });

  const { data: checkoutRequests = [] } = useQuery<Array<{
    id: string;
    equipmentId: string;
    companyId?: string | null;
    requestedBy: string;
    requestType?: string | null;
    currentHolder?: string | null;
    reviewedBy?: string | null;
    status: string;
    location?: string | null;
    locationId?: string | null;
    manualLocation?: string | null;
    note?: string | null;
    decisionNote?: string | null;
    kanbanCardId?: string | null;
    kanbanCardIds?: string[] | null;
    projectId?: string | null;
    physicalDestination?: {
      displayName?: string | null;
      locationName?: string | null;
      manualLocation?: string | null;
    };
    workContext?: {
      project?: { id: string; name: string; status?: string | null } | null;
      kanbanCards?: Array<{ id: string; title: string; boardId?: string | null; projectId?: string | null }>;
    };
    quantity?: number | null;
    createdAt?: string;
    updatedAt?: string;
    reviewedAt?: string | null;
  }>>({
    queryKey: ["/api/equipment-checkout-requests"],
    enabled: Boolean(currentUser?.id),
  });

  const companyMemberships = Array.isArray(companyData?.companies) ? companyData.companies : [];
  const activeCompanyIds: string[] = companyMemberships
    .map((item: any) => String(item?.company?.id || "").trim())
    .filter(Boolean);
  const manageableCompanyIds = companyMemberships
    .filter((item: any) => ["owner", "admin"].includes(String(item?.membership?.role || "")))
    .map((item: any) => String(item?.company?.id || "").trim())
    .filter(Boolean);
  const primaryCompanyId = activeCompanyIds[0] || "";
  const canApproveCheckout = manageableCompanyIds.length > 0 || currentUser?.role === "admin";
  const userCanCreate = canCreateEquipment(currentUser) || canApproveCheckout || currentUser?.workspaceMode === "company_owner";
  const userCanEdit = canEditEquipment(currentUser) || canApproveCheckout;
  const userCanReserve = canReserveEquipment(currentUser) || canApproveCheckout;
  const canRequestCheckout = activeCompanyIds.length > 0;

  useRealtimeSubscriptions(
    activeCompanyIds.map((companyId) => `company:${companyId}`),
    () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/storage-locations"] });
    },
  );

  const updateEquipmentNoteMutation = useMutation({
    mutationFn: async ({ equipmentId, notes }: { equipmentId: string; notes: string }) => {
      const response = await apiRequest("PUT", `/api/equipment/${equipmentId}`, { notes });
      return response.json();
    },
    onSuccess: (updated: Equipment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      if (updated?.id) {
        setDetailsEquipment(updated);
      }
    },
  });

  const equipmentNoteAutosave = useDebouncedAutosave({
    enabled: Boolean(detailsEquipment?.id && userCanEdit),
    resetKey: String(detailsEquipment?.id || ""),
    source: `equipment-note:${detailsEquipment?.id || "closed"}`,
    value: {
      equipmentId: String(detailsEquipment?.id || ""),
      notes: detailsNote,
    },
    validate: (snapshot) => snapshot.equipmentId
      ? { ok: true as const, payload: snapshot }
      : { ok: false as const, error: "Оборудование не выбрано" },
    save: async (payload) => {
      await updateEquipmentNoteMutation.mutateAsync(payload);
    },
  });

  const closeEquipmentDetails = async () => {
    if (detailsEquipment?.id && userCanEdit) {
      const saved = await equipmentNoteAutosave.flush();
      if (!saved) {
        toast({
          title: "Изменения не сохранены",
          description: equipmentNoteAutosave.error || "Не удалось сохранить примечание.",
          variant: "destructive",
        });
        return;
      }
    }
    setDetailsEquipment(null);
    setDetailsReturnBundleId(null);
  };

  const sendToProjectMutation = useMutation({
    mutationFn: async ({
      projectId,
      equipmentIds,
      handoffAt,
      returnDate,
      returnTime,
      assignedByName,
      assignedByUserId,
      kitExtractions,
    }: {
      projectId: string;
      equipmentIds: string[];
      handoffAt?: string;
      returnDate: string;
      returnTime?: string;
      assignedByName: string;
      assignedByUserId?: string;
      kitExtractions?: Record<string, KitExtractionPayload>;
    }) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/equipment-bundle`, {
        equipmentIds,
        handoffAt,
        returnDate,
        returnTime,
        assignedByName,
        assignedByUserId,
        kitExtractions,
      });
      return res.json();
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      const project = projects.find((p) => p.id === projectId);
      toast({
        title: "Отправлено",
        description: `Оборудование привязано к проекту «${project?.name || projectId}». Не забудьте вернуть к указанной дате.`,
      });
      setCart([]);
      setCartOpen(false);
      setSendToProjectId("");
      setHandoffAt(toLocalDateTimeInputValue());
      setReturnDate("");
      setReturnTime("18:00");
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось отправить", variant: "destructive" });
    },
  });

  const passDocumentMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error("Добавьте оборудование в корзину");
      const user = getCurrentUser();
      const res = await fetch(apiUrl("/api/equipment/pass-document"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          equipmentIds: cart.map((item) => item.id),
          direction: passDirection,
          projectId: sendToProjectId || undefined,
          basis: passBasis || undefined,
          handoffAt,
          returnDate: returnDate || undefined,
          returnTime: returnTime || undefined,
          responsibleName: user?.name || user?.username,
          responsiblePhone: passResponsiblePhone || user?.phone || undefined,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let message = text;
        try {
          const json = text ? JSON.parse(text) : null;
          if (json?.message) message = json.message;
        } catch (_) {}
        throw new Error(message || "Не удалось сформировать пропуск");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Пропуск_${passDirection === "in" ? "внос" : "вынос"}_${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast({ title: "Готово", description: "Пропуск сформирован. Его можно открыть, распечатать или сохранить." });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось сформировать пропуск", variant: "destructive" });
    },
  });

  const addToCart = (item: Equipment) => {
    if (!isEquipmentOperable(item)) {
      toast({ title: "Недоступно для выдачи", description: getInoperableMessage(item), variant: "destructive" });
      return;
    }
    if (cart.some((e) => e.id === item.id)) return;
    setCart((prev) => [...prev, item]);
    toast({ title: "В корзине", description: `${item.name} добавлено в корзину` });
  };
  const removeFromCart = (id: string) => setCart((prev) => prev.filter((e) => e.id !== id));
  const clearCart = () => { setCart([]); setCartOpen(false); };

  const warehouseCategoryById = new Map(
    warehouseCategories.map((category) => [String(category.id), category]),
  );
  const warehouseCategoryFilterOptions = buildWarehouseCategoryFilterOptions(warehouseCategories);
  const equipmentFilterState = {
    searchTerm,
    status: statusFilter,
    operability: operabilityFilter,
    category: typeFilter,
    employee: employeeFilter,
  };
  const equipmentMatchingBaseFilters = equipment.filter((item) =>
    matchesEquipmentBaseFilters(item, equipmentFilterState),
  );
  const filteredEquipment = equipmentMatchingBaseFilters.filter((item) =>
    matchesEquipmentEmployeeFilter(item, employeeFilter, canApproveCheckout, users),
  );

  const toExport = selectedIds.size > 0
    ? filteredEquipment.filter((e: Equipment) => selectedIds.has(e.id))
    : filteredEquipment;
  const selectedEquipmentForLabels = equipment.filter((e: Equipment) => selectedIds.has(e.id));
  const selectedEquipmentForBundle = equipment.filter((e: Equipment) => selectedIds.has(e.id));

  const exportBarcodesToExcel = () => {
    const BOM = "\uFEFF";
    const headers = [
      "Категория",
      "Название",
      "Модель",
      "Статус",
      "Исправность",
      "Сотрудник",
      "Проект",
      "Серийный номер",
      "Инв. номер",
      "Штрихкод",
      "Место",
      "Место хранения",
      "Ответственный",
      "Контакт ответственного",
      "Тех. характеристики",
      "Комментарий",
    ];
    const rows = toExport
      .map((item: Equipment) => {
        const projectInfo = getAnyProjectContext(item.id);
        return [
          getEquipmentCategoryLabel(item),
          item.name ?? "",
          item.model ?? "",
          getStatusText(item.status ?? ""),
          getOperabilityText(getEquipmentOperabilityStatus(item)),
          getAssignedUserName(item.assignedTo),
          projectInfo?.projectName ?? "",
          item.serialNumber ?? "",
          item.inventoryNumber ?? "",
          String(item.barcode ?? "").trim(),
          item.location ?? "",
          getEquipmentStorageLocation(item),
          getEquipmentResponsiblePerson(item),
          getEquipmentResponsibleContact(item),
          getSpecificationEntries(item.specifications).map(([key, value]) => `${key}: ${value}`).join("\n"),
          String(item.notes ?? "").trim(),
        ];
      })
      .sort((left, right) =>
        `${left[0]}|${left[5]}|${left[1]}`.localeCompare(`${right[0]}|${right[5]}|${right[1]}`, "ru"),
      );
    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\r\n");
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `склад_штрихкоды_и_характеристики_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: "Выгружено",
      description: selectedIds.size > 0
        ? `Подготовлен отчёт по ${toExport.length} отмеченным позициям.`
        : `Подготовлен отчёт по ${toExport.length} позициям текущего списка.`,
    });
  };

  const printEquipmentLabelsMutation = useMutation({
    mutationFn: async (items: Equipment[]) => {
      if (items.length === 0) throw new Error("Выберите оборудование для печати этикеток");
      const holder = document.createElement("div");
      holder.style.position = "fixed";
      holder.style.left = "-10000px";
      holder.style.top = "0";
      holder.style.pointerEvents = "none";
      document.body.appendChild(holder);

      try {
        const labels = [];
        for (const item of items) {
          const value = String(item.inventoryNumber || item.barcode || item.serialNumber || `EQ${item.id.slice(0, 10).toUpperCase()}`).trim();
          if (!value) continue;
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          holder.appendChild(svg);
          renderCompactBarcodeLabel(svg, value);
          labels.push(await buildBarcodeLabelBitmapPayload(svg, value));
        }

        if (labels.length === 0) throw new Error("Нет инвентарника для печати этикетки");
        const response = await apiRequest("POST", "/api/equipment/labels/print-bitmaps", { labels });
        return response.json();
      } finally {
        holder.remove();
      }
    },
    onSuccess: (data: any) => {
      toast({
        title: "Этикетки отправлены",
        description: `Принтер: ${data?.printer || "TSC"}. Количество: ${data?.count || 0}.`,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Ошибка печати",
        description: e?.message || "Не удалось отправить этикетки на принтер",
        variant: "destructive",
      });
    },
  });

  const calibrateLabelPrinterMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/equipment/labels/calibrate", {});
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Калибровка отправлена",
        description: `Принтер: ${data?.printer || "TSC"}.`,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Ошибка калибровки",
        description: e?.message || "Не удалось откалибровать принтер",
        variant: "destructive",
      });
    },
  });

  const printEquipmentLabels = (items: Equipment[]) => {
    const printableItems = items.filter(Boolean);
    if (printableItems.length === 0) {
      toast({
        title: "Нечего печатать",
        description: "Выберите оборудование или нажмите печать на карточке.",
        variant: "destructive",
      });
      return;
    }
    printEquipmentLabelsMutation.mutate(printableItems);
  };

  const createBundleMutation = useMutation({
    mutationFn: async ({
      name,
      type,
      categoryId,
      items,
    }: {
      name: string;
      type: string;
      categoryId?: string | null;
      items: Equipment[];
    }) => {
      if (items.length < 2) throw new Error("Выберите минимум две позиции для сборки");
      const cleanName = name.trim();
      if (!cleanName) throw new Error("Введите название сборки");

      const assembledAt = new Date().toISOString();
      const componentSnapshots = items.map((item) => ({
        id: item.id,
        name: item.name,
        model: item.model,
        inventoryNumber: item.inventoryNumber,
        serialNumber: item.serialNumber,
        type: item.type,
      }));

      const createResponse = await apiRequest("POST", "/api/equipment", {
        name: cleanName,
        type,
        categoryId: categoryId || null,
        model: `Сборка из ${items.length} позиций`,
        status: "available",
        location: items[0]?.location || "Склад",
        specifications: {
          isSuperPosition: true,
          bundleType: "super_position",
          bundleComponentIds: items.map((item) => item.id),
          bundleComponents: componentSnapshots,
          assembledAt,
          assembledByUserId: currentUser?.id || null,
          assembledByName: currentUser?.name || currentUser?.username || null,
          companyId: primaryCompanyId || undefined,
        },
        notes: `Супер позиция из ${items.length} комплектующих.`,
      });
      const bundle = await createResponse.json();

      await Promise.all(items.map((item) => {
        const specs = asRecord(item.specifications);
        return apiRequest("PUT", `/api/equipment/${item.id}`, {
          status: "in-use",
          location: `В составе: ${cleanName}`,
          specifications: {
            ...specs,
            parentBundleId: bundle.id,
            parentBundleName: cleanName,
            parentBundleCreatedAt: assembledAt,
          },
        });
      }));

      return bundle;
    },
    onSuccess: (bundle: Equipment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setBundleDialogOpen(false);
      setBundleName("");
      setBundleCategoryId("none");
      setSelectedIds(new Set());
      setDetailsEquipment(bundle);
      toast({
        title: "Сборка создана",
        description: "Комплектующие объединены в супер позицию на складе.",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Ошибка сборки",
        description: e?.message || "Не удалось объединить позиции",
        variant: "destructive",
      });
    },
  });

  const addKitComponentsMutation = useMutation({
    mutationFn: async ({
      bundleId,
      equipmentIds,
      reason,
      activeKitApproval,
    }: {
      bundleId: string;
      equipmentIds: string[];
      reason: string;
      activeKitApproval: boolean;
    }) => {
      const response = await apiRequest("POST", `/api/equipment/${bundleId}/components`, {
        equipmentIds,
        reason,
        activeKitApproval,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      if (data?.bundle) setDetailsEquipment(data.bundle);
      setKitAddBundle(null);
      setKitAddSelectedIds(new Set());
      setKitAddSearch("");
      setKitAddReason("");
      setKitAddApprovalPhrase("");
      toast({
        title: "Состав обновлён",
        description: `Добавлено позиций: ${Array.isArray(data?.addedComponentIds) ? data.addedComponentIds.length : 0}.`,
      });
    },
    onError: (e: any) => {
      toast({
        title: "Не удалось добавить в комплект",
        description: e?.message || "Обновите склад и повторите действие.",
        variant: "destructive",
      });
    },
  });

  const removeKitComponentMutation = useMutation({
    mutationFn: async ({
      bundleId,
      componentId,
      kitExtraction,
    }: {
      bundleId: string;
      componentId: string;
      kitExtraction: KitExtractionPayload;
    }) => {
      const response = await apiRequest("DELETE", `/api/equipment/${bundleId}/components/${componentId}`, {
        kitExtraction,
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      if (data?.bundle) setDetailsEquipment(data.bundle);
      toast({
        title: "Позиция убрана из комплекта",
        description: data?.component?.name
          ? `«${data.component.name}» снова доступна отдельно.`
          : "Позиция снова доступна отдельно.",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Не удалось изменить состав",
        description: e?.message || "Обновите склад и повторите действие.",
        variant: "destructive",
      });
    },
  });

  const openBundleDialog = () => {
    if (selectedEquipmentForBundle.length < 2) {
      toast({
        title: "Выберите позиции",
        description: "Для супер позиции нужно отметить минимум две складские карточки.",
      });
      return;
    }
    if (!bundleName.trim()) {
      const first = selectedEquipmentForBundle[0];
      setBundleName(first?.type === "computer" ? `Сборка ${first.name}` : `Комплект ${selectedEquipmentForBundle.length} поз.`);
    }
    setBundleDialogOpen(true);
  };

  const returnToWarehouseMutation = useMutation({
    mutationFn: async ({
      equipmentId,
      storageLocationId,
      storageLocation,
      fromProject,
    }: {
      equipmentId: string;
      storageLocationId?: string | null;
      storageLocation?: string | null;
      fromProject: boolean;
    }) => {
      if (!fromProject) {
        const response = await apiRequest("PUT", `/api/equipment/${equipmentId}`, {
          status: "available",
          assignedTo: null,
          lastUsed: new Date(),
          storageLocationId,
          storageLocation,
        });
        return response.json();
      }
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (currentUser) (headers as Record<string, string>)["x-user"] = encodeUserHeader(currentUser);
      const res = await fetch(apiUrl("/api/equipment-return"), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          equipmentId,
          userId: currentUser?.id,
          storageLocationId,
          storageLocation,
        }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = text;
        try {
          const j = text ? JSON.parse(text) : null;
          if (j && typeof j.message === "string") msg = j.message;
        } catch (_) {}
        throw new Error(msg.slice(0, 300) || `Ошибка ${res.status}`);
      }
      try {
        return text ? JSON.parse(text) : {};
      } catch {
        throw new Error("Сервер вернул неверный ответ. Попробуйте обновить страницу.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      toast({ title: "Готово", description: "Оборудование возвращено на склад" });
      setProjectReturnEquipment(null);
      setProjectReturnStorageId("none");
      setProjectReturnManualStorage("");
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось вернуть", variant: "destructive" });
    },
  });

  const requestCheckoutMutation = useMutation({
    mutationFn: async ({
      equipmentId,
      physicalDestination,
      workContext,
      note,
      companyId,
      requestType,
      quantity,
      kitExtraction,
    }: {
      equipmentId: string;
      physicalDestination: { locationId?: string; manualLocation?: string };
      workContext?: { projectId?: string; kanbanCardIds: string[] };
      note?: string;
      companyId?: string;
      requestType?: "checkout" | "transfer";
      quantity: number;
      kitExtraction?: KitExtractionPayload;
    }) => {
      const response = await apiRequest("POST", "/api/equipment-checkout-requests", {
        equipmentId,
        physicalDestination,
        workContext,
        note,
        companyId,
        requestType,
        quantity,
        kitExtraction,
      });
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      const isTransfer = variables.requestType === "transfer";
      toast({
        title: isTransfer ? "Запрос на перенос отправлен" : "Запрос отправлен",
        description: isTransfer
          ? "Главный по компании увидит запрос и решит, можно ли перенести оборудование вам."
          : "Главный по компании увидит запрос и сможет подтвердить выдачу.",
      });
      setRequestEquipment(null);
      setRequestLocationChoice("");
      setRequestManualLocation("");
      setRequestNote("");
      setRequestQuantity("1");
      setRequestProjectId("none");
      setRequestCardIds(new Set());
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось отправить запрос", variant: "destructive" });
    },
  });

  const approveCheckoutMutation = useMutation({
    mutationFn: async ({
      requestIds,
      kitExtractions,
      kitExtractionApproval,
    }: {
      requestIds: string[];
      kitExtractions?: Record<string, KitExtractionPayload>;
      kitExtractionApproval?: boolean;
    }) => {
      const responses = await Promise.all(
        requestIds.map((requestId) => {
          const request = checkoutRequests.find((entry) => entry.id === requestId);
          return apiRequest("POST", `/api/equipment-checkout-requests/${requestId}/approve`, {
            ...(request?.requestType === "kit-extraction"
              ? { kitExtractionApproval: kitExtractionApproval === true }
              : { kitExtraction: request ? kitExtractions?.[request.equipmentId] : undefined }),
          });
        }),
      );
      return Promise.all(responses.map((response) => response.json().catch(() => null)));
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      const requestId = variables.requestIds[0];
      const request = checkoutRequests.find((item) => item.id === requestId);
      const isTransfer = request?.requestType === "transfer";
      const isExtraction = request?.requestType === "kit-extraction";
      toast({
        title: isExtraction ? "Извлечение подтверждено" : isTransfer ? "Перенос подтверждён" : "Выдача подтверждена",
        description: isExtraction
          ? "Компонент извлечён из комплекта, событие записано в историю."
          : isTransfer
          ? "Оборудование переназначено сотруднику."
          : "Оборудование закреплено за сотрудником.",
      });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось подтвердить выдачу", variant: "destructive" });
    },
  });

  const rejectCheckoutMutation = useMutation({
    mutationFn: async (requestIdOrIds: string | string[]) => {
      const requestIds = Array.isArray(requestIdOrIds) ? requestIdOrIds : [requestIdOrIds];
      const responses = await Promise.all(
        requestIds.map((requestId) => apiRequest("POST", `/api/equipment-checkout-requests/${requestId}/reject`, {})),
      );
      return Promise.all(responses.map((response) => response.json().catch(() => null)));
    },
    onSuccess: (_, requestIdOrIds) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      const requestId = Array.isArray(requestIdOrIds) ? requestIdOrIds[0] : requestIdOrIds;
      const request = checkoutRequests.find((item) => item.id === requestId);
      const count = Array.isArray(requestIdOrIds) ? requestIdOrIds.length : 1;
      toast({
        title: request?.requestType === "transfer" ? "Перенос отклонён" : "Запрос отклонён",
        description: "Сотрудник увидит решение в уведомлениях.",
      });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось отклонить запрос", variant: "destructive" });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async ({ equipmentId, kitExtraction }: { equipmentId: string; kitExtraction?: KitExtractionPayload }) => {
      const response = await apiRequest("DELETE", `/api/equipment/${equipmentId}`, { kitExtraction });
      return response.json();
    },
    onSuccess: (_result, input) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-equipment-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      setDetailsEquipment((current) => current?.id === input.equipmentId ? null : current);
      toast({ title: "Удалено", description: "Позиция убрана со склада." });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось удалить оборудование", variant: "destructive" });
    },
  });

  const takeCartForSelfMutation = useMutation({
    mutationFn: async ({
      items,
      kitExtractions,
    }: {
      items: Equipment[];
      kitExtractions?: Record<string, KitExtractionPayload>;
    }) => {
      const direct = userCanReserve;
      const requests = items.map((item) =>
        direct
          ? apiRequest("PUT", `/api/equipment/${item.id}`, {
              status: "in-use",
              assignedTo: currentUser?.id,
              lastUsed: new Date(),
              location: item.location || `У сотрудника ${currentUser?.name || currentUser?.username || ""}`.trim(),
              kitExtraction: kitExtractions?.[item.id],
            })
          : apiRequest("POST", "/api/equipment-checkout-requests", {
              equipmentId: item.id,
              companyId: primaryCompanyId,
              quantity: 1,
              location: item.location || `У сотрудника ${currentUser?.name || currentUser?.username || ""}`.trim(),
              kitExtraction: kitExtractions?.[item.id],
            }),
      );
      const responses = await Promise.all(requests);
      return Promise.all(responses.map((response) => response.json().catch(() => null)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      setCart([]);
      setCartOpen(false);
      toast({
        title: userCanReserve ? "Оборудование выдано" : "Запросы отправлены",
        description: userCanReserve
          ? "Позиции закреплены за сотрудником."
          : "Главный по компании увидит запросы на выдачу.",
      });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось оформить выдачу", variant: "destructive" });
    },
  });

  const requestKitExtractionMutation = useMutation({
    mutationFn: async ({ entries, reason }: { entries: KitSafetyEntry[]; reason: string }) => {
      const responses = await Promise.all(
        entries.map((entry) => apiRequest("POST", `/api/equipment/${entry.item.id}/kit-extraction-request`, {
          reason: reason.trim() || `Требуется извлечение для действия «${kitSafetyActionLabel}»`,
          context: kitSafetyContext,
        })),
      );
      return Promise.all(responses.map((response) => response.json()));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      setKitSafetyEntries([]);
      setKitSafetyReason("");
      setKitOverridePhrase("");
      pendingKitActionRef.current = null;
      toast({
        title: "Запрос менеджеру отправлен",
        description: "Компонент останется в активном комплекте до явного подтверждения извлечения.",
      });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось отправить запрос", variant: "destructive" });
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size >= filteredEquipment.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredEquipment.map((e: Equipment) => e.id)));
  };

  const getOnProjectInfo = (equipmentId: string) =>
    equipmentOnProjects.find((entry) =>
      entry.equipmentId === equipmentId && (entry.sources || ["project-bundle"]).includes("project-bundle"),
    );
  const getAnyProjectContext = (equipmentId: string) =>
    equipmentOnProjects.find((entry) => entry.equipmentId === equipmentId);

  const getKitOperationalContext = (item: Equipment) => {
    let current = item;
    let projectInfo = getOnProjectInfo(current.id);
    const visited = new Set<string>();

    while (getParentBundleId(current) && !visited.has(current.id)) {
      visited.add(current.id);
      const parent = equipment.find((candidate) => candidate.id === getParentBundleId(current));
      if (!parent) break;
      current = parent;
      projectInfo = projectInfo || getOnProjectInfo(current.id);
    }

    const project = projects.find((candidate) => candidate.id === projectInfo?.projectId);
    return {
      active: Boolean(projectInfo) || current.status === "in-use",
      projectId: projectInfo?.projectId,
      projectName: projectInfo?.projectName || project?.name,
    };
  };

  const canOverrideActiveKit = canApproveCheckout || ["admin", "manager"].includes(String(currentUser?.role || ""));

  const closeKitSafetyDialog = () => {
    setKitSafetyEntries([]);
    setKitSafetyActionLabel("");
    setKitSafetyContext("");
    setKitSafetyReason("");
    setKitOverridePhrase("");
    pendingKitActionRef.current = null;
  };

  const runWithKitSafety = (
    items: Equipment[],
    actionLabel: string,
    context: string,
    action: (payloads: Record<string, KitExtractionPayload>) => void,
  ) => {
    const linkedItemCount = items.filter((item) => Boolean(getParentBundleId(item))).length;
    const entries = items.flatMap((item): KitSafetyEntry[] => {
      const parentBundleId = getParentBundleId(item);
      if (!parentBundleId) return [];
      const bundle = equipment.find((candidate) => candidate.id === parentBundleId);
      if (!bundle) {
        toast({
          title: "Комплект не найден",
          description: "Обновите склад перед продолжением операции.",
          variant: "destructive",
        });
        return [];
      }
      const operationalContext = getKitOperationalContext(item);
      return [{
        item,
        bundle,
        active: operationalContext.active,
        projectId: operationalContext.projectId,
        projectName: operationalContext.projectName,
      }];
    });

    if (entries.length !== linkedItemCount) return;

    if (entries.length === 0) {
      action({});
      return;
    }

    pendingKitActionRef.current = action;
    setKitSafetyEntries(entries);
    setKitSafetyActionLabel(actionLabel);
    setKitSafetyContext(context);
    setKitSafetyReason("");
    setKitOverridePhrase("");
  };

  const confirmKitExtraction = () => {
    const payloads = Object.fromEntries(kitSafetyEntries.map((entry) => [
      entry.item.id,
      {
        confirmed: true as const,
        override: entry.active,
        bundleName: entry.bundle.name,
        reason: kitSafetyReason.trim() || kitSafetyActionLabel,
        context: kitSafetyContext,
      },
    ]));
    const action = pendingKitActionRef.current;
    closeKitSafetyDialog();
    action?.(payloads);
  };

  const closeKitAddDialog = () => {
    setKitAddBundle(null);
    setKitAddSelectedIds(new Set());
    setKitAddSearch("");
    setKitAddReason("");
    setKitAddApprovalPhrase("");
  };

  const openKitAddDialog = (bundle: Equipment) => {
    setKitAddBundle(bundle);
    setKitAddSelectedIds(new Set());
    setKitAddSearch("");
    setKitAddReason("");
    setKitAddApprovalPhrase("");
  };

  const removeKitComponent = (bundle: Equipment, component: Equipment) => {
    runWithKitSafety(
      [component],
      "Убрать из комплекта",
      "manual-kit-component-remove",
      (payloads) => {
        const kitExtraction = payloads[component.id];
        if (!kitExtraction) return;
        removeKitComponentMutation.mutate({
          bundleId: bundle.id,
          componentId: component.id,
          kitExtraction,
        });
      },
    );
  };

  const openBundleComponentDetails = (bundleId: string, component?: Equipment) => {
    if (!component) return;
    setDetailsReturnBundleId(bundleId);
    setDetailsEquipment(component);
  };

  const openParentBundleDetails = (component: Equipment) => {
    const bundleId = getParentBundleId(component);
    const bundle = equipment.find((item) => item.id === bundleId);
    if (!bundle) {
      toast({ title: "Комплект не найден", description: "Обновите список склада.", variant: "destructive" });
      return;
    }
    setDetailsReturnBundleId(null);
    setDetailsEquipment(bundle);
  };

  const openKitReturnPath = (component: Equipment) => {
    const bundleName = getParentBundleName(component) || "сборка";
    const bundleId = getParentBundleId(component);
    const bundle = equipment.find((item) => item.id === bundleId);
    if (!bundle) {
      toast({
        title: "Сборка уже удалена",
        description: `«${component.name}» можно вернуть как отдельную позицию. Старая связь будет очищена автоматически.`,
      });
      setSelectedEquipment(component);
      setFormMode("take_return");
      setIsFormOpen(true);
      return;
    }
    toast({
      title: "Возврат через сборку",
      description: `«${component.name}» входит в «${bundleName}». Верните сборку целиком или сначала извлеките компонент.`,
    });
    setDetailsReturnBundleId(null);
    setDetailsEquipment(bundle);
  };

  const getAssignedUserName = (assignedTo: string | null | undefined) => {
    const normalized = String(assignedTo ?? "").trim();
    if (!normalized) return "";

    const matchedUser = users.find((user) => {
      const candidates = [user.id, user.name, user.username]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean);
      return candidates.includes(normalized);
    });

    return matchedUser?.name?.trim() || matchedUser?.username?.trim() || normalized;
  };

  const isCurrentUserMatch = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    if (!normalized || !currentUser) return false;
    return [currentUser.id, currentUser.name, currentUser.username]
      .map((item: unknown) => String(item ?? "").trim())
      .filter(Boolean)
      .includes(normalized);
  };

  const getCheckoutRequestType = (request?: { requestType?: string | null }, item?: Equipment | null) => {
    if (request?.requestType === "kit-extraction") return "kit-extraction";
    if (request?.requestType === "transfer") return "transfer";
    if (item?.status === "in-use" && item.assignedTo && !isCurrentUserMatch(item.assignedTo)) return "transfer";
    return "checkout";
  };

  const canRequestEquipmentItem = (item: Equipment, projectInfo?: { projectId?: string } | undefined) => {
    if (!canRequestCheckout || projectInfo) return false;
    if (!isEquipmentOperable(item)) return false;
    if (item.status === "available") return true;
    return item.status === "in-use" && Boolean(item.assignedTo) && !isCurrentUserMatch(item.assignedTo);
  };

  const resetRequestContext = () => {
    setRequestEquipment(null);
    setRequestLocationChoice("");
    setRequestManualLocation("");
    setRequestNote("");
    setRequestQuantity("1");
    setRequestProjectId("none");
    setRequestCardIds(new Set());
  };
  const requestCompanyId = getEquipmentCompanyId(requestEquipment) || primaryCompanyId;
  const requestLocations = locations.filter((location) =>
    !location.archivedAt && String(location.companyId || "") === requestCompanyId,
  );
  const requestProjects = projects.filter((project) =>
    String(project.companyId || "") === requestCompanyId && String(project.status || "") !== "archived",
  );
  const requestKanbanCards = kanbanCards.filter((card) =>
    String(card.companyId || "") === requestCompanyId,
  );

  const pendingRequests = checkoutRequests.filter((item) => item.status === "pending");
  const managedPendingRequests = pendingRequests.filter((item) =>
    manageableCompanyIds.includes(String(item.companyId || "").trim()),
  );
  const requestGroupTime = (value?: string | null) => {
    const date = value ? new Date(value) : new Date(0);
    if (Number.isNaN(date.getTime())) return "no-date";
    date.setSeconds(0, 0);
    return date.toISOString();
  };
  const managedPendingRequestGroups = Object.values(
    managedPendingRequests.reduce<Record<string, {
      id: string;
      requests: typeof managedPendingRequests;
      requester: string;
      requestType: string;
      location?: string | null;
      createdAt?: string;
    }>>((acc, request) => {
      const key = [
        request.requestedBy,
        request.requestType || "checkout",
        request.physicalDestination?.displayName || request.location || "",
        request.projectId || "",
        [...(request.kanbanCardIds || [])].sort().join(","),
        requestGroupTime(request.createdAt),
      ].join("|");
      if (!acc[key]) {
        acc[key] = {
          id: key,
          requests: [],
          requester: request.requestedBy,
          requestType: request.requestType || "checkout",
          location: request.physicalDestination?.displayName || request.location,
          createdAt: request.createdAt,
        };
      }
      acc[key].requests.push(request);
      return acc;
    }, {}),
  ).sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime());
  const managedPendingRequestViews: WarehousePendingRequestGroupView[] = managedPendingRequestGroups.map((group) => {
    const request = group.requests[0];
    const items = group.requests
      .map((entry) => equipment.find((item) => item.id === entry.equipmentId))
      .filter(Boolean) as Equipment[];
    const fallbackEquipment = equipment.find((item) => item.id === request.equipmentId);
    const requestType = getCheckoutRequestType(request, fallbackEquipment) as WarehousePendingRequestGroupView["requestType"];
    return {
      id: group.id,
      requestIds: group.requests.map((entry) => entry.id),
      items,
      fallbackEquipmentName: fallbackEquipment?.name || "Оборудование",
      requesterName: getAssignedUserName(request.requestedBy),
      requestType,
      currentHolderName: getAssignedUserName(request.currentHolder || fallbackEquipment?.assignedTo),
      quantity: Math.max(1, Number(request.quantity || 1)),
      destination: String(request.physicalDestination?.displayName || request.location || ""),
      projectName: String(request.workContext?.project?.name || ""),
      kanbanCardTitles: request.workContext?.kanbanCards?.map((card) => card.title) || [],
      note: String(request.note || ""),
    };
  });
  const getPendingRequestForEquipment = (equipmentId: string) =>
    pendingRequests.find((item) => item.equipmentId === equipmentId);

  const canDeleteEquipmentItem = (item: Equipment) => {
    const specifications = (item.specifications && typeof item.specifications === "object" && !Array.isArray(item.specifications))
      ? item.specifications as Record<string, unknown>
      : {};
    const creatorId = String(specifications.createdByUserId ?? "").trim();
    const companyId = String(specifications.companyId ?? "").trim();
    if (creatorId && currentUser?.id === creatorId) return true;
    if (manageableCompanyIds.includes(companyId)) return true;
    return Array.isArray(currentUser?.permissions) && currentUser.permissions.includes("equipment:delete");
  };

  const employeeFilterOptions = users
    .map((user) => ({
      id: user.id,
      label: user.name || user.username || "Сотрудник",
      count: equipmentMatchingBaseFilters.filter((item) => matchesAssignedUser(item.assignedTo, user)).length,
    }))
    .filter((option) => option.count > 0)
    .sort((left, right) => left.label.localeCompare(right.label, "ru"));

  const unknownEmployeeFilterOptions = Array.from(
    new Set(
      equipment
        .filter((item) => matchesEquipmentBaseFilters(item, equipmentFilterState))
        .map((item) => String(item.assignedTo ?? "").trim())
        .filter(Boolean)
        .filter((assignedTo) => !users.some((user) => matchesAssignedUser(assignedTo, user))),
    ),
  ).map((assignedTo) => ({
    id: `raw:${assignedTo}`,
    label: assignedTo,
    count: equipmentMatchingBaseFilters.filter((item) => String(item.assignedTo ?? "").trim() === assignedTo).length,
  }));

  const getRequestStatusText = (status: string | null | undefined) => {
    switch (status) {
      case "approved": return "Подтверждено";
      case "rejected": return "Отклонено";
      case "pending": return "Ожидает решения";
      default: return status || "История";
    }
  };

  const myCurrentEquipment = equipment.filter((item) => item.status === "in-use" && isCurrentUserMatch(item.assignedTo));
  const myHistoryItems = [
    ...myCurrentEquipment.map((item) => ({
      id: `current-${item.id}`,
      equipmentName: item.name,
      model: item.model,
      status: "Сейчас у вас",
      tone: "current",
      date: item.lastUsed ? new Date(item.lastUsed) : null,
      location: item.location,
      note: "",
    })),
    ...checkoutRequests
      .filter((request) => isCurrentUserMatch(request.requestedBy))
      .map((request) => {
        const item = equipment.find((entry) => entry.id === request.equipmentId);
        return {
          id: `request-${request.id}`,
          equipmentName: item?.name || "Оборудование",
          model: item?.model,
          status: request.requestType === "kit-extraction"
            ? `Извлечение: ${getRequestStatusText(request.status)}`
            : request.requestType === "transfer"
              ? `Перенос: ${getRequestStatusText(request.status)}`
              : `Выдача: ${getRequestStatusText(request.status)}`,
          tone: request.status || "history",
          date: request.createdAt ? new Date(request.createdAt) : null,
          location: request.location,
          note: request.decisionNote || request.note || "",
        };
      }),
  ].sort((left, right) => (right.date?.getTime() || 0) - (left.date?.getTime() || 0));

  const myHistoryGroups = Object.values(
    myHistoryItems.reduce<Record<string, {
      id: string;
      status: string;
      tone: string;
      date: Date | null;
      location?: string | null;
      note?: string;
      items: typeof myHistoryItems;
    }>>((acc, entry) => {
      const date = entry.date ? new Date(entry.date) : null;
      if (date && !Number.isNaN(date.getTime())) date.setSeconds(0, 0);
      const key = [
        entry.status,
        entry.location || "",
        date ? date.toISOString() : "no-date",
      ].join("|");
      if (!acc[key]) {
        acc[key] = {
          id: key,
          status: entry.status,
          tone: entry.tone,
          date: entry.date,
          location: entry.location,
          note: entry.note,
          items: [],
        };
      }
      acc[key].items.push(entry);
      if (!acc[key].note && entry.note) acc[key].note = entry.note;
      return acc;
    }, {}),
  ).sort((left, right) => (right.date?.getTime() || 0) - (left.date?.getTime() || 0));

  const equipmentByEmployee = equipment
    .filter((item) => item.status === "in-use" && item.assignedTo)
    .reduce<Record<string, Equipment[]>>((acc, item) => {
      const key = String(item.assignedTo || "").trim();
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});

  const isReturnOverdue = (returnDateStr: string, returnTimeStr?: string) => {
    const due = new Date(`${returnDateStr}T${returnTimeStr || "23:59"}`);
    if (Number.isNaN(due.getTime())) {
      const today = new Date().toISOString().slice(0, 10);
      return returnDateStr < today;
    }
    return due.getTime() < Date.now();
  };

  const overdueCount = equipmentOnProjects.filter((entry) =>
    (entry.sources || ["project-bundle"]).includes("project-bundle") &&
    isReturnOverdue(entry.returnDate, entry.returnTime),
  ).length;
  const activeFilterCount = countActiveEquipmentFilters(equipmentFilterState, canApproveCheckout);
  const kitAddOperationalContext = kitAddBundle ? getKitOperationalContext(kitAddBundle) : null;
  const kitAddBundleCompanyId = String(asRecord(kitAddBundle?.specifications).companyId || "").trim();
  const normalizedKitAddSearch = kitAddSearch.trim().toLocaleLowerCase("ru-RU");
  const kitAddCandidates = kitAddBundle
    ? equipment
        .filter((item) => {
          if (item.id === kitAddBundle.id || item.status !== "available") return false;
          if (getEquipmentOperabilityStatus(item) !== "working" || getParentBundleId(item)) return false;
          const candidateCompanyId = String(asRecord(item.specifications).companyId || "").trim();
          if (kitAddBundleCompanyId && candidateCompanyId && candidateCompanyId !== kitAddBundleCompanyId) return false;
          if (isSuperPosition(item) && bundleContainsEquipment(item, kitAddBundle.id, equipment)) return false;
          if (!normalizedKitAddSearch) return true;
          return [item.name, item.model, item.inventoryNumber]
            .some((value) => String(value || "").toLocaleLowerCase("ru-RU").includes(normalizedKitAddSearch));
        })
        .sort((left, right) => left.name.localeCompare(right.name, "ru"))
    : [];
  const hasShownOverdueRef = useRef(false);
  useEffect(() => {
    if (overdueCount > 0 && equipment.length > 0 && !hasShownOverdueRef.current) {
      hasShownOverdueRef.current = true;
      toast({
        title: "Напоминание: просрочено возвращение оборудования",
        description: `Оборудование по ${overdueCount} позиции(ям) не возвращено в срок. Проверьте карточки с меткой «Просрочено возвращение».`,
        variant: "destructive",
      });
    }
  }, [overdueCount, equipment.length]);

  if (isLoading) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-4 px-2 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-48 animate-pulse rounded-control bg-muted" />
          <div className="h-9 w-32 animate-pulse rounded-control bg-muted" />
        </div>
        <div className="rounded-surface border border-border/50 bg-surface-raised p-3 shadow-xs">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-surface border border-border/40 bg-surface-subtle"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col gap-4 px-2 py-3 sm:px-4 sm:py-4">
      {/* Header: фиксированная шапка и фильтры, скролл только у списка */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-foreground sm:text-2xl">Склад техники</h2>
            <p className="text-sm text-muted-foreground">
              Оборудование, комплекты, выдача и места хранения.
            </p>
          </div>
          {userCanCreate && (
            <Button
              className="shrink-0"
              onClick={() => { setSelectedEquipment(null); setIsFormOpen(true); }} 
              data-testid="button-add-equipment"
            >
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Добавить</span>
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-w-0 flex-1 border-border/50 bg-surface-raised sm:flex-none"
            onClick={() => setWarehouseSettingsOpen(true)}
          >
            <Settings className="w-4 h-4 mr-1.5 sm:mr-2" />
            Настройки склада
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            className="min-w-0 flex-1 border-border/50 bg-surface-raised sm:flex-none"
            onClick={() => setIsScannerOpen(true)}
            data-testid="button-scan-barcode"
          >
            <ScanBarcode className="w-4 h-4 mr-1.5 sm:mr-2" />
            Сканировать
          </Button>
          <WarehouseHistorySheet
            open={historyOpen}
            groups={myHistoryGroups}
            onOpenChange={setHistoryOpen}
          />
          <WarehouseCartSheet
            open={cartOpen}
            cart={cart}
            projects={projects}
            equipmentCountByProject={equipmentCountByProject}
            canReserve={userCanReserve}
            canRequestCheckout={canRequestCheckout}
            sendToProjectId={sendToProjectId}
            handoffAt={handoffAt}
            returnDate={returnDate}
            returnTime={returnTime}
            passDirection={passDirection}
            passBasis={passBasis}
            passResponsiblePhone={passResponsiblePhone}
            passPending={passDocumentMutation.isPending}
            takePending={takeCartForSelfMutation.isPending}
            sendPending={sendToProjectMutation.isPending}
            onOpenChange={setCartOpen}
            onRemove={removeFromCart}
            onClear={clearCart}
            onSendToProjectIdChange={setSendToProjectId}
            onHandoffAtChange={setHandoffAt}
            onReturnDateChange={setReturnDate}
            onReturnTimeChange={setReturnTime}
            onPassDirectionChange={setPassDirection}
            onPassBasisChange={setPassBasis}
            onPassResponsiblePhoneChange={setPassResponsiblePhone}
            onDownloadPass={() => passDocumentMutation.mutate()}
            onTakeForSelf={() => runWithKitSafety(
              cart,
              userCanReserve ? "Забрать себе" : "Запросить себе",
              userCanReserve ? "cart-direct-take" : "cart-checkout-request",
              (kitExtractions) => takeCartForSelfMutation.mutate({
                items: cart,
                kitExtractions,
              }),
            )}
            onSendToProject={(input) => {
              const user = getCurrentUser();
              const name = user?.name || user?.username || "Сотрудник";
              runWithKitSafety(
                cart,
                "Отправить на проект",
                `project-send:${input.projectId}`,
                (kitExtractions) => sendToProjectMutation.mutate({
                  projectId: input.projectId,
                  equipmentIds: cart.map((item) => item.id),
                  handoffAt: input.handoffAt,
                  returnDate: input.returnDate,
                  returnTime: input.returnTime,
                  assignedByName: name,
                  assignedByUserId: user?.id,
                  kitExtractions,
                }),
              );
            }}
          />
        </div>
      </div>

      <WarehouseFilters
        mobileOpen={mobileFiltersOpen}
        searchTerm={searchTerm}
        status={statusFilter}
        category={typeFilter}
        operability={operabilityFilter}
        employee={employeeFilter}
        activeFilterCount={activeFilterCount}
        canFilterByEmployee={canApproveCheckout}
        categoryOptions={warehouseCategoryFilterOptions}
        employeeOptions={employeeFilterOptions}
        unknownEmployeeOptions={unknownEmployeeFilterOptions}
        selectedCount={selectedIds.size}
        filteredCount={filteredEquipment.length}
        exportCount={toExport.length}
        printCount={selectedEquipmentForLabels.length}
        bundleCount={selectedEquipmentForBundle.length}
        printPending={printEquipmentLabelsMutation.isPending}
        bundlePending={createBundleMutation.isPending}
        onMobileOpenChange={setMobileFiltersOpen}
        onSearchTermChange={setSearchTerm}
        onStatusChange={setStatusFilter}
        onCategoryChange={setTypeFilter}
        onOperabilityChange={setOperabilityFilter}
        onEmployeeChange={setEmployeeFilter}
        onReset={() => {
          setSearchTerm("");
          setStatusFilter("all");
          setOperabilityFilter("all");
          setTypeFilter("all");
          setEmployeeFilter("all");
        }}
        onToggleSelectAll={toggleSelectAll}
        onExport={exportBarcodesToExcel}
        onPrint={() => printEquipmentLabels(selectedEquipmentForLabels)}
        onCreateBundle={openBundleDialog}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          Показано: {filteredEquipment.length} из {equipment.length}
        </span>
        {activeFilterCount > 0 && (
          <span>
            Фильтры применены: {activeFilterCount}
          </span>
        )}
      </div>

      {canApproveCheckout && (
        <WarehousePendingRequests
          groups={managedPendingRequestViews}
          approvePending={approveCheckoutMutation.isPending}
          rejectPending={rejectCheckoutMutation.isPending}
          onApprove={(group) => {
            const isKitExtraction = group.requestType === "kit-extraction";
            runWithKitSafety(
              group.items,
              isKitExtraction ? "Подтвердить извлечение" : "Разрешить выдачу",
              isKitExtraction ? "manager-extraction-approval" : "manager-checkout-approval",
              (kitExtractions) => approveCheckoutMutation.mutate({
                requestIds: group.requestIds,
                kitExtractions,
                kitExtractionApproval: isKitExtraction,
              }),
            );
          }}
          onReject={(requestIds) => rejectCheckoutMutation.mutate(requestIds)}
        />
      )}

      {false && canApproveCheckout && Object.keys(equipmentByEmployee).length > 0 && (
        <Card className="border-border/50 bg-surface-raised">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-foreground">
              Что сейчас на руках у сотрудников
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Здесь видно, кто что забрал себе вне проектных наборов.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {Object.entries(equipmentByEmployee).map(([userId, items]) => (
              <div
                key={userId}
                className="rounded-control border border-border/40 bg-surface-subtle p-4"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium text-foreground">
                    {getAssignedUserName(userId) || "Сотрудник"}
                  </div>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="space-y-1.5 text-sm text-muted-foreground">
                  {items.map((item) => (
                    <div key={item.id} className="break-words">
                      {item.name}
                      {item.model ? ` · ${item.model}` : ""}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Equipment Grid: скролл только здесь, контент не съезжает за края */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredEquipment.length === 0 ? (
          <div className="col-span-full rounded-surface border border-dashed border-border/60 bg-surface-raised px-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Package className="h-5 w-5" />
            </div>
            <p className="font-medium text-foreground">Оборудование не найдено</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Показано: 0 из {equipment.length}
            </p>
          </div>
        ) : (
          filteredEquipment.map((item: Equipment) => {
            const projectInfo = getOnProjectInfo(item.id);
            const contextProjectInfo = getAnyProjectContext(item.id);
            const pendingRequest = getPendingRequestForEquipment(item.id);
            const requestType = getCheckoutRequestType(pendingRequest, item);
            const canReturnOwnItem = item.status === "in-use" && isCurrentUserMatch(item.assignedTo);
            return (
              <EquipmentCard
                key={item.id}
                item={item}
                allEquipment={equipment}
                selected={selectedIds.has(item.id)}
                inCart={cart.some((entry) => entry.id === item.id)}
                projectInfo={projectInfo}
                contextProjectInfo={contextProjectInfo}
                pendingRequest={pendingRequest}
                requestType={requestType}
                requestedByCurrentUser={Boolean(
                  pendingRequest?.requestedBy && isCurrentUserMatch(pendingRequest.requestedBy),
                )}
                canReturnOwnItem={canReturnOwnItem}
                canRequestItem={
                  !userCanReserve &&
                  !canReturnOwnItem &&
                  canRequestEquipmentItem(item, projectInfo)
                }
                canReserve={userCanReserve}
                canEdit={userCanEdit}
                canDelete={canDeleteEquipmentItem(item)}
                currentUserId={currentUser?.id}
                expanded={expandedBundleIds.has(item.id)}
                printPending={printEquipmentLabelsMutation.isPending}
                calibratePending={calibrateLabelPrinterMutation.isPending}
                returnPending={returnToWarehouseMutation.isPending}
                deletePending={deleteEquipmentMutation.isPending}
                removeKitPending={removeKitComponentMutation.isPending}
                getAssignedUserName={getAssignedUserName}
                getProjectInfo={getOnProjectInfo}
                isReturnOverdue={isReturnOverdue}
                onToggleSelected={(selected) => toggleSelect(selected.id)}
                onOpenDetails={setDetailsEquipment}
                onOpenBarcode={(selected) => {
                  setBarcodeEquipment(selected);
                  setIsBarcodeModalOpen(true);
                }}
                onPrint={(selected) => printEquipmentLabels([selected])}
                onCalibrate={() => calibrateLabelPrinterMutation.mutate()}
                onAddToCart={addToCart}
                onTakeReturn={(selected, returnViaParentBundle) => {
                  if (returnViaParentBundle) {
                    openKitReturnPath(selected);
                    return;
                  }
                  if (selected.status !== "in-use" && !isEquipmentOperable(selected)) {
                    toast({
                      title: "Недоступно для выдачи",
                      description: getInoperableMessage(selected),
                      variant: "destructive",
                    });
                    return;
                  }
                  setSelectedEquipment(selected);
                  setFormMode("take_return");
                  setIsFormOpen(true);
                }}
                onReturnOwn={(selected, returnViaParentBundle) => {
                  if (returnViaParentBundle) {
                    openKitReturnPath(selected);
                    return;
                  }
                  setProjectReturnMode("direct");
                  setProjectReturnEquipment(selected);
                  setProjectReturnStorageId(
                    String(selected.storageLocationId || "") ||
                    (getEquipmentStorageLocation(selected) ? "manual" : "none"),
                  );
                  setProjectReturnManualStorage(
                    selected.storageLocationId ? "" : getEquipmentStorageLocation(selected),
                  );
                }}
                onRequest={(selected) => {
                  if (!isEquipmentOperable(selected)) {
                    toast({
                      title: "Недоступно для выдачи",
                      description: getInoperableMessage(selected),
                      variant: "destructive",
                    });
                    return;
                  }
                  setRequestEquipment(selected);
                  setRequestLocationChoice("");
                  setRequestManualLocation("");
                  setRequestNote("");
                  setRequestProjectId("none");
                  setRequestCardIds(new Set());
                }}
                onEdit={(selected) => {
                  setSelectedEquipment(selected);
                  setFormMode("full");
                  setIsFormOpen(true);
                }}
                onDelete={async (selected) => {
                  const confirmed = await confirmAction({
                    title: `Удалить «${selected.name}»?`,
                    description: "Позиция будет удалена со склада. Связи с комплектами будут обработаны отдельно.",
                    confirmLabel: "Удалить",
                    destructive: true,
                  });
                  if (!confirmed) return;
                  runWithKitSafety(
                    [selected],
                    "Удалить со склада",
                    "equipment-delete",
                    (kitExtractions) => deleteEquipmentMutation.mutate({
                      equipmentId: selected.id,
                      kitExtraction: kitExtractions[selected.id],
                    }),
                  );
                }}
                onProjectReturn={(selected, isKitComponent) => {
                  if (isKitComponent) {
                    openKitReturnPath(selected);
                    return;
                  }
                  setProjectReturnMode("project");
                  setProjectReturnEquipment(selected);
                  setProjectReturnStorageId(
                    String(selected.storageLocationId || "") ||
                    (getEquipmentStorageLocation(selected) ? "manual" : "none"),
                  );
                  setProjectReturnManualStorage(
                    selected.storageLocationId ? "" : getEquipmentStorageLocation(selected),
                  );
                }}
                onToggleBundle={(bundle) => setExpandedBundleIds((current) => {
                  const next = new Set(current);
                  if (next.has(bundle.id)) next.delete(bundle.id);
                  else next.add(bundle.id);
                  return next;
                })}
                onAddBundleComponent={openKitAddDialog}
                onOpenBundleComponent={openBundleComponentDetails}
                onRemoveBundleComponent={removeKitComponent}
              />
            );
          })
        )}
        </div>
      </div>

      <WarehouseSettings
        open={warehouseSettingsOpen}
        onOpenChange={setWarehouseSettingsOpen}
        canManage={userCanEdit}
      />

      <WarehouseReturnDialog
        equipment={projectReturnEquipment}
        storageLocations={warehouseStorageLocations}
        storageChoice={projectReturnStorageId}
        manualStorage={projectReturnManualStorage}
        pending={returnToWarehouseMutation.isPending}
        onStorageChoiceChange={(value) => {
          setProjectReturnStorageId(value);
          if (value !== "manual") setProjectReturnManualStorage("");
        }}
        onManualStorageChange={setProjectReturnManualStorage}
        onClose={() => {
          setProjectReturnEquipment(null);
          setProjectReturnStorageId("none");
          setProjectReturnManualStorage("");
        }}
        onSubmit={(selection) => {
          if (!projectReturnEquipment) return;
          returnToWarehouseMutation.mutate({
            equipmentId: projectReturnEquipment.id,
            ...selection,
            fromProject: projectReturnMode === "project",
          });
        }}
      />

      {/* Equipment Form */}
      <EquipmentForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
        mode={formMode}
        companyManager={canApproveCheckout}
        companyId={selectedEquipment ? getEquipmentCompanyId(selectedEquipment) : primaryCompanyId}
        categories={warehouseCategories}
        storageLocations={warehouseStorageLocations}
        locations={locations}
        projects={projects}
        kanbanCards={kanbanCards}
        parentBundleExists={selectedEquipment
          ? Boolean(equipment.some((candidate) => candidate.id === getParentBundleId(selectedEquipment)))
          : true}
        onOpenParentBundle={(component) => {
          setIsFormOpen(false);
          setSelectedEquipment(null);
          openKitReturnPath(component);
        }}
      />

      {/* Barcode Scanner */}
      <BarcodeScanner
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onEquipmentFound={(foundEquipment: Equipment) => {
          if (userCanReserve) {
            const parentBundleId = getParentBundleId(foundEquipment);
            const parentBundleExists = Boolean(parentBundleId && equipment.some((candidate) => candidate.id === parentBundleId));
            if (foundEquipment.status === "in-use" && parentBundleExists) {
              openKitReturnPath(foundEquipment);
              setIsScannerOpen(false);
              return;
            }
            if (foundEquipment.status !== "in-use" && !isEquipmentOperable(foundEquipment)) {
              toast({ title: "Недоступно для выдачи", description: getInoperableMessage(foundEquipment), variant: "destructive" });
              setDetailsEquipment(foundEquipment);
              setIsScannerOpen(false);
              return;
            }
            setSelectedEquipment(foundEquipment);
            setFormMode("take_return");
            setIsFormOpen(true);
          } else if (userCanEdit) {
            setSelectedEquipment(foundEquipment);
            setFormMode("full");
            setIsFormOpen(true);
          } else if (canRequestEquipmentItem(foundEquipment, getOnProjectInfo(foundEquipment.id))) {
            if (!isEquipmentOperable(foundEquipment)) {
              toast({ title: "Недоступно для выдачи", description: getInoperableMessage(foundEquipment), variant: "destructive" });
              setDetailsEquipment(foundEquipment);
              setIsScannerOpen(false);
              return;
            }
            setRequestEquipment(foundEquipment);
            setRequestLocationChoice("");
            setRequestManualLocation("");
            setRequestNote("");
            setRequestProjectId("none");
            setRequestCardIds(new Set());
          } else {
            setDetailsEquipment(foundEquipment);
          }
          setIsScannerOpen(false);
        }}
        onBarcodeScanned={(barcode: string) => {
          setSearchTerm(barcode);
          setIsScannerOpen(false);
        }}
        companyManager={canApproveCheckout}
        canRequestCheckout={canRequestCheckout}
      />

      {/* Barcode Generator Modal */}
      <EquipmentBarcodeModal
        isOpen={isBarcodeModalOpen}
        onClose={() => {
          setIsBarcodeModalOpen(false);
          setBarcodeEquipment(null);
        }}
        equipment={barcodeEquipment}
      />

      <EquipmentBundleCreateDialog
        open={bundleDialogOpen}
        name={bundleName}
        categoryId={bundleCategoryId}
        categoryOptions={warehouseCategoryFilterOptions}
        items={selectedEquipmentForBundle}
        pending={createBundleMutation.isPending}
        onOpenChange={setBundleDialogOpen}
        onNameChange={setBundleName}
        onCategoryIdChange={setBundleCategoryId}
        onSubmit={({ name, categoryId, items }) => createBundleMutation.mutate({
          name,
          type: categoryId
            ? warehouseCategoryById.get(categoryId)?.name || "other"
            : "other",
          categoryId,
          items,
        })}
      />

      <EquipmentKitAddDialog
        bundle={kitAddBundle}
        candidates={kitAddCandidates}
        selectedIds={kitAddSelectedIds}
        search={kitAddSearch}
        reason={kitAddReason}
        approvalPhrase={kitAddApprovalPhrase}
        operationalContext={kitAddOperationalContext}
        canOverrideActiveKit={canOverrideActiveKit}
        pending={addKitComponentsMutation.isPending}
        onClose={closeKitAddDialog}
        onSearchChange={setKitAddSearch}
        onSelectedIdsChange={setKitAddSelectedIds}
        onReasonChange={setKitAddReason}
        onApprovalPhraseChange={setKitAddApprovalPhrase}
        onSubmit={(input) => addKitComponentsMutation.mutate(input)}
      />

      <EquipmentCheckoutRequestDialog
        equipment={requestEquipment}
        requestType={getCheckoutRequestType(undefined, requestEquipment) as "checkout" | "transfer"}
        companyId={String(requestCompanyId || "")}
        assignedUserName={requestEquipment?.assignedTo
          ? getAssignedUserName(requestEquipment.assignedTo)
          : ""}
        locations={requestLocations}
        projects={requestProjects}
        cards={requestKanbanCards}
        locationChoice={requestLocationChoice}
        manualLocation={requestManualLocation}
        quantity={requestQuantity}
        projectId={requestProjectId}
        selectedCardIds={requestCardIds}
        note={requestNote}
        pending={requestCheckoutMutation.isPending}
        onClose={resetRequestContext}
        onLocationChoiceChange={setRequestLocationChoice}
        onManualLocationChange={setRequestManualLocation}
        onQuantityChange={setRequestQuantity}
        onProjectIdChange={setRequestProjectId}
        onSelectedCardIdsChange={setRequestCardIds}
        onNoteChange={setRequestNote}
        onValidationError={({ title, description }) => toast({
          title,
          description,
          variant: "destructive",
        })}
        onSubmit={(input) => {
          if (!requestEquipment) return;
          runWithKitSafety(
            [requestEquipment],
            input.requestType === "transfer" ? "Запросить перенос" : "Запросить выдачу",
            "single-checkout-request",
            (kitExtractions) => requestCheckoutMutation.mutate({
              equipmentId: requestEquipment.id,
              ...input,
              companyId: requestCompanyId,
              kitExtraction: kitExtractions[requestEquipment.id],
            }),
          );
        }}
      />

      <EquipmentKitSafetyDialog
        entries={kitSafetyEntries}
        actionLabel={kitSafetyActionLabel}
        reason={kitSafetyReason}
        overridePhrase={kitOverridePhrase}
        canOverrideActiveKit={canOverrideActiveKit}
        requestPending={requestKitExtractionMutation.isPending}
        onReasonChange={setKitSafetyReason}
        onOverridePhraseChange={setKitOverridePhrase}
        onClose={closeKitSafetyDialog}
        onConfirm={confirmKitExtraction}
        onRequestManager={(entries, reason) => requestKitExtractionMutation.mutate({
          entries,
          reason,
        })}
      />

      {cart.length > 0 && (
        <Button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-surface hover:bg-primary/90 sm:bottom-6 sm:right-6"
          data-testid="floating-cart-button"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-overlay px-1 text-[11px] font-semibold text-primary shadow-xs">
            {cart.length}
          </span>
        </Button>
      )}

      <EquipmentDetailsDialog
        equipment={detailsEquipment}
        allEquipment={equipment}
        canEdit={userCanEdit}
        canComment={Boolean(
          detailsEquipment &&
          currentUser?.id &&
          getEquipmentCompanyId(detailsEquipment),
        )}
        assignedUserName={detailsEquipment?.assignedTo
          ? getAssignedUserName(detailsEquipment.assignedTo)
          : ""}
        canReturnToBundle={Boolean(detailsReturnBundleId)}
        note={detailsNote}
        noteAutosaveStatus={equipmentNoteAutosave.status}
        noteAutosaveError={equipmentNoteAutosave.error}
        removePending={removeKitComponentMutation.isPending}
        onClose={closeEquipmentDetails}
        onBackToBundle={() => {
          if (!detailsReturnBundleId) return;
          const bundle = equipment.find((item) => item.id === detailsReturnBundleId);
          if (!bundle) return;
          setDetailsEquipment(bundle);
          setDetailsReturnBundleId(null);
        }}
        onAddToKit={openKitAddDialog}
        onOpenComponent={openBundleComponentDetails}
        onRemoveComponent={removeKitComponent}
        onOpenParent={openParentBundleDetails}
        onNoteChange={setDetailsNote}
        onActivity={() => {
          queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
          queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
        }}
      />

    </div>
  );
}
