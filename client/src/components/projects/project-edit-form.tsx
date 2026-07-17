import { useEffect, useState, type FormEvent, type MutableRefObject } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StreamMultiSelect } from "@/components/ui/stream-multi-select";
import { Textarea } from "@/components/ui/textarea";
import { useDebouncedAutosave } from "@/hooks/use-debounced-autosave";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

export function normalizeProjectParticipantIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item || "").trim()).filter(Boolean)));
}

export function toggleProjectSelection(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

interface ProjectEditorUser {
  id: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
}

interface ProjectEditorLocation {
  id: string;
  name: string;
  archivedAt?: string | Date | null;
}

interface ProjectEditorValue {
  id: string;
  name?: string | null;
  description?: string | null;
  assignedTo?: string | null;
  participants?: unknown;
  showInTaskManager?: boolean | null;
  directLocationIds?: unknown;
}

interface ProjectEditFormProps {
  project: ProjectEditorValue;
  users?: ProjectEditorUser[];
  locations?: ProjectEditorLocation[];
  onClose: () => void;
  closeHandlerRef: MutableRefObject<(() => Promise<void>) | null>;
}

export function ProjectEditForm({
  project,
  users = [],
  locations = [],
  onClose,
  closeHandlerRef,
}: ProjectEditFormProps) {
  const safeUsers = Array.isArray(users) ? users : [];
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [assignedTo, setAssignedTo] = useState(project?.assignedTo ?? "");
  const [participants, setParticipants] = useState<string[]>(normalizeProjectParticipantIds(project?.participants));
  const [showInTaskManager, setShowInTaskManager] = useState(Boolean(project?.showInTaskManager));
  const [locationIds, setLocationIds] = useState<string[]>(normalizeProjectParticipantIds(project?.directLocationIds));
  const { toast } = useToast();

  useEffect(() => {
    if (!project) return;
    setName(project.name ?? "");
    setDescription(project.description ?? "");
    setAssignedTo(project.assignedTo ?? "");
    setParticipants(normalizeProjectParticipantIds(project.participants));
    setShowInTaskManager(Boolean(project.showInTaskManager));
    setLocationIds(normalizeProjectParticipantIds(project.directLocationIds));
  }, [
    project?.id,
    project?.name,
    project?.description,
    project?.assignedTo,
    project?.participants,
    project?.showInTaskManager,
    project?.directLocationIds,
  ]);

  const projectAutosave = useDebouncedAutosave({
    enabled: Boolean(project?.id),
    resetKey: String(project?.id || ""),
    source: `project:${project?.id || "closed"}`,
    value: {
      name,
      description,
      assignedTo,
      participants: [...participants].sort(),
      showInTaskManager,
      locationIds: [...locationIds].sort(),
    },
    validate: (snapshot) => snapshot.name.trim()
      ? {
          ok: true as const,
          payload: {
            name: snapshot.name.trim(),
            description: snapshot.description.trim(),
            assignedTo: snapshot.assignedTo || null,
            participants: snapshot.participants,
            showInTaskManager: snapshot.showInTaskManager,
            locationIds: snapshot.locationIds,
          },
        }
      : { ok: false as const, error: "Введите название проекта" },
    save: async (payload) => {
      await apiRequest("PUT", `/api/projects/${project.id}`, payload);
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    },
  });

  const requestClose = async () => {
    const saved = await projectAutosave.flush();
    if (!saved) {
      toast({
        title: "Изменения не сохранены",
        description: projectAutosave.error || "Исправьте данные проекта или повторите сохранение.",
        variant: "destructive",
      });
      return;
    }
    onClose();
  };

  useEffect(() => {
    closeHandlerRef.current = requestClose;
    return () => {
      if (closeHandlerRef.current === requestClose) closeHandlerRef.current = null;
    };
  }, [closeHandlerRef, requestClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await projectAutosave.flush();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium">Название *</label>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название проекта" />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Описание</label>
        <Textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Описание проекта"
          rows={3}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium">Участник</label>
        <Select value={assignedTo || "_none"} onValueChange={(value) => setAssignedTo(value === "_none" ? "" : value)}>
          <SelectTrigger className="bg-background text-foreground">
            <SelectValue placeholder="Выберите участника" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_none">Не назначен</SelectItem>
            {safeUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.name ?? user.username ?? user.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Участники проекта</label>
        <StreamMultiSelect
          values={participants}
          options={safeUsers.map((user) => ({
            value: user.id,
            label: user.name ?? user.username ?? user.id,
            description: user.email ?? undefined,
          }))}
          onValuesChange={setParticipants}
          placeholder={safeUsers.length > 0 ? "Выберите участников" : "Пользователей пока нет"}
          ariaLabel="Участники проекта"
          title="Участники проекта"
          searchable
          disabled={safeUsers.length === 0}
        />
      </div>
      <label className="flex items-start gap-2 rounded-control border border-border/50 bg-surface-subtle p-3 text-sm">
        <Checkbox checked={showInTaskManager} onCheckedChange={(checked) => setShowInTaskManager(Boolean(checked))} />
        <span>
          <span className="block font-medium">Показывать в таск-менеджере</span>
          <span className="text-muted-foreground">Локальная доска StreamDesk, без обязательной доски YouGile.</span>
        </span>
      </label>
      <div className="space-y-2">
        <label className="block text-sm font-medium">Площадки проекта</label>
        <StreamMultiSelect
          values={locationIds}
          options={locations
            .filter((location) => !location.archivedAt || locationIds.includes(location.id))
            .map((location) => ({
              value: location.id,
              label: location.name,
              description: location.archivedAt ? "Архив" : undefined,
            }))}
          onValuesChange={setLocationIds}
          placeholder={locations.length > 0 ? "Выберите площадки" : "Активных площадок пока нет"}
          ariaLabel="Площадки проекта"
          title="Площадки проекта"
          searchable
          disabled={locations.length === 0}
        />
        <p className="text-xs text-muted-foreground">Площадки карточек Kanban добавляются в сводку проекта автоматически.</p>
      </div>
      <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className={cn(
            "text-sm",
            projectAutosave.status === "error" || (projectAutosave.status === "dirty" && projectAutosave.error)
              ? "text-destructive"
              : "text-muted-foreground",
          )}
          role="status"
        >
          {projectAutosave.status === "saving"
            ? "Сохранение изменений..."
            : projectAutosave.status === "dirty"
              ? projectAutosave.error || "Изменения будут сохранены автоматически"
              : projectAutosave.status === "error"
                ? projectAutosave.error || "Не удалось сохранить изменения"
                : "Все изменения сохранены"}
        </div>
        <Button type="button" variant="outline" onClick={() => void requestClose()}>
          Закрыть
        </Button>
      </div>
    </form>
  );
}
