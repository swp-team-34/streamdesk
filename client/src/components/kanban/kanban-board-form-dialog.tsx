import { Building2, UserRound, Users } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  KANBAN_PANEL_INPUT_CLASS,
  KANBAN_PANEL_SELECT_CLASS,
  KANBAN_PANEL_TEXTAREA_CLASS,
} from "./kanban-styles";

export type BoardVisibility = "personal" | "company" | "members";

export interface KanbanBoardFormState {
  companyId: string;
  name: string;
  description: string;
  visibility: BoardVisibility;
}

interface CompanyOption {
  id: string;
  name: string;
}

interface KanbanBoardFormDialogProps {
  open: boolean;
  editingBoardId?: string | null;
  form: KanbanBoardFormState;
  companies: CompanyOption[];
  companiesLoading: boolean;
  workspaceType?: string | null;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (form: KanbanBoardFormState) => void;
  onCancel: () => void;
  onSave: () => void;
}

const BOARD_VISIBILITY_META: Record<
  BoardVisibility,
  { label: string; hint: string; icon: typeof UserRound }
> = {
  personal: {
    label: "Личная",
    hint: "Только для тебя, без компании",
    icon: UserRound,
  },
  company: {
    label: "Командная",
    hint: "Доступна всей компании",
    icon: Building2,
  },
  members: {
    label: "По приглашению",
    hint: "Видят только участники доски",
    icon: Users,
  },
};

export function KanbanBoardFormDialog({
  open,
  editingBoardId,
  form,
  companies,
  companiesLoading,
  workspaceType,
  pending,
  onOpenChange,
  onChange,
  onCancel,
  onSave,
}: KanbanBoardFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/50 bg-card text-card-foreground">
        <DialogHeader>
          <DialogTitle>{editingBoardId ? "Изменить доску" : "Создать доску"}</DialogTitle>
          <DialogDescription>
            Новая доска будет создана в текущем рабочем пространстве.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(BOARD_VISIBILITY_META) as BoardVisibility[]).map((value) => {
              const meta = BOARD_VISIBILITY_META[value];
              const Icon = meta.icon;
              const selected = form.visibility === value;
              const disabled = workspaceType === "personal"
                ? value !== "personal"
                : value === "personal" || (
                  (value === "company" || value === "members") && companies.length === 0
                );
              return (
                <button
                  key={value}
                  type="button"
                  disabled={disabled || pending}
                  onClick={() => onChange({
                    ...form,
                    visibility: value,
                    companyId: value === "personal" ? "" : form.companyId || companies[0]?.id || "",
                  })}
                  className={[
                    "rounded-2xl border p-3 text-left transition",
                    selected
                      ? "border-primary/60 bg-primary/10 text-foreground"
                      : "border-border/40 bg-background hover:bg-accent/60",
                    disabled ? "cursor-not-allowed opacity-50" : "",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Icon className="h-4 w-4" />
                    {meta.label}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{meta.hint}</p>
                </button>
              );
            })}
          </div>

          {form.visibility !== "personal" && (
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="kanban-board-dialog-company">
                Компания
              </label>
              <select
                id="kanban-board-dialog-company"
                className={KANBAN_PANEL_SELECT_CLASS}
                value={form.companyId}
                onChange={(event) => onChange({ ...form, companyId: event.target.value })}
                disabled={Boolean(editingBoardId) || companiesLoading || pending}
              >
                {companies.length === 0 && <option value="">Нет доступных компаний</option>}
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="kanban-board-dialog-name">
              Название доски
            </label>
            <Input
              id="kanban-board-dialog-name"
              value={form.name}
              onChange={(event) => onChange({ ...form, name: event.target.value })}
              placeholder="Например: Personal Focus или Product Sprint"
              disabled={pending}
              className={KANBAN_PANEL_INPUT_CLASS}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="kanban-board-dialog-description">
              Описание
            </label>
            <Textarea
              id="kanban-board-dialog-description"
              value={form.description}
              onChange={(event) => onChange({ ...form, description: event.target.value })}
              placeholder="Что будет жить на этой доске и зачем она тебе или команде"
              rows={4}
              disabled={pending}
              className={KANBAN_PANEL_TEXTAREA_CLASS}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Отмена
          </Button>
          <Button
            onClick={onSave}
            disabled={
              !form.name.trim() ||
              (form.visibility !== "personal" && !form.companyId) ||
              pending
            }
          >
            {editingBoardId ? "Сохранить доску" : "Создать доску"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
