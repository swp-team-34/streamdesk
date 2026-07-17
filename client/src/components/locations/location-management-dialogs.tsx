import { AlertTriangle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import type { ArchivePreview, Location, LocationForm } from "@/lib/location-model";
import {
  RECORDING_PLACE_STATUSES,
  RECORDING_PLACE_STATUS_LABELS,
  type RecordingPlaceStatus,
} from "@/lib/recording-place-status";

interface CompanyOption {
  id: string;
  name: string;
}

interface LocationFormDialogProps {
  open: boolean;
  editing: boolean;
  companies: CompanyOption[];
  form: LocationForm;
  primaryCompanyId: string;
  pending: boolean;
  onClose: () => void;
  onChange: (form: LocationForm) => void;
  onSave: () => void;
}

export function LocationFormDialog({
  open,
  editing,
  companies,
  form,
  primaryCompanyId,
  pending,
  onClose,
  onChange,
  onSave,
}: LocationFormDialogProps) {
  const update = <Key extends keyof LocationForm>(key: Key, value: LocationForm[Key]) => {
    onChange({ ...form, [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Редактировать площадку" : "Новая площадка"}</DialogTitle>
          <DialogDescription>
            Метаданные, адрес, рабочие заметки и операционный статус площадки.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {!editing && companies.length > 1 && (
            <Label>
              Компания
              <Select value={form.companyId} onValueChange={(value) => update("companyId", value)}>
                <SelectTrigger><SelectValue placeholder="Выберите компанию" /></SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Label>
          )}
          <Label>
            Название
            <Input value={form.name} onChange={(event) => update("name", event.target.value)} />
          </Label>
          <Label>
            Тип
            <Input
              value={form.type}
              onChange={(event) => update("type", event.target.value)}
              placeholder="Студия, форум, выездная площадка"
            />
          </Label>
          <Label>
            Адрес или контекст
            <Textarea
              value={form.address}
              onChange={(event) => update("address", event.target.value)}
              placeholder="Адрес, корпус, зал, особенности доступа"
            />
          </Label>
          <Label>
            Описание
            <Textarea value={form.description} onChange={(event) => update("description", event.target.value)} />
          </Label>
          <Label>
            Рабочие заметки
            <Textarea
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              className="min-h-28"
              placeholder="Технические особенности, контакты, ограничения и инструкции"
            />
          </Label>
          <Label>
            Статус
            <Select
              value={form.status}
              onValueChange={(value) => update("status", value as RecordingPlaceStatus)}
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
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            onClick={onSave}
            disabled={!form.name.trim() || (!editing && !form.companyId && !primaryCompanyId) || pending}
          >
            {pending ? "Сохранение..." : editing ? "Сохранить" : "Создать"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface LocationArchiveDialogProps {
  target: Location | null;
  preview: ArchivePreview | null;
  previewPending: boolean;
  archivePending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LocationArchiveDialog({
  target,
  preview,
  previewPending,
  archivePending,
  onClose,
  onConfirm,
}: LocationArchiveDialogProps) {
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Архивировать площадку?</DialogTitle>
          <DialogDescription>
            Площадка исчезнет из новых выборов, но история, проблемы и существующие связи сохранятся.
          </DialogDescription>
        </DialogHeader>
        {target && (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 font-medium">{target.name}</div>
            {previewPending || !preview ? (
              <div className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Проверяем активные связи...
              </div>
            ) : preview.activeLinks.total > 0 ? (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                <div className="mb-2 flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  У площадки есть активные связи
                </div>
                <ul className="list-inside list-disc text-muted-foreground">
                  <li>Активные карточки Kanban V2: {preview.activeLinks.activeKanbanCards}</li>
                  <li>Активные проекты: {preview.activeLinks.activeProjects}</li>
                  <li>Нерешённые проблемы: {preview.activeLinks.unresolvedDiscussions}</li>
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Активных проектов, карточек и нерешённых проблем нет.</p>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            variant="destructive"
            disabled={!target || !preview || archivePending}
            onClick={onConfirm}
          >
            {archivePending ? "Архивирование..." : "Подтвердить архивирование"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
