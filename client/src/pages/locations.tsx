import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, Camera, MessageSquarePlus, Plus, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AuthService } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import {
  ALL_RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUS_LABELS,
  RECORDING_PLACE_STATUS_TONES,
  type RecordingPlaceStatus,
} from "@/lib/recording-place-status";

type Location = { id: string; name: string; description?: string | null; type?: string | null; status?: RecordingPlaceStatus | null; createdAt?: string };
type LocationIssue = { id: string; locationId: string; title: string; description: string; severity: "low" | "medium" | "high" | "critical"; status: string; photos?: string[] | null; comments?: Array<{ id: string; content: string; createdAt?: string }> };

const EMPTY_LOCATION = { name: "", type: "recording", description: "", status: "available" as RecordingPlaceStatus };
const EMPTY_ISSUE = { locationId: "", title: "", description: "", severity: "medium" };
const ISSUE_TONES: Record<string, string> = { low: "text-sky-600", medium: "text-amber-600", high: "text-orange-600", critical: "text-red-600" };

export default function LocationsPage() {
  const currentUser = AuthService.getCurrentUser();
  const canManage = currentUser?.role === "admin" || currentUser?.role === "manager";
  const [filter, setFilter] = useState(ALL_RECORDING_PLACE_STATUSES);
  const [sort, setSort] = useState("name");
  const [search, setSearch] = useState("");
  const [locationDialog, setLocationDialog] = useState(false);
  const [issueDialog, setIssueDialog] = useState(false);
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION);
  const [issueForm, setIssueForm] = useState(EMPTY_ISSUE);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const locationsQuery = useQuery<Location[]>({ queryKey: ["/api/locations"] });
  const issuesQuery = useQuery<LocationIssue[]>({ queryKey: ["/api/location-issues"], refetchInterval: 15_000 });
  const locations = locationsQuery.data ?? [];
  const issues = issuesQuery.data ?? [];
  const activeIssueCount = new Map<string, number>();
  for (const issue of issues) if (!["resolved", "cancelled"].includes(issue.status)) activeIssueCount.set(issue.locationId, (activeIssueCount.get(issue.locationId) ?? 0) + 1);

  const visibleLocations = useMemo(() => locations
    .filter((location) => filter === ALL_RECORDING_PLACE_STATUSES || location.status === filter)
    .filter((location) => `${location.name} ${location.type || ""}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((left, right) => sort === "status"
      ? String(left.status || "available").localeCompare(String(right.status || "available"), "ru") || left.name.localeCompare(right.name, "ru")
      : sort === "newest"
        ? new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime()
        : left.name.localeCompare(right.name, "ru")), [locations, filter, search, sort]);

  const saveLocation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/locations", locationForm)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/locations"] }); setLocationDialog(false); setLocationForm(EMPTY_LOCATION); },
  });
  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RecordingPlaceStatus }) => apiRequest("PUT", `/api/locations/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/locations"] }),
  });
  const createIssue = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/location-issues", issueForm)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] }); setIssueDialog(false); setIssueForm(EMPTY_ISSUE); },
  });
  const addComment = useMutation({
    mutationFn: ({ issueId, content }: { issueId: string; content: string }) => apiRequest("POST", `/api/location-issues/${issueId}/comments`, { content }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] }),
  });
  const uploadPhoto = useMutation({
    mutationFn: ({ issueId, file }: { issueId: string; file: File }) => { const form = new FormData(); form.append("photo", file); return apiRequest("POST", `/api/location-issues/${issueId}/photos`, form, true); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] }),
  });

  return <div className="container mx-auto max-w-7xl space-y-4 px-4 py-4 sm:py-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><h1 className="text-2xl font-bold">Площадки</h1><p className="text-sm text-muted-foreground">Статус площадок и сообщения о проблемах для production-работ.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => setIssueDialog(true)}><MessageSquarePlus className="mr-2 h-4 w-4" />Сообщить об ошибке</Button><Button onClick={() => setLocationDialog(true)}><Plus className="mr-2 h-4 w-4" />Площадка</Button></div>
    </div>
    <Card><CardContent className="flex flex-col gap-2 p-3 sm:flex-row"><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск площадки" className="sm:max-w-xs" /><Select value={filter} onValueChange={setFilter}><SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL_RECORDING_PLACE_STATUSES}>Все статусы</SelectItem>{RECORDING_PLACE_STATUSES.map((status) => <SelectItem key={status} value={status}>{RECORDING_PLACE_STATUS_LABELS[status]}</SelectItem>)}</SelectContent></Select><Select value={sort} onValueChange={setSort}><SelectTrigger className="sm:w-48"><SlidersHorizontal className="mr-2 h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">По названию</SelectItem><SelectItem value="status">По статусу</SelectItem><SelectItem value="newest">Сначала новые</SelectItem></SelectContent></Select></CardContent></Card>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleLocations.map((location) => { const status = location.status || "available"; const issuesCount = activeIssueCount.get(location.id) ?? 0; return <Card key={location.id} className={cn(issuesCount && "border-amber-500/50")}><CardHeader className="space-y-2 pb-2"><div className="flex items-start justify-between gap-3"><CardTitle className="flex min-w-0 items-center gap-2 text-base"><Building2 className="h-4 w-4 shrink-0" /> <span className="truncate">{location.name}</span></CardTitle><Badge variant="outline" className={cn("shrink-0", RECORDING_PLACE_STATUS_TONES[status])}>{RECORDING_PLACE_STATUS_LABELS[status]}</Badge></div>{location.type && <p className="text-xs text-muted-foreground">{location.type}</p>}</CardHeader><CardContent className="space-y-3">{location.description && <p className="line-clamp-2 text-sm text-muted-foreground">{location.description}</p>}{issuesCount > 0 && <div className="flex items-center gap-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="h-4 w-4" />Активные ошибки: {issuesCount}</div>}{canManage && <Select value={status} onValueChange={(value) => updateStatus.mutate({ id: location.id, status: value as RecordingPlaceStatus })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{RECORDING_PLACE_STATUSES.map((next) => <SelectItem key={next} value={next}>{RECORDING_PLACE_STATUS_LABELS[next]}</SelectItem>)}</SelectContent></Select>}</CardContent></Card>; })}</div>
    {!locationsQuery.isLoading && visibleLocations.length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Площадки по выбранным условиям не найдены.</div>}
    <Card className="border-amber-500/30"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-amber-500" />Ошибки площадок</CardTitle></CardHeader><CardContent className="space-y-2">{issues.filter((issue) => !["resolved", "cancelled"].includes(issue.status)).length === 0 ? <p className="text-sm text-muted-foreground">Активных ошибок нет.</p> : issues.filter((issue) => !["resolved", "cancelled"].includes(issue.status)).map((issue) => <div key={issue.id} className="rounded-md border p-3"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{issue.title}</div><div className="text-sm text-muted-foreground">{locations.find((l) => l.id === issue.locationId)?.name || "Площадка"} · {issue.description}</div>{Array.isArray(issue.photos) && issue.photos.length > 0 && <div className="mt-2 flex gap-2">{issue.photos.map((photo) => <img key={photo} src={photo} alt="Фото ошибки" className="h-12 w-12 rounded object-cover" />)}</div>}</div><Badge variant="outline" className={ISSUE_TONES[issue.severity]}>{issue.severity}</Badge></div><div className="mt-2 space-y-1">{(issue.comments ?? []).map((comment) => <p key={comment.id} className="rounded bg-muted/50 px-2 py-1 text-sm">{comment.content}</p>)}</div><div className="mt-2 flex flex-col gap-2 sm:flex-row"><Input value={commentDrafts[issue.id] || ""} onChange={(event) => setCommentDrafts({ ...commentDrafts, [issue.id]: event.target.value })} placeholder="Добавить комментарий" /><Button size="sm" variant="outline" onClick={() => addComment.mutate({ issueId: issue.id, content: commentDrafts[issue.id] || "" })} disabled={!commentDrafts[issue.id]?.trim()}>Добавить</Button><Label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm"><Camera className="h-4 w-4" />Фото<input className="hidden" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadPhoto.mutate({ issueId: issue.id, file }); }} /></Label></div></div>)}</CardContent></Card>
    <Dialog open={locationDialog} onOpenChange={setLocationDialog}><DialogContent><DialogHeader><DialogTitle>Новая площадка</DialogTitle></DialogHeader><div className="space-y-3"><Label>Название<Input value={locationForm.name} onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })} /></Label><Label>Тип<Input value={locationForm.type} onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })} /></Label><Label>Описание<Textarea value={locationForm.description} onChange={(e) => setLocationForm({ ...locationForm, description: e.target.value })} /></Label><Label>Статус<Select value={locationForm.status} onValueChange={(value) => setLocationForm({ ...locationForm, status: value as RecordingPlaceStatus })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RECORDING_PLACE_STATUSES.map((status) => <SelectItem key={status} value={status}>{RECORDING_PLACE_STATUS_LABELS[status]}</SelectItem>)}</SelectContent></Select></Label></div><DialogFooter><Button onClick={() => saveLocation.mutate()} disabled={!locationForm.name.trim() || saveLocation.isPending}>Создать</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={issueDialog} onOpenChange={setIssueDialog}><DialogContent><DialogHeader><DialogTitle>Сообщить об ошибке площадки</DialogTitle></DialogHeader><div className="space-y-3"><Label>Площадка<Select value={issueForm.locationId} onValueChange={(value) => setIssueForm({ ...issueForm, locationId: value })}><SelectTrigger><SelectValue placeholder="Выберите площадку" /></SelectTrigger><SelectContent>{locations.map((location) => <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>)}</SelectContent></Select></Label><Label>Заголовок<Input value={issueForm.title} onChange={(e) => setIssueForm({ ...issueForm, title: e.target.value })} /></Label><Label>Описание<Textarea value={issueForm.description} onChange={(e) => setIssueForm({ ...issueForm, description: e.target.value })} /></Label><Label>Серьёзность<Select value={issueForm.severity} onValueChange={(value) => setIssueForm({ ...issueForm, severity: value as typeof issueForm.severity })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Низкая</SelectItem><SelectItem value="medium">Средняя</SelectItem><SelectItem value="high">Высокая</SelectItem><SelectItem value="critical">Критическая</SelectItem></SelectContent></Select></Label></div><DialogFooter><Button onClick={() => createIssue.mutate()} disabled={!issueForm.locationId || !issueForm.title.trim() || !issueForm.description.trim() || createIssue.isPending}>Отправить</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
