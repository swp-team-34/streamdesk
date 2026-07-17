import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MessageSquareReply, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDialog } from "@/components/ui/app-dialog-provider";
import { Textarea } from "@/components/ui/textarea";
import { useRealtimeSubscription } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { shouldRefetchDiscussion } from "@/lib/realtime";

export type DiscussionComment = {
  id: string;
  userId: string;
  parentCommentId?: string | null;
  authorName: string;
  content: string;
  isDeleted?: boolean;
  canDelete?: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

type DiscussionThreadProps = {
  apiPath: string;
  channel: string;
  queryKey: QueryKey;
  canComment?: boolean;
  emptyLabel?: string;
  onActivity?: () => void;
};

function formatCommentTime(value: DiscussionComment["createdAt"]) {
  if (!value) return "Время неизвестно";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Время неизвестно";
  return format(date, "d MMM yyyy, HH:mm", { locale: ru });
}

export function DiscussionThread({
  apiPath,
  channel,
  queryKey,
  canComment = true,
  emptyLabel = "Комментариев пока нет.",
  onActivity,
}: DiscussionThreadProps) {
  const queryClient = useQueryClient();
  const { confirm: confirmAction } = useAppDialog();
  const [draft, setDraft] = useState("");
  const [replyRootId, setReplyRootId] = useState<string | null>(null);
  const [subscriptionDenied, setSubscriptionDenied] = useState(false);

  const commentsQuery = useQuery<DiscussionComment[]>({
    queryKey,
    queryFn: async () => {
      const response = await apiRequest("GET", apiPath);
      return response.json();
    },
  });

  const refreshDiscussion = () => {
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
      refreshDiscussion();
    }
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", apiPath, {
        content: draft.trim(),
        parentCommentId: replyRootId,
      });
      return response.json();
    },
    onSuccess: () => {
      setDraft("");
      setReplyRootId(null);
      refreshDiscussion();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `${apiPath}/${commentId}`);
      return commentId;
    },
    onSuccess: refreshDiscussion,
  });

  const comments = commentsQuery.data ?? [];
  const roots = useMemo(
    () => comments.filter((comment) => !comment.parentCommentId),
    [comments],
  );
  const repliesByRoot = useMemo(() => {
    const result = new Map<string, DiscussionComment[]>();
    comments.forEach((comment) => {
      if (!comment.parentCommentId) return;
      const replies = result.get(comment.parentCommentId) ?? [];
      replies.push(comment);
      result.set(comment.parentCommentId, replies);
    });
    return result;
  }, [comments]);
  const replyRoot = replyRootId
    ? comments.find((comment) => comment.id === replyRootId)
    : null;

  const renderComment = (comment: DiscussionComment, isReply = false) => (
    <article
      key={comment.id}
      className={[
        "rounded-xl border border-border/40 bg-background/70 p-3",
        isReply ? "ml-3 border-l-2 border-l-primary/40 sm:ml-8" : "",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-medium">{comment.authorName || "Удалённый пользователь"}</div>
          <time className="text-xs text-muted-foreground">{formatCommentTime(comment.createdAt)}</time>
        </div>
        <div className="flex items-center gap-1">
          {!isReply && !comment.isDeleted && canComment && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 px-2"
              onClick={() => {
                setReplyRootId(comment.id);
                setDraft("");
              }}
            >
              <MessageSquareReply className="h-3.5 w-3.5" />
              Ответить
            </Button>
          )}
          {comment.canDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive"
              aria-label="Удалить комментарий"
              onClick={async () => {
                const confirmed = await confirmAction({
                  title: "Удалить комментарий?",
                  description: "Комментарий будет удалён из этой ветки обсуждения.",
                  confirmLabel: "Удалить",
                  destructive: true,
                });
                if (confirmed) deleteMutation.mutate(comment.id);
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
        {comment.isDeleted ? (
          <span className="italic text-muted-foreground">Комментарий удалён</span>
        ) : comment.content}
      </p>
    </article>
  );

  return (
    <div className="space-y-4">
      {!isConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          Realtime временно недоступен. Отправка продолжит работать через HTTP, после подключения данные обновятся.
        </div>
      )}
      {subscriptionDenied && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Realtime-подписка недоступна для этого обсуждения. Проверьте права доступа.
        </div>
      )}

      {commentsQuery.isLoading ? (
        <div className="rounded-xl border border-dashed border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Загружаем обсуждение...
        </div>
      ) : commentsQuery.isError ? (
        <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="text-destructive">Не удалось загрузить обсуждение.</p>
          <Button variant="outline" size="sm" onClick={() => commentsQuery.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Повторить
          </Button>
        </div>
      ) : roots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {roots.map((root) => (
            <div key={root.id} className="space-y-2">
              {renderComment(root)}
              {(repliesByRoot.get(root.id) ?? []).map((reply) => renderComment(reply, true))}
            </div>
          ))}
        </div>
      )}

      {canComment ? (
        <div className="space-y-2 border-t border-border/40 pt-4">
          {replyRoot && (
            <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 px-3 py-2 text-xs">
              <span className="truncate">
                Ответ для {replyRoot.authorName}: {replyRoot.content || "Комментарий удалён"}
              </span>
              <Button variant="ghost" size="sm" className="h-7" onClick={() => setReplyRootId(null)}>
                Отмена
              </Button>
            </div>
          )}
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={replyRootId ? "Напишите ответ" : "Добавьте комментарий"}
            rows={3}
            disabled={createMutation.isPending}
          />
          {createMutation.isError && (
            <p className="text-xs text-destructive">
              {(createMutation.error as Error)?.message || "Не удалось отправить комментарий. Попробуйте ещё раз."}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!draft.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Отправляем..." : createMutation.isError ? "Повторить отправку" : replyRootId ? "Ответить" : "Добавить комментарий"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          У вас нет права добавлять комментарии в это обсуждение.
        </div>
      )}
    </div>
  );
}
