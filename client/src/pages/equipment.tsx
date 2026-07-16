import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Package, Plus, Mic, Camera, Lightbulb, Monitor, Gavel, Edit, MapPin, ScanBarcode, QrCode, ArrowRightLeft, ShoppingCart, Send, Trash2, User, Calendar, AlertTriangle, FileSpreadsheet, PackageCheck, FileText, Search, X, Clock, SlidersHorizontal, History, MessageSquare, Printer, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { EquipmentForm } from "@/components/forms/equipment-form";
import { BarcodeScanner } from "@/components/equipment/barcode-scanner";
import { EquipmentBarcodeModal } from "@/components/equipment/barcode-generator";
import { canCreateEquipment, canEditEquipment, canReserveEquipment } from "@/lib/equipment-permissions";
import { buildBarcodeLabelBitmapPayload, renderCompactBarcodeLabel } from "@/lib/barcode-label";
import { apiRequest, apiUrl, encodeUserHeader } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscriptions } from "@/hooks/use-websocket";
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";
import { cn } from "@/lib/utils";
import type { Equipment } from "@shared/schema";

function getCurrentUser() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem('streamstudio_user') || '{}');
  } catch {
    return null;
  }
}

function toLocalDateTimeInputValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatReturnDateTime(dateValue: string, timeValue?: string) {
  if (!dateValue) return "";
  const date = new Date(`${dateValue}T${timeValue || "23:59"}`);
  if (Number.isNaN(date.getTime())) return [dateValue, timeValue].filter(Boolean).join(" ");
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSpecificationValue(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return String(record.name || record.caption || record.model || record.description || "").trim();
        }
        return String(item ?? "").trim();
      })
      .filter(Boolean)
      .join(", ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, itemValue]) => {
        if (itemValue && typeof itemValue === "object") return "";
        return `${key}: ${String(itemValue ?? "").trim()}`;
      })
      .filter(Boolean)
      .join(", ");
  }
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

const INTERNAL_SPECIFICATION_KEYS = new Set([
  "agent",
  "agentKey",
  "checkout",
  "checkoutHistory",
  "companyId",
  "createdBy",
  "createdByUserId",
  "noteAudit",
  "notesHistory",
  "equipmentComments",
  "isSuperPosition",
  "bundleType",
  "bundleComponentIds",
  "bundleComponents",
  "assembledAt",
  "assembledByUserId",
  "assembledByName",
  "parentBundleId",
  "parentBundleName",
  "parentBundleCreatedAt",
  "bundleExtractionHistory",
  "kitExtractionHistory",
  "hardware",
  "metrics",
  "metricsHistory",
  "workspace",
  "localIps",
  "syncedAt",
  "systemId",
  "source",
  "deviceType",
]);

type EquipmentComment = {
  id: string;
  text: string;
  authorId?: string | null;
  authorName?: string | null;
  createdAt: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function getSpecificationEntries(specifications: unknown): Array<[string, string]> {
  if (!specifications || typeof specifications !== "object" || Array.isArray(specifications)) {
    return [];
  }

  return Object.entries(specifications as Record<string, unknown>)
    .filter(([key]) => !INTERNAL_SPECIFICATION_KEYS.has(String(key ?? "").trim()))
    .map(([key, value]) => [String(key).trim(), formatSpecificationValue(value)] as [string, string])
    .filter(([key, value]) => key && value);
}

function getEquipmentPhotos(item: Equipment | null | undefined): string[] {
  return Array.isArray(item?.photos)
    ? (item?.photos as unknown[])
        .map((photo) => String(photo || "").trim())
        .filter(Boolean)
        .filter((photo) => !photo.startsWith("blob:"))
        .map((photo) => {
          const normalized = photo.replace(/\\/g, "/");
          if (/^(https?:)?\/\//i.test(normalized) || normalized.startsWith("/")) return normalized;
          if (normalized.includes("uploads/")) return `/${normalized.replace(/^\/+/, "")}`;
          return `/uploads/${normalized.replace(/^\/+/, "")}`;
        })
    : [];
}

function getEquipmentComments(item: Equipment | null | undefined): EquipmentComment[] {
  const comments = asRecord(item?.specifications).equipmentComments;
  if (!Array.isArray(comments)) return [];
  return comments
    .map((comment: any) => ({
      id: String(comment?.id || `comment-${comment?.createdAt || Math.random()}`),
      text: String(comment?.text || "").trim(),
      authorId: comment?.authorId ? String(comment.authorId) : null,
      authorName: comment?.authorName ? String(comment.authorName) : null,
      createdAt: String(comment?.createdAt || new Date().toISOString()),
    }))
    .filter((comment) => comment.text);
}

function getEquipmentStorageLocation(item: Equipment | null | undefined) {
  return String(item?.storageLocation || "").trim();
}

function getEquipmentResponsiblePerson(item: Equipment | null | undefined) {
  return String(item?.responsiblePerson || "").trim();
}

function getEquipmentResponsibleContact(item: Equipment | null | undefined) {
  return String(item?.responsibleContact || "").trim();
}

function getEquipmentCompanyId(item: Equipment | null | undefined) {
  return String(asRecord(item?.specifications).companyId || "").trim();
}

function getEquipmentPhysicalDestination(item: Equipment | null | undefined) {
  const destination = asRecord((item as any)?.physicalDestination);
  return {
    locationId: String(destination.locationId || (item as any)?.locationId || "").trim(),
    locationName: String(destination.locationName || "").trim(),
    manualLocation: String(destination.manualLocation || (item as any)?.manualLocation || "").trim(),
    displayName: String(destination.displayName || item?.location || "").trim(),
    archived: destination.archived === true,
    legacyLocation: String(destination.legacyLocation || "").trim(),
  };
}

function getEquipmentContextLinks(item: Equipment | null | undefined) {
  const workContext = asRecord((item as any)?.workContext);
  return Array.isArray(workContext.links) ? workContext.links as any[] : [];
}

function getEquipmentOperabilityStatus(item: Equipment | null | undefined) {
  const explicit = String(item?.operabilityStatus || "").trim();
  if (explicit) return explicit;
  if (item?.status === "broken") return "broken";
  if (item?.status === "maintenance") return "on_repair";
  return "working";
}

function isSuperPosition(item: Equipment | null | undefined) {
  const specs = asRecord(item?.specifications);
  return specs.isSuperPosition === true || specs.bundleType === "super_position";
}

function getParentBundleName(item: Equipment | null | undefined) {
  return String(asRecord(item?.specifications).parentBundleName || "").trim();
}

function getParentBundleId(item: Equipment | null | undefined) {
  return String(asRecord(item?.specifications).parentBundleId || "").trim();
}

type KitExtractionPayload = {
  confirmed: true;
  override: boolean;
  bundleName: string;
  reason: string;
  context: string;
};

type KitSafetyEntry = {
  item: Equipment;
  bundle: Equipment;
  active: boolean;
  projectId?: string;
  projectName?: string;
};

function getBundleComponents(item: Equipment | null | undefined, allEquipment: Equipment[]) {
  const specs = asRecord(item?.specifications);
  const snapshots = Array.isArray(specs.bundleComponents) ? specs.bundleComponents as any[] : [];
  const ids = Array.isArray(specs.bundleComponentIds) ? specs.bundleComponentIds.map((id) => String(id)) : [];
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
          operabilityStatus: live ? getEquipmentOperabilityStatus(live) : String(entry?.operabilityStatus || "working"),
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

function getBundleComponentIds(item: Equipment | null | undefined) {
  const specs = asRecord(item?.specifications);
  return [...new Set([
    ...(Array.isArray(specs.bundleComponentIds) ? specs.bundleComponentIds : []),
    ...(Array.isArray(specs.bundleComponents)
      ? specs.bundleComponents.map((entry: any) => entry?.id)
      : []),
  ].map((id) => String(id || "").trim()).filter(Boolean))];
}

function bundleContainsEquipment(
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
    return Boolean(component && isSuperPosition(component) && bundleContainsEquipment(component, equipmentId, allEquipment, visited));
  });
}

export default function EquipmentPage() {
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
  const [detailsComment, setDetailsComment] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [cart, setCart] = useState<Equipment[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const [bundleType, setBundleType] = useState("computer");
  const [kitAddBundle, setKitAddBundle] = useState<Equipment | null>(null);
  const [kitAddSelectedIds, setKitAddSelectedIds] = useState<Set<string>>(new Set());
  const [kitAddSearch, setKitAddSearch] = useState("");
  const [kitAddReason, setKitAddReason] = useState("");
  const [kitAddApprovalPhrase, setKitAddApprovalPhrase] = useState("");
  const [expandedBundleIds, setExpandedBundleIds] = useState<Set<string>>(new Set());
  const [detailsReturnBundleId, setDetailsReturnBundleId] = useState<string | null>(null);
  const [kitSafetyEntries, setKitSafetyEntries] = useState<KitSafetyEntry[]>([]);
  const [kitSafetyActionLabel, setKitSafetyActionLabel] = useState("");
  const [kitSafetyContext, setKitSafetyContext] = useState("");
  const [kitSafetyReason, setKitSafetyReason] = useState("");
  const [kitOverridePhrase, setKitOverridePhrase] = useState("");
  const pendingKitActionRef = useRef<((payloads: Record<string, KitExtractionPayload>) => void) | null>(null);
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

  const addEquipmentCommentMutation = useMutation({
    mutationFn: async ({ equipmentItem, text }: { equipmentItem: Equipment; text: string }) => {
      const commentText = text.trim();
      if (!commentText) throw new Error("Введите комментарий");
      const currentComments = getEquipmentComments(equipmentItem);
      const nextComment: EquipmentComment = {
        id: `comment-${Date.now()}`,
        text: commentText,
        authorId: currentUser?.id || null,
        authorName: currentUser?.name || currentUser?.username || "Сотрудник",
        createdAt: new Date().toISOString(),
      };
      const response = await apiRequest("PUT", `/api/equipment/${equipmentItem.id}`, {
        specifications: {
          ...asRecord(equipmentItem.specifications),
          equipmentComments: [...currentComments, nextComment],
        },
      });
      return response.json();
    },
    onSuccess: (updated: Equipment) => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setDetailsEquipment(updated);
      setDetailsComment("");
      toast({ title: "Комментарий добавлен" });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось добавить комментарий", variant: "destructive" });
    },
  });

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

  const matchesAssignedUser = (
    assignedTo: string | null | undefined,
    user: { id?: string | null; name?: string | null; username?: string | null },
  ) => {
    const normalized = String(assignedTo ?? "").trim();
    if (!normalized) return false;
    return [user.id, user.name, user.username]
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .includes(normalized);
  };

  const matchesEmployeeFilter = (item: Equipment) => {
    if (!canApproveCheckout || employeeFilter === "all") return true;
    const assignedTo = String(item.assignedTo ?? "").trim();
    if (employeeFilter === "unassigned") return !assignedTo;
    if (employeeFilter.startsWith("raw:")) return assignedTo === employeeFilter.slice(4);
    const user = users.find((entry) => entry.id === employeeFilter);
    return user ? matchesAssignedUser(assignedTo, user) : assignedTo === employeeFilter;
  };

  const matchesEquipmentBaseFilters = (item: Equipment) => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = item.name.toLowerCase().includes(searchLower) ||
                         item.model?.toLowerCase().includes(searchLower) ||
                         item.serialNumber?.toLowerCase().includes(searchLower) ||
                         item.inventoryNumber?.toLowerCase().includes(searchLower) ||
                         item.barcode?.toLowerCase().includes(searchLower);
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesOperability = operabilityFilter === "all" || getEquipmentOperabilityStatus(item) === operabilityFilter;
    const matchesType = typeFilter === "all" || item.type === typeFilter;

    return matchesSearch && matchesStatus && matchesOperability && matchesType;
  };

  const equipmentMatchingBaseFilters = equipment.filter(matchesEquipmentBaseFilters);
  const filteredEquipment = equipmentMatchingBaseFilters.filter((item: Equipment) => matchesEmployeeFilter(item));

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "in-use": return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
      case "maintenance": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      case "broken": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      default: return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "available": return "Доступно";
      case "in-use": return "Используется";
      case "maintenance": return "Обслуживание";
      case "broken": return "Сломано";
      default: return status;
    }
  };

  const getOperabilityColor = (status: string) => {
    switch (status) {
      case "working": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
      case "broken": return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      case "on_repair": return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      default: return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getOperabilityText = (status: string) => {
    switch (status) {
      case "working": return "Исправно";
      case "broken": return "Неисправно";
      case "on_repair": return "В ремонте";
      default: return status || "Исправно";
    }
  };

  const isEquipmentOperable = (item: Equipment | null | undefined) =>
    getEquipmentOperabilityStatus(item) === "working";

  const getInoperableMessage = (item: Equipment | null | undefined) => {
    const status = getEquipmentOperabilityStatus(item);
    return status === "broken"
      ? "Оборудование помечено как неисправное и недоступно для выдачи."
      : "Оборудование находится в ремонте и недоступно для выдачи.";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "microphone": return <Mic className="w-5 h-5" />;
      case "camera": return <Camera className="w-5 h-5" />;
      case "lighting": return <Lightbulb className="w-5 h-5" />;
      case "computer": return <Monitor className="w-5 h-5" />;
      default: return <Gavel className="w-5 h-5" />;
    }
  };

  const getTypeText = (type: string) => {
    switch (type) {
      case "microphone": return "Микрофон";
      case "camera": return "Камера";
      case "lighting": return "Освещение";
      case "computer": return "Компьютер";
      default: return "Другое";
    }
  };

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
          getTypeText(item.type ?? "other"),
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
    mutationFn: async ({ name, type, items }: { name: string; type: string; items: Equipment[] }) => {
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
      setBundleType("computer");
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
    mutationFn: async (equipmentId: string) => {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (currentUser) (headers as Record<string, string>)["x-user"] = encodeUserHeader(currentUser);
      const res = await fetch(apiUrl("/api/equipment-return"), {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ equipmentId, userId: currentUser?.id }),
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
      toast({ title: "Готово", description: "Оборудование возвращено на склад" });
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

  const quickReturnMutation = useMutation({
    mutationFn: async (equipmentId: string) => {
      const response = await apiRequest("PUT", `/api/equipment/${equipmentId}`, {
        status: "available",
        assignedTo: null,
        lastUsed: new Date(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({ title: "Оборудование возвращено", description: "Позиция снова доступна на складе." });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось вернуть оборудование", variant: "destructive" });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: async ({ equipmentId, kitExtraction }: { equipmentId: string; kitExtraction?: KitExtractionPayload }) => {
      const response = await apiRequest("DELETE", `/api/equipment/${equipmentId}`, { kitExtraction });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-checkout-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
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
  const getCardProjectId = (card: {
    projectId?: string | null;
    boardProjectId?: string | null;
  }) => String(card.projectId || card.boardProjectId || "").trim();
  const requestKanbanCards = kanbanCards.filter((card) => {
    if (String(card.companyId || "") !== requestCompanyId) return false;
    const cardProjectId = getCardProjectId(card);
    return requestProjectId === "none" || cardProjectId === requestProjectId;
  });
  const changeRequestProject = (projectId: string) => {
    setRequestProjectId(projectId);
    if (projectId === "none") return;
    setRequestCardIds((current) => new Set(
      [...current].filter((cardId) => {
        const card = kanbanCards.find((entry) => entry.id === cardId);
        return card && getCardProjectId(card) === projectId;
      }),
    ));
  };
  const toggleRequestCard = (card: typeof kanbanCards[number], checked: boolean) => {
    const cardProjectId = getCardProjectId(card);
    if (checked && requestProjectId === "none" && cardProjectId) {
      setRequestProjectId(cardProjectId);
      setRequestCardIds((current) => new Set([
        ...[...current].filter((cardId) => {
          const selectedCard = kanbanCards.find((entry) => entry.id === cardId);
          return selectedCard && getCardProjectId(selectedCard) === cardProjectId;
        }),
        card.id,
      ]));
      return;
    }
    setRequestCardIds((current) => {
      const next = new Set(current);
      if (checked) next.add(card.id);
      else next.delete(card.id);
      return next;
    });
  };

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
        .filter(matchesEquipmentBaseFilters)
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
  const activeFilterCount =
    Number(statusFilter !== "all") +
    Number(operabilityFilter !== "all") +
    Number(typeFilter !== "all") +
    Number(Boolean(searchTerm.trim())) +
    Number(canApproveCheckout && employeeFilter !== "all");
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
      <div className="flex h-full min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="h-8 w-48 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
          <div className="h-10 w-32 animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-900/[0.02] p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div
                key={index}
                className="h-56 animate-pulse rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full gap-4">
      {/* Header: фиксированная шапка и фильтры, скролл только у списка */}
      <div className="flex flex-col gap-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">Склад техники</h2>
          {userCanCreate && (
            <Button 
              className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
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
            className="flex-1 min-w-0 sm:flex-none border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={() => setIsScannerOpen(true)}
            data-testid="button-scan-barcode"
          >
            <ScanBarcode className="w-4 h-4 mr-1.5 sm:mr-2" />
            Сканировать
          </Button>
          <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="flex-1 min-w-0 sm:flex-none border-slate-300 dark:border-slate-600">
                <History className="w-4 h-4 mr-1.5 sm:mr-2" />
                Моя история
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
              <SheetHeader>
                <SheetTitle className="px-4 pt-4">Моя история склада</SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
                {myHistoryGroups.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Пока нет выдач и запросов.
                  </div>
                ) : (
                  myHistoryGroups.map((group) => (
                    <div key={group.id} className="rounded-md border bg-card p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium leading-snug text-slate-900 dark:text-white">
                            {group.items.length === 1 ? group.items[0].equipmentName : `${group.items.length} позиций оборудования`}
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {group.items.slice(0, 8).map((item) => (
                              <div key={item.id} className="break-words">
                                {item.equipmentName}{item.model ? ` · ${item.model}` : ""}
                              </div>
                            ))}
                            {group.items.length > 8 && (
                              <div>+ ещё {group.items.length - 8}</div>
                            )}
                          </div>
                        </div>
                        <Badge variant={group.tone === "rejected" ? "destructive" : "outline"} className="shrink-0">
                          {group.status}
                        </Badge>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                        {group.date && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Забрал: {formatDateTime(group.date.toISOString())}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          Вернул: {group.status.includes("Сейчас") ? "пока на руках" : "по отметке склада"}
                        </div>
                        {group.location && (
                          <div className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span className="break-words">{group.location}</span>
                          </div>
                        )}
                        {group.note && (
                          <div className="break-words text-slate-600 dark:text-slate-300">{group.note}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SheetContent>
          </Sheet>
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="relative flex-1 min-w-0 sm:flex-none border-slate-300 dark:border-slate-600">
                <ShoppingCart className="w-4 h-4 mr-1.5 sm:mr-2" />
                Корзина
                {cart.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                    {cart.length}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-lg flex flex-col p-0">
              <SheetHeader>
                <SheetTitle className="px-4 pt-4">Корзина оборудования</SheetTitle>
              </SheetHeader>
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
                {cart.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Добавьте оборудование с карточек кнопкой «Корзина»</p>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-2 p-3 rounded-md border bg-card">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug break-words">{item.name}</p>
                        <p className="text-xs text-muted-foreground break-words">
                          {[item.model, getTypeText(item.type)].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={() => removeFromCart(item.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
              {cart.length > 0 && (
                <div className="border-t px-4 py-4 space-y-3 bg-background">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Позиций: {cart.length}</span>
                    {sendToProjectId && <span className="truncate ml-3">{projects.find((p) => p.id === sendToProjectId)?.name}</span>}
                  </div>
                  {userCanReserve && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-1 block">Отправить на проект</label>
                        <Select value={sendToProjectId} onValueChange={setSendToProjectId}>
                          <SelectTrigger className="bg-white dark:bg-slate-800">
                            <SelectValue placeholder={projects.length > 0 ? "Выберите проект" : "Нет доступных проектов"} />
                          </SelectTrigger>
                          <SelectContent>
                            {projects.length > 0 ? (
                              projects.map((p) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {equipmentCountByProject[p.id] ? ` (${equipmentCountByProject[p.id]})` : ""}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="_empty" disabled>Нет доступных проектов</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {projects.length === 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            В рабочем пространстве пока нет проектов. Можно забрать оборудование себе.
                          </p>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Выдать</label>
                          <Input
                            type="datetime-local"
                            value={handoffAt}
                            onChange={(e) => setHandoffAt(e.target.value)}
                            className="bg-white dark:bg-slate-800"
                          />
                        </div>
                        <div className="grid grid-cols-[1fr_92px] gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Вернуть до <span className="text-red-500">*</span></label>
                            <Input
                              type="date"
                              value={returnDate}
                              onChange={(e) => setReturnDate(e.target.value)}
                              min={new Date().toISOString().slice(0, 10)}
                              className="bg-white dark:bg-slate-800"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Время</label>
                            <Input
                              type="time"
                              value={returnTime}
                              onChange={(e) => setReturnTime(e.target.value)}
                              className="bg-white dark:bg-slate-800 px-2"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="rounded-md border bg-muted/20 p-3 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          Пропуск на материальные ценности
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Направление</label>
                            <Select value={passDirection} onValueChange={(value) => setPassDirection(value === "in" ? "in" : "out")}>
                              <SelectTrigger className="bg-white dark:bg-slate-800">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="out">Вынос</SelectItem>
                                <SelectItem value="in">Внос</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Телефон ответственного</label>
                            <Input
                              value={passResponsiblePhone}
                              onChange={(e) => setPassResponsiblePhone(e.target.value)}
                              placeholder="+7..."
                              className="bg-white dark:bg-slate-800"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Основание</label>
                          <Input
                            value={passBasis}
                            onChange={(e) => setPassBasis(e.target.value)}
                            placeholder="Например: работы по проекту"
                            className="bg-white dark:bg-slate-800"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={passDocumentMutation.isPending}
                          onClick={() => passDocumentMutation.mutate()}
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          {passDocumentMutation.isPending ? "Формирование..." : "Скачать пропуск DOCX"}
                        </Button>
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button variant="outline" onClick={clearCart}>Очистить</Button>
                    <Button
                      variant="outline"
                      disabled={!canRequestCheckout || takeCartForSelfMutation.isPending}
                      onClick={() => runWithKitSafety(
                        cart,
                        userCanReserve ? "Забрать себе" : "Запросить себе",
                        userCanReserve ? "cart-direct-take" : "cart-checkout-request",
                        (kitExtractions) => takeCartForSelfMutation.mutate({ items: cart, kitExtractions }),
                      )}
                    >
                      {takeCartForSelfMutation.isPending ? (
                        "Оформление..."
                      ) : (
                        <>
                          <User className="w-4 h-4 mr-2" />
                          {userCanReserve ? "Забрать себе" : "Запросить себе"}
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="grid gap-2">
                    {userCanReserve && (
                      <Button
                        className="w-full min-w-0"
                        disabled={!sendToProjectId || !returnDate || sendToProjectMutation.isPending}
                        onClick={() => {
                          const user = getCurrentUser();
                          const name = user?.name || user?.username || "Сотрудник";
                          if (sendToProjectId && returnDate) {
                            runWithKitSafety(
                              cart,
                              "Отправить на проект",
                              `project-send:${sendToProjectId}`,
                              (kitExtractions) => sendToProjectMutation.mutate({
                                projectId: sendToProjectId,
                                equipmentIds: cart.map((e) => e.id),
                                handoffAt,
                                returnDate,
                                returnTime,
                                assignedByName: name,
                                assignedByUserId: user?.id,
                                kitExtractions,
                              }),
                            );
                          }
                        }}
                      >
                        {sendToProjectMutation.isPending ? (
                          <span className="truncate">Отправка…</span>
                        ) : (
                          <span className="flex min-w-0 items-center justify-center">
                            <Send className="w-4 h-4 mr-2" />
                            <span className="truncate">Отправить на проект</span>
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Mobile Filters */}
      <div className="sm:hidden">
        <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between border-slate-200 bg-slate-50 text-left dark:border-slate-700 dark:bg-slate-900/50"
            >
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Фильтры и поиск
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {activeFilterCount > 0 ? `${activeFilterCount} активно` : "Все позиции"}
              </span>
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl border-slate-200 bg-white px-4 pb-6 pt-4 dark:border-slate-700 dark:bg-slate-950">
            <SheetHeader>
              <SheetTitle>Фильтры склада</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Поиск: название, модель, серийник, штрихкод"
                  className="pl-9 pr-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                    aria-label="Очистить поиск"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Статус" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  <SelectItem value="available">Доступно</SelectItem>
                  <SelectItem value="in-use">Используется</SelectItem>
                  <SelectItem value="maintenance">Обслуживание</SelectItem>
                  <SelectItem value="broken">Сломано</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Тип" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все типы</SelectItem>
                  <SelectItem value="microphone">Микрофоны</SelectItem>
                  <SelectItem value="camera">Камеры</SelectItem>
                  <SelectItem value="lighting">Освещение</SelectItem>
                  <SelectItem value="computer">Компьютеры</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>

              <Select value={operabilityFilter} onValueChange={setOperabilityFilter}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                  <SelectValue placeholder="Исправность" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Любая исправность</SelectItem>
                  <SelectItem value="working">Исправно</SelectItem>
                  <SelectItem value="broken">Неисправно</SelectItem>
                  <SelectItem value="on_repair">В ремонте</SelectItem>
                </SelectContent>
              </Select>

              {canApproveCheckout && (
                <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
                  <SelectTrigger className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Сотрудник" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все сотрудники</SelectItem>
                    <SelectItem value="unassigned">Без сотрудника</SelectItem>
                    {employeeFilterOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} ({option.count})
                      </SelectItem>
                    ))}
                    {unknownEmployeeFilterOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label} ({option.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  className="border-slate-200 dark:border-slate-700"
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setOperabilityFilter("all");
                    setTypeFilter("all");
                    setEmployeeFilter("all");
                  }}
                >
                  Сбросить
                </Button>
                <Button variant="outline" className="border-slate-200 dark:border-slate-700" onClick={toggleSelectAll}>
                  {selectedIds.size >= filteredEquipment.length && filteredEquipment.length > 0 ? "Снять выбор" : "Выбрать все"}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 dark:border-slate-700"
                  onClick={exportBarcodesToExcel}
                  disabled={toExport.length === 0}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  {selectedIds.size > 0 ? `Отчёт Excel (${selectedIds.size})` : "Отчёт в Excel"}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 dark:border-slate-700"
                  onClick={() => printEquipmentLabels(selectedEquipmentForLabels)}
                  disabled={selectedEquipmentForLabels.length === 0 || printEquipmentLabelsMutation.isPending}
                  title="Выберите карточки галочками, чтобы напечатать пачку этикеток"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  {selectedEquipmentForLabels.length > 0 ? `Печать (${selectedEquipmentForLabels.length})` : "Печать этикеток"}
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-200 dark:border-slate-700"
                  onClick={openBundleDialog}
                  disabled={selectedEquipmentForBundle.length < 2 || createBundleMutation.isPending}
                  title="Отметьте комплектующие и соберите их в одну складскую позицию"
                >
                  <Package className="mr-2 h-4 w-4" />
                  {selectedEquipmentForBundle.length >= 2 ? `Собрать (${selectedEquipmentForBundle.length})` : "Собрать комплект"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Filters */}
      <div className="hidden sm:flex flex-col sm:flex-row sm:flex-wrap gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-slate-200 dark:border-slate-800">
        <div className="relative w-full sm:min-w-[260px] sm:flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Поиск: название, модель, серийник, штрихкод"
            className="pl-9 pr-9 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Очистить поиск"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="available">Доступно</SelectItem>
            <SelectItem value="in-use">Используется</SelectItem>
            <SelectItem value="maintenance">Обслуживание</SelectItem>
            <SelectItem value="broken">Сломано</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[140px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="Тип" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            <SelectItem value="microphone">Микрофоны</SelectItem>
            <SelectItem value="camera">Камеры</SelectItem>
            <SelectItem value="lighting">Освещение</SelectItem>
            <SelectItem value="computer">Компьютеры</SelectItem>
            <SelectItem value="other">Другое</SelectItem>
          </SelectContent>
        </Select>

        <Select value={operabilityFilter} onValueChange={setOperabilityFilter}>
          <SelectTrigger className="w-full sm:w-[155px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
            <SelectValue placeholder="Исправность" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Исправность</SelectItem>
            <SelectItem value="working">Исправно</SelectItem>
            <SelectItem value="broken">Неисправно</SelectItem>
            <SelectItem value="on_repair">В ремонте</SelectItem>
          </SelectContent>
        </Select>

        {canApproveCheckout && (
          <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
            <SelectTrigger className="w-full sm:w-[190px] bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <SelectValue placeholder="Сотрудник" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все сотрудники</SelectItem>
              <SelectItem value="unassigned">Без сотрудника</SelectItem>
              {employeeFilterOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label} ({option.count})
                </SelectItem>
              ))}
              {unknownEmployeeFilterOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label} ({option.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Button 
          variant="outline" 
          className="border-slate-300 dark:border-slate-600"
          onClick={() => {
            setSearchTerm("");
            setStatusFilter("all");
            setOperabilityFilter("all");
            setTypeFilter("all");
            setEmployeeFilter("all");
          }}
        >
          Сбросить
        </Button>

        <Button variant="outline" size="sm" className="border-slate-300 dark:border-slate-600" onClick={toggleSelectAll}>
          {selectedIds.size >= filteredEquipment.length && filteredEquipment.length > 0 ? "Снять выбор" : "Выбрать все"}
        </Button>
        <Button 
          variant="outline" 
          className="border-slate-300 dark:border-slate-600"
          onClick={exportBarcodesToExcel}
          disabled={toExport.length === 0}
          title={selectedIds.size > 0 ? "Выгрузить отмеченное оборудование в Excel" : "Выгрузить текущий список оборудования в Excel"}
        >
          <FileSpreadsheet className="w-4 h-4 mr-1.5 sm:mr-2" />
          {selectedIds.size > 0 ? `Отчёт Excel (${selectedIds.size})` : "Отчёт в Excel"}
        </Button>
        <Button
          variant="outline"
          className="border-slate-300 dark:border-slate-600"
          onClick={() => printEquipmentLabels(selectedEquipmentForLabels)}
          disabled={selectedEquipmentForLabels.length === 0 || printEquipmentLabelsMutation.isPending}
          title="Выберите карточки галочками, чтобы напечатать пачку этикеток"
        >
          <Printer className="w-4 h-4 mr-1.5 sm:mr-2" />
          {selectedEquipmentForLabels.length > 0 ? `Печать (${selectedEquipmentForLabels.length})` : "Печать этикеток"}
        </Button>
        <Button
          variant="outline"
          className="border-slate-300 dark:border-slate-600"
          onClick={openBundleDialog}
          disabled={selectedEquipmentForBundle.length < 2 || createBundleMutation.isPending}
          title="Отметьте комплектующие и соберите их в одну складскую позицию"
        >
          <Package className="w-4 h-4 mr-1.5 sm:mr-2" />
          {selectedEquipmentForBundle.length >= 2 ? `Собрать (${selectedEquipmentForBundle.length})` : "Собрать комплект"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
        <span>
          Показано: {filteredEquipment.length} из {equipment.length}
        </span>
        {activeFilterCount > 0 && (
          <span>
            Фильтры применены: {activeFilterCount}
          </span>
        )}
      </div>

      {canApproveCheckout && managedPendingRequestGroups.length > 0 && (
        <Card className="border-violet-200/70 bg-violet-50/60 dark:border-violet-900 dark:bg-violet-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white">
              Запросы на выдачу и перенос оборудования
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Сотрудники ждут решения. После апрува позиция либо выдаётся, либо переносится на нового сотрудника.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {managedPendingRequestGroups.map((group) => {
              const request = group.requests[0];
              const groupRequestIds = group.requests.map((entry) => entry.id);
              const groupItems = group.requests
                .map((entry) => equipment.find((item) => item.id === entry.equipmentId))
                .filter(Boolean) as Equipment[];
              const item = equipment.find((entry) => entry.id === request.equipmentId);
              const requester = getAssignedUserName(request.requestedBy);
              const requestType = getCheckoutRequestType(request, item);
              const isKitExtractionRequest = requestType === "kit-extraction";
              const currentHolderName = getAssignedUserName(request.currentHolder || item?.assignedTo);
              return (
                <div
                  key={group.id}
                  className="flex flex-col gap-3 rounded-xl border border-violet-200/70 bg-white/90 p-4 dark:border-violet-900/60 dark:bg-slate-900/80 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {groupItems.length <= 1 ? (item?.name || "Оборудование") : `${groupItems.length} позиций оборудования`}
                    </div>
                    {groupItems.length > 1 && (
                      <div className="space-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                        {groupItems.slice(0, 8).map((entry) => (
                          <div key={entry.id} className="break-words">
                            {entry.name}{entry.model ? ` · ${entry.model}` : ""}
                          </div>
                        ))}
                        {groupItems.length > 8 && <div>+ ещё {groupItems.length - 8}</div>}
                      </div>
                    )}
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {isKitExtractionRequest ? "Запросил извлечение" : requestType === "transfer" ? "Просит перенести" : "Запросил"}: {requester || "Сотрудник"}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Количество: {Math.max(1, Number(request.quantity || 1))}
                    </div>
                    {(requestType === "transfer" || isKitExtractionRequest) && currentHolderName && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {isKitExtractionRequest ? "Активный комплект" : "Сейчас у сотрудника"}: {currentHolderName}
                      </div>
                    )}
                    {(request.physicalDestination?.displayName || request.location) && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {requestType === "transfer" ? "Куда переносит" : "Куда берёт"}: {request.physicalDestination?.displayName || request.location}
                      </div>
                    )}
                    {request.workContext?.project && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Проект: {request.workContext.project.name}
                      </div>
                    )}
                    {Boolean(request.workContext?.kanbanCards?.length) && (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        Kanban V2: {request.workContext?.kanbanCards?.map((card) => card.title).join(", ")}
                      </div>
                    )}
                    {request.note && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 break-words">
                        Комментарий: {request.note}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                      disabled={approveCheckoutMutation.isPending}
                      onClick={() => runWithKitSafety(
                        groupItems,
                        isKitExtractionRequest ? "Подтвердить извлечение" : "Разрешить выдачу",
                        isKitExtractionRequest ? "manager-extraction-approval" : "manager-checkout-approval",
                        (kitExtractions) => approveCheckoutMutation.mutate({
                          requestIds: groupRequestIds,
                          kitExtractions,
                          kitExtractionApproval: isKitExtractionRequest,
                        }),
                      )}
                    >
                      <PackageCheck className="mr-2 h-4 w-4" />
                      {isKitExtractionRequest ? "Подтвердить извлечение" : "Разрешить"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={rejectCheckoutMutation.isPending}
                      onClick={() => rejectCheckoutMutation.mutate(groupRequestIds)}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Отклонить
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {false && canApproveCheckout && Object.keys(equipmentByEmployee).length > 0 && (
        <Card className="border-slate-200/80 bg-white/90 dark:border-slate-800 dark:bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-900 dark:text-white">
              Что сейчас на руках у сотрудников
            </CardTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Здесь видно, кто что забрал себе вне проектных наборов.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3 lg:grid-cols-2">
            {Object.entries(equipmentByEmployee).map(([userId, items]) => (
              <div
                key={userId}
                className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {getAssignedUserName(userId) || "Сотрудник"}
                  </div>
                  <Badge variant="outline">{items.length}</Badge>
                </div>
                <div className="space-y-1.5 text-sm text-slate-500 dark:text-slate-400">
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
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="grid grid-cols-1 gap-3 pb-4 sm:grid-cols-2 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {filteredEquipment.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Package className="w-12 h-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400">Оборудование не найдено</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Показано: 0 из {equipment.length}
            </p>
          </div>
        ) : (
          filteredEquipment.map((item: Equipment) => {
            const projectInfo = getOnProjectInfo(item.id);
            const contextProjectInfo = getAnyProjectContext(item.id);
            const pendingRequest = getPendingRequestForEquipment(item.id);
            const requestType = getCheckoutRequestType(pendingRequest, item);
            const requestedByMe = pendingRequest?.requestedBy && isCurrentUserMatch(pendingRequest.requestedBy);
            const canReturnOwnItem = item.status === "in-use" && isCurrentUserMatch(item.assignedTo);
            const parentBundleId = getParentBundleId(item);
            const parentBundleExists = Boolean(parentBundleId && equipment.some((candidate) => candidate.id === parentBundleId));
            const isKitComponent = Boolean(parentBundleId && parentBundleExists);
            const returnViaParentBundle = isKitComponent && item.status === "in-use";
            const takenByName =
              !projectInfo && item.status === "in-use"
                ? getAssignedUserName(item.assignedTo)
                : "";
            const hasDescription = Boolean(
              String(item.notes ?? "").trim() ||
                getSpecificationEntries(item.specifications).length > 0,
            );
            const itemComments = getEquipmentComments(item);
            const physicalDestination = getEquipmentPhysicalDestination(item);
            const storageLocation = getEquipmentStorageLocation(item);
            const responsiblePerson = getEquipmentResponsiblePerson(item);
            const responsibleContact = getEquipmentResponsibleContact(item);
            const operabilityStatus = getEquipmentOperabilityStatus(item);
            const canRequestThisItem = !userCanReserve && !canReturnOwnItem && canRequestEquipmentItem(item, projectInfo);

            return (
              <Card
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailsEquipment(item)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setDetailsEquipment(item);
                  }
                }}
                className="cursor-pointer overflow-hidden border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 dark:border-slate-700 dark:bg-slate-800/90 dark:hover:border-slate-600"
              >
              <CardHeader className="space-y-3 p-3 pb-2">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="flex min-w-0 items-center pr-0 sm:pr-2">
                    <div
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      className="shrink-0"
                    >
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelect(item.id)}
                        className="shrink-0"
                        title="Выбрать для выгрузки в Excel"
                      />
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap items-center justify-start gap-1 sm:w-auto sm:max-w-[248px] sm:justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetailsEquipment(item);
                      }}
                      title={hasDescription ? "Описание и тех. характеристики" : "Открыть описание"}
                      data-testid={`button-details-${item.id}`}
                    >
                      <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        setBarcodeEquipment(item);
                        setIsBarcodeModalOpen(true);
                      }}
                      title="Штрих-код"
                      data-testid={`button-barcode-${item.id}`}
                    >
                      <QrCode className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        printEquipmentLabels([item]);
                      }}
                      title="Напечатать этикетку"
                      disabled={printEquipmentLabelsMutation.isPending}
                      data-testid={`button-print-label-${item.id}`}
                    >
                      <Printer className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        calibrateLabelPrinterMutation.mutate();
                      }}
                      title="Калибровка принтера этикеток"
                      disabled={calibrateLabelPrinterMutation.isPending}
                      data-testid={`button-calibrate-label-${item.id}`}
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                      onClick={(event) => {
                        event.stopPropagation();
                        addToCart(item);
                      }}
                      title="В корзину"
                      disabled={cart.some((e) => e.id === item.id) || !!projectInfo}
                    >
                      <ShoppingCart className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </Button>
                    {userCanReserve && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (returnViaParentBundle) {
                            openKitReturnPath(item);
                            return;
                          }
                          if (item.status !== "in-use" && !isEquipmentOperable(item)) {
                            toast({ title: "Недоступно для выдачи", description: getInoperableMessage(item), variant: "destructive" });
                            return;
                          }
                          setSelectedEquipment(item);
                          setFormMode("take_return");
                          setIsFormOpen(true);
                        }}
                        title={returnViaParentBundle ? "Открыть сборку для возврата" : item.status === "in-use" ? "Вернуть" : "Взять"}
                        data-testid={`button-take-return-${item.id}`}
                      >
                        {returnViaParentBundle ? (
                          <Package className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <ArrowRightLeft className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        )}
                      </Button>
                    )}
                    {!userCanReserve && canReturnOwnItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (returnViaParentBundle) {
                            openKitReturnPath(item);
                            return;
                          }
                          quickReturnMutation.mutate(item.id);
                        }}
                        title={returnViaParentBundle ? "Открыть сборку для возврата" : "Вернуть"}
                        disabled={quickReturnMutation.isPending}
                      >
                        {returnViaParentBundle ? (
                          <Package className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        ) : (
                          <PackageCheck className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        )}
                      </Button>
                    )}
                    {canRequestThisItem && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (!isEquipmentOperable(item)) {
                            toast({ title: "Недоступно для выдачи", description: getInoperableMessage(item), variant: "destructive" });
                            return;
                          }
                          setRequestEquipment(item);
                          setRequestLocationChoice("");
                          setRequestManualLocation("");
                          setRequestNote("");
                          setRequestProjectId("none");
                          setRequestCardIds(new Set());
                        }}
                        title={
                          pendingRequest
                            ? requestType === "transfer" ? "Запрос на перенос уже отправлен" : "Запрос уже отправлен"
                            : requestType === "transfer" ? "Запросить перенос" : "Запросить выдачу"
                        }
                        disabled={Boolean(pendingRequest)}
                      >
                        {pendingRequest ? (
                          <Clock className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        ) : (
                          <Send className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        )}
                      </Button>
                    )}
                    {userCanEdit ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-slate-100 dark:hover:bg-slate-700 sm:h-7 sm:w-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedEquipment(item);
                          setFormMode("full");
                          setIsFormOpen(true);
                        }}
                        title="Редактировать"
                        data-testid={`button-edit-${item.id}`}
                      >
                        <Edit className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                      </Button>
                    ) : null}
                    {canDeleteEquipmentItem(item) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-red-50 dark:hover:bg-red-950/30 sm:h-7 sm:w-7"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (window.confirm(`Удалить «${item.name}» со склада?`)) {
                            runWithKitSafety(
                              [item],
                              "Удалить со склада",
                              "equipment-delete",
                              (kitExtractions) => deleteEquipmentMutation.mutate({
                                equipmentId: item.id,
                                kitExtraction: kitExtractions[item.id],
                              }),
                            );
                          }
                        }}
                        title="Удалить"
                        disabled={deleteEquipmentMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary dark:bg-primary/20">
                    {getTypeIcon(item.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="break-words text-sm leading-tight text-slate-900 dark:text-white sm:text-base">
                      {item.name}
                    </CardTitle>
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs">
                      {getTypeText(item.type)}
                    </p>
                  </div>
                </div>

                {projectInfo && (userCanReserve || (currentUser?.id && projectInfo.assignedByUserId === currentUser.id)) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-[11px]"
                    title={isKitComponent ? "Открыть сборку для возврата" : "Вернуть на склад"}
                    disabled={!isKitComponent && returnToWarehouseMutation.isPending}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isKitComponent) {
                        openKitReturnPath(item);
                      } else {
                        returnToWarehouseMutation.mutate(item.id);
                      }
                    }}
                  >
                    {isKitComponent ? <Package className="mr-1 h-3.5 w-3.5" /> : <PackageCheck className="mr-1 h-3.5 w-3.5" />}
                    {isKitComponent ? "Открыть сборку" : "Вернуть"}
                  </Button>
                )}
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-0">
                <div className="space-y-2.5 text-[12px] text-slate-700 dark:text-slate-300 sm:text-sm">
                  {projectInfo && (() => {
                    const info = projectInfo;
                    const overdue = isReturnOverdue(info.returnDate, info.returnTime);
                    return (
                      <div className={cn("rounded-md p-2 space-y-1.5", overdue ? "bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800" : "bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800")}>
                        <div className="flex items-start gap-1.5 text-violet-700 dark:text-violet-300">
                          <User className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span className="min-w-0 break-words">Отправил: {info.assignedByName}</span>
                        </div>
                        {info.sentAt && (
                          <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
                            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="min-w-0 break-words">Выдано: {formatDateTime(info.sentAt)}</span>
                          </div>
                        )}
                        <div className="flex items-start gap-1.5 text-slate-600 dark:text-slate-400">
                          <Calendar className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                          <span className="min-w-0 break-words">
                            Возврат: {formatReturnDateTime(info.returnDate, info.returnTime)}
                            {info.projectName ? ` · ${info.projectName}` : ""}
                          </span>
                        </div>
                        {overdue && (
                          <div className="flex items-start gap-1.5 text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span className="min-w-0 break-words">Просрочено возвращение</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {item.model && (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Модель:</span>
                      <span className="max-w-full min-w-0 break-words text-left font-medium sm:max-w-[68%] sm:text-right">{item.model}</span>
                    </div>
                  )}
                  {item.serialNumber && (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Серийный номер:</span>
                      <span className="max-w-full min-w-0 break-all text-left font-mono text-xs font-medium sm:max-w-[68%] sm:text-right">{item.serialNumber}</span>
                    </div>
                  )}
                  {item.inventoryNumber && (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Инв. номер:</span>
                      <span className="max-w-full min-w-0 break-all text-left font-medium sm:max-w-[68%] sm:text-right">{item.inventoryNumber}</span>
                    </div>
                  )}
                  {physicalDestination.displayName && (
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
                      <MapPin className="mt-1 h-3 w-3 shrink-0 text-violet-500" />
                      <span className="text-slate-500 dark:text-slate-400">Сейчас:</span>
                      <span className="col-span-2 min-w-0 break-words font-medium sm:col-span-1 sm:text-right">
                        {physicalDestination.displayName}
                        {physicalDestination.archived ? " · архив" : ""}
                      </span>
                    </div>
                  )}
                  {storageLocation && (
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
                      <MapPin className="mt-1 h-3 w-3 shrink-0 text-slate-400" />
                      <span className="text-slate-500 dark:text-slate-400">Хранение:</span>
                      <span className="col-span-2 min-w-0 break-words font-medium sm:col-span-1 sm:text-right">{storageLocation}</span>
                    </div>
                  )}
                  {(responsiblePerson || responsibleContact) && (
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
                      <User className="mt-1 h-3 w-3 shrink-0 text-slate-400" />
                      <span className="text-slate-500 dark:text-slate-400">Ответственный:</span>
                      <span className="col-span-2 min-w-0 break-words font-medium sm:col-span-1 sm:text-right">
                        {[responsiblePerson, responsibleContact].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  )}
                  {contextProjectInfo && !projectInfo && (
                    <div className="rounded-md border border-blue-200 bg-blue-50/70 px-3 py-2 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
                      <div className="min-w-0 break-words">
                        Рабочий контекст: {contextProjectInfo.projectName || contextProjectInfo.projectId}
                      </div>
                    </div>
                  )}
                  {itemComments.length > 0 && (
                    <div className="flex items-start gap-1.5 text-slate-500 dark:text-slate-400">
                      <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 break-words">
                        {itemComments.length} комм., последний: {itemComments[itemComments.length - 1]?.authorName || "сотрудник"}
                      </span>
                    </div>
                  )}
                  {item.lastUsed && (
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <span className="text-slate-500 dark:text-slate-400 shrink-0">Последнее использование:</span>
                      <span className="font-medium min-w-0 text-left sm:text-right">{new Date(item.lastUsed).toLocaleDateString("ru-RU")}</span>
                    </div>
                  )}
                  {!projectInfo && takenByName && (
                    <div className="rounded-md border border-blue-200 bg-blue-50/80 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/20">
                      <div className="flex items-start gap-1.5 text-blue-700 dark:text-blue-300">
                        <User className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 break-words">Забрал: {takenByName}</span>
                      </div>
                    </div>
                  )}
                  {pendingRequest && !projectInfo && (
                    <div className="rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/20">
                      <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 break-words">
                          {requestedByMe
                            ? requestType === "transfer"
                              ? "Ваш запрос на перенос отправлен и ждёт решения главного"
                              : "Ваш запрос на выдачу отправлен и ждёт подтверждения"
                            : requestType === "transfer"
                              ? `Ожидает решения по переносу для ${getAssignedUserName(pendingRequest.requestedBy) || "сотрудника"}`
                              : `Ожидает решения по запросу от ${getAssignedUserName(pendingRequest.requestedBy) || "сотрудника"}`}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-1.5">
                    {projectInfo ? (
                      <Badge className="max-w-full rounded-full bg-violet-100 text-[11px] text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                        На проекте
                      </Badge>
                    ) : pendingRequest ? (
                      <Badge className="max-w-full rounded-full bg-amber-100 text-[11px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        {requestedByMe
                          ? requestType === "transfer" ? "Ждёт перенос" : "Ждёт апрув"
                          : requestType === "transfer" ? "Есть перенос" : "Есть запрос"}
                      </Badge>
                    ) : contextProjectInfo ? (
                      <Badge className="max-w-full rounded-full bg-blue-100 text-[11px] text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        Контекст проекта
                      </Badge>
                    ) : (
                      <Badge className={`${getStatusColor(item.status)} max-w-full rounded-full text-[11px]`}>
                        {getStatusText(item.status)}
                      </Badge>
                    )}
                    {isSuperPosition(item) && (
                      <Badge className="max-w-full rounded-full bg-emerald-100 text-[11px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Сборка
                      </Badge>
                    )}
                    <Badge className={`${getOperabilityColor(operabilityStatus)} max-w-full rounded-full text-[11px]`}>
                      {getOperabilityText(operabilityStatus)}
                    </Badge>
                    {getParentBundleName(item) && (
                      <Badge className="max-w-full rounded-full bg-blue-100 text-[11px] text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                        В сборке
                      </Badge>
                    )}
                  </div>
                  {isSuperPosition(item) && (() => {
                    const components = getBundleComponents(item, equipment);
                    const expanded = expandedBundleIds.has(item.id);
                    return (
                      <div
                        className="border-t border-slate-200 pt-2 dark:border-slate-700"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 min-w-0 flex-1 justify-between px-2 text-xs"
                            aria-expanded={expanded}
                            aria-controls={`bundle-components-${item.id}`}
                            onClick={() => setExpandedBundleIds((current) => {
                              const next = new Set(current);
                              if (next.has(item.id)) next.delete(item.id);
                              else next.add(item.id);
                              return next;
                            })}
                          >
                            <span>Состав: {components.length}</span>
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          {userCanEdit && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 shrink-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                              title="Добавить в комплект"
                              aria-label={`Добавить позицию в «${item.name}»`}
                              onClick={() => openKitAddDialog(item)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                        {expanded && (
                          <div
                            id={`bundle-components-${item.id}`}
                            className="mt-2 max-h-72 space-y-2 overflow-y-auto overscroll-contain pr-1"
                          >
                            {components.length > 0 ? components.map((component, index) => {
                              const componentProject = getOnProjectInfo(component.id) || projectInfo;
                              const overdue = componentProject
                                ? isReturnOverdue(componentProject.returnDate, componentProject.returnTime)
                                : false;
                              const holder = getAssignedUserName(component.assignedTo);
                              return (
                                <div
                                  key={component.id || `${item.id}-${index}`}
                                  className="flex items-stretch overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60"
                                >
                                  <button
                                    type="button"
                                    disabled={!component.live}
                                    onClick={() => openBundleComponentDetails(item.id, component.live)}
                                    className="min-w-0 flex-1 px-2.5 py-2 text-left transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40 disabled:cursor-default disabled:opacity-70 dark:hover:bg-slate-900"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <span className="min-w-0 break-words font-medium text-slate-900 dark:text-white">
                                        {component.name}
                                      </span>
                                      <span className="shrink-0 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                        {component.inventoryNumber || "без инв. №"}
                                      </span>
                                    </div>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      <Badge className={`${getStatusColor(component.status)} text-[10px]`}>
                                        {getStatusText(component.status)}
                                      </Badge>
                                      <Badge className={`${getOperabilityColor(component.operabilityStatus)} text-[10px]`}>
                                        {getOperabilityText(component.operabilityStatus)}
                                      </Badge>
                                      {component.live && isSuperPosition(component.live) && (
                                        <Badge className="bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                          Комплект
                                        </Badge>
                                      )}
                                      {componentProject && (
                                        <Badge className="bg-violet-100 text-[10px] text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
                                          На проекте
                                        </Badge>
                                      )}
                                      {overdue && (
                                        <Badge className="bg-red-100 text-[10px] text-red-800 dark:bg-red-900/40 dark:text-red-300">
                                          Просрочено
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="mt-1.5 break-words text-[11px] text-slate-500 dark:text-slate-400">
                                      {holder ? `У сотрудника: ${holder}` : component.location ? `Хранение: ${component.location}` : "Место не указано"}
                                    </div>
                                  </button>
                                  {userCanEdit && component.live && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-auto w-10 shrink-0 rounded-none border-l border-slate-200 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-950/20"
                                      disabled={removeKitComponentMutation.isPending}
                                      title="Убрать из комплекта"
                                      aria-label={`Убрать «${component.name}» из комплекта`}
                                      onClick={() => removeKitComponent(item, component.live!)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              );
                            }) : (
                              <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                В комплекте нет компонентов.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </CardContent>
              </Card>
            );
          })
        )}
        </div>
      </div>

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

      <Dialog open={bundleDialogOpen} onOpenChange={setBundleDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              Создать супер позицию
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Выбранные позиции будут объединены в одну складскую карточку, а комплектующие пометятся как входящие в сборку.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Название сборки</label>
              <Input
                value={bundleName}
                onChange={(event) => setBundleName(event.target.value)}
                placeholder="Например: PC ECHO_1, комплект режиссерского ПК"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Тип карточки</label>
              <Select value={bundleType} onValueChange={setBundleType}>
                <SelectTrigger className="bg-white dark:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="computer">Компьютер</SelectItem>
                  <SelectItem value="camera">Камера</SelectItem>
                  <SelectItem value="microphone">Микрофон</SelectItem>
                  <SelectItem value="lighting">Освещение</SelectItem>
                  <SelectItem value="other">Другое</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="mb-2 text-sm font-medium text-slate-900 dark:text-white">
                Состав: {selectedEquipmentForBundle.length}
              </div>
              <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {selectedEquipmentForBundle.map((item) => (
                  <div key={item.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                    <div className="font-medium text-slate-900 dark:text-white">{item.name}</div>
                    <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                      {[item.model, item.inventoryNumber].filter(Boolean).join(" · ") || getTypeText(item.type)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setBundleDialogOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={createBundleMutation.isPending || selectedEquipmentForBundle.length < 2 || !bundleName.trim()}
                onClick={() => createBundleMutation.mutate({
                  name: bundleName,
                  type: bundleType,
                  items: selectedEquipmentForBundle,
                })}
              >
                {createBundleMutation.isPending ? "Сборка..." : "Создать сборку"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(kitAddBundle)}
        onOpenChange={(open) => {
          if (!open) closeKitAddDialog();
        }}
      >
        <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-xl flex-col overflow-hidden bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              Добавить в комплект
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {kitAddBundle
                ? `Выберите оборудование для «${kitAddBundle.name}». Можно вложить и другой комплект.`
                : "Выберите оборудование для комплекта."}
            </DialogDescription>
          </DialogHeader>

          {kitAddBundle && (
            <div className="flex min-h-0 flex-col gap-4">
              {kitAddOperationalContext?.active && (
                <div className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  canOverrideActiveKit
                    ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/25 dark:text-red-200"
                    : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200",
                )}>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Комплект используется{kitAddOperationalContext.projectName || kitAddOperationalContext.projectId
                        ? ` в проекте «${kitAddOperationalContext.projectName || kitAddOperationalContext.projectId}»`
                        : ""}.
                      {canOverrideActiveKit
                        ? " Добавление будет записано как изменение активного состава."
                        : " Изменить активный состав может только менеджер или администратор."}
                    </span>
                  </div>
                </div>
              )}

              <Input
                value={kitAddSearch}
                onChange={(event) => setKitAddSearch(event.target.value)}
                placeholder="Поиск по названию, модели или инвентарному номеру"
              />

              <div className="min-h-0 max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                {kitAddCandidates.length > 0 ? kitAddCandidates.map((item) => {
                  const checked = kitAddSelectedIds.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 transition",
                        checked
                          ? "border-primary/50 bg-primary/5"
                          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => setKitAddSelectedIds((current) => {
                          const next = new Set(current);
                          if (nextChecked === true) next.add(item.id);
                          else next.delete(item.id);
                          return next;
                        })}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                          {item.name}
                          {isSuperPosition(item) && (
                            <Badge className="bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                              Комплект
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                          {[item.model, item.inventoryNumber].filter(Boolean).join(" · ") || getTypeText(item.type)}
                        </span>
                      </span>
                    </label>
                  );
                }) : (
                  <div className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {normalizedKitAddSearch
                      ? "По вашему запросу нет доступных позиций."
                      : "Нет доступного исправного оборудования, которое можно добавить в этот комплект."}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Причина или контекст
                </label>
                <Textarea
                  value={kitAddReason}
                  onChange={(event) => setKitAddReason(event.target.value)}
                  placeholder="Например: доукомплектование для выезда"
                  className="min-h-20 resize-y"
                />
              </div>

              {kitAddOperationalContext?.active && canOverrideActiveKit && (
                <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/25">
                  <label className="text-sm font-medium text-red-800 dark:text-red-200">
                    Для изменения активного комплекта введите ДОБАВИТЬ
                  </label>
                  <Input
                    value={kitAddApprovalPhrase}
                    onChange={(event) => setKitAddApprovalPhrase(event.target.value)}
                    placeholder="ДОБАВИТЬ"
                    autoComplete="off"
                  />
                </div>
              )}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeKitAddDialog}>
                  Отмена
                </Button>
                <Button
                  type="button"
                  disabled={
                    addKitComponentsMutation.isPending ||
                    kitAddSelectedIds.size === 0 ||
                    (Boolean(kitAddOperationalContext?.active) && !canOverrideActiveKit) ||
                    (Boolean(kitAddOperationalContext?.active) &&
                      kitAddApprovalPhrase.trim().toLocaleUpperCase("ru-RU") !== "ДОБАВИТЬ")
                  }
                  onClick={() => addKitComponentsMutation.mutate({
                    bundleId: kitAddBundle.id,
                    equipmentIds: [...kitAddSelectedIds],
                    reason: kitAddReason.trim(),
                    activeKitApproval: Boolean(kitAddOperationalContext?.active),
                  })}
                >
                  {addKitComponentsMutation.isPending
                    ? "Добавление..."
                    : `Добавить (${kitAddSelectedIds.size})`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(requestEquipment)}
        onOpenChange={(open) => {
          if (!open) resetRequestContext();
        }}
      >
        <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900 dark:text-white">
              {requestEquipment && getCheckoutRequestType(undefined, requestEquipment) === "transfer"
                ? "Запросить перенос оборудования"
                : "Запросить выдачу оборудования"}
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              {requestEquipment && getCheckoutRequestType(undefined, requestEquipment) === "transfer"
                ? "Запрос уйдёт главному по компании. После подтверждения оборудование будет перенесено на вас."
                : "Запрос уйдёт главному по компании. После подтверждения оборудование закрепится за вами."}
            </DialogDescription>
          </DialogHeader>

          {requestEquipment && (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="font-medium text-slate-900 dark:text-white">{requestEquipment.name}</div>
                {requestEquipment.model && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">{requestEquipment.model}</div>
                )}
                <Badge className={`mt-2 ${getOperabilityColor(getEquipmentOperabilityStatus(requestEquipment))}`}>
                  {getOperabilityText(getEquipmentOperabilityStatus(requestEquipment))}
                </Badge>
              </div>

              {getCheckoutRequestType(undefined, requestEquipment) === "transfer" && requestEquipment.assignedTo && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
                  Сейчас у сотрудника: {getAssignedUserName(requestEquipment.assignedTo)}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {getCheckoutRequestType(undefined, requestEquipment) === "transfer" ? "Куда переносите" : "Куда берёте"}
                </label>
                <Select
                  value={requestLocationChoice}
                  onValueChange={(value) => {
                    setRequestLocationChoice(value);
                    if (value !== "manual") setRequestManualLocation("");
                  }}
                >
                  <SelectTrigger className="bg-white dark:bg-slate-800">
                    <SelectValue placeholder="Выберите площадку или ручной ввод" />
                  </SelectTrigger>
                  <SelectContent>
                    {requestLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="manual">Указать место вручную</SelectItem>
                  </SelectContent>
                </Select>
                {requestLocationChoice === "manual" && (
                  <Input
                    value={requestManualLocation}
                    onChange={(event) => setRequestManualLocation(event.target.value)}
                    placeholder="Например: выездная площадка, монтажная 2"
                  />
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Площадка и ручное место — взаимоисключающие варианты.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Количество *</label>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={requestQuantity}
                    onChange={(event) => setRequestQuantity(event.target.value)}
                    placeholder="1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Проект
                  </label>
                  <Select value={requestProjectId} onValueChange={changeRequestProject}>
                    <SelectTrigger className="bg-white dark:bg-slate-800">
                      <SelectValue placeholder="Без проекта" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Без проекта</SelectItem>
                      {requestProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Карточки Kanban V2
                </label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  {requestKanbanCards.length > 0 ? requestKanbanCards.slice(0, 100).map((card) => (
                    <label key={card.id} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <Checkbox
                        checked={requestCardIds.has(card.id)}
                        onCheckedChange={(checked) => toggleRequestCard(card, checked === true)}
                      />
                      <span className="min-w-0 text-sm">
                        <span className="block break-words font-medium text-slate-800 dark:text-slate-200">
                          {card.title || "Карточка"}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {[card.boardName, card.listName].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                    </label>
                  )) : (
                    <div className="py-3 text-center text-sm text-slate-500 dark:text-slate-400">
                      {requestProjectId === "none"
                        ? "В компании нет доступных карточек Kanban V2"
                        : "У проекта нет доступных карточек Kanban V2"}
                    </div>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Можно выбрать несколько карточек. Проект карточки подставляется автоматически.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Комментарий</label>
                <Input
                  value={requestNote}
                  onChange={(event) => setRequestNote(event.target.value)}
                  placeholder={
                    getCheckoutRequestType(undefined, requestEquipment) === "transfer"
                      ? "Например: для моей смены, под эфир, под монтаж"
                      : "Если нужно, уточните задачу или проект"
                  }
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={resetRequestContext}
                >
                  Отмена
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={!requestCompanyId || requestCheckoutMutation.isPending || !isEquipmentOperable(requestEquipment)}
                  onClick={() => {
                    if (!isEquipmentOperable(requestEquipment)) {
                      toast({ title: "Недоступно для выдачи", description: getInoperableMessage(requestEquipment), variant: "destructive" });
                      return;
                    }
                    const quantity = Number(requestQuantity);
                    if (!requestQuantity.trim() || !Number.isInteger(quantity) || quantity <= 0) {
                      toast({
                        title: "Проверьте количество",
                        description: "Укажите положительное целое число.",
                        variant: "destructive",
                      });
                      return;
                    }
                    if (!requestLocationChoice || (requestLocationChoice === "manual" && !requestManualLocation.trim())) {
                      toast({
                        title: "Укажите место",
                        description: "Выберите площадку или заполните ручное местоположение.",
                        variant: "destructive",
                      });
                      return;
                    }
                    runWithKitSafety(
                      [requestEquipment],
                      getCheckoutRequestType(undefined, requestEquipment) === "transfer" ? "Запросить перенос" : "Запросить выдачу",
                      "single-checkout-request",
                      (kitExtractions) => requestCheckoutMutation.mutate({
                        equipmentId: requestEquipment.id,
                        physicalDestination: requestLocationChoice === "manual"
                          ? { manualLocation: requestManualLocation.trim() }
                          : { locationId: requestLocationChoice },
                        workContext: {
                          projectId: requestProjectId === "none" ? undefined : requestProjectId,
                          kanbanCardIds: [...requestCardIds],
                        },
                        note: requestNote,
                        companyId: requestCompanyId,
                        requestType: getCheckoutRequestType(undefined, requestEquipment) as "checkout" | "transfer",
                        quantity,
                        kitExtraction: kitExtractions[requestEquipment.id],
                      }),
                    );
                  }}
                >
                  {requestCheckoutMutation.isPending
                    ? "Отправка..."
                    : getCheckoutRequestType(undefined, requestEquipment) === "transfer"
                      ? "Отправить запрос на перенос"
                      : "Отправить"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={kitSafetyEntries.length > 0}
        onOpenChange={(open) => {
          if (!open) closeKitSafetyDialog();
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Компонент входит в комплект
            </DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400">
              Для действия «{kitSafetyActionLabel}» сначала нужно явно извлечь компонент. Состав и автор операции будут записаны в историю.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="max-h-52 space-y-2 overflow-y-auto overscroll-contain pr-1">
              {kitSafetyEntries.map((entry) => (
                <div key={entry.item.id} className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  entry.active
                    ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/25"
                    : "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/25",
                )}>
                  <div className="font-medium text-slate-900 dark:text-white">{entry.item.name}</div>
                  <div className="mt-1 text-slate-600 dark:text-slate-300">
                    Комплект: <span className="font-medium">{entry.bundle.name}</span>
                  </div>
                  {entry.active && (
                    <div className="mt-1 flex items-start gap-1.5 font-medium text-red-700 dark:text-red-300">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        Комплект используется{entry.projectName || entry.projectId
                          ? ` в проекте «${entry.projectName || entry.projectId}»`
                          : ""}.
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Причина или контекст
              </label>
              <Textarea
                value={kitSafetyReason}
                onChange={(event) => setKitSafetyReason(event.target.value)}
                placeholder="Например: замена неисправного компонента"
                className="min-h-20 resize-y"
              />
            </div>

            {kitSafetyEntries.some((entry) => entry.active) && canOverrideActiveKit && (
              <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/25">
                <label className="text-sm font-medium text-red-800 dark:text-red-200">
                  Для override активного комплекта введите ИЗВЛЕЧЬ
                </label>
                <Input
                  value={kitOverridePhrase}
                  onChange={(event) => setKitOverridePhrase(event.target.value)}
                  placeholder="ИЗВЛЕЧЬ"
                  autoComplete="off"
                />
              </div>
            )}

            {kitSafetyEntries.some((entry) => entry.active) && !canOverrideActiveKit ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Активный комплект может изменить только менеджер или администратор. До решения состав останется без изменений.
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={closeKitSafetyDialog}>
                    Оставить в комплекте
                  </Button>
                  <Button
                    type="button"
                    disabled={requestKitExtractionMutation.isPending}
                    onClick={() => requestKitExtractionMutation.mutate({
                      entries: kitSafetyEntries.filter((entry) => entry.active),
                      reason: kitSafetyReason,
                    })}
                  >
                    {requestKitExtractionMutation.isPending ? "Отправка..." : "Отправить запрос менеджеру"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeKitSafetyDialog}>
                  Оставить в комплекте
                </Button>
                <Button
                  type="button"
                  onClick={confirmKitExtraction}
                  disabled={
                    kitSafetyEntries.some((entry) => entry.active) &&
                    kitOverridePhrase.trim().toLocaleUpperCase("ru-RU") !== "ИЗВЛЕЧЬ"
                  }
                >
                  Извлечь и продолжить
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {cart.length > 0 && (
        <Button
          type="button"
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 right-5 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 sm:bottom-6 sm:right-6"
          data-testid="floating-cart-button"
        >
          <ShoppingCart className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[11px] font-semibold text-primary shadow dark:bg-slate-950">
            {cart.length}
          </span>
        </Button>
      )}

      <Dialog
        open={Boolean(detailsEquipment)}
        onOpenChange={(open) => {
          if (!open) void closeEquipmentDetails();
        }}
      >
        <DialogContent className="flex max-h-[88vh] w-[calc(100vw-2rem)] max-w-2xl flex-col overflow-hidden bg-white dark:bg-slate-900">
          {detailsEquipment && (
            <>
              <DialogHeader>
                {detailsReturnBundleId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-1 w-fit px-2"
                    onClick={() => {
                      const bundle = equipment.find((item) => item.id === detailsReturnBundleId);
                      if (bundle) {
                        setDetailsEquipment(bundle);
                        setDetailsReturnBundleId(null);
                      }
                    }}
                  >
                    <ChevronUp className="mr-1.5 h-4 w-4 -rotate-90" />
                    Назад к комплекту
                  </Button>
                )}
                <DialogTitle className="text-slate-900 dark:text-white">
                  {detailsEquipment.name}
                </DialogTitle>
                <DialogDescription className="text-slate-500 dark:text-slate-400">
                  {[detailsEquipment.model, getTypeText(detailsEquipment.type)].filter(Boolean).join(" · ")}
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 space-y-4 overflow-y-auto pr-1 text-sm text-slate-700 dark:text-slate-300">
                {getEquipmentPhotos(detailsEquipment).length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {getEquipmentPhotos(detailsEquipment).map((photo, index) => (
                      <a
                        key={`${detailsEquipment.id}-photo-${index}`}
                        href={photo}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <img
                          src={photo}
                          alt={`${detailsEquipment.name} ${index + 1}`}
                          className="h-48 w-full object-contain"
                          loading="lazy"
                          onError={(event) => {
                            const image = event.currentTarget;
                            if (image.dataset.retry === "api") return;
                            image.dataset.retry = "api";
                            image.src = apiUrl(photo);
                          }}
                        />
                      </a>
                    ))}
                  </div>
                )}

                {isSuperPosition(detailsEquipment) && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/25">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-200">
                        <Package className="h-4 w-4" />
                        Состав комплекта
                      </div>
                      {userCanEdit && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 border-emerald-300 bg-white/80 text-emerald-800 hover:bg-white dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                          onClick={() => openKitAddDialog(detailsEquipment)}
                        >
                          <Plus className="mr-1.5 h-3.5 w-3.5" />
                          Добавить
                        </Button>
                      )}
                    </div>
                    <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {getBundleComponents(detailsEquipment, equipment).length > 0
                        ? getBundleComponents(detailsEquipment, equipment).map((component, index) => (
                            <div
                              key={component.id || index}
                              className="flex items-stretch overflow-hidden rounded-md border border-emerald-200/70 bg-white dark:border-emerald-900/70 dark:bg-slate-900"
                            >
                              <button
                                type="button"
                                disabled={!component.live}
                                onClick={() => openBundleComponentDetails(detailsEquipment.id, component.live)}
                                className="min-w-0 flex-1 px-3 py-2 text-left text-xs transition hover:bg-emerald-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/40 disabled:cursor-default disabled:opacity-70 dark:hover:bg-emerald-950/20"
                              >
                                <div className="flex flex-wrap items-center gap-1.5 font-medium text-slate-900 dark:text-white">
                                  {component.name}
                                  {component.live && isSuperPosition(component.live) && (
                                    <Badge className="bg-emerald-100 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                                      Комплект
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-0.5 text-slate-500 dark:text-slate-400">
                                  {[component.model, component.inventoryNumber].filter(Boolean).join(" · ") || getTypeText(component.type)}
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  <Badge className={`${getStatusColor(component.status)} text-[10px]`}>
                                    {getStatusText(component.status)}
                                  </Badge>
                                  <Badge className={`${getOperabilityColor(component.operabilityStatus)} text-[10px]`}>
                                    {getOperabilityText(component.operabilityStatus)}
                                  </Badge>
                                </div>
                              </button>
                              {userCanEdit && component.live && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-auto w-11 shrink-0 rounded-none border-l border-emerald-200/70 text-red-500 hover:bg-red-50 hover:text-red-600 dark:border-emerald-900/70 dark:hover:bg-red-950/20"
                                  disabled={removeKitComponentMutation.isPending}
                                  title="Убрать из комплекта"
                                  aria-label={`Убрать «${component.name}» из комплекта`}
                                  onClick={() => removeKitComponent(detailsEquipment, component.live!)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))
                        : (
                            <div className="rounded-md border border-dashed border-emerald-300 px-3 py-5 text-center text-xs text-emerald-800/80 dark:border-emerald-800 dark:text-emerald-300/80">
                              В комплекте пока нет позиций. Нажмите «Добавить».
                            </div>
                          )}
                    </div>
                  </div>
                )}

                {getParentBundleName(detailsEquipment) && (() => {
                  const parentBundleId = getParentBundleId(detailsEquipment);
                  const parentBundleExists = equipment.some((item) => item.id === parentBundleId);
                  return (
                    <div className={cn(
                      "flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center sm:justify-between",
                      parentBundleExists
                        ? "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900 dark:bg-blue-950/25 dark:text-blue-200"
                        : "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/25 dark:text-amber-200",
                    )}>
                      <span>
                        {parentBundleExists ? (
                          <>Входит в комплект: <span className="font-medium">{getParentBundleName(detailsEquipment)}</span></>
                        ) : (
                          <>Сборка «<span className="font-medium">{getParentBundleName(detailsEquipment)}</span>» удалена. Старая связь очистится автоматически при следующем действии.</>
                        )}
                      </span>
                      {parentBundleExists && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-blue-300 bg-white/70 text-blue-800 hover:bg-white dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200"
                          onClick={() => openParentBundleDetails(detailsEquipment)}
                        >
                          Открыть комплект
                        </Button>
                      )}
                    </div>
                  );
                })()}

                {(() => {
                  const specs = asRecord(detailsEquipment.specifications);
                  const history = (Array.isArray(specs.bundleExtractionHistory)
                    ? specs.bundleExtractionHistory
                    : Array.isArray(specs.kitExtractionHistory)
                      ? specs.kitExtractionHistory
                      : []) as Array<Record<string, unknown>>;
                  if (history.length === 0) return null;
                  return (
                    <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                        <History className="h-3.5 w-3.5" />
                        История состава
                      </div>
                      <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                        {[...history].reverse().map((entry, index) => (
                          <div key={String(entry.id || index)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                            <div className="font-medium text-slate-900 dark:text-white">
                              {String(entry.componentName || "Компонент")}
                            </div>
                            <Badge className={cn(
                              "mt-1 text-[10px]",
                              entry.action === "added"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                            )}>
                              {entry.action === "added" ? "Добавлено" : "Извлечено"}
                            </Badge>
                            <div className="mt-1 text-slate-500 dark:text-slate-400">
                              {String(entry.actorName || "Пользователь")} · {formatDateTime(String(entry.at || ""))}
                            </div>
                            <div className="mt-1 break-words text-slate-600 dark:text-slate-300">
                              {String(entry.reason || entry.context || "Без комментария")}
                            </div>
                            {entry.managerOverride === true && (
                              <Badge className="mt-2 bg-amber-100 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                                Override менеджера
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    Исправность
                  </div>
                  <Badge className={getOperabilityColor(getEquipmentOperabilityStatus(detailsEquipment))}>
                    {getOperabilityText(getEquipmentOperabilityStatus(detailsEquipment))}
                  </Badge>
                </div>

                {(() => {
                  const destination = getEquipmentPhysicalDestination(detailsEquipment);
                  if (!destination.displayName) return null;
                  return (
                    <div className="rounded-md border border-violet-200/80 bg-violet-50/70 px-4 py-3 dark:border-violet-900 dark:bg-violet-950/20">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-violet-600 dark:text-violet-300">
                        Физическое местоположение
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
                        <div className="min-w-0">
                          <div className="break-words font-medium">{destination.displayName}</div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge className="bg-white text-[10px] text-violet-700 dark:bg-violet-950 dark:text-violet-200">
                              {destination.locationId ? "Площадка" : destination.legacyLocation ? "Историческое значение" : "Ручной ввод"}
                            </Badge>
                            {destination.archived && (
                              <Badge className="bg-slate-200 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                В архиве
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const links = getEquipmentContextLinks(detailsEquipment).filter((link) => link.active);
                  if (links.length === 0) return null;
                  return (
                    <div className="rounded-md border border-blue-200/80 bg-blue-50/70 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/20">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-normal text-blue-600 dark:text-blue-300">
                        Рабочий контекст
                      </div>
                      <div className="space-y-2">
                        {links.map((link) => (
                          <div key={link.id} className="rounded-md border border-blue-200/70 bg-white/80 px-3 py-2 dark:border-blue-900/70 dark:bg-slate-900/70">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge className={link.source === "checkout"
                                ? "bg-blue-100 text-[10px] text-blue-800 dark:bg-blue-900/50 dark:text-blue-200"
                                : "bg-violet-100 text-[10px] text-violet-800 dark:bg-violet-900/50 dark:text-violet-200"}>
                                {link.source === "checkout" ? "Выдача / запрос" : "Ручная связь"}
                              </Badge>
                              {link.checkoutRequest?.status && (
                                <Badge className="bg-slate-100 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {getRequestStatusText(link.checkoutRequest.status)}
                                </Badge>
                              )}
                            </div>
                            {link.project?.name && (
                              <div className="mt-1.5 break-words font-medium text-slate-900 dark:text-white">
                                Проект: {link.project.name}
                              </div>
                            )}
                            {link.kanbanCard?.title && (
                              <div className="mt-1 break-words text-slate-600 dark:text-slate-300">
                                Kanban V2: {link.kanbanCard.title}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {(() => {
                  const storageLocation = getEquipmentStorageLocation(detailsEquipment);
                  const responsiblePerson = getEquipmentResponsiblePerson(detailsEquipment);
                  const responsibleContact = getEquipmentResponsibleContact(detailsEquipment);
                  if (!storageLocation && !responsiblePerson && !responsibleContact) return null;

                  return (
                    <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                      <div className="mb-3 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                        Хранение и ответственность
                      </div>
                      <div className="space-y-2">
                        {storageLocation && (
                          <div className="flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <div className="text-xs text-slate-500 dark:text-slate-400">Место хранения</div>
                              <div className="break-words font-medium">{storageLocation}</div>
                            </div>
                          </div>
                        )}
                        {(responsiblePerson || responsibleContact) && (
                          <div className="flex items-start gap-2">
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                            <div className="min-w-0">
                              <div className="text-xs text-slate-500 dark:text-slate-400">Ответственный</div>
                              {responsiblePerson && <div className="break-words font-medium">{responsiblePerson}</div>}
                              {responsibleContact && <div className="break-words text-slate-600 dark:text-slate-300">{responsibleContact}</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {detailsEquipment.status === "in-use" && getAssignedUserName(detailsEquipment.assignedTo) && (
                  <div className="rounded-md border border-blue-200 bg-blue-50/80 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/20">
                    <div className="flex items-start gap-2 text-blue-700 dark:text-blue-300">
                      <User className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <div className="font-medium">Сейчас забрал</div>
                        <div className="break-words">{getAssignedUserName(detailsEquipment.assignedTo)}</div>
                      </div>
                    </div>
                  </div>
                )}

                {!userCanEdit && String(detailsEquipment.notes ?? "").trim() && (
                  <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                      Описание
                    </div>
                    {(() => {
                      const audit = asRecord(asRecord(detailsEquipment.specifications).noteAudit);
                      const authorName = String(audit.authorName || "").trim();
                      const at = String(audit.at || "").trim();
                      if (!authorName && !at) return null;
                      return (
                        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                          Примечание: {authorName || "пользователь"}{at ? `, ${formatDateTime(at)}` : ""}
                        </div>
                      );
                    })()}
                    <p className="whitespace-pre-wrap break-words leading-6 text-slate-700 dark:text-slate-200">
                      {detailsEquipment.notes}
                    </p>
                  </div>
                )}

                {userCanEdit && (
                  <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="mb-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                      Примечание
                    </div>
                    {(() => {
                      const audit = asRecord(asRecord(detailsEquipment.specifications).noteAudit);
                      const authorName = String(audit.authorName || "").trim();
                      const at = String(audit.at || "").trim();
                      if (!authorName && !at) return null;
                      return (
                        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                          Последнее изменение: {authorName || "пользователь"}{at ? `, ${formatDateTime(at)}` : ""}
                        </div>
                      );
                    })()}
                    <Textarea
                      value={detailsNote}
                      onChange={(event) => setDetailsNote(event.target.value)}
                      placeholder="Напишите примечание по оборудованию"
                      className="min-h-28 resize-y bg-white dark:bg-slate-950"
                    />
                    <div
                      className={cn(
                        "mt-2 text-xs",
                        equipmentNoteAutosave.status === "error" ||
                          (equipmentNoteAutosave.status === "dirty" && equipmentNoteAutosave.error)
                          ? "text-destructive"
                          : "text-slate-500 dark:text-slate-400",
                      )}
                      role="status"
                    >
                      {equipmentNoteAutosave.status === "saving"
                        ? "Сохранение..."
                        : equipmentNoteAutosave.status === "dirty"
                          ? equipmentNoteAutosave.error || "Изменения будут сохранены автоматически"
                          : equipmentNoteAutosave.status === "error"
                            ? equipmentNoteAutosave.error || "Не удалось сохранить изменения"
                            : "Все изменения сохранены"}
                    </div>
                  </div>
                )}

                {getSpecificationEntries(detailsEquipment.specifications).length > 0 && (
                  <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                    <div className="mb-3 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                      Технические характеристики
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {getSpecificationEntries(detailsEquipment.specifications).map(([label, value]) => (
                        <div
                          key={`${detailsEquipment.id}-${label}`}
                          className="rounded-md border border-slate-200/70 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
                        >
                          <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
                          <div className="mt-1 break-words font-medium text-slate-900 dark:text-slate-100">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="rounded-md border border-slate-200/80 bg-slate-50/80 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/70">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Комментарии
                  </div>
                  <div className="space-y-3">
                    {getEquipmentComments(detailsEquipment).length > 0 ? (
                      getEquipmentComments(detailsEquipment).map((comment) => (
                        <div key={comment.id} className="rounded-md border border-slate-200/70 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{comment.authorName || getAssignedUserName(comment.authorId) || "Сотрудник"}</span>
                            <span>{formatDateTime(comment.createdAt)}</span>
                          </div>
                          <div className="whitespace-pre-wrap break-words leading-5 text-slate-700 dark:text-slate-200">{comment.text}</div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-md border border-dashed border-slate-300 px-3 py-4 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                        Комментариев пока нет.
                      </div>
                    )}
                    <Textarea
                      value={detailsComment}
                      onChange={(event) => setDetailsComment(event.target.value)}
                      placeholder="Оставить комментарий по оборудованию"
                      className="min-h-20 resize-y bg-white dark:bg-slate-950"
                    />
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        onClick={() => addEquipmentCommentMutation.mutate({ equipmentItem: detailsEquipment, text: detailsComment })}
                        disabled={addEquipmentCommentMutation.isPending || !detailsComment.trim()}
                      >
                        {addEquipmentCommentMutation.isPending ? "Добавление..." : "Добавить комментарий"}
                      </Button>
                    </div>
                  </div>
                </div>

                {userCanEdit &&
                  !String(detailsEquipment.notes ?? "").trim() &&
                  getSpecificationEntries(detailsEquipment.specifications).length === 0 && (
                    <div className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                      Для этой позиции описание и технические характеристики пока не заполнены.
                    </div>
                  )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
