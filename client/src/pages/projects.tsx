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
import { 
  Plus, HardDrive, Calendar,
  User, Edit, Trash2, Film, Clock, CheckCircle2,
  Columns, GripVertical, X, Settings2, MessageSquare, Link2, Github, ExternalLink,
  ArrowUp, ArrowDown, ListTodo, BarChart3, FileSpreadsheet as FileExcelIcon, MapPin
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DiscussionThread } from "@/components/discussion-thread";
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
  assignedTo: z.string().optional(),
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
  planning: { label: "Планирование", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", progress: 10 },
  filming: { label: "Съёмка", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", progress: 30 },
  editing: { label: "Монтаж", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", progress: 50 },
  review: { label: "На проверке", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", progress: 80 },
  completed: { label: "Завершён", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", progress: 100 },
  archived: { label: "В архиве", color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", progress: 100 },
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

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export default function Projects() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const projectEditorCloseRef = useRef<(() => Promise<void>) | null>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

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
      assignedTo: "",
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
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.client?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchesAssigned = assignedFilter === "all" || item.assignedTo === assignedFilter || participantIds.includes(assignedFilter);
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
      getUserName(p.assignedTo),
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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mt-1">Управление файлами и устройствами для монтажа</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportProjectsToExcel} disabled={filteredProjects.length === 0} title="Выгрузить текущий список в Excel">
            <FileExcelIcon className="w-4 h-4 mr-1.5" />
            В Excel
          </Button>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button className="dark:neon-glow-purple" data-testid="button-add-project">
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
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Участник</FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите участника" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Не назначен</SelectItem>
                          {(users as any[]).map((user: any) => (
                            <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                          <div className="max-h-48 overflow-y-auto rounded-lg border bg-background p-2 space-y-2">
                            {(users as any[]).length === 0 ? (
                              <p className="text-sm text-muted-foreground px-2 py-1">Пользователей пока нет</p>
                            ) : (
                              (users as any[]).map((user: any) => (
                                <label key={user.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                                  <Checkbox
                                    checked={selected.includes(user.id)}
                                    onCheckedChange={() => field.onChange(toggleId(selected, user.id))}
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate">{user.name || user.username || user.id}</span>
                                    {user.email && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
                                  </span>
                                </label>
                              ))
                            )}
                          </div>
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
                      <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
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
                          <div className="max-h-44 overflow-y-auto rounded-lg border bg-background p-2 space-y-2">
                            {availableLocations.length === 0 ? (
                              <p className="text-sm text-muted-foreground px-2 py-1">Активных площадок пока нет</p>
                            ) : (
                              availableLocations.map((location) => (
                                <label key={location.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/60">
                                  <Checkbox
                                    checked={selected.includes(location.id)}
                                    onCheckedChange={() => field.onChange(toggleId(selected, location.id))}
                                  />
                                  <MapPin className="h-4 w-4 text-muted-foreground" />
                                  <span className="truncate">{location.name}</span>
                                </label>
                              ))
                            )}
                          </div>
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
                      <label className="flex items-start gap-2 rounded-lg border bg-muted/20 p-3 text-sm">
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
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] bg-background">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Категория" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categoryOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-[180px] bg-background">
            <SelectValue placeholder="Сотрудник" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все сотрудники</SelectItem>
            {(users as any[]).map((u: any) => (
              <SelectItem key={u.id} value={u.id}>{u.name || u.username || u.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">Найдено: {filteredProjects.length}</span>
      </div>

      {/* Проекты из YouGile — добавляются именно проекты; новые проекты из YouGile подтягиваются синхронизацией */}
      {yougileProjects.length > 0 && (
        <Card className="border-dashed border-primary/40 bg-muted/20">
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
                  className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"
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
          <div className="col-span-full text-center py-12">
            <Film className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Проекты не найдены</p>
            <p className="text-sm text-muted-foreground mt-1">Создайте первый видеопроект</p>
          </div>
        ) : (
          filteredProjects.map((project: any) => (
              <Card 
                key={project.id} 
                className="dark:border-border/50 dark:hover:border-primary/50 transition-all hover:shadow-lg"
                data-testid={`project-card-${project.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center shrink-0">
                      <Film className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                      {equipmentCountByProject[project.id] > 0 && (
                        <div className="mt-2">
                          <Badge variant="secondary" className="inline-flex items-center gap-1">
                            <HardDrive className="h-3.5 w-3.5" />
                            Связано оборудования: {equipmentCountByProject[project.id]}
                          </Badge>
                        </div>
                      )}
                      {(project.commentCount ?? 0) > 0 && (
                        <div className="mt-2 space-y-1">
                          <Badge variant="outline" className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {project.commentCount} в обсуждении
                          </Badge>
                          {project.latestCommentAt && (
                            <div className="text-xs text-muted-foreground">
                              Последняя активность: {formatDiscussionActivity(project.latestCommentAt)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">{project.description}</p>
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
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5">
                      <div className="mb-1.5 flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-200">
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
                  {project.assignedTo && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span>{getUserName(project.assignedTo)}</span>
                    </div>
                  )}
                  {normalizeParticipantIds(project.participants).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {normalizeParticipantIds(project.participants).slice(0, 4).map((userId) => (
                        <Badge key={userId} variant="secondary" className="text-[11px]">
                          {getUserName(userId)}
                        </Badge>
                      ))}
                      {normalizeParticipantIds(project.participants).length > 4 && (
                        <Badge variant="outline" className="text-[11px]">
                          +{normalizeParticipantIds(project.participants).length - 4}
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="shrink-0 min-w-[7rem]"
                      onClick={() => setSelectedProject(project)}
                    >
                      <Edit className="w-4 h-4 mr-1 shrink-0" />
                      Изменить
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="shrink-0 min-w-[7rem]"
                      title="Статистика по задачам"
                      onClick={() => setProjectForStats(project)}
                    >
                      <BarChart3 className="w-4 h-4 mr-1 shrink-0" />
                      Статистика
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 min-w-[5rem]"
                      title="Открыть доску проекта в Task Manager"
                      disabled={openProjectKanbanBoardMutation.isPending}
                      onClick={() => openProjectKanbanBoardMutation.mutate(project.id)}
                    >
                      <ListTodo className="w-4 h-4 mr-1 shrink-0" />
                      {openProjectKanbanBoardMutation.isPending && openProjectKanbanBoardMutation.variables === project.id
                        ? "Открытие..."
                        : "Таск"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 min-w-[7rem]"
                      title="Открыть обсуждение проекта"
                      onClick={() => setProjectForDiscussion(project)}
                    >
                      <MessageSquare className="w-4 h-4 mr-1 shrink-0" />
                      Обсуждение{(project.commentCount ?? 0) > 0 ? ` · ${project.commentCount}` : ""}
                    </Button>
                    {project.yougileBoardId ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0 min-w-[7rem]"
                          title="Добавить колонку на доску YouGile"
                          disabled={addColumnMutation.isPending}
                          onClick={() => setProjectForAddColumn(project)}
                        >
                          <Columns className="w-4 h-4 mr-1 shrink-0" />
                          Колонка
                        </Button>
                        <Badge variant="outline" className="h-8 px-2 inline-flex items-center gap-1">
                          <Link2 className="w-3.5 h-3.5" />
                          YouGile
                        </Badge>
                      </>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="shrink-0 min-w-[7rem]"
                        title="Создать и привязать доску YouGile"
                        disabled={linkBoardMutation.isPending}
                        onClick={() => linkBoardMutation.mutate(project.id)}
                      >
                        {linkBoardMutation.isPending ? (
                          <span className="inline-flex items-center gap-1"><span className="animate-pulse">…</span>YouGile</span>
                        ) : (
                          <><Link2 className="w-4 h-4 mr-1 shrink-0" />YouGile</>
                        )}
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="shrink-0 min-w-[2.5rem] text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        if (confirm(`Точно удалить проект "${project.name || "без названия"}"?`)) {
                          deleteMutation.mutate(project.id);
                        }
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
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
