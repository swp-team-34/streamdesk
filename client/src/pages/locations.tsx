import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  Building2,
  Camera,
  Download,
  Edit3,
  FileText,
  History,
  Loader2,
  ListTodo,
  Film,
  MapPin,
  MessageSquarePlus,
  Paperclip,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { apiRequest, apiUrl, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  ALL_RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUS_LABELS,
  RECORDING_PLACE_STATUS_TONES,
  type RecordingPlaceStatus,
} from "@/lib/recording-place-status";

type LocationAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  uploadedByName?: string | null;
  createdAt?: string | null;
};

type Location = {
  id: string;
  companyId?: string | null;
  name: string;
  description?: string | null;
  type?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: RecordingPlaceStatus | null;
  attachments?: LocationAttachment[] | null;
  archivedAt?: string | null;
  archivedByName?: string | null;
  updatedAt?: string | null;
  updatedByName?: string | null;
  createdAt?: string | null;
  activeLinks?: {
    activeKanbanCards: number;
    activeProjects: number;
    unresolvedDiscussions: number;
    total: number;
  };
  linkedWork?: {
    cards: Array<{
      id: string;
      title: string;
      boardId: string;
      boardName: string;
      projectId?: string | null;
      listName: string;
      listType: string;
      status: "active" | "completed";
    }>;
    projects: Array<{
      id: string;
      name: string;
      status: string;
      completed: boolean;
      source: "direct" | "cards" | "direct_and_cards";
    }>;
  };
};

type LocationIssue = {
  id: string;
  locationId: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: string;
  photos?: string[] | null;
  comments?: Array<{ id: string; content: string; createdAt?: string }>;
};

type LocationForm = {
  companyId: string;
  name: string;
  type: string;
  address: string;
  description: string;
  notes: string;
  status: RecordingPlaceStatus;
};

type ArchivePreview = {
  locationId: string;
  activeLinks: {
    activeKanbanCards: number;
    activeProjects: number;
    unresolvedDiscussions: number;
    total: number;
  };
};

const EMPTY_LOCATION: LocationForm = {
  companyId: "",
  name: "",
  type: "recording",
  address: "",
  description: "",
  notes: "",
  status: "available",
};
const EMPTY_ISSUE = { locationId: "", title: "", description: "", severity: "medium" as const };
const ISSUE_TONES: Record<string, string> = {
  low: "text-sky-600",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

function formatDateTime(value?: string | null) {
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

function formatFileSize(value?: number | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

export default function LocationsPage() {
  const currentUser = AuthService.getCurrentUser();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState(ALL_RECORDING_PLACE_STATUSES);
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived" | "all">("active");
  const [sort, setSort] = useState("name");
  const [search, setSearch] = useState("");
  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [detailsLocationId, setDetailsLocationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("locationId");
  });
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [archivePreview, setArchivePreview] = useState<ArchivePreview | null>(null);
  const [issueDialog, setIssueDialog] = useState(false);
  const [locationForm, setLocationForm] = useState<LocationForm>(EMPTY_LOCATION);
  const [issueForm, setIssueForm] = useState(EMPTY_ISSUE);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const companyQuery = useQuery<any>({
    queryKey: ["/api/companies/me"],
    enabled: Boolean(currentUser?.id),
  });
  const companyMemberships = Array.isArray(companyQuery.data?.companies) ? companyQuery.data.companies : [];
  const allCompanies = companyMemberships
    .map((entry: any) => entry?.company)
    .filter((company: any) => company?.id);
  const manageableCompanyIds = companyMemberships
    .filter((entry: any) => ["owner", "admin"].includes(String(entry?.membership?.role || "")))
    .map((entry: any) => String(entry.company.id));
  const hasGlobalLocationRole = ["admin", "manager"].includes(String(currentUser?.role || ""));
  const companies = hasGlobalLocationRole
    ? allCompanies
    : allCompanies.filter((company: any) => manageableCompanyIds.includes(String(company.id)));
  const primaryCompanyId = String(companies[0]?.id || "");
  const canManage = hasGlobalLocationRole || manageableCompanyIds.length > 0;

  const locationsQuery = useQuery<Location[]>({
    queryKey: ["/api/locations", "all"],
    queryFn: async () => (await apiRequest("GET", "/api/locations?archive=all")).json(),
  });
  const issuesQuery = useQuery<LocationIssue[]>({
    queryKey: ["/api/location-issues"],
    refetchInterval: 15_000,
  });
  const locations = locationsQuery.data ?? [];
  const issues = issuesQuery.data ?? [];
  const detailsLocationQuery = useQuery<Location>({
    queryKey: ["/api/locations", detailsLocationId],
    enabled: Boolean(detailsLocationId),
    queryFn: async () => (await apiRequest("GET", `/api/locations/${detailsLocationId}`)).json(),
  });
  const detailsLocation = detailsLocationQuery.data
    ?? locations.find((location) => location.id === detailsLocationId)
    ?? null;
  const archiveTarget = locations.find((location) => location.id === archiveTargetId) || null;
  const activeLocations = locations.filter((location) => !location.archivedAt);

  const activeIssueCount = new Map<string, number>();
  for (const issue of issues) {
    if (!["resolved", "cancelled"].includes(issue.status)) {
      activeIssueCount.set(issue.locationId, (activeIssueCount.get(issue.locationId) ?? 0) + 1);
    }
  }

  const visibleLocations = useMemo(() => locations
    .filter((location) =>
      archiveFilter === "all" ||
      (archiveFilter === "archived" ? Boolean(location.archivedAt) : !location.archivedAt),
    )
    .filter((location) =>
      statusFilter === ALL_RECORDING_PLACE_STATUSES || location.status === statusFilter,
    )
    .filter((location) => {
      const needle = search.trim().toLocaleLowerCase("ru-RU");
      if (!needle) return true;
      return [
        location.name,
        location.type,
        location.address,
        location.description,
        location.notes,
      ].some((value) => String(value || "").toLocaleLowerCase("ru-RU").includes(needle));
    })
    .sort((left, right) => sort === "status"
      ? String(left.status || "available").localeCompare(String(right.status || "available"), "ru") ||
        left.name.localeCompare(right.name, "ru")
      : sort === "newest"
        ? new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
        : sort === "updated"
          ? new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime()
          : left.name.localeCompare(right.name, "ru")), [
    archiveFilter,
    locations,
    search,
    sort,
    statusFilter,
  ]);

  const resetLocationForm = () => {
    setLocationDialog(false);
    setEditingLocationId(null);
    setLocationForm({ ...EMPTY_LOCATION, companyId: primaryCompanyId });
  };

  const openCreateLocation = () => {
    setEditingLocationId(null);
    setLocationForm({ ...EMPTY_LOCATION, companyId: primaryCompanyId });
    setLocationDialog(true);
  };

  const openEditLocation = (location: Location) => {
    setDetailsLocationId(null);
    setEditingLocationId(location.id);
    setLocationForm({
      companyId: String(location.companyId || primaryCompanyId),
      name: location.name,
      type: String(location.type || ""),
      address: String(location.address || ""),
      description: String(location.description || ""),
      notes: String(location.notes || ""),
      status: location.status || "available",
    });
    setLocationDialog(true);
  };

  const invalidateLocations = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
    queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
  };

  const saveLocation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...locationForm,
        companyId: locationForm.companyId || primaryCompanyId,
      };
      const response = editingLocationId
        ? await apiRequest("PUT", `/api/locations/${editingLocationId}`, payload)
        : await apiRequest("POST", "/api/locations", payload);
      return response.json();
    },
    onSuccess: (location: Location) => {
      invalidateLocations();
      resetLocationForm();
      setDetailsLocationId(location.id);
      toast({ title: editingLocationId ? "Площадка обновлена" : "Площадка создана" });
    },
    onError: (error: any) => {
      toast({
        title: "Не удалось сохранить площадку",
        description: error?.message || "Проверьте данные и повторите действие.",
        variant: "destructive",
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RecordingPlaceStatus }) =>
      (await apiRequest("PUT", `/api/locations/${id}`, { status })).json(),
    onSuccess: () => {
      invalidateLocations();
      toast({ title: "Статус площадки обновлён" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось обновить статус", description: error?.message, variant: "destructive" });
    },
  });

  const loadArchivePreview = useMutation({
    mutationFn: async (locationId: string) =>
      (await apiRequest("GET", `/api/locations/${locationId}/archive-preview`)).json(),
    onSuccess: (preview: ArchivePreview) => setArchivePreview(preview),
    onError: (error: any) => {
      setArchiveTargetId(null);
      toast({ title: "Не удалось проверить связи", description: error?.message, variant: "destructive" });
    },
  });

  const archiveLocation = useMutation({
    mutationFn: async (locationId: string) =>
      (await apiRequest("POST", `/api/locations/${locationId}/archive`, { confirmed: true })).json(),
    onSuccess: () => {
      invalidateLocations();
      setArchiveTargetId(null);
      setArchivePreview(null);
      setDetailsLocationId(null);
      toast({ title: "Площадка перемещена в архив" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось архивировать площадку", description: error?.message, variant: "destructive" });
    },
  });

  const restoreLocation = useMutation({
    mutationFn: async (locationId: string) =>
      (await apiRequest("POST", `/api/locations/${locationId}/restore`, {})).json(),
    onSuccess: () => {
      invalidateLocations();
      toast({ title: "Площадка восстановлена" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось восстановить площадку", description: error?.message, variant: "destructive" });
    },
  });

  const uploadAttachment = useMutation({
    mutationFn: async ({ locationId, file }: { locationId: string; file: File }) => {
      const form = new FormData();
      form.append("file", file);
      return (await apiRequest("POST", `/api/locations/${locationId}/attachments`, form, true)).json();
    },
    onSuccess: () => {
      invalidateLocations();
      toast({ title: "Файл добавлен" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось добавить файл", description: error?.message, variant: "destructive" });
    },
  });

  const removeAttachment = useMutation({
    mutationFn: ({ locationId, attachmentId }: { locationId: string; attachmentId: string }) =>
      apiRequest("DELETE", `/api/locations/${locationId}/attachments/${attachmentId}`),
    onSuccess: () => {
      invalidateLocations();
      toast({ title: "Файл удалён" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось удалить файл", description: error?.message, variant: "destructive" });
    },
  });

  const createIssue = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/location-issues", issueForm)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-cards"] });
      setIssueDialog(false);
      setIssueForm(EMPTY_ISSUE);
      toast({ title: "Проблема площадки зарегистрирована" });
    },
    onError: (error: any) => {
      toast({ title: "Не удалось создать проблему", description: error?.message, variant: "destructive" });
    },
  });

  const addComment = useMutation({
    mutationFn: ({ issueId, content }: { issueId: string; content: string }) =>
      apiRequest("POST", `/api/location-issues/${issueId}/comments`, { content }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] });
      setCommentDrafts((current) => ({ ...current, [variables.issueId]: "" }));
    },
  });

  const uploadPhoto = useMutation({
    mutationFn: ({ issueId, file }: { issueId: string; file: File }) => {
      const form = new FormData();
      form.append("photo", file);
      return apiRequest("POST", `/api/location-issues/${issueId}/photos`, form, true);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] }),
  });

  const requestArchive = (location: Location) => {
    setDetailsLocationId(null);
    setArchiveTargetId(location.id);
    setArchivePreview(null);
    loadArchivePreview.mutate(location.id);
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-4 px-4 py-4 sm:py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Площадки</h1>
          <p className="text-sm text-muted-foreground">
            Рабочие пространства площадок, техническая информация и операционные проблемы.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setIssueDialog(true)} disabled={activeLocations.length === 0}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Сообщить о проблеме
          </Button>
          {canManage && (
            <Button onClick={openCreateLocation}>
              <Plus className="mr-2 h-4 w-4" />
              Площадка
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_190px_190px_190px]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Название, адрес, тип или заметки"
          />
          <Select value={archiveFilter} onValueChange={(value) => setArchiveFilter(value as typeof archiveFilter)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Активные площадки</SelectItem>
              <SelectItem value="archived">Архив</SelectItem>
              <SelectItem value="all">Активные и архив</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RECORDING_PLACE_STATUSES}>Все статусы</SelectItem>
              {RECORDING_PLACE_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>{RECORDING_PLACE_STATUS_LABELS[status]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger>
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">По названию</SelectItem>
              <SelectItem value="status">По статусу</SelectItem>
              <SelectItem value="updated">Недавно обновлённые</SelectItem>
              <SelectItem value="newest">Сначала новые</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {locationsQuery.isLoading ? (
        <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Загрузка площадок...
        </div>
      ) : locationsQuery.isError ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-8 text-center">
          <p className="text-sm text-red-700 dark:text-red-300">Не удалось загрузить площадки.</p>
          <Button className="mt-3" variant="outline" onClick={() => locationsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleLocations.map((location) => {
            const status = location.status || "available";
            const issuesCount = activeIssueCount.get(location.id) ?? 0;
            return (
              <Card
                key={location.id}
                className={cn(
                  "cursor-pointer transition hover:border-primary/40",
                  issuesCount > 0 && "border-amber-500/50",
                  location.archivedAt && "border-dashed opacity-80",
                )}
                onClick={() => setDetailsLocationId(location.id)}
              >
                <CardHeader className="space-y-2 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="flex min-w-0 items-center gap-2 text-base">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span className="truncate">{location.name}</span>
                    </CardTitle>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="outline" className={RECORDING_PLACE_STATUS_TONES[status]}>
                        {RECORDING_PLACE_STATUS_LABELS[status]}
                      </Badge>
                      {location.archivedAt && <Badge variant="secondary">Архив</Badge>}
                    </div>
                  </div>
                  {location.type && <p className="text-xs text-muted-foreground">{location.type}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  {location.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="line-clamp-2">{location.address}</span>
                    </div>
                  )}
                  {location.description && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{location.description}</p>
                  )}
                  {issuesCount > 0 && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-sm text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="h-4 w-4" />
                      Активные проблемы: {issuesCount}
                    </div>
                  )}
                  {Array.isArray(location.attachments) && location.attachments.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Paperclip className="h-3.5 w-3.5" />
                      Файлы: {location.attachments.length}
                    </div>
                  )}
                  {canManage && !location.archivedAt && (
                    <div onClick={(event) => event.stopPropagation()}>
                      <Select
                        value={status}
                        onValueChange={(value) => updateStatus.mutate({
                          id: location.id,
                          status: value as RecordingPlaceStatus,
                        })}
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {RECORDING_PLACE_STATUSES.map((next) => (
                            <SelectItem key={next} value={next}>{RECORDING_PLACE_STATUS_LABELS[next]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {!locationsQuery.isLoading && !locationsQuery.isError && visibleLocations.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Площадки по выбранным условиям не найдены.
        </div>
      )}

      <Card className="border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Проблемы площадок
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {issues.filter((issue) => !["resolved", "cancelled"].includes(issue.status)).length === 0 ? (
            <p className="text-sm text-muted-foreground">Активных проблем нет.</p>
          ) : issues
            .filter((issue) => !["resolved", "cancelled"].includes(issue.status))
            .map((issue) => (
              <div key={issue.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{issue.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {locations.find((location) => location.id === issue.locationId)?.name || "Площадка"} · {issue.description}
                    </div>
                    {Array.isArray(issue.photos) && issue.photos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {issue.photos.map((photo) => (
                          <img
                            key={photo}
                            src={apiUrl(photo)}
                            alt="Фото проблемы"
                            className="h-12 w-12 rounded object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className={ISSUE_TONES[issue.severity]}>{issue.severity}</Badge>
                </div>
                <div className="mt-2 space-y-1">
                  {(issue.comments ?? []).map((comment) => (
                    <p key={comment.id} className="rounded bg-muted/50 px-2 py-1 text-sm">{comment.content}</p>
                  ))}
                </div>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={commentDrafts[issue.id] || ""}
                    onChange={(event) => setCommentDrafts((current) => ({
                      ...current,
                      [issue.id]: event.target.value,
                    }))}
                    placeholder="Добавить комментарий"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addComment.mutate({
                      issueId: issue.id,
                      content: commentDrafts[issue.id] || "",
                    })}
                    disabled={!commentDrafts[issue.id]?.trim()}
                  >
                    Добавить
                  </Button>
                  <Label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                    <Camera className="h-4 w-4" />
                    Фото
                    <input
                      className="hidden"
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) uploadPhoto.mutate({ issueId: issue.id, file });
                      }}
                    />
                  </Label>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      <Dialog open={Boolean(detailsLocation)} onOpenChange={(open) => !open && setDetailsLocationId(null)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {detailsLocation && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {detailsLocation.name}
                  {detailsLocation.archivedAt && <Badge variant="secondary">Архив</Badge>}
                </DialogTitle>
                <DialogDescription>
                  {detailsLocation.type || "Тип не указан"} · {RECORDING_PLACE_STATUS_LABELS[detailsLocation.status || "available"]}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {detailsLocation.address && (
                  <div className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      Адрес или контекст
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{detailsLocation.address}</p>
                  </div>
                )}
                {detailsLocation.description && (
                  <div className="rounded-lg border p-3">
                    <div className="mb-1 text-xs font-medium uppercase text-muted-foreground">Описание</div>
                    <p className="whitespace-pre-wrap text-sm">{detailsLocation.description}</p>
                  </div>
                )}
                {detailsLocation.notes && (
                  <div className="rounded-lg border p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      Рабочие заметки
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{detailsLocation.notes}</p>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <ListTodo className="h-4 w-4" />
                        Карточки Kanban V2
                      </div>
                      <Badge variant="outline">{detailsLocation.linkedWork?.cards.length ?? 0}</Badge>
                    </div>
                    {detailsLocationQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Загружаем связи...</p>
                    ) : (detailsLocation.linkedWork?.cards.length ?? 0) > 0 ? (
                      <div className="max-h-52 space-y-2 overflow-y-auto">
                        {detailsLocation.linkedWork?.cards.map((card) => (
                          <a
                            key={card.id}
                            href={`/tasks-v2?boardId=${encodeURIComponent(card.boardId)}&cardId=${encodeURIComponent(card.id)}`}
                            className="block rounded-md bg-muted/40 px-3 py-2 transition hover:bg-muted"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="min-w-0 truncate text-sm font-medium">{card.title}</span>
                              <Badge variant={card.status === "active" ? "default" : "secondary"}>
                                {card.status === "active" ? "Активна" : "Завершена"}
                              </Badge>
                            </div>
                            <div className="mt-1 truncate text-xs text-muted-foreground">
                              {card.boardName} · {card.listName}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Связанных карточек пока нет.</p>
                    )}
                  </div>

                  <div className="rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Film className="h-4 w-4" />
                        Проекты
                      </div>
                      <Badge variant="outline">{detailsLocation.linkedWork?.projects.length ?? 0}</Badge>
                    </div>
                    {detailsLocationQuery.isLoading ? (
                      <p className="text-sm text-muted-foreground">Загружаем связи...</p>
                    ) : (detailsLocation.linkedWork?.projects.length ?? 0) > 0 ? (
                      <div className="max-h-52 space-y-2 overflow-y-auto">
                        {detailsLocation.linkedWork?.projects.map((project) => (
                          <a
                            key={project.id}
                            href={`/projects?projectId=${encodeURIComponent(project.id)}`}
                            className="block rounded-md bg-muted/40 px-3 py-2 transition hover:bg-muted"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="min-w-0 truncate text-sm font-medium">{project.name}</span>
                              <Badge variant={project.completed ? "secondary" : "default"}>
                                {project.completed ? "Завершён" : "Активен"}
                              </Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {project.source === "cards"
                                ? "Связь через карточки Kanban"
                                : project.source === "direct_and_cards"
                                  ? "Прямая связь и карточки Kanban"
                                  : "Прямая связь проекта"}
                            </div>
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Связанных проектов пока нет.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Paperclip className="h-4 w-4" />
                      Файлы
                    </div>
                    {canManage && !detailsLocation.archivedAt && (
                      <Label className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2.5 text-xs">
                        <Plus className="h-3.5 w-3.5" />
                        Добавить
                        <input
                          className="hidden"
                          type="file"
                          accept=".pdf,.docx,.xlsx,.txt,image/jpeg,image/png,image/webp"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) uploadAttachment.mutate({ locationId: detailsLocation.id, file });
                          }}
                        />
                      </Label>
                    )}
                  </div>
                  {Array.isArray(detailsLocation.attachments) && detailsLocation.attachments.length > 0 ? (
                    <div className="space-y-2">
                      {detailsLocation.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{attachment.fileName}</div>
                            <div className="text-xs text-muted-foreground">
                              {[formatFileSize(attachment.fileSize), attachment.uploadedByName, formatDateTime(attachment.createdAt)]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                          </div>
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                            <a href={apiUrl(attachment.fileUrl)} target="_blank" rel="noreferrer" aria-label="Открыть файл">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          {canManage && !detailsLocation.archivedAt && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-500 hover:text-red-600"
                              onClick={() => removeAttachment.mutate({
                                locationId: detailsLocation.id,
                                attachmentId: attachment.id,
                              })}
                              aria-label="Удалить файл"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Файлы пока не добавлены.</p>
                  )}
                </div>

                <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <History className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Последнее изменение: {detailsLocation.updatedByName || "неизвестный пользователь"}
                      {detailsLocation.updatedAt ? ` · ${formatDateTime(detailsLocation.updatedAt)}` : ""}
                    </span>
                  </div>
                  {detailsLocation.archivedAt && (
                    <div className="mt-2">
                      Архивировал: {detailsLocation.archivedByName || "неизвестный пользователь"} · {formatDateTime(detailsLocation.archivedAt)}
                    </div>
                  )}
                </div>
              </div>

              {canManage && (
                <DialogFooter className="gap-2 sm:justify-between">
                  {detailsLocation.archivedAt ? (
                    <Button
                      variant="outline"
                      onClick={() => restoreLocation.mutate(detailsLocation.id)}
                      disabled={restoreLocation.isPending}
                    >
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                      Восстановить
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => requestArchive(detailsLocation)}>
                      <Archive className="mr-2 h-4 w-4" />
                      В архив
                    </Button>
                  )}
                  {!detailsLocation.archivedAt && (
                    <Button onClick={() => openEditLocation(detailsLocation)}>
                      <Edit3 className="mr-2 h-4 w-4" />
                      Редактировать
                    </Button>
                  )}
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={locationDialog} onOpenChange={(open) => !open && resetLocationForm()}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingLocationId ? "Редактировать площадку" : "Новая площадка"}</DialogTitle>
            <DialogDescription>
              Метаданные, адрес, рабочие заметки и операционный статус площадки.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!editingLocationId && companies.length > 1 && (
              <Label>
                Компания
                <Select
                  value={locationForm.companyId}
                  onValueChange={(value) => setLocationForm((current) => ({ ...current, companyId: value }))}
                >
                  <SelectTrigger><SelectValue placeholder="Выберите компанию" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((company: any) => (
                      <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Label>
            )}
            <Label>
              Название
              <Input
                value={locationForm.name}
                onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))}
              />
            </Label>
            <Label>
              Тип
              <Input
                value={locationForm.type}
                onChange={(event) => setLocationForm((current) => ({ ...current, type: event.target.value }))}
                placeholder="Студия, форум, выездная площадка"
              />
            </Label>
            <Label>
              Адрес или контекст
              <Textarea
                value={locationForm.address}
                onChange={(event) => setLocationForm((current) => ({ ...current, address: event.target.value }))}
                placeholder="Адрес, корпус, зал, особенности доступа"
              />
            </Label>
            <Label>
              Описание
              <Textarea
                value={locationForm.description}
                onChange={(event) => setLocationForm((current) => ({ ...current, description: event.target.value }))}
              />
            </Label>
            <Label>
              Рабочие заметки
              <Textarea
                value={locationForm.notes}
                onChange={(event) => setLocationForm((current) => ({ ...current, notes: event.target.value }))}
                className="min-h-28"
                placeholder="Технические особенности, контакты, ограничения и инструкции"
              />
            </Label>
            <Label>
              Статус
              <Select
                value={locationForm.status}
                onValueChange={(value) => setLocationForm((current) => ({
                  ...current,
                  status: value as RecordingPlaceStatus,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECORDING_PLACE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>{RECORDING_PLACE_STATUS_LABELS[status]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetLocationForm}>Отмена</Button>
            <Button
              onClick={() => saveLocation.mutate()}
              disabled={
                !locationForm.name.trim() ||
                (!editingLocationId && !locationForm.companyId && !primaryCompanyId) ||
                saveLocation.isPending
              }
            >
              {saveLocation.isPending ? "Сохранение..." : editingLocationId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(archiveTargetId)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTargetId(null);
            setArchivePreview(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Архивировать площадку?</DialogTitle>
            <DialogDescription>
              Площадка исчезнет из новых выборов, но история, проблемы и существующие связи сохранятся.
            </DialogDescription>
          </DialogHeader>
          {archiveTarget && (
            <div className="space-y-3">
              <div className="rounded-lg border p-3 font-medium">{archiveTarget.name}</div>
              {loadArchivePreview.isPending || !archivePreview ? (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Проверяем активные связи...
                </div>
              ) : archivePreview.activeLinks.total > 0 ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <div className="mb-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="h-4 w-4" />
                    У площадки есть активные связи
                  </div>
                  <ul className="list-inside list-disc text-muted-foreground">
                    <li>Активные карточки Kanban V2: {archivePreview.activeLinks.activeKanbanCards}</li>
                    <li>Активные проекты: {archivePreview.activeLinks.activeProjects}</li>
                    <li>Нерешённые проблемы: {archivePreview.activeLinks.unresolvedDiscussions}</li>
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Активных проектов, карточек и нерешённых проблем нет.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setArchiveTargetId(null);
                setArchivePreview(null);
              }}
            >
              Отмена
            </Button>
            <Button
              variant="destructive"
              disabled={!archiveTarget || !archivePreview || archiveLocation.isPending}
              onClick={() => archiveTarget && archiveLocation.mutate(archiveTarget.id)}
            >
              {archiveLocation.isPending ? "Архивирование..." : "Подтвердить архивирование"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={issueDialog} onOpenChange={setIssueDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сообщить о проблеме площадки</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>
              Площадка
              <Select
                value={issueForm.locationId}
                onValueChange={(value) => setIssueForm((current) => ({ ...current, locationId: value }))}
              >
                <SelectTrigger><SelectValue placeholder="Выберите площадку" /></SelectTrigger>
                <SelectContent>
                  {activeLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
            <Label>
              Заголовок
              <Input
                value={issueForm.title}
                onChange={(event) => setIssueForm((current) => ({ ...current, title: event.target.value }))}
              />
            </Label>
            <Label>
              Описание
              <Textarea
                value={issueForm.description}
                onChange={(event) => setIssueForm((current) => ({ ...current, description: event.target.value }))}
              />
            </Label>
            <Label>
              Серьёзность
              <Select
                value={issueForm.severity}
                onValueChange={(value) => setIssueForm((current) => ({
                  ...current,
                  severity: value as typeof issueForm.severity,
                }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Низкая</SelectItem>
                  <SelectItem value="medium">Средняя</SelectItem>
                  <SelectItem value="high">Высокая</SelectItem>
                  <SelectItem value="critical">Критическая</SelectItem>
                </SelectContent>
              </Select>
            </Label>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createIssue.mutate()}
              disabled={
                !issueForm.locationId ||
                !issueForm.title.trim() ||
                !issueForm.description.trim() ||
                createIssue.isPending
              }
            >
              Отправить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
