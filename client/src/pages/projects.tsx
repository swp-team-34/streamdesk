import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { StreamMultiSelect } from "@/components/ui/stream-multi-select";
import { 
  Plus, HardDrive, Calendar,
  User, Edit, Trash2, Film, Clock, CheckCircle2,
  Columns, GripVertical, X, Settings2, MessageSquare, Link2, Github, ExternalLink,
  ArrowUp, ArrowDown, ListTodo, BarChart3, FileSpreadsheet as FileExcelIcon, MapPin, Search
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DiscussionThread } from "@/components/discussion-thread";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { ProjectEditForm } from "@/components/projects/project-edit-form";
import { ProjectTaskStats } from "@/components/projects/project-task-stats";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscriptions } from "@/hooks/use-websocket";
import {
  updateOpenedProject,
  upsertProjectKanbanBoard,
} from "@/lib/project-kanban";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";

const projectSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().min(1, "Название обязательно"),
  client: z.string().optional(),
  description: z.string().optional(),
  status: z.string().default("planning"),
  category: z.string().optional(),
  deadline: z.string().optional(),
  responsibleUserIds: z.array(z.string()).optional(),
  participants: z.array(z.string()).optional(),
  showInTaskManager: z.boolean().default(false),
  createYougileBoard: z.boolean().default(false),
  devices: z.array(z.string()).optional(),
  storageLocation: z.string().optional(),
  estimatedSize: z.string().optional(),
  notes: z.string().optional(),
  locationIds: z.array(z.string()).default([]),
});

type ProjectFormData = z.infer<typeof projectSchema>;

const statusConfig = {
  planning: { label: "Планирование", color: "border-info/20 bg-info-muted text-info", progress: 10 },
  filming: { label: "Съёмка", color: "border-primary/20 bg-primary/10 text-primary", progress: 30 },
  editing: { label: "Монтаж", color: "border-warning/20 bg-warning-muted text-warning", progress: 50 },
  review: { label: "На проверке", color: "border-warning/20 bg-warning-muted text-warning", progress: 80 },
  completed: { label: "Завершён", color: "border-success/20 bg-success-muted text-success", progress: 100 },
  archived: { label: "В архиве", color: "border-border/40 bg-muted text-muted-foreground", progress: 100 },
};

const categoryOptions = [
  { value: "commercial", label: "Рекламный ролик" },
  { value: "music_video", label: "Музыкальный клип" },
  { value: "documentary", label: "Документальный" },
  { value: "corporate", label: "Корпоративный" },
  { value: "event", label: "Мероприятие" },
  { value: "youtube", label: "YouTube контент" },
  { value: "stream_highlight", label: "Хайлайты стрима" },
  { value: "other", label: "Другое" },
];

function getProjectStatus(project: { status?: string | null }) {
  return statusConfig[project.status as keyof typeof statusConfig] ?? {
    label: project.status || "Без статуса",
    color: "border-border/40 bg-muted text-muted-foreground",
    progress: 0,
  };
}

function getProjectCategoryLabel(category: unknown) {
  const value = String(category || "").trim();
  return categoryOptions.find((option) => option.value === value)?.label || value;
}

interface ProjectColumn {
  id: string;
  projectId: string;
  name: string;
  order: number;
  color?: string | null;
}

function formatDiscussionActivity(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMM, HH:mm", { locale: ru });
}

function formatProjectDeadline(value: unknown) {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "d MMMM yyyy", { locale: ru });
}

// Колонки для менеджера задач (сохраняются в localStorage, используются на странице «Задачи»)
const TASK_MANAGER_COLUMNS_KEY = "streamdesk_task_columns";
const DEFAULT_TASK_COLUMNS = [
  { id: "not_ready", name: "Бэклог", order: 0 },
  { id: "todo", name: "К выполнению", order: 1 },
  { id: "in_progress", name: "В работе", order: 2 },
  { id: "done", name: "Готово", order: 3 },
];

function AddColumnForm({
  boardId,
  onSuccess,
  onCancel,
  isLoading,
  onSubmit,
}: {
  boardId: string;
  onSuccess: () => void;
  onCancel: () => void;
  isLoading: boolean;
  onSubmit: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const { toast } = useToast();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) {
      toast({ title: "Ошибка", description: "Введите название колонки", variant: "destructive" });
      return;
    }
    onSubmit(t);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Название колонки</label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: В работе"
          className="bg-background"
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Отмена
        </Button>
        <Button type="submit" disabled={isLoading} className="flex-1">
          {isLoading ? "Создание…" : "Создать"}
        </Button>
      </div>
    </form>
  );
}

function loadTaskManagerColumns(): { id: string; name: string; order: number }[] {
  if (typeof window === "undefined") return DEFAULT_TASK_COLUMNS;
  try {
    const raw = localStorage.getItem(TASK_MANAGER_COLUMNS_KEY);
    if (!raw) return DEFAULT_TASK_COLUMNS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_TASK_COLUMNS;
    return parsed.map((c: any, i: number) => ({
      id: String(c?.id ?? `col_${i}`),
      name: String(c?.name ?? "Столбец"),
      order: Number(c?.order) ?? i,
    }));
  } catch {
    return DEFAULT_TASK_COLUMNS;
  }
}

function saveTaskManagerColumns(cols: { id: string; name: string; order: number }[]) {
  try {
    localStorage.setItem(TASK_MANAGER_COLUMNS_KEY, JSON.stringify(cols));
  } catch (e) {
    console.warn("saveTaskManagerColumns", e);
  }
}

function normalizeParticipantIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
}

function normalizeProjectResponsibleIds(project: any): string[] {
  const ids = normalizeParticipantIds(project?.responsibleUserIds);
  const legacyAssignedTo = String(project?.assignedTo || "").trim();
  if (legacyAssignedTo && !ids.includes(legacyAssignedTo)) ids.push(legacyAssignedTo);
  return ids;
}

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [assignedFilter, setAssignedFilter] = useState<string[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const projectEditorCloseRef = useRef<(() => Promise<void>) | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { confirm: confirmAction } = useAppDialog();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["/api/projects"],
  });
  const projectDiscussionChannels = useMemo(
    () => (projects as any[])
      .map((project) => String(project?.id || "").trim())
      .filter(Boolean)
      .map((projectId) => `project:${projectId}:comments`),
    [projects],
  );
  useRealtimeSubscriptions(projectDiscussionChannels, (message) => {
    if (message.type === "discussion_event" || message.type === "realtime_reconnected") {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const projectId = new URLSearchParams(window.location.search).get("projectId");
    if (!projectId) return;
    const project = (projects as any[]).find((item) => String(item.id) === projectId);
    if (project) setSelectedProject(project);
  }, [projects]);

  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
  });

  const { data: companiesResponse } = useQuery<any>({
    queryKey: ["/api/companies/me", "projects"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/companies/me");
      return response.json();
    },
  });
  const companies = Array.isArray(companiesResponse?.companies)
    ? companiesResponse.companies.map((entry: any) => entry?.company).filter((company: any) => company?.id)
    : [];
  const primaryCompanyId = String(companies[0]?.id || "");
  const companyTopicChannels = useMemo(
    () => companies
      .map((company: any) => String(company.id || "").trim())
      .filter(Boolean)
      .map((companyId: string) => `company:${companyId}`),
    [companies],
  );
  useRealtimeSubscriptions(companyTopicChannels, (message) => {
    if (message.type !== "discussion_event" && message.type !== "realtime_reconnected") return;
    queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
    queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] });
    queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  });

  const { data: locations = [] } = useQuery<Array<{
    id: string;
    companyId?: string | null;
    name: string;
    archivedAt?: string | Date | null;
  }>>({
    queryKey: ["/api/locations", "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/locations?archive=all");
      return response.json();
    },
  });

  const { data: equipmentOnProjects = [] } = useQuery<Array<{ projectId: string; equipmentId: string }>>({
    queryKey: ["/api/equipment-on-projects"],
  });

  const { data: yougileProjects = [] } = useQuery<Array<{ id: string; title?: string }>>({
    queryKey: ["/api/yougile/projects"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/yougile/projects");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const syncYougileMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/yougile/sync-projects", {});
      return res.json();
    },
    onSuccess: (data: { synced?: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (data?.synced) toast({ title: "Синхронизация", description: `Добавлено проектов из YouGile: ${data.synced}` });
    },
  });

  useEffect(() => {
    if (yougileProjects.length === 0) return;
    apiRequest("POST", "/api/yougile/sync-projects", {})
      .then((r) => r.ok && r.json())
      .then((data: { synced?: number } | undefined) => {
        if (data?.synced) queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      })
      .catch(() => {});
  }, [yougileProjects.length]);

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      companyId: "",
      name: "",
      client: "",
      description: "",
      status: "planning",
      category: "",
      deadline: "",
      responsibleUserIds: [],
      participants: [],
      showInTaskManager: false,
      createYougileBoard: false,
      devices: [],
      storageLocation: "",
      estimatedSize: "",
      notes: "",
      locationIds: [],
    },
  });

  useEffect(() => {
    if (!primaryCompanyId || form.getValues("companyId")) return;
    form.setValue("companyId", primaryCompanyId);
  }, [form, primaryCompanyId]);
  const selectedProjectCompanyId = form.watch("companyId") || primaryCompanyId;

  const createMutation = useMutation({
    mutationFn: async (data: ProjectFormData) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Успешно", description: "Проект создан" });
      setIsFormOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать проект", variant: "destructive" });
    },
  });

  const importYougileProjectMutation = useMutation({
    mutationFn: async (project: { id: string; title?: string }) => {
      const name = (project.title || "Проект YouGile").trim() || "Проект YouGile";
      const boardsRes = await apiRequest("GET", `/api/yougile/boards?projectId=${encodeURIComponent(project.id)}`);
      const boards = boardsRes.ok ? await boardsRes.json() : [];
      const firstBoard = boards[0];
      const existing = (queryClient.getQueryData(["/api/projects"]) as any[]) || [];
      if (firstBoard?.id && existing.some((p: any) => p.yougileBoardId === firstBoard.id)) {
        throw new Error("Этот проект уже в видеопроектах");
      }
      const payload: { name: string; status: string; yougileBoardId?: string; showInTaskManager?: boolean } = {
        name,
        status: "planning",
        showInTaskManager: true,
      };
      if (firstBoard?.id) payload.yougileBoardId = firstBoard.id;
      const res = await apiRequest("POST", "/api/projects", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yougile/projects"] });
      toast({ title: "Готово", description: "Проект из YouGile добавлен в видеопроекты" });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось добавить проект", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ProjectFormData> }) => {
      const response = await apiRequest("PUT", `/api/projects/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      toast({ title: "Успешно", description: "Проект обновлён" });
      setSelectedProject(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Успешно", description: "Проект удалён" });
    },
  });

  const [projectForStats, setProjectForStats] = useState<any>(null);
  const [projectForAddColumn, setProjectForAddColumn] = useState<any>(null);
  const [projectForDiscussion, setProjectForDiscussion] = useState<any>(null);

  const linkBoardMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/link-yougile-board`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({ title: "Готово", description: "Доска YouGile создана и привязана" });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось создать доску", variant: "destructive" });
    },
  });

  const openProjectKanbanBoardMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const res = await apiRequest("POST", `/api/projects/${projectId}/kanban-board`, {});
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Не удалось открыть доску проекта");
      }
      return res.json();
    },
    onSuccess: async (data: any, projectId: string) => {
      const boardId = data?.board?.id;
      if (!boardId) {
        toast({ title: "Ошибка", description: "Сервер не вернул доску проекта", variant: "destructive" });
        return;
      }
      queryClient.setQueryData(
        ["/api/kanban/boards"],
        (current: any[] | undefined) => upsertProjectKanbanBoard(current, data.board),
      );
      if (data?.project?.id) {
        queryClient.setQueryData(
          ["/api/projects"],
          (current: any[] | undefined) => updateOpenedProject(current, data.project),
        );
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/projects"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-lists", boardId] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-board-members", boardId] }),
        queryClient.invalidateQueries({ queryKey: ["kanban-cards", boardId] }),
        queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "task-stats"] }),
      ]);
      navigate(`/tasks?boardId=${encodeURIComponent(boardId)}`);
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось открыть доску проекта", variant: "destructive" });
    },
  });

  const addColumnMutation = useMutation({
    mutationFn: async ({ boardId, title }: { boardId: string; title: string }) => {
      const res = await apiRequest("POST", "/api/yougile/columns", { boardId, title });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Ошибка создания колонки");
      }
      return res.json();
    },
    onSuccess: () => {
      setProjectForAddColumn(null);
      queryClient.invalidateQueries({ queryKey: ["/api/yougile/columns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/yougile/boards-all"] });
      toast({ title: "Готово", description: "Колонка добавлена на доску" });
    },
    onError: (e: any) => {
      toast({ title: "Ошибка", description: e?.message || "Не удалось добавить колонку", variant: "destructive" });
    },
  });

  const filteredProjects = (projects as any[]).filter((item) => {
    const participantIds = normalizeParticipantIds(item.participants);
    const responsibleUserIds = normalizeProjectResponsibleIds(item);
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.client?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(String(item.status || ""));
    const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(String(item.category || ""));
    const matchesAssigned = assignedFilter.length === 0 || assignedFilter.some((userId) =>
      responsibleUserIds.includes(userId) || participantIds.includes(userId),
    );
    return matchesSearch && matchesStatus && matchesCategory && matchesAssigned;
  });

  const equipmentCountByProject = equipmentOnProjects.reduce<Record<string, number>>((acc, item) => {
    const key = String(item.projectId || "").trim();
    if (!key) return acc;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const exportProjectsToExcel = () => {
    const BOM = "\uFEFF";
    const statusLabels: Record<string, string> = {
      planning: "Планирование",
      filming: "Съёмка",
      editing: "Монтаж",
      review: "На проверке",
      completed: "Завершён",
      archived: "В архиве",
    };
    const headers = ["Название", "Описание", "Статус", "Категория", "Ответственный", "Дедлайн"];
    const rows = filteredProjects.map((p: any) => [
      p.name ?? "",
      p.description ?? "",
      statusLabels[p.status] ?? p.status ?? "",
      p.category ?? "",
      normalizeProjectResponsibleIds(p).map(getUserName).join(", "),
      p.deadline ? format(new Date(p.deadline), "dd.MM.yyyy", { locale: ru }) : "",
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))].join("\r\n");
    const blob = new Blob([BOM + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `видеопроекты_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Выгружено", description: `Экспорт ${filteredProjects.length} проектов. Откройте в Excel.` });
  };

  const onSubmit = (data: ProjectFormData) => {
    createMutation.mutate(data);
  };

  const getUserName = (userId: string) => {
    const user = (users as any[]).find(u => u.id === userId);
    return user?.name || "Не назначен";
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-4 px-2 py-3 sm:px-4 sm:py-4">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Проекты</h1>
          <p className="text-sm text-muted-foreground">Команда, площадки, оборудование и Kanban-доски проектов.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="border-border/50 bg-surface-raised" onClick={exportProjectsToExcel} disabled={filteredProjects.length === 0} title="Выгрузить текущий список в Excel">
            <FileExcelIcon className="w-4 h-4 mr-1.5" />
            В Excel
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-project">
              <Plus className="w-4 h-4 mr-2" />
              Новый проект
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto hide-scrollbar">
            <DialogHeader>
              <DialogTitle>Создать проект</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                {companies.length > 1 && (
                  <FormField
                    control={form.control}
                    name="companyId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Компания *</FormLabel>
                        <Select
                          value={field.value || primaryCompanyId}
                          onValueChange={(value) => {
                            field.onChange(value);
                            form.setValue("locationIds", []);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Выберите компанию" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {companies.map((company: any) => (
                              <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Название проекта *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Название проекта" data-testid="input-project-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Описание</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Описание проекта (при необходимости)" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="responsibleUserIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ответственные</FormLabel>
                      <FormControl>
                        <StreamMultiSelect
                          values={normalizeParticipantIds(field.value)}
                          options={(users as any[]).map((user: any) => ({
                            value: String(user.id),
                            label: user.name || user.username || user.id,
                            description: user.email || undefined,
                          }))}
                          onValuesChange={field.onChange}
                          placeholder={(users as any[]).length > 0 ? "Выберите ответственных" : "Пользователей пока нет"}
                          ariaLabel="Ответственные проекта"
                          title="Ответственные проекта"
                          searchable
                          disabled={(users as any[]).length === 0}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="participants"
                  render={({ field }) => {
                    const selected = normalizeParticipantIds(field.value);
                    return (
                      <FormItem>
                        <FormLabel>Участники проекта</FormLabel>
                        <FormControl>
                          <StreamMultiSelect
                            values={selected}
                            options={(users as any[]).map((user: any) => ({
                              value: String(user.id),
                              label: user.name || user.username || user.id,
                              description: user.email || undefined,
                            }))}
                            onValuesChange={field.onChange}
                            placeholder={(users as any[]).length > 0 ? "Выберите участников" : "Пользователей пока нет"}
                            ariaLabel="Участники проекта"
                            title="Участники проекта"
                            searchable
                            disabled={(users as any[]).length === 0}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="showInTaskManager"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-start gap-2 rounded-control border border-border/50 bg-surface-subtle p-3 text-sm">
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                        <span>
                          <span className="block font-medium">Показывать в таск-менеджере</span>
                          <span className="text-muted-foreground">Создать локальную доску StreamDesk без обязательного YouGile.</span>
                        </span>
                      </label>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="locationIds"
                  render={({ field }) => {
                    const selected = normalizeParticipantIds(field.value);
                    const availableLocations = locations.filter((location) =>
                      !location.archivedAt &&
                      (!selectedProjectCompanyId || String(location.companyId || "") === selectedProjectCompanyId),
                    );
                    return (
                      <FormItem>
                        <FormLabel>Площадки проекта</FormLabel>
                        <FormControl>
                          <StreamMultiSelect
                            values={selected}
                            options={availableLocations.map((location) => ({
                              value: String(location.id),
                              label: location.name,
                            }))}
                            onValuesChange={field.onChange}
                            placeholder={availableLocations.length > 0 ? "Выберите площадки" : "Активных площадок пока нет"}
                            ariaLabel="Площадки проекта"
                            title="Площадки проекта"
                            searchable
                            disabled={availableLocations.length === 0}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Можно выбрать несколько площадок; дубли автоматически исключаются.</p>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
                <FormField
                  control={form.control}
                  name="createYougileBoard"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex items-start gap-2 rounded-control border border-border/50 bg-surface-subtle p-3 text-sm">
                        <Checkbox checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                        <span>
                          <span className="block font-medium">Создать доску в YouGile</span>
                          <span className="text-muted-foreground">Опционально. Оставьте выключенным для сотрудников без YouGile.</span>
                        </span>
                      </label>
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Создание..." : "Создать проект"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Фильтры и статистика */}
      <div className="flex flex-wrap items-center gap-2 rounded-surface border border-border/50 bg-surface-raised p-3 shadow-xs">
        <div className="relative min-w-[220px] flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Название или клиент"
            aria-label="Поиск проектов"
            className="bg-surface-base pl-9"
          />
        </div>
        <StreamMultiSelect
          values={statusFilter}
          onValuesChange={setStatusFilter}
          ariaLabel="Статусы проектов"
          placeholder="Все статусы"
          options={Object.entries(statusConfig).map(([value, config]) => ({ value, label: config.label }))}
          className="w-full sm:w-[170px]"
        />
        <StreamMultiSelect
          values={categoryFilter}
          onValuesChange={setCategoryFilter}
          ariaLabel="Категории проектов"
          placeholder="Все категории"
          options={categoryOptions}
          searchable
          className="w-full sm:w-[190px]"
        />
        <StreamMultiSelect
          values={assignedFilter}
          onValuesChange={setAssignedFilter}
          ariaLabel="Сотрудники проектов"
          placeholder="Все сотрудники"
          options={(users as any[]).map((user: any) => ({
            value: String(user.id),
            label: user.name || user.username || user.id,
          }))}
          searchable
          className="w-full sm:w-[200px]"
        />
        <span className="ml-auto text-xs text-muted-foreground">Найдено: {filteredProjects.length}</span>
      </div>

      {/* Проекты из YouGile — добавляются именно проекты; новые проекты из YouGile подтягиваются синхронизацией */}
      {yougileProjects.length > 0 && (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  Проекты из YouGile
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Проекты, созданные в YouGile. Добавьте в видеопроекты — привяжется первая доска. Новые проекты/доски из YouGile появятся после синхронизации.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={syncYougileMutation.isPending}
                onClick={() => syncYougileMutation.mutate()}
              >
                {syncYougileMutation.isPending ? "Синхронизация…" : "Синхронизировать"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {yougileProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-2 rounded-control border border-border/50 bg-surface-raised px-3 py-2 text-sm shadow-xs"
                >
                  <span className="font-medium truncate max-w-[180px]" title={project.title || project.id}>
                    {project.title || "Без названия"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    disabled={importYougileProjectMutation.isPending}
                    onClick={() => importYougileProjectMutation.mutate(project)}
                  >
                    {importYougileProjectMutation.isPending ? "…" : "В видеопроекты"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredProjects.length === 0 ? (
          <div className="col-span-full rounded-surface border border-dashed border-border/60 bg-surface-raised px-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Film className="h-5 w-5" />
            </div>
            <p className="font-medium text-foreground">Проекты не найдены</p>
            <p className="mt-1 text-sm text-muted-foreground">Измените фильтры или создайте первый проект.</p>
          </div>
        ) : (
          filteredProjects.map((project: any) => (
              <Card 
                key={project.id} 
                className="group border-border/50 bg-surface-raised shadow-xs transition-[border-color,box-shadow,background-color] duration-150 hover:border-border/80 hover:bg-surface-overlay hover:shadow-surface"
                data-testid={`project-card-${project.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary/10 text-primary">
                      <Film className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="line-clamp-2 text-lg">{project.name}</CardTitle>
                        <Badge className={cn("shrink-0 rounded-full border text-[11px]", getProjectStatus(project).color)}>
                          {getProjectStatus(project).label}
                        </Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {equipmentCountByProject[project.id] > 0 && (
                          <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-full text-[11px]">
                            <HardDrive className="h-3 w-3" />
                            {equipmentCountByProject[project.id]} ед.
                          </Badge>
                        )}
                        {(project.commentCount ?? 0) > 0 && (
                          <Badge variant="outline" className="inline-flex items-center gap-1 rounded-full border-border/40 text-[11px]">
                            <MessageSquare className="h-3 w-3" />
                            {project.commentCount}
                          </Badge>
                        )}
                        {project.yougileBoardId && (
                          <Badge variant="outline" className="inline-flex items-center gap-1 rounded-full border-border/40 text-[11px] text-muted-foreground">
                            <Link2 className="h-3 w-3" />
                            YouGile
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
                  )}
                  {(project.category || project.deadline || normalizeProjectResponsibleIds(project).length > 0 || project.latestCommentAt) && (
                    <div className="space-y-2 rounded-control border border-border/40 bg-surface-subtle p-3 text-sm">
                      {project.category && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Film className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-foreground/85">{getProjectCategoryLabel(project.category)}</span>
                        </div>
                      )}
                      {formatProjectDeadline(project.deadline) && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>{formatProjectDeadline(project.deadline)}</span>
                        </div>
                      )}
                      {normalizeProjectResponsibleIds(project).length > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate text-foreground/85">
                            {normalizeProjectResponsibleIds(project).slice(0, 3).map(getUserName).join(", ")}
                            {normalizeProjectResponsibleIds(project).length > 3 && ` +${normalizeProjectResponsibleIds(project).length - 3}`}
                          </span>
                        </div>
                      )}
                      {project.latestCommentAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                          Последняя активность: {formatDiscussionActivity(project.latestCommentAt)}
                        </div>
                      )}
                    </div>
                  )}
                  {Array.isArray(project.locations) && project.locations.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {project.locations.map((location: any) => (
                        <Button
                          key={location.id}
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 max-w-full rounded-full px-2 text-xs"
                        >
                          <a href={`/locations?locationId=${encodeURIComponent(location.id)}`}>
                            <MapPin className="mr-1 h-3 w-3 shrink-0" />
                            <span className="truncate">{location.name}</span>
                            {location.source === "cards" && <span className="ml-1 text-muted-foreground">из Kanban</span>}
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                  {Array.isArray(project.locationTopics) && project.locationTopics.length > 0 && (
                    <div className="rounded-control border border-warning/20 bg-warning-muted p-2.5">
                      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-warning">
                        <MessageSquare className="h-3.5 w-3.5" />
                        Активные темы площадок: {project.locationTopics.length}
                      </div>
                      <div className="space-y-1">
                        {project.locationTopics.slice(0, 3).map((topic: any) => (
                          <a
                            key={topic.id}
                            href={`/locations?locationId=${encodeURIComponent(topic.locationId)}&topicId=${encodeURIComponent(topic.id)}`}
                            className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            {topic.locationName}: {topic.title}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {normalizeParticipantIds(project.participants).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {normalizeParticipantIds(project.participants).slice(0, 4).map((userId) => (
                        <Badge key={userId} variant="secondary" className="rounded-full text-[11px]">
                          {getUserName(userId)}
                        </Badge>
                      ))}
                      {normalizeParticipantIds(project.participants).length > 4 && (
                        <Badge variant="outline" className="rounded-full text-[11px]">
                          +{normalizeParticipantIds(project.participants).length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 border-t border-border/40 pt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="mr-auto min-w-0"
                      title="Открыть доску проекта в Kanban V2"
                      disabled={openProjectKanbanBoardMutation.isPending}
                      onClick={() => openProjectKanbanBoardMutation.mutate(project.id)}
                    >
                      <ListTodo className="h-4 w-4 shrink-0" />
                      {openProjectKanbanBoardMutation.isPending && openProjectKanbanBoardMutation.variables === project.id
                        ? "Открытие..."
                        : "Открыть доску"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                      aria-label="Изменить проект"
                      title="Изменить проект"
                      onClick={() => setSelectedProject(project)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                      aria-label="Статистика проекта"
                      title="Статистика проекта"
                      onClick={() => setProjectForStats(project)}
                    >
                      <BarChart3 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="relative h-11 w-11 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                      aria-label="Обсуждение проекта"
                      title="Обсуждение проекта"
                      onClick={() => setProjectForDiscussion(project)}
                    >
                      <MessageSquare className="h-4 w-4" />
                      {(project.commentCount ?? 0) > 0 && (
                        <span className="absolute right-0 top-0 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
                      aria-label={project.yougileBoardId ? "Добавить колонку YouGile" : "Создать доску YouGile"}
                      title={project.yougileBoardId ? "Добавить колонку YouGile" : "Создать доску YouGile"}
                      disabled={project.yougileBoardId ? addColumnMutation.isPending : linkBoardMutation.isPending}
                      onClick={() => project.yougileBoardId
                        ? setProjectForAddColumn(project)
                        : linkBoardMutation.mutate(project.id)}
                    >
                      {project.yougileBoardId ? <Columns className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                    </Button>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-error hover:bg-error-muted hover:text-error sm:h-8 sm:w-8"
                      aria-label="Удалить проект"
                      title="Удалить проект"
                      onClick={async () => {
                        const confirmed = await confirmAction({
                          title: `Удалить проект «${project.name || "без названия"}»?`,
                          description: "Проект и его рабочие связи будут удалены. Это действие нельзя отменить.",
                          confirmLabel: "Удалить",
                          destructive: true,
                        });
                        if (confirmed) deleteMutation.mutate(project.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
        )}
      </div>

      {/* Редактирование проекта: название, описание, участник */}
      <Dialog
        open={!!selectedProject}
        onOpenChange={(open) => {
          if (!open) {
            if (projectEditorCloseRef.current) void projectEditorCloseRef.current();
            else setSelectedProject(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl bg-background text-foreground">
          <DialogHeader>
            <DialogTitle>Изменить проект</DialogTitle>
          </DialogHeader>
          {selectedProject && (
            <ProjectEditForm
              project={selectedProject}
              users={Array.isArray(users) ? users : []}
              locations={locations.filter((location) =>
                !selectedProject.companyId || String(location.companyId || "") === String(selectedProject.companyId),
              )}
              onClose={() => setSelectedProject(null)}
              closeHandlerRef={projectEditorCloseRef}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!projectForDiscussion} onOpenChange={(open) => !open && setProjectForDiscussion(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Обсуждение проекта
              {projectForDiscussion && (
                <span className="font-normal text-muted-foreground">— {projectForDiscussion.name}</span>
              )}
            </DialogTitle>
          </DialogHeader>
          {projectForDiscussion && (
            <DiscussionThread
              apiPath={`/api/projects/${projectForDiscussion.id}/comments`}
              channel={`project:${projectForDiscussion.id}:comments`}
              queryKey={["project-comments", projectForDiscussion.id]}
              emptyLabel="У проекта пока нет комментариев."
              onActivity={() => queryClient.invalidateQueries({ queryKey: ["/api/projects"] })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Статистика по задачам проекта */}
      <Dialog open={!!projectForStats} onOpenChange={(open) => !open && setProjectForStats(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Статистика
              {projectForStats && <span className="font-normal text-muted-foreground">— {projectForStats.name}</span>}
            </DialogTitle>
          </DialogHeader>
          {projectForStats && (
            <ProjectTaskStats
              projectId={projectForStats.id}
              companyId={projectForStats.companyId}
              onClose={() => setProjectForStats(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Добавить колонку на доску YouGile */}
      <Dialog open={!!projectForAddColumn} onOpenChange={(open) => !open && setProjectForAddColumn(null)}>
        <DialogContent className="max-w-sm bg-background text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Columns className="w-5 h-5" />
              Новая колонка
              {projectForAddColumn && <span className="font-normal text-muted-foreground">— {projectForAddColumn.name}</span>}
            </DialogTitle>
          </DialogHeader>
          {projectForAddColumn?.yougileBoardId && (
            <AddColumnForm
              boardId={projectForAddColumn.yougileBoardId}
              onSuccess={() => setProjectForAddColumn(null)}
              onCancel={() => setProjectForAddColumn(null)}
              isLoading={addColumnMutation.isPending}
              onSubmit={(title) => addColumnMutation.mutate({ boardId: projectForAddColumn.yougileBoardId, title })}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
