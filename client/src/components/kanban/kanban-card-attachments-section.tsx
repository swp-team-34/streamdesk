import { Download, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { KanbanCardAttachmentView } from "@/lib/kanban-board-model";
import { formatFileSize } from "@/lib/kanban-presentation";
import { formatDueDateLabel } from "@/lib/task-dates";
import { KANBAN_PANEL_INPUT_CLASS } from "./kanban-styles";

interface KanbanCardAttachmentsSectionProps {
  attachments: KanbanCardAttachmentView[];
  loading: boolean;
  canEdit: boolean;
  uploadPending: boolean;
  deletePending: boolean;
  getUserName: (userId: string) => string;
  onUpload: (file: File) => void;
  onDelete: (attachmentId: string) => void;
  confirmDelete: (message: string) => Promise<boolean>;
}

export function KanbanCardAttachmentsSection({
  attachments,
  loading,
  canEdit,
  uploadPending,
  deletePending,
  getUserName,
  onUpload,
  onDelete,
  confirmDelete,
}: KanbanCardAttachmentsSectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Вложения</h3>
        {loading && (
          <span className="text-xs text-muted-foreground">Загружаем файлы...</span>
        )}
      </div>

      <div className="space-y-3">
        {attachments.length === 0 ? (
          <div className="rounded-surface border border-dashed border-border/50 bg-surface-subtle px-4 py-6 text-sm text-muted-foreground">
            У этой карточки пока нет вложений.
          </div>
        ) : (
          attachments.map((attachment) => (
            <div key={attachment.id} className="rounded-surface border border-border/50 bg-surface-subtle p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {attachment.fileName}
                    </a>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="rounded-full border border-border/40 bg-surface-overlay px-2 py-1">
                      {formatFileSize(attachment.fileSize)} · {attachment.mimeType || "unknown"} ·{" "}
                      {formatDueDateLabel(attachment.createdAt) || "Неизвестное время"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Загрузил: {getUserName(attachment.uploadedByUserId)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <a
                      href={attachment.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Скачать ${attachment.fileName}`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!await confirmDelete(`Удалить вложение "${attachment.fileName}"?`)) return;
                        onDelete(attachment.id);
                      }}
                      disabled={deletePending}
                    >
                      Удалить
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {canEdit && (
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="kanban-detail-attachment">
            Загрузить файл
          </label>
          <Input
            id="kanban-detail-attachment"
            type="file"
            disabled={uploadPending}
            className={KANBAN_PANEL_INPUT_CLASS}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onUpload(file);
              event.currentTarget.value = "";
            }}
          />
          <p className="text-xs text-muted-foreground">
            Поддерживаются любые типы файлов до 25 МБ.
          </p>
        </div>
      )}
    </div>
  );
}
