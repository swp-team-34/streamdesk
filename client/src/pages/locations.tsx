import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageSquarePlus, Plus, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  LocationTopicsWorkspace,
  type LocationTopic,
} from "@/components/location-topics-workspace";
import { LocationCard } from "@/components/locations/location-card";
import { LocationDetailsDialog } from "@/components/locations/location-details-dialog";
import {
  LocationArchiveDialog,
  LocationFormDialog,
} from "@/components/locations/location-management-dialogs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import {
  EMPTY_LOCATION,
  getActiveLocationIssueCounts,
  getVisibleLocations,
  type ArchivePreview,
  type Location,
  type LocationArchiveFilter,
  type LocationForm,
  type LocationSort,
} from "@/lib/location-model";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ALL_RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUS_LABELS,
  type RecordingPlaceStatus,
} from "@/lib/recording-place-status";


export default function LocationsPage() {
  const currentUser = AuthService.getCurrentUser();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState(ALL_RECORDING_PLACE_STATUSES);
  const [archiveFilter, setArchiveFilter] = useState<LocationArchiveFilter>("active");
  const [sort, setSort] = useState<LocationSort>("name");
  const [search, setSearch] = useState("");
  const [locationDialog, setLocationDialog] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [detailsLocationId, setDetailsLocationId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("topicId") ? null : params.get("locationId");
  });
  const [topicId, setTopicId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("topicId");
  });
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);
  const [archivePreview, setArchivePreview] = useState<ArchivePreview | null>(null);
  const [issueDialog, setIssueDialog] = useState(false);
  const [locationForm, setLocationForm] = useState<LocationForm>(EMPTY_LOCATION);

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
  const issuesQuery = useQuery<LocationTopic[]>({
    queryKey: ["/api/location-issues"],
    refetchInterval: 30_000,
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

  const activeIssueCount = useMemo(() => getActiveLocationIssueCounts(issues), [issues]);
  const visibleLocations = useMemo(() => getVisibleLocations({
    locations,
    archiveFilter,
    statusFilter,
    search,
    sort,
  }), [archiveFilter, locations, search, sort, statusFilter]);

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
            Новая тема
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
          <Select value={sort} onValueChange={(value) => setSort(value as LocationSort)}>
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
        <div className="rounded-surface border border-error/30 bg-error-muted p-8 text-center">
          <p className="text-sm text-error">Не удалось загрузить площадки.</p>
          <Button className="mt-3" variant="outline" onClick={() => locationsQuery.refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Повторить
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleLocations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              issueCount={activeIssueCount.get(location.id) ?? 0}
              canManage={canManage}
              onOpen={() => setDetailsLocationId(location.id)}
              onStatusChange={(status) => updateStatus.mutate({ id: location.id, status })}
            />
          ))}
        </div>
      )}

      {!locationsQuery.isLoading && !locationsQuery.isError && visibleLocations.length === 0 && (
        <div className="rounded-surface border border-dashed border-border/60 bg-surface-subtle p-8 text-center text-sm text-muted-foreground">
          Площадки по выбранным условиям не найдены.
        </div>
      )}

      <LocationTopicsWorkspace
        locations={locations}
        createOpen={issueDialog}
        onCreateOpenChange={setIssueDialog}
        topicId={topicId}
        defaultLocationId={detailsLocationId}
        onTopicChange={(nextTopicId, locationId) => {
          setTopicId(nextTopicId);
          setDetailsLocationId(null);
          if (typeof window !== "undefined") {
            const params = new URLSearchParams();
            if (nextTopicId && locationId) {
              params.set("locationId", locationId);
              params.set("topicId", nextTopicId);
            }
            window.history.replaceState(null, "", params.size ? `/locations?${params}` : "/locations");
          }
        }}
      />

      <LocationDetailsDialog
        location={detailsLocation}
        loading={detailsLocationQuery.isLoading}
        canManage={canManage}
        restorePending={restoreLocation.isPending}
        onClose={() => setDetailsLocationId(null)}
        onUpload={(file) => {
          if (detailsLocation) uploadAttachment.mutate({ locationId: detailsLocation.id, file });
        }}
        onRemoveAttachment={(attachmentId) => {
          if (detailsLocation) {
            removeAttachment.mutate({ locationId: detailsLocation.id, attachmentId });
          }
        }}
        onRestore={() => detailsLocation && restoreLocation.mutate(detailsLocation.id)}
        onArchive={() => detailsLocation && requestArchive(detailsLocation)}
        onEdit={() => detailsLocation && openEditLocation(detailsLocation)}
      />

      <LocationFormDialog
        open={locationDialog}
        editing={Boolean(editingLocationId)}
        companies={companies}
        form={locationForm}
        primaryCompanyId={primaryCompanyId}
        pending={saveLocation.isPending}
        onClose={resetLocationForm}
        onChange={setLocationForm}
        onSave={() => saveLocation.mutate()}
      />

      <LocationArchiveDialog
        target={archiveTarget}
        preview={archivePreview}
        previewPending={loadArchivePreview.isPending}
        archivePending={archiveLocation.isPending}
        onClose={() => {
          setArchiveTargetId(null);
          setArchivePreview(null);
        }}
        onConfirm={() => archiveTarget && archiveLocation.mutate(archiveTarget.id)}
      />

    </div>
  );
}
