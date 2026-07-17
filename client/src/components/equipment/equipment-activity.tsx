import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Image as ImageIcon, Paperclip, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeSubscription } from "@/hooks/use-websocket";
import { apiRequest, apiUrl } from "@/lib/queryClient";
import { shouldRefetchDiscussion } from "@/lib/realtime";

type EquipmentActivityAttachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
};

export type EquipmentActivityComment = {
  id: string;
  equipmentId: string;
  userId: string;
  authorName: string;
  content: string;
  attachments?: EquipmentActivityAttachment[];
  createdAt?: string | Date | null;
  legacy?: boolean;
};

type EquipmentActivityProps = {
  equipmentId: string;
  canComment?: boolean;
  onActivity?: () => void;
};

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
].join(",");

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatActivityTime(value: EquipmentActivityComment["createdAt"]) {
  if (!value) return "Время неизвестно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Время неизвестно";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(value: number | null | undefined) {
  if (!value || value < 1) return "";
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
}

function isImageAttachment(attachment: EquipmentActivityAttachment) {
  return String(attachment.mimeType || "").startsWith("image/");
}

export function EquipmentActivity({
  equipmentId,
  canComment = true,
  onActivity,
}: EquipmentActivityProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [validationError, setValidationError] = useState("");
  const [subscriptionDenied, setSubscriptionDenied] = useState(false);
  const queryKey = ["equipment-comments", equipmentId] as const;
  const channel = `equipment:${equipmentId}:comments`;

  const commentsQuery = useQuery<EquipmentActivityComment[]>({
    queryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/equipment/${equipmentId}/comments`);
      return response.json();
    },
    enabled: Boolean(equipmentId),
  });

  const refreshActivity = () => {
    queryClient.invalidateQueries({ queryKey });
    onActivity?.();
  };

  const { isConnected } = useRealtimeSubscription(channel, (message) => {
    if (message.type === "subscription_denied") {
      setSubscriptionDenied(true);
      return;
    }
    if (shouldRefetchDiscussion(message, channel)) {
      setSubscriptionDenied(false);
      refreshActivity();
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("content", draft.trim());
      files.forEach((file) => formData.append("files", file));
      const response = await apiRequest(
        "POST",
        `/api/equipment/${equipmentId}/comments`,
        formData,
        true,
      );
      return response.json() as Promise<EquipmentActivityComment>;
    },
    onSuccess: (created) => {
      queryClient.setQueryData<EquipmentActivityComment[]>(queryKey, (current = []) => {
        if (current.some((comment) => comment.id === created.id)) return current;
        return [...current, created];
      });
      setDraft("");
      setFiles([]);
      setValidationError("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      onActivity?.();
    },
  });

  const selectFiles = (selected: FileList | null) => {
    const nextFiles = Array.from(selected || []);
    if (nextFiles.length > MAX_FILES) {
      setValidationError(`Можно приложить не более ${MAX_FILES} файлов.`);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const oversized = nextFiles.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) {
      setValidationError(`Файл «${oversized.name}» больше 10 МБ.`);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setValidationError("");
    setFiles(nextFiles);
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_file, fileIndex) => fileIndex !== index));
    setValidationError("");
  };

  const comments = commentsQuery.data ?? [];
  const queryError = commentsQuery.error as Error | null;
  const permissionDenied = Boolean(queryError && /доступ|компан/i.test(queryError.message));

  return (
    <div className="space-y-4">
      {!isConnected && (
        <div className="rounded-control border border-warning/30 bg-warning-muted px-3 py-2 text-xs text-warning">
          Realtime временно недоступен. История обновится после восстановления соединения.
        </div>
      )}
      {subscriptionDenied && (
        <div className="rounded-control border border-error/30 bg-error-muted px-3 py-2 text-xs text-error">
          Realtime-подписка недоступна для этого оборудования.
        </div>
      )}

      {commentsQuery.isLoading ? (
        <div className="rounded-control border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
          Загружаем историю...
        </div>
      ) : commentsQuery.isError ? (
        <div className="space-y-2 rounded-control border border-error/30 bg-error-muted p-3 text-sm">
          <p className="text-error">
            {permissionDenied ? "У вас нет доступа к активности этого оборудования." : "Не удалось загрузить активность оборудования."}
          </p>
          {!permissionDenied && (
            <Button variant="outline" size="sm" onClick={() => commentsQuery.refetch()}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Повторить
            </Button>
          )}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-control border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
          Комментариев и файлов пока нет.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-surface border border-border/50 bg-surface-raised px-3 py-3 shadow-xs"
            >
              <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">
                  {comment.authorName || "Сотрудник"}
                </span>
                <time>{formatActivityTime(comment.createdAt)}</time>
                {comment.legacy && <span>перенесено из старой истории</span>}
              </div>
              {comment.content && (
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                  {comment.content}
                </p>
              )}
              {Array.isArray(comment.attachments) && comment.attachments.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {comment.attachments.map((attachment) => {
                    const href = apiUrl(attachment.fileUrl);
                    if (isImageAttachment(attachment)) {
                      return (
                        <a
                          key={attachment.id}
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-control border border-border/50 bg-surface-subtle"
                        >
                          <img
                            src={href}
                            alt={attachment.fileName}
                            className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]"
                            loading="lazy"
                          />
                          <span className="flex items-center gap-2 px-2 py-2 text-xs text-muted-foreground">
                            <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                            <span>{formatFileSize(attachment.fileSize)}</span>
                          </span>
                        </a>
                      );
                    }
                    return (
                      <a
                        key={attachment.id}
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-w-0 items-center gap-2 rounded-control border border-border/50 bg-surface-subtle px-3 py-2 text-xs text-foreground hover:border-primary/40"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{attachment.fileName}</span>
                        <span className="shrink-0 text-muted-foreground">{formatFileSize(attachment.fileSize)}</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {canComment && !permissionDenied ? (
        <div className="space-y-3 border-t border-border/50 pt-4">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Добавьте комментарий о состоянии, дефекте или использовании"
            className="min-h-24 resize-y bg-surface-raised"
            maxLength={10_000}
            disabled={createMutation.isPending}
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            className="hidden"
            onChange={(event) => selectFiles(event.target.files)}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-center"
              onClick={() => fileInputRef.current?.click()}
              disabled={createMutation.isPending}
            >
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              Добавить фото или файл
            </Button>
            <span className="text-xs text-muted-foreground">
              До 5 файлов по 10 МБ: JPG, PNG, WebP, PDF, DOCX, XLSX, TXT
            </span>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {files.map((file, index) => (
                <span
                  key={`${file.name}-${file.lastModified}-${index}`}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/40 bg-surface-subtle px-2.5 py-1 text-xs text-foreground"
                >
                  <span className="max-w-56 truncate">{file.name}</span>
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-surface-overlay"
                    aria-label={`Убрать файл ${file.name}`}
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {(validationError || createMutation.isError) && (
            <p className="text-xs text-destructive">
              {validationError || (createMutation.error as Error)?.message || "Не удалось добавить комментарий."}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={
                createMutation.isPending ||
                Boolean(validationError) ||
                (!draft.trim() && files.length === 0)
              }
            >
              {createMutation.isPending ? "Добавление..." : createMutation.isError ? "Повторить" : "Добавить в историю"}
            </Button>
          </div>
        </div>
      ) : !commentsQuery.isLoading && !permissionDenied ? (
        <div className="rounded-control border border-border/50 bg-surface-subtle px-3 py-2 text-xs text-muted-foreground">
          У вас нет права добавлять записи в историю оборудования.
        </div>
      ) : null}
    </div>
  );
}
