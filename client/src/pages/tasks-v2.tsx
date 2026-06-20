import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowDown, ArrowLeft, ArrowUp, Download, GripVertical, Paperclip, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type BoardVisibility = "company" | "members";
type KanbanListType = "active" | "closed" | "archive" | "trash";
type KanbanCardPriority = "low" | "medium" | "high" | "urgent";

interface CompanySummary {
  id: string;
  name: string;
}

interface CompanyMembershipSummary {
  id: string;
  role: string;
  status: string;
}

interface CompanyMemberSummary {
  id: string;
  companyId: string;
  userId: string;
  role: string;
  status: string;
}

interface CompanyWorkspaceItem {
  company: CompanySummary;
  membership: CompanyMembershipSummary;
  members: CompanyMemberSummary[];
}

interface CompaniesResponse {
  companies: CompanyWorkspaceItem[];
}

interface UserSummary {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  active?: boolean | null;
}

interface KanbanBoardView {
  id: string;
  companyId: string;
  projectId?: string | null;
  name: string;
  description?: string | null;
  visibility: BoardVisibility;
  createdByUserId: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
  canManage?: boolean;
  canEdit?: boolean;
  canComment?: boolean;
  isMember?: boolean;
  membershipRole?: string | null;
}

interface KanbanBoardMemberView {
  id: string;
  boardId: string;
  userId: string;
  role: "viewer" | "editor";
  canComment?: boolean | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

interface MemberFormState {
  userId: string;
  role: "viewer" | "editor";
  canComment: boolean;
}

interface KanbanListView {
  id: string;
  boardId: string;
  type: KanbanListType;
  position: number;
  name: string;
  color?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

interface KanbanCardView {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  description?: string | null;
  position: number;
  priority: KanbanCardPriority;
  dueDate?: string | Date | null;
  labelIds?: string[];
  subtasks?: KanbanSubtask[];
  creatorUserId: string;
  assigneeUserId?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

interface KanbanSubtask {
  id: string;
  title: string;
  completed?: boolean;
}

interface KanbanLabelView {
  id: string;
  boardId: string;
  name: string;
  color?: string | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

interface KanbanCardHistoryView {
  id: string;
  cardId: string;
  userId: string;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt?: string | Date | null;
}

interface KanbanCardCommentView {
  id: string;
  cardId: string;
  userId: string;
  content: string;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

interface KanbanCardAttachmentView {
  id: string;
  cardId: string;
  uploadedByUserId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  fileSize?: number | null;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
}

const EMPTY_BOARD_FORM = {
  companyId: "",
  name: "",
  description: "",
  visibility: "company" as BoardVisibility,
};

const EMPTY_LIST_FORM = {
  name: "",
  color: "",
  type: "active" as KanbanListType,
};

const EMPTY_CARD_FORM = {
  listId: "",
  title: "",
  description: "",
  priority: "medium" as KanbanCardPriority,
  dueDate: "",
  assigneeUserId: "",
  labelIds: [] as string[],
};

const EMPTY_LABEL_FORM = {
  name: "",
  color: "",
};

const EMPTY_MEMBER_FORM: MemberFormState = {
  userId: "",
  role: "viewer",
  canComment: false,
};

const EMPTY_FILTERS = {
  search: "",
  assigneeUserId: "",
  priority: "all",
  dueStatus: "all",
  labelId: "",
};

const LIST_TYPE_LABELS: Record<KanbanListType, string> = {
  active: "Активный",
  closed: "Закрытый",
  archive: "Архив",
  trash: "Корзина",
};

const CARD_PRIORITY_LABELS: Record<KanbanCardPriority, string> = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
  urgent: "Срочный",
};

const CARD_PRIORITY_BADGE_VARIANTS: Record<
  KanbanCardPriority,
  "outline" | "secondary" | "default" | "destructive"
> = {
  low: "outline",
  medium: "secondary",
  high: "default",
  urgent: "destructive",
};

const DUE_DATE_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});

const toDateTimeLocalValue = (value?: string | Date | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");

  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join("T");
};

const formatDueDateLabel = (value?: string | Date | null) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return DUE_DATE_FORMATTER.format(date);
};

type DueDateStatus = "none" | "upcoming" | "soon" | "overdue" | "complete";

const getDueDateStatus = (
  value?: string | Date | null,
  options?: { isComplete?: boolean },
): DueDateStatus => {
  if (options?.isComplete) return "complete";
  if (!value) return "none";

  const dueDate = new Date(value);
  if (Number.isNaN(dueDate.getTime())) return "none";

  const now = new Date();
  const diffMs = dueDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffMs < 0) return "overdue";
  if (diffHours <= 24) return "soon";
  return "upcoming";
};

const getDueDateStatusLabel = (status: DueDateStatus) => {
  switch (status) {
    case "complete":
      return "Завершено";
    case "overdue":
      return "Просрочено";
    case "soon":
      return "Скоро срок";
    case "upcoming":
      return "Запланировано";
    default:
      return "Без срока";
  }
};

const getDueDateStatusClasses = (status: DueDateStatus) => {
  switch (status) {
    case "complete":
      return {
        badge: "border-emerald-200 bg-emerald-100 text-emerald-900",
        card: "border-emerald-200/80 bg-emerald-50/40",
      };
    case "overdue":
      return {
        badge: "border-red-200 bg-red-100 text-red-900",
        card: "border-red-200/80 bg-red-50/50",
      };
    case "soon":
      return {
        badge: "border-amber-200 bg-amber-100 text-amber-900",
        card: "border-amber-200/80 bg-amber-50/50",
      };
    case "upcoming":
      return {
        badge: "border-sky-200 bg-sky-100 text-sky-900",
        card: "border-sky-200/80 bg-sky-50/40",
      };
    default:
      return {
        badge: "border-border bg-muted text-muted-foreground",
        card: "",
      };
  }
};

const getKanbanHistoryActionLabel = (action: string) => {
  switch (action) {
    case "created":
      return "Создал карточку";
    case "updated":
      return "Обновил карточку";
    case "moved":
      return "Переместил карточку";
    case "labels_updated":
      return "Обновил метки карточки";
    case "commented":
      return "Добавил комментарий";
    case "attachment_added":
      return "Добавил вложение";
    default:
      return action || "Изменил карточку";
  }
};

const normalizeLabelIds = (labelIds?: string[] | null) =>
  Array.from(new Set((labelIds ?? []).map(String).filter(Boolean)));

const formatFileSize = (value?: number | null) => {
  if (!value || value < 0) return "Неизвестный размер";
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / (1024 * 1024)).toFixed(1)} МБ`;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const normalizeSubtasks = (subtasks?: KanbanSubtask[] | null) =>
  Array.isArray(subtasks)
    ? subtasks
        .map((subtask) => ({
          id: String(subtask.id || "").trim(),
          title: String(subtask.title || "").trim(),
          completed: Boolean(subtask.completed),
        }))
        .filter((subtask) => subtask.id && subtask.title)
    : [];

const getSubtaskProgress = (subtasks?: KanbanSubtask[] | null) => {
  const normalized = normalizeSubtasks(subtasks);
  const completed = normalized.filter((subtask) => subtask.completed).length;
  return { total: normalized.length, completed };
};

interface KanbanCardMoveInput {
  boardId: string;
  cardId: string;
  targetListId: string;
  targetPosition: number;
}

interface KanbanListReorderInput {
  boardId: string;
  listIds: string[];
}

const moveKanbanCards = (
  cards: KanbanCardView[],
  movement: Pick<KanbanCardMoveInput, "cardId" | "targetListId" | "targetPosition">,
) => {
  const movingCard = cards.find((card) => card.id === movement.cardId);
  if (!movingCard) return cards;

  const sourceListId = String(movingCard.listId);
  const targetListId = String(movement.targetListId);
  const normalizedTargetPosition = Math.max(0, Number(movement.targetPosition || 0));

  if (sourceListId === targetListId) {
    const sameListCards = cards.filter((card) => String(card.listId) === sourceListId && card.id !== movingCard.id);
    const insertionIndex = Math.min(normalizedTargetPosition, sameListCards.length);
    sameListCards.splice(insertionIndex, 0, movingCard);

    const updatedSameListCards = sameListCards.map((card, index) => ({
      ...card,
      position: index,
    }));

    return [
      ...cards.filter((card) => String(card.listId) !== sourceListId),
      ...updatedSameListCards,
    ];
  }

  const sourceCards = cards.filter((card) => String(card.listId) === sourceListId && card.id !== movingCard.id);
  const targetCards = cards.filter((card) => String(card.listId) === targetListId && card.id !== movingCard.id);
  const insertionIndex = Math.min(normalizedTargetPosition, targetCards.length);

  targetCards.splice(insertionIndex, 0, {
    ...movingCard,
    listId: targetListId,
  });

  const updatedSourceCards = sourceCards.map((card, index) => ({
    ...card,
    position: index,
  }));
  const updatedTargetCards = targetCards.map((card, index) => ({
    ...card,
    listId: targetListId,
    position: index,
  }));

  return [
    ...cards.filter(
      (card) => String(card.listId) !== sourceListId && String(card.listId) !== targetListId,
    ),
    ...updatedSourceCards,
    ...updatedTargetCards,
  ];
};

const reorderKanbanLists = (lists: KanbanListView[], listIds: string[]) => {
  const listMap = new Map(lists.map((list) => [String(list.id), list]));

  return listIds
    .map((listId, index) => {
      const list = listMap.get(String(listId));
      if (!list) return null;
      return {
        ...list,
        position: index,
      };
    })
    .filter((list): list is KanbanListView => Boolean(list));
};

export default function TasksV2Page() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [boardForm, setBoardForm] = useState(EMPTY_BOARD_FORM);
  const [listForm, setListForm] = useState(EMPTY_LIST_FORM);
  const [cardForm, setCardForm] = useState(EMPTY_CARD_FORM);
  const [labelForm, setLabelForm] = useState(EMPTY_LABEL_FORM);
  const [memberForm, setMemberForm] = useState(EMPTY_MEMBER_FORM);
  const [cardFilters, setCardFilters] = useState(EMPTY_FILTERS);
  const [detailCardForm, setDetailCardForm] = useState(EMPTY_CARD_FORM);
  const [detailCommentDraft, setDetailCommentDraft] = useState("");
  const [detailSubtaskDraft, setDetailSubtaskDraft] = useState("");

  const { data: companiesResponse, isLoading: companiesLoading } = useQuery<CompaniesResponse>({
    queryKey: ["/api/companies/me", "kanban-v2"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/companies/me");
      return await res.json();
    },
  });

  const { data: boards = [], isLoading: boardsLoading } = useQuery<KanbanBoardView[]>({
    queryKey: ["/api/kanban/boards"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/kanban/boards");
      return await res.json();
    },
  });

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      return await res.json();
    },
  });

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );

  const { data: lists = [], isLoading: listsLoading } = useQuery<KanbanListView[]>({
    queryKey: ["kanban-lists", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/lists`);
      return await res.json();
    },
  });

  const { data: cards = [], isLoading: cardsLoading } = useQuery<KanbanCardView[]>({
    queryKey: ["kanban-cards", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/cards`);
      return await res.json();
    },
  });
  const { data: boardLabels = [], isLoading: boardLabelsLoading } = useQuery<KanbanLabelView[]>({
    queryKey: ["kanban-labels", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/labels`);
      return await res.json();
    },
  });
  const { data: boardMembers = [], isLoading: boardMembersLoading } = useQuery<KanbanBoardMemberView[]>({
    queryKey: ["kanban-board-members", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/members`);
      return await res.json();
    },
  });
  const selectedDetailCardSummary = useMemo(
    () => cards.find((card) => card.id === detailCardId) ?? null,
    [cards, detailCardId],
  );
  const { data: detailCardData, isLoading: detailCardLoading } = useQuery<KanbanCardView>({
    queryKey: ["kanban-card", selectedBoardId, detailCardId],
    enabled: !!selectedBoardId && !!detailCardId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}`);
      return await res.json();
    },
  });
  const { data: detailCardHistory = [], isLoading: detailCardHistoryLoading } = useQuery<KanbanCardHistoryView[]>({
    queryKey: ["kanban-card-history", selectedBoardId, detailCardId],
    enabled: !!selectedBoardId && !!detailCardId,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}/history`,
      );
      return await res.json();
    },
  });
  const { data: detailCardComments = [], isLoading: detailCardCommentsLoading } = useQuery<KanbanCardCommentView[]>({
    queryKey: ["kanban-card-comments", selectedBoardId, detailCardId],
    enabled: !!selectedBoardId && !!detailCardId,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}/comments`,
      );
      return await res.json();
    },
  });
  const { data: detailCardAttachments = [], isLoading: detailCardAttachmentsLoading } = useQuery<KanbanCardAttachmentView[]>({
    queryKey: ["kanban-card-attachments", selectedBoardId, detailCardId],
    enabled: !!selectedBoardId && !!detailCardId,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}/attachments`,
      );
      return await res.json();
    },
  });

  const companyItems = companiesResponse?.companies ?? [];
  const companies = companyItems.map((item) => item.company);
  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );
  const userById = useMemo(
    () => new Map(users.map((user) => [user.id, user])),
    [users],
  );
  const labelById = useMemo(
    () => new Map(boardLabels.map((label) => [label.id, label])),
    [boardLabels],
  );
  const selectedCompanyItem = useMemo(
    () => companyItems.find((item) => item.company.id === selectedBoard?.companyId) ?? null,
    [companyItems, selectedBoard?.companyId],
  );
  const selectedDetailCard = detailCardData ?? selectedDetailCardSummary ?? null;
  const selectedDetailList = useMemo(
    () => lists.find((list) => list.id === selectedDetailCard?.listId) ?? null,
    [lists, selectedDetailCard?.listId],
  );
  const availableAssignees = useMemo(() => {
    if (!selectedBoard) return [];

    if (!selectedCompanyItem) {
      return users.filter((user) => user.active !== false);
    }

    const activeMemberIds = new Set(
      selectedCompanyItem.members
        .filter((member) => member.status === "active")
        .map((member) => String(member.userId)),
    );

    return users.filter((user) => activeMemberIds.has(String(user.id)) && user.active !== false);
  }, [selectedBoard, selectedCompanyItem, users]);
  const availableBoardMembers = useMemo(() => {
    if (!selectedCompanyItem) return [];
    const existingUserIds = new Set(boardMembers.map((member) => String(member.userId)));
    return users.filter((user) => {
      if (user.active === false) return false;
      const companyMember = selectedCompanyItem.members.find(
        (member) => String(member.userId) === String(user.id) && member.status === "active",
      );
      if (!companyMember) return false;
      return !existingUserIds.has(String(user.id));
    });
  }, [boardMembers, selectedCompanyItem, users]);
  const filteredCards = useMemo(() => {
    const search = cardFilters.search.trim().toLowerCase();

    return cards.filter((card) => {
      if (search) {
        const haystack = [card.title, card.description || ""].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (cardFilters.assigneeUserId && String(card.assigneeUserId || "") !== cardFilters.assigneeUserId) {
        return false;
      }

      if (cardFilters.priority !== "all" && card.priority !== cardFilters.priority) {
        return false;
      }

      if (cardFilters.labelId && !normalizeLabelIds(card.labelIds).includes(cardFilters.labelId)) {
        return false;
      }

      if (cardFilters.dueStatus !== "all") {
        const list = lists.find((item) => item.id === card.listId);
        const isCompleteLikeList = list?.type === "closed" || list?.type === "archive" || list?.type === "trash";
        const dueStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList });
        if (dueStatus !== cardFilters.dueStatus) return false;
      }

      return true;
    });
  }, [cardFilters, cards, lists]);

  const filteredCardsByListId = useMemo(() => {
    const groupedCards = new Map<string, KanbanCardView[]>();

    for (const card of filteredCards) {
      const listCards = groupedCards.get(card.listId) ?? [];
      listCards.push(card);
      groupedCards.set(card.listId, listCards);
    }

    return groupedCards;
  }, [filteredCards]);

  const toggleCardFormLabel = (labelId: string) => {
    setCardForm((prev) => ({
      ...prev,
      labelIds: prev.labelIds.includes(labelId)
        ? prev.labelIds.filter((value) => value !== labelId)
        : [...prev.labelIds, labelId],
    }));
  };

  const toggleDetailCardFormLabel = (labelId: string) => {
    setDetailCardForm((prev) => ({
      ...prev,
      labelIds: prev.labelIds.includes(labelId)
        ? prev.labelIds.filter((value) => value !== labelId)
        : [...prev.labelIds, labelId],
    }));
  };

  const getListNameById = (listId: unknown) => {
    const normalized = String(listId || "").trim();
    if (!normalized) return "Без списка";
    return lists.find((list) => String(list.id) === normalized)?.name || normalized;
  };

  const getUserNameById = (userId: unknown) => {
    const normalized = String(userId || "").trim();
    if (!normalized) return "Без исполнителя";
    return userById.get(normalized)?.name || normalized;
  };

  const getLabelNameList = (labelIds: unknown) => {
    const normalized = Array.isArray(labelIds) ? normalizeLabelIds(labelIds as string[]) : [];
    return normalized.map((labelId) => labelById.get(labelId)?.name || labelId);
  };

  const getHistoryChangeLines = (entry: KanbanCardHistoryView) => {
    const oldValue = asRecord(entry.oldValue);
    const newValue = asRecord(entry.newValue);
    const lines: string[] = [];

    if (entry.action === "attachment_added") {
      const fileName = String(newValue?.fileName || "").trim();
      return fileName ? [`Файл: ${fileName}`] : [];
    }

    if (entry.action === "commented") {
      const content = String(newValue?.content || "").trim();
      return content ? [`Комментарий: ${content}`] : [];
    }

    if (entry.action === "labels_updated") {
      const oldLabels = getLabelNameList(oldValue?.labelIds);
      const newLabels = getLabelNameList(newValue?.labelIds);
      const added = newLabels.filter((label) => !oldLabels.includes(label));
      const removed = oldLabels.filter((label) => !newLabels.includes(label));
      if (added.length) lines.push(`Добавлены метки: ${added.join(", ")}`);
      if (removed.length) lines.push(`Удалены метки: ${removed.join(", ")}`);
      if (!lines.length) lines.push("Состав меток изменен");
      return lines;
    }

    if (entry.action === "moved") {
      const fromList = getListNameById(oldValue?.listId);
      const toList = getListNameById(newValue?.listId);
      if (fromList !== toList) {
        lines.push(`Список: ${fromList} -> ${toList}`);
      }
      const fromPosition = oldValue?.position;
      const toPosition = newValue?.position;
      if (fromPosition !== undefined && toPosition !== undefined && fromPosition !== toPosition) {
        lines.push(`Позиция: ${Number(fromPosition) + 1} -> ${Number(toPosition) + 1}`);
      }
      return lines;
    }

    if (entry.action === "updated" || entry.action === "created") {
      const fieldLines: Array<[boolean, string]> = [
        [oldValue?.title !== newValue?.title && newValue?.title !== undefined, `Название: ${String(newValue?.title || "Без названия")}`],
        [oldValue?.description !== newValue?.description && newValue?.description !== undefined, `Описание обновлено`],
        [oldValue?.priority !== newValue?.priority && newValue?.priority !== undefined, `Приоритет: ${CARD_PRIORITY_LABELS[String(newValue?.priority) as KanbanCardPriority] || String(newValue?.priority)}`],
        [oldValue?.listId !== newValue?.listId && newValue?.listId !== undefined, `Список: ${getListNameById(oldValue?.listId)} -> ${getListNameById(newValue?.listId)}`],
        [oldValue?.assigneeUserId !== newValue?.assigneeUserId && newValue?.assigneeUserId !== undefined, `Исполнитель: ${getUserNameById(oldValue?.assigneeUserId)} -> ${getUserNameById(newValue?.assigneeUserId)}`],
        [String(oldValue?.dueDate || "") !== String(newValue?.dueDate || "") && newValue?.dueDate !== undefined, `Срок: ${formatDueDateLabel(oldValue?.dueDate as string | Date | null) || "Не задан"} -> ${formatDueDateLabel(newValue?.dueDate as string | Date | null) || "Не задан"}`],
      ];

      for (const [shouldAdd, text] of fieldLines) {
        if (shouldAdd) lines.push(text);
      }

      if (entry.action === "created" && !lines.length) {
        lines.push("Карточка создана и готова к работе");
      }

      if (oldValue?.subtasks !== newValue?.subtasks && newValue?.subtasks !== undefined) {
        const before = getSubtaskProgress(oldValue?.subtasks as KanbanSubtask[] | null);
        const after = getSubtaskProgress(newValue?.subtasks as KanbanSubtask[] | null);
        lines.push(`Подзадачи: ${before.completed}/${before.total} -> ${after.completed}/${after.total}`);
      }
    }

    return lines;
  };

  useEffect(() => {
    if (!editingBoardId && !boardForm.companyId && companies[0]?.id) {
      setBoardForm((prev) => ({ ...prev, companyId: companies[0].id }));
    }
  }, [boardForm.companyId, companies, editingBoardId]);

  useEffect(() => {
    if (editingMemberId) return;
    if (memberForm.userId) return;
    if (availableBoardMembers[0]?.id) {
      setMemberForm((prev) => ({ ...prev, userId: availableBoardMembers[0].id }));
    }
  }, [availableBoardMembers, editingMemberId, memberForm.userId]);

  useEffect(() => {
    if (boards.length === 0) {
      setSelectedBoardId(null);
      return;
    }

    if (!selectedBoardId || !boards.some((board) => board.id === selectedBoardId)) {
      setSelectedBoardId(boards[0].id);
    }
  }, [boards, selectedBoardId]);

  useEffect(() => {
    setEditingListId(null);
    setListForm(EMPTY_LIST_FORM);
    setEditingCardId(null);
    setCardForm(EMPTY_CARD_FORM);
    setDetailCardId(null);
    setDetailCardForm(EMPTY_CARD_FORM);
    setDetailCommentDraft("");
  }, [selectedBoardId]);

  useEffect(() => {
    if (lists.length === 0) {
      setEditingCardId(null);
      setCardForm(EMPTY_CARD_FORM);
      return;
    }

    setCardForm((prev) => {
      const nextListId = lists.some((list) => list.id === prev.listId) ? prev.listId : lists[0].id;
      return prev.listId === nextListId ? prev : { ...prev, listId: nextListId };
    });
  }, [lists]);

  useEffect(() => {
    if (!editingCardId) return;
    if (cards.some((card) => card.id === editingCardId)) return;

    setEditingCardId(null);
    setCardForm((prev) => ({
      ...EMPTY_CARD_FORM,
      listId: lists.some((list) => list.id === prev.listId) ? prev.listId : lists[0]?.id || "",
    }));
  }, [cards, editingCardId, lists]);

  useEffect(() => {
    if (!detailCardId) return;
    if (!selectedDetailCard) return;

    setDetailCardForm({
      listId: selectedDetailCard.listId,
      title: selectedDetailCard.title,
      description: selectedDetailCard.description || "",
      priority: selectedDetailCard.priority,
      dueDate: toDateTimeLocalValue(selectedDetailCard.dueDate),
      assigneeUserId: selectedDetailCard.assigneeUserId || "",
      labelIds: normalizeLabelIds(selectedDetailCard.labelIds),
    });
  }, [detailCardId, selectedDetailCard]);

  useEffect(() => {
    if (!detailCardId) return;
    if (cards.some((card) => card.id === detailCardId)) return;
    if (detailCardLoading) return;

    setDetailCardId(null);
    setDetailCardForm(EMPTY_CARD_FORM);
  }, [cards, detailCardId, detailCardLoading]);

  const saveBoardMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyId: boardForm.companyId,
        name: boardForm.name.trim(),
        description: boardForm.description.trim() || null,
        visibility: boardForm.visibility,
      };

      if (editingBoardId) {
        const res = await apiRequest("PUT", `/api/kanban/boards/${editingBoardId}`, {
          name: payload.name,
          description: payload.description,
          visibility: payload.visibility,
        });
        return await res.json();
      }

      const res = await apiRequest("POST", "/api/kanban/boards", payload);
      return await res.json();
    },
    onSuccess: (board: KanbanBoardView) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      toast({
        title: editingBoardId ? "Доска обновлена" : "Доска создана",
        description: "Board core для Kanban V2 сохранен.",
      });
      setSelectedBoardId(board.id);
      setEditingBoardId(null);
      setBoardForm((prev) => ({
        ...EMPTY_BOARD_FORM,
        companyId: prev.companyId || companies[0]?.id || "",
      }));
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось сохранить доску",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteBoardMutation = useMutation({
    mutationFn: async (boardId: string) => {
      await apiRequest("DELETE", `/api/kanban/boards/${boardId}`);
      return boardId;
    },
    onSuccess: (boardId: string) => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      toast({
        title: "Доска удалена",
        description: "Связанные списки удалены вместе с доской. Legacy Task Manager не затронут.",
      });
      if (selectedBoardId === boardId) {
        setSelectedBoardId(null);
      }
      if (editingBoardId === boardId) {
        setEditingBoardId(null);
        setBoardForm((prev) => ({
          ...EMPTY_BOARD_FORM,
          companyId: prev.companyId || companies[0]?.id || "",
        }));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить доску",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveListMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");

      const payload = {
        name: listForm.name.trim(),
        color: listForm.color.trim() || null,
        type: listForm.type,
      };

      if (editingListId) {
        const res = await apiRequest(
          "PUT",
          `/api/kanban/boards/${selectedBoardId}/lists/${editingListId}`,
          payload,
        );
        return await res.json();
      }

      const res = await apiRequest("POST", `/api/kanban/boards/${selectedBoardId}/lists`, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-lists", selectedBoardId] });
      toast({
        title: editingListId ? "Список обновлен" : "Список создан",
        description: "First-class list сохранен в Kanban V2.",
      });
      setEditingListId(null);
      setListForm(EMPTY_LIST_FORM);
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось сохранить список",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      await apiRequest("DELETE", `/api/kanban/boards/${selectedBoardId}/lists/${listId}`);
      return listId;
    },
    onSuccess: (listId: string) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-lists", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      toast({
        title: "Список удален",
        description: "Структура доски и вложенные карточки обновлены.",
      });
      if (editingListId === listId) {
        setEditingListId(null);
        setListForm(EMPTY_LIST_FORM);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить список",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveListMutation = useMutation({
    mutationFn: async (movement: KanbanListReorderInput) => {
      const res = await apiRequest(
        "POST",
        `/api/kanban/boards/${movement.boardId}/lists/reorder`,
        { listIds: movement.listIds },
      );
      return await res.json();
    },
    onMutate: async (movement) => {
      await queryClient.cancelQueries({ queryKey: ["kanban-lists", movement.boardId] });

      const previousLists = queryClient.getQueryData<KanbanListView[]>([
        "kanban-lists",
        movement.boardId,
      ]) ?? [];

      queryClient.setQueryData<KanbanListView[]>(
        ["kanban-lists", movement.boardId],
        reorderKanbanLists(previousLists, movement.listIds),
      );

      return { previousLists };
    },
    onError: (error: Error, movement, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData(["kanban-lists", movement.boardId], context.previousLists);
      }

      toast({
        title: "Не удалось изменить порядок списков",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_result, _error, movement) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-lists", movement.boardId] });
    },
  });

  const saveCardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!cardForm.listId) throw new Error("Сначала выберите список");

      const payload = {
        listId: cardForm.listId,
        title: cardForm.title.trim(),
        description: cardForm.description.trim() || null,
        priority: cardForm.priority,
        dueDate: cardForm.dueDate || null,
        assigneeUserId: cardForm.assigneeUserId || null,
        labelIds: normalizeLabelIds(cardForm.labelIds),
      };

      if (editingCardId) {
        const res = await apiRequest(
          "PUT",
          `/api/kanban/boards/${selectedBoardId}/cards/${editingCardId}`,
          payload,
        );
        return await res.json();
      }

      const res = await apiRequest("POST", `/api/kanban/boards/${selectedBoardId}/cards`, payload);
      return await res.json();
    },
    onSuccess: (card: KanbanCardView) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      toast({
        title: editingCardId ? "Карточка обновлена" : "Карточка создана",
        description: "First-class card сохранена в Kanban V2.",
      });
      setEditingCardId(null);
      setCardForm({
        ...EMPTY_CARD_FORM,
        listId: card.listId || lists[0]?.id || "",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось сохранить карточку",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCardMutation = useMutation({
    mutationFn: async (cardId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      await apiRequest("DELETE", `/api/kanban/boards/${selectedBoardId}/cards/${cardId}`);
      return cardId;
    },
    onSuccess: (cardId: string) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      toast({
        title: "Карточка удалена",
        description: "Содержимое списка синхронизировано.",
      });
      if (editingCardId === cardId) {
        setEditingCardId(null);
        setCardForm((prev) => ({
          ...EMPTY_CARD_FORM,
          listId: lists.some((list) => list.id === prev.listId) ? prev.listId : lists[0]?.id || "",
        }));
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить карточку",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveCardDetailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!detailCardId) throw new Error("Сначала выберите карточку");
      if (!detailCardForm.listId) throw new Error("Сначала выберите список");

      const res = await apiRequest(
        "PUT",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}`,
        {
          listId: detailCardForm.listId,
          title: detailCardForm.title.trim(),
          description: detailCardForm.description.trim() || null,
          priority: detailCardForm.priority,
          dueDate: detailCardForm.dueDate || null,
          assigneeUserId: detailCardForm.assigneeUserId || null,
          labelIds: normalizeLabelIds(detailCardForm.labelIds),
        },
      );
      return await res.json();
    },
    onSuccess: (card: KanbanCardView) => {
      queryClient.setQueryData(["kanban-card", selectedBoardId, card.id], card);
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card", selectedBoardId, card.id] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card-history", selectedBoardId, card.id] });

      if (editingCardId === card.id) {
        setCardForm({
          listId: card.listId,
          title: card.title,
          description: card.description || "",
          priority: card.priority,
          dueDate: toDateTimeLocalValue(card.dueDate),
          assigneeUserId: card.assigneeUserId || "",
          labelIds: normalizeLabelIds(card.labelIds),
        });
      }

      toast({
        title: "Карточка обновлена",
        description: "Изменения сохранены в detail view.",
      });
      setDetailCardId(null);
      setDetailCardForm(EMPTY_CARD_FORM);
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось сохранить карточку",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const moveCardMutation = useMutation({
    mutationFn: async (movement: KanbanCardMoveInput) => {
      const res = await apiRequest(
        "POST",
        `/api/kanban/boards/${movement.boardId}/cards/${movement.cardId}/move`,
        {
          listId: movement.targetListId,
          position: movement.targetPosition,
        },
      );
      return await res.json();
    },
    onMutate: async (movement) => {
      await queryClient.cancelQueries({ queryKey: ["kanban-cards", movement.boardId] });

      const previousCards = queryClient.getQueryData<KanbanCardView[]>([
        "kanban-cards",
        movement.boardId,
      ]) ?? [];
      const previousCard = previousCards.find((card) => card.id === movement.cardId) ?? null;

      queryClient.setQueryData<KanbanCardView[]>(
        ["kanban-cards", movement.boardId],
        moveKanbanCards(previousCards, movement),
      );

      if (editingCardId === movement.cardId) {
        setCardForm((prev) => ({ ...prev, listId: movement.targetListId }));
      }

      return { previousCards, previousCard };
    },
    onError: (error: Error, movement, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(["kanban-cards", movement.boardId], context.previousCards);
      }

      if (editingCardId === movement.cardId && context?.previousCard) {
        setCardForm((prev) => ({ ...prev, listId: context.previousCard?.listId || prev.listId }));
      }

      toast({
        title: "Не удалось переместить карточку",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_movedCard, _error, movement) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", movement.boardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card-history", movement.boardId, movement.cardId] });
    },
  });

  const createCardCommentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!detailCardId) throw new Error("Сначала выберите карточку");
      const res = await apiRequest(
        "POST",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}/comments`,
        { content: detailCommentDraft.trim() },
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-card-comments", selectedBoardId, detailCardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card-history", selectedBoardId, detailCardId] });
      setDetailCommentDraft("");
      toast({
        title: "Комментарий добавлен",
        description: "Обсуждение карточки обновлено.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось добавить комментарий",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadCardAttachmentMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!detailCardId) throw new Error("Сначала выберите карточку");
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiRequest(
        "POST",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}/attachments`,
        formData,
        true,
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-card-attachments", selectedBoardId, detailCardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card-history", selectedBoardId, detailCardId] });
      toast({
        title: "Файл загружен",
        description: "Вложение появилось в карточке.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось загрузить файл",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCardAttachmentMutation = useMutation({
    mutationFn: async (attachmentId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!detailCardId) throw new Error("Сначала выберите карточку");
      await apiRequest(
        "DELETE",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}/attachments/${attachmentId}`,
      );
      return attachmentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-card-attachments", selectedBoardId, detailCardId] });
      toast({
        title: "Вложение удалено",
        description: "Список файлов карточки обновлен.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить вложение",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveCardSubtasksMutation = useMutation({
    mutationFn: async (subtasks: KanbanSubtask[]) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!detailCardId) throw new Error("Сначала выберите карточку");
      const res = await apiRequest(
        "PUT",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}`,
        { subtasks: normalizeSubtasks(subtasks) },
      );
      return await res.json();
    },
    onSuccess: (card: KanbanCardView) => {
      queryClient.setQueryData(["kanban-card", selectedBoardId, card.id], card);
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card", selectedBoardId, card.id] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card-history", selectedBoardId, card.id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось сохранить подзадачи",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveLabelMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");

      const payload = {
        name: labelForm.name.trim(),
        color: labelForm.color.trim() || null,
      };

      if (editingLabelId) {
        const res = await apiRequest(
          "PUT",
          `/api/kanban/boards/${selectedBoardId}/labels/${editingLabelId}`,
          payload,
        );
        return await res.json();
      }

      const res = await apiRequest("POST", `/api/kanban/boards/${selectedBoardId}/labels`, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-labels", selectedBoardId] });
      toast({
        title: editingLabelId ? "Метка обновлена" : "Метка создана",
        description: "Справочник меток доски синхронизирован.",
      });
      setEditingLabelId(null);
      setLabelForm(EMPTY_LABEL_FORM);
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось сохранить метку",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteLabelMutation = useMutation({
    mutationFn: async (labelId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      await apiRequest("DELETE", `/api/kanban/boards/${selectedBoardId}/labels/${labelId}`);
      return labelId;
    },
    onSuccess: (labelId: string) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-labels", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      if (detailCardId) {
        queryClient.invalidateQueries({ queryKey: ["kanban-card", selectedBoardId, detailCardId] });
      }
      setCardForm((prev) => ({ ...prev, labelIds: prev.labelIds.filter((value) => value !== labelId) }));
      setDetailCardForm((prev) => ({ ...prev, labelIds: prev.labelIds.filter((value) => value !== labelId) }));
      if (editingLabelId === labelId) {
        setEditingLabelId(null);
        setLabelForm(EMPTY_LABEL_FORM);
      }
      toast({
        title: "Метка удалена",
        description: "Связанные карточки обновят набор меток после следующего сохранения.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить метку",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const saveMemberMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!memberForm.userId && !editingMemberId) throw new Error("Выберите пользователя");

      const payload = {
        userId: memberForm.userId,
        role: memberForm.role,
        canComment: memberForm.role === "editor" ? true : memberForm.canComment,
      };

      if (editingMemberId) {
        const res = await apiRequest(
          "PUT",
          `/api/kanban/boards/${selectedBoardId}/members/${editingMemberId}`,
          { role: payload.role, canComment: payload.canComment },
        );
        return await res.json();
      }

      const res = await apiRequest("POST", `/api/kanban/boards/${selectedBoardId}/members`, payload);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board-members", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      toast({
        title: editingMemberId ? "Участник обновлен" : "Участник добавлен",
        description: "Права доступа к доске синхронизированы.",
      });
      setEditingMemberId(null);
      setMemberForm(EMPTY_MEMBER_FORM);
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось сохранить участника",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      await apiRequest("DELETE", `/api/kanban/boards/${selectedBoardId}/members/${memberId}`);
      return memberId;
    },
    onSuccess: (memberId: string) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-board-members", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      if (editingMemberId === memberId) {
        setEditingMemberId(null);
        setMemberForm(EMPTY_MEMBER_FORM);
      }
      toast({
        title: "Участник удален",
        description: "Состав доски обновлен.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить участника",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteCardCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!detailCardId) throw new Error("Сначала выберите карточку");
      await apiRequest(
        "DELETE",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}/comments/${commentId}`,
      );
      return commentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-card-comments", selectedBoardId, detailCardId] });
      toast({
        title: "Комментарий удален",
        description: "Лента комментариев обновлена.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось удалить комментарий",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEditBoard = (board: KanbanBoardView) => {
    setSelectedBoardId(board.id);
    setEditingBoardId(board.id);
    setBoardForm({
      companyId: board.companyId,
      name: board.name,
      description: board.description || "",
      visibility: board.visibility,
    });
  };

  const handleCancelBoardEdit = () => {
    setEditingBoardId(null);
    setBoardForm((prev) => ({
      ...EMPTY_BOARD_FORM,
      companyId: prev.companyId || companies[0]?.id || "",
    }));
  };

  const handleEditList = (list: KanbanListView) => {
    setEditingListId(list.id);
    setListForm({
      name: list.name,
      color: list.color || "",
      type: list.type,
    });
  };

  const handleCancelListEdit = () => {
    setEditingListId(null);
    setListForm(EMPTY_LIST_FORM);
  };

  const handleEditCard = (card: KanbanCardView) => {
    setEditingCardId(card.id);
    setCardForm({
      listId: card.listId,
      title: card.title,
      description: card.description || "",
      priority: card.priority,
      dueDate: toDateTimeLocalValue(card.dueDate),
      assigneeUserId: card.assigneeUserId || "",
      labelIds: normalizeLabelIds(card.labelIds),
    });
  };

  const handleCancelCardEdit = () => {
    setEditingCardId(null);
    setCardForm((prev) => ({
      ...EMPTY_CARD_FORM,
      listId: lists.some((list) => list.id === prev.listId) ? prev.listId : lists[0]?.id || "",
    }));
  };

  const handleOpenCardDetail = (cardId: string) => {
    setDetailCardId(cardId);
  };

  const handleCloseCardDetail = () => {
    setDetailCardId(null);
    setDetailCardForm(EMPTY_CARD_FORM);
    setDetailCommentDraft("");
    setDetailSubtaskDraft("");
  };

  const handleEditLabel = (label: KanbanLabelView) => {
    setEditingLabelId(label.id);
    setLabelForm({
      name: label.name,
      color: label.color || "",
    });
  };

  const handleCancelLabelEdit = () => {
    setEditingLabelId(null);
    setLabelForm(EMPTY_LABEL_FORM);
  };

  const handleEditMember = (member: KanbanBoardMemberView) => {
    setEditingMemberId(member.id);
    setMemberForm({
      userId: member.userId,
      role: member.role,
      canComment: Boolean(member.canComment),
    });
  };

  const handleCancelMemberEdit = () => {
    setEditingMemberId(null);
    setMemberForm(EMPTY_MEMBER_FORM);
  };

  const handleCardDragEnd = (result: DropResult) => {
    if (!selectedBoardId || !canEditSelectedBoard || isCardPending) return;

    const { destination, source, draggableId } = result;
    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    moveCardMutation.mutate({
      boardId: selectedBoardId,
      cardId: draggableId,
      targetListId: destination.droppableId,
      targetPosition: destination.index,
    });
  };

  const handleShiftList = (listId: string, direction: "up" | "down") => {
    if (!selectedBoardId || moveListMutation.isPending) return;

    const currentIndex = lists.findIndex((list) => list.id === listId);
    if (currentIndex < 0) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= lists.length) return;

    const reorderedIds = lists.map((list) => list.id);
    const [movedId] = reorderedIds.splice(currentIndex, 1);
    reorderedIds.splice(targetIndex, 0, movedId);

    moveListMutation.mutate({
      boardId: selectedBoardId,
      listIds: reorderedIds,
    });
  };

  const isBoardPending = saveBoardMutation.isPending || deleteBoardMutation.isPending;
  const isListPending =
    saveListMutation.isPending || deleteListMutation.isPending || moveListMutation.isPending;
  const isLabelPending = saveLabelMutation.isPending || deleteLabelMutation.isPending;
  const isMemberPending = saveMemberMutation.isPending || deleteMemberMutation.isPending;
  const isCardPending =
    saveCardMutation.isPending ||
    saveCardDetailMutation.isPending ||
    saveCardSubtasksMutation.isPending ||
    createCardCommentMutation.isPending ||
    uploadCardAttachmentMutation.isPending ||
    deleteCardAttachmentMutation.isPending ||
    deleteCardCommentMutation.isPending ||
    deleteCardMutation.isPending ||
    moveCardMutation.isPending;
  const canEditSelectedBoard = Boolean(selectedBoard?.canEdit);
  const canCommentSelectedBoard = Boolean(selectedBoard?.canComment);
  const isBoardStructureLoading = listsLoading || cardsLoading;
  const hasLists = lists.length > 0;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <Card className="border-border/70">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Kanban V2</CardTitle>
              <CardDescription>
                Итерация 8: добавлены board labels и назначение меток карточкам.
              </CardDescription>
            </div>
            <Link href="/tasks">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Legacy Tasks
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="kanban-company">
                    Компания
                  </label>
                  <select
                    id="kanban-company"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={boardForm.companyId}
                    onChange={(event) => setBoardForm((prev) => ({ ...prev, companyId: event.target.value }))}
                    disabled={Boolean(editingBoardId) || companiesLoading || isBoardPending}
                  >
                    {companies.length === 0 && <option value="">Нет доступных компаний</option>}
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="kanban-visibility">
                    Видимость
                  </label>
                  <select
                    id="kanban-visibility"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={boardForm.visibility}
                    onChange={(event) =>
                      setBoardForm((prev) => ({ ...prev, visibility: event.target.value as BoardVisibility }))
                    }
                    disabled={isBoardPending}
                  >
                    <option value="company">Вся компания</option>
                    <option value="members">Только участники</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="kanban-name">
                  Название доски
                </label>
                <Input
                  id="kanban-name"
                  value={boardForm.name}
                  onChange={(event) => setBoardForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Например: Продакшн / Июль"
                  disabled={isBoardPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="kanban-description">
                  Описание
                </label>
                <Textarea
                  id="kanban-description"
                  value={boardForm.description}
                  onChange={(event) => setBoardForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Кратко опишите назначение доски"
                  rows={4}
                  disabled={isBoardPending}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  onClick={() => saveBoardMutation.mutate()}
                  disabled={!boardForm.companyId || !boardForm.name.trim() || isBoardPending}
                >
                  <Plus className="h-4 w-4" />
                  {editingBoardId ? "Сохранить изменения" : "Создать доску"}
                </Button>
                {editingBoardId && (
                  <Button variant="ghost" onClick={handleCancelBoardEdit} disabled={isBoardPending}>
                    Отменить
                  </Button>
                )}
              </div>
            </div>

            <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-base">Что уже готово</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Доски и участники хранятся в отдельных таблицах.</p>
              <p>Списки и карточки стали first-class сущностями, а не `project_columns` / `project_tasks` суррогатами.</p>
              <p>Следующий этап после этого: activity log, comments и richer card timeline.</p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Доски</h2>
          <Badge variant="secondary">{boards.length}</Badge>
        </div>

        {boardsLoading ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Загружаем доски Kanban V2...
            </CardContent>
          </Card>
        ) : boards.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Пока нет досок. Создайте первую доску через форму выше.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {boards.map((board) => {
              const isSelected = board.id === selectedBoardId;
              return (
                <Card
                  key={board.id}
                  className={isSelected ? "h-full border-primary shadow-sm" : "h-full"}
                >
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <CardTitle className="text-base break-words">{board.name}</CardTitle>
                        <CardDescription className="break-words">
                          {board.description || "Описание пока не заполнено"}
                        </CardDescription>
                      </div>
                      <Badge variant={board.visibility === "company" ? "default" : "outline"}>
                        {board.visibility === "company" ? "Вся компания" : "Только участники"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>Компания: {companyById.get(board.companyId)?.name || board.companyId}</p>
                      <p>Роль: {board.membershipRole || (board.isMember ? "участник" : "не назначена")}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={isSelected ? "default" : "secondary"}
                        size="sm"
                        onClick={() => setSelectedBoardId(board.id)}
                      >
                        {isSelected ? "Открыта" : "Открыть доску"}
                      </Button>

                      {board.canManage && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => handleEditBoard(board)}
                            disabled={isBoardPending}
                          >
                            <Pencil className="h-4 w-4" />
                            Редактировать
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="gap-2"
                            onClick={() => deleteBoardMutation.mutate(board.id)}
                            disabled={isBoardPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Удалить
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card className="border-border/70">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>
                {selectedBoard ? `Доска: ${selectedBoard.name}` : "Выберите доску"}
              </CardTitle>
              <CardDescription>
                {selectedBoard
                  ? selectedBoard.description || "У доски пока нет описания."
                  : "Здесь появятся first-class lists выбранной доски."}
              </CardDescription>
            </div>
            {selectedBoard && (
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {canEditSelectedBoard ? "Editor access" : canCommentSelectedBoard ? "Comment access" : "View only"}
                </Badge>
                <Badge variant="secondary">{boardMembers.length} участников</Badge>
                <Badge variant="secondary">{lists.length} списков</Badge>
                <Badge variant="secondary">{filteredCards.length} из {cards.length} карточек</Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedBoard ? (
            <div className="py-8 text-sm text-muted-foreground">
              Выберите доску выше, чтобы управлять ее списками и карточками.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              <div className="space-y-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">Фильтры карточек</CardTitle>
                    <CardDescription>
                      Быстрый поиск и срезы по исполнителю, приоритету, сроку и меткам.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-2 xl:col-span-2">
                      <label className="text-sm font-medium" htmlFor="kanban-filter-search">
                        Поиск
                      </label>
                      <Input
                        id="kanban-filter-search"
                        value={cardFilters.search}
                        onChange={(event) => setCardFilters((prev) => ({ ...prev, search: event.target.value }))}
                        placeholder="Название или описание карточки"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-filter-assignee">
                        Исполнитель
                      </label>
                      <select
                        id="kanban-filter-assignee"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cardFilters.assigneeUserId}
                        onChange={(event) =>
                          setCardFilters((prev) => ({ ...prev, assigneeUserId: event.target.value }))
                        }
                      >
                        <option value="">Все</option>
                        {availableAssignees.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-filter-priority">
                        Приоритет
                      </label>
                      <select
                        id="kanban-filter-priority"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cardFilters.priority}
                        onChange={(event) =>
                          setCardFilters((prev) => ({ ...prev, priority: event.target.value }))
                        }
                      >
                        <option value="all">Все</option>
                        {Object.entries(CARD_PRIORITY_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-filter-due">
                        Срок
                      </label>
                      <select
                        id="kanban-filter-due"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cardFilters.dueStatus}
                        onChange={(event) =>
                          setCardFilters((prev) => ({ ...prev, dueStatus: event.target.value }))
                        }
                      >
                        <option value="all">Все</option>
                        <option value="overdue">Просрочено</option>
                        <option value="soon">Скоро срок</option>
                        <option value="upcoming">Запланировано</option>
                        <option value="complete">Завершено</option>
                        <option value="none">Без срока</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-filter-label">
                        Метка
                      </label>
                      <select
                        id="kanban-filter-label"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cardFilters.labelId}
                        onChange={(event) =>
                          setCardFilters((prev) => ({ ...prev, labelId: event.target.value }))
                        }
                      >
                        <option value="">Все</option>
                        {boardLabels.map((label) => (
                          <option key={label.id} value={label.id}>
                            {label.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2 xl:col-span-5 flex justify-end">
                      <Button variant="ghost" onClick={() => setCardFilters(EMPTY_FILTERS)}>
                        Сбросить фильтры
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {isBoardStructureLoading ? (
                  <Card>
                    <CardContent className="py-8 text-sm text-muted-foreground">
                      Загружаем структуру доски и карточки...
                    </CardContent>
                  </Card>
                ) : lists.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-sm text-muted-foreground">
                      В этой доске пока нет списков. Создайте первый список справа.
                    </CardContent>
                  </Card>
                ) : (
                  <DragDropContext onDragEnd={handleCardDragEnd}>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {lists.map((list, listIndex) => {
                        const listCards = filteredCardsByListId.get(list.id) ?? [];

                        return (
                          <Droppable
                            key={list.id}
                            droppableId={list.id}
                            isDropDisabled={!canEditSelectedBoard || isCardPending}
                          >
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.droppableProps}
                                className={[
                                  "h-full transition-colors",
                                  snapshot.isDraggingOver ? "border-primary/70 bg-primary/5" : "",
                                ].join(" ").trim()}
                              >
                                <CardHeader className="space-y-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1 min-w-0">
                                      <CardTitle className="text-base break-words">{list.name}</CardTitle>
                                      <CardDescription>
                                        Позиция: {Number(list.position) + 1}
                                      </CardDescription>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      {canEditSelectedBoard && (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2"
                                            onClick={() => handleShiftList(list.id, "up")}
                                            disabled={isListPending || listIndex === 0}
                                          >
                                            <ArrowUp className="h-4 w-4" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 px-2"
                                            onClick={() => handleShiftList(list.id, "down")}
                                            disabled={isListPending || listIndex === lists.length - 1}
                                          >
                                            <ArrowDown className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                      <Badge variant="secondary">{listCards.length}</Badge>
                                      <Badge variant={list.type === "active" ? "default" : "outline"}>
                                        {LIST_TYPE_LABELS[list.type]}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                  <div className="text-sm text-muted-foreground space-y-2">
                                    <p>Тип списка: {LIST_TYPE_LABELS[list.type]}</p>
                                    <p className="flex items-center gap-2">
                                      Цвет:
                                      <span
                                        className="inline-block h-3 w-3 rounded-full border border-border"
                                        style={{ backgroundColor: list.color || "transparent" }}
                                      />
                                      <span>{list.color || "Не задан"}</span>
                                    </p>
                                  </div>

                                  <div className="space-y-3 min-h-24">
                                    {listCards.length === 0 && (
                                      <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                                        {canEditSelectedBoard
                                          ? "Перетащите сюда карточку или создайте новую справа."
                                          : "В этом списке пока нет карточек."}
                                      </div>
                                    )}

                                    {listCards.map((card, index) => {
                                      const isCompleteLikeList = list.type === "closed" || list.type === "archive" || list.type === "trash";
                                      const dueDateLabel = formatDueDateLabel(card.dueDate);
                                      const dueDateStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList });
                                      const dueDateStatusClasses = getDueDateStatusClasses(dueDateStatus);
                                      const subtaskProgress = getSubtaskProgress(card.subtasks);
                                      const assigneeName = card.assigneeUserId
                                        ? userById.get(card.assigneeUserId)?.name || card.assigneeUserId
                                        : null;
                                      const cardLabels = normalizeLabelIds(card.labelIds)
                                        .map((labelId) => labelById.get(labelId))
                                        .filter((label): label is KanbanLabelView => Boolean(label));

                                      return (
                                        <Draggable
                                          key={card.id}
                                          draggableId={card.id}
                                          index={index}
                                          isDragDisabled={!canEditSelectedBoard || isCardPending}
                                        >
                                          {(dragProvided, dragSnapshot) => (
                                            <div
                                              ref={dragProvided.innerRef}
                                              {...dragProvided.draggableProps}
                                              className={[
                                                "rounded-lg border bg-muted/20 p-3 space-y-3",
                                                dueDateStatusClasses.card,
                                                dragSnapshot.isDragging
                                                  ? "bg-background shadow-lg ring-1 ring-primary/40"
                                                  : "",
                                              ].join(" ").trim()}
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div className="flex min-w-0 gap-2">
                                                  {canEditSelectedBoard && (
                                                    <button
                                                      type="button"
                                                      aria-label="Переместить карточку"
                                                      className="mt-0.5 shrink-0 cursor-grab rounded-md p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                                                      {...dragProvided.dragHandleProps}
                                                    >
                                                      <GripVertical className="h-4 w-4" />
                                                    </button>
                                                  )}
                                                  <div className="min-w-0 space-y-1">
                                                    <p className="font-medium break-words">{card.title}</p>
                                                    {card.description && (
                                                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                                                        {card.description}
                                                      </p>
                                                    )}
                                                  </div>
                                                </div>
                                                <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[card.priority]}>
                                                  {CARD_PRIORITY_LABELS[card.priority]}
                                                </Badge>
                                              </div>

                                              <div className="flex flex-wrap gap-2">
                                                <Badge variant="outline" className={dueDateStatusClasses.badge}>
                                                  {getDueDateStatusLabel(dueDateStatus)}
                                                </Badge>
                                              </div>

                                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                <span>Порядок: {Number(card.position) + 1}</span>
                                                {assigneeName && <span>Исполнитель: {assigneeName}</span>}
                                                {dueDateLabel && <span>Срок: {dueDateLabel}</span>}
                                                {subtaskProgress.total > 0 && (
                                                  <span>Подзадачи: {subtaskProgress.completed}/{subtaskProgress.total}</span>
                                                )}
                                              </div>

                                              {cardLabels.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                  {cardLabels.map((label) => (
                                                    <Badge
                                                      key={label.id}
                                                      variant="outline"
                                                      className="gap-1 border-transparent"
                                                      style={{
                                                        backgroundColor: label.color || "rgba(148, 163, 184, 0.18)",
                                                        color: "#111827",
                                                      }}
                                                    >
                                                      {label.name}
                                                    </Badge>
                                                  ))}
                                                </div>
                                              )}

                                              {canEditSelectedBoard && (
                                                <div className="flex flex-wrap gap-2">
                                                  <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleOpenCardDetail(card.id)}
                                                    disabled={detailCardLoading && detailCardId === card.id}
                                                  >
                                                    Подробнее
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => handleEditCard(card)}
                                                    disabled={isCardPending}
                                                  >
                                                    <Pencil className="h-4 w-4" />
                                                    Редактировать
                                                  </Button>
                                                  <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="gap-2"
                                                    onClick={() => deleteCardMutation.mutate(card.id)}
                                                    disabled={isCardPending}
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                    Удалить
                                                  </Button>
                                                </div>
                                              )}

                                              {!canEditSelectedBoard && (
                                                <div className="flex flex-wrap gap-2">
                                                  <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleOpenCardDetail(card.id)}
                                                  >
                                                    Подробнее
                                                  </Button>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })}

                                    {provided.placeholder}
                                  </div>

                                  {canEditSelectedBoard && (
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => handleEditList(list)}
                                        disabled={isListPending}
                                      >
                                        <Pencil className="h-4 w-4" />
                                        Редактировать список
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => deleteListMutation.mutate(list.id)}
                                        disabled={isListPending}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Удалить список
                                      </Button>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}
                          </Droppable>
                        );
                      })}
                    </div>
                  </DragDropContext>
                )}
              </div>

              <div className="space-y-4">
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {editingListId ? "Редактировать список" : "Новый список"}
                    </CardTitle>
                    <CardDescription>
                      {canEditSelectedBoard
                        ? "Списки живут отдельно от legacy project columns и теперь содержат first-class cards."
                        : "У вас сейчас только просмотр этой доски."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-list-name">
                        Название списка
                      </label>
                      <Input
                        id="kanban-list-name"
                        value={listForm.name}
                        onChange={(event) => setListForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Например: Бэклог"
                        disabled={!canEditSelectedBoard || isListPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-list-type">
                        Тип
                      </label>
                      <select
                        id="kanban-list-type"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={listForm.type}
                        onChange={(event) =>
                          setListForm((prev) => ({ ...prev, type: event.target.value as KanbanListType }))
                        }
                        disabled={!canEditSelectedBoard || isListPending}
                      >
                        {Object.entries(LIST_TYPE_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-list-color">
                        Цвет
                      </label>
                      <Input
                        id="kanban-list-color"
                        value={listForm.color}
                        onChange={(event) => setListForm((prev) => ({ ...prev, color: event.target.value }))}
                        placeholder="Например: #0f766e"
                        disabled={!canEditSelectedBoard || isListPending}
                      />
                    </div>

                    {canEditSelectedBoard && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="gap-2"
                          onClick={() => saveListMutation.mutate()}
                          disabled={!listForm.name.trim() || isListPending}
                        >
                          <Plus className="h-4 w-4" />
                          {editingListId ? "Сохранить список" : "Создать список"}
                        </Button>
                        {editingListId && (
                          <Button variant="ghost" onClick={handleCancelListEdit} disabled={isListPending}>
                            Отменить
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {editingCardId ? "Редактировать карточку" : "Новая карточка"}
                    </CardTitle>
                    <CardDescription>
                      {canEditSelectedBoard
                        ? hasLists
                          ? "Карточки можно создавать вручную и сразу перетаскивать между списками."
                          : "Сначала создайте хотя бы один список, затем можно будет добавлять карточки."
                        : "У вас сейчас только просмотр этой доски."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-card-list">
                        Список
                      </label>
                      <select
                        id="kanban-card-list"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={cardForm.listId}
                        onChange={(event) => setCardForm((prev) => ({ ...prev, listId: event.target.value }))}
                        disabled={!canEditSelectedBoard || !hasLists || isCardPending}
                      >
                        {!hasLists && <option value="">Нет доступных списков</option>}
                        {lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-card-title">
                        Название карточки
                      </label>
                      <Input
                        id="kanban-card-title"
                        value={cardForm.title}
                        onChange={(event) => setCardForm((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Например: Подготовить релиз"
                        disabled={!canEditSelectedBoard || !hasLists || isCardPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-card-description">
                        Описание
                      </label>
                      <Textarea
                        id="kanban-card-description"
                        value={cardForm.description}
                        onChange={(event) =>
                          setCardForm((prev) => ({ ...prev, description: event.target.value }))
                        }
                        placeholder="Краткий контекст, критерии готовности или детали задачи"
                        rows={4}
                        disabled={!canEditSelectedBoard || !hasLists || isCardPending}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="kanban-card-priority">
                          Приоритет
                        </label>
                        <select
                          id="kanban-card-priority"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={cardForm.priority}
                          onChange={(event) =>
                            setCardForm((prev) => ({
                              ...prev,
                              priority: event.target.value as KanbanCardPriority,
                            }))
                          }
                          disabled={!canEditSelectedBoard || !hasLists || isCardPending}
                        >
                          {Object.entries(CARD_PRIORITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium" htmlFor="kanban-card-assignee">
                          Исполнитель
                        </label>
                        <select
                          id="kanban-card-assignee"
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={cardForm.assigneeUserId}
                          onChange={(event) =>
                            setCardForm((prev) => ({ ...prev, assigneeUserId: event.target.value }))
                          }
                          disabled={!canEditSelectedBoard || !hasLists || isCardPending}
                        >
                          <option value="">Без исполнителя</option>
                          {availableAssignees.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-card-due-date">
                        Срок
                      </label>
                      <Input
                        id="kanban-card-due-date"
                        type="datetime-local"
                        value={cardForm.dueDate}
                        onChange={(event) => setCardForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                        disabled={!canEditSelectedBoard || !hasLists || isCardPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="text-sm font-medium">Метки</label>
                        {boardLabelsLoading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
                      </div>
                      {boardLabels.length === 0 ? (
                        <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                          У этой доски пока нет меток. Ниже справа можно создать первую.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {boardLabels.map((label) => {
                            const selected = cardForm.labelIds.includes(label.id);
                            return (
                              <button
                                key={label.id}
                                type="button"
                                className={[
                                  "rounded-full border px-3 py-1.5 text-sm transition",
                                  selected ? "border-foreground shadow-sm" : "border-border",
                                ].join(" ")}
                                style={{ backgroundColor: label.color || "rgba(148, 163, 184, 0.16)" }}
                                onClick={() => toggleCardFormLabel(label.id)}
                                disabled={!canEditSelectedBoard || !hasLists || isCardPending}
                              >
                                {label.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {availableAssignees.length === 0 && canEditSelectedBoard && (
                      <p className="text-xs text-muted-foreground">
                        Для этой доски пока не найдено активных участников компании, поэтому карточки создаются без исполнителя.
                      </p>
                    )}

                    {canEditSelectedBoard && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="gap-2"
                          onClick={() => saveCardMutation.mutate()}
                          disabled={!hasLists || !cardForm.listId || !cardForm.title.trim() || isCardPending}
                        >
                          <Plus className="h-4 w-4" />
                          {editingCardId ? "Сохранить карточку" : "Создать карточку"}
                        </Button>
                        {editingCardId && (
                          <Button variant="ghost" onClick={handleCancelCardEdit} disabled={isCardPending}>
                            Отменить
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {editingLabelId ? "Редактировать метку" : "Метки доски"}
                    </CardTitle>
                    <CardDescription>
                      {canEditSelectedBoard
                        ? "Создавайте и переиспользуйте метки доски для карточек."
                        : "Доступен только просмотр набора меток этой доски."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-label-name">
                        Название метки
                      </label>
                      <Input
                        id="kanban-label-name"
                        value={labelForm.name}
                        onChange={(event) => setLabelForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="Например: Blocked"
                        disabled={!canEditSelectedBoard || isLabelPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-label-color">
                        Цвет
                      </label>
                      <Input
                        id="kanban-label-color"
                        value={labelForm.color}
                        onChange={(event) => setLabelForm((prev) => ({ ...prev, color: event.target.value }))}
                        placeholder="Например: #f59e0b"
                        disabled={!canEditSelectedBoard || isLabelPending}
                      />
                    </div>

                    {canEditSelectedBoard && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="gap-2"
                          onClick={() => saveLabelMutation.mutate()}
                          disabled={!selectedBoardId || !labelForm.name.trim() || isLabelPending}
                        >
                          <Plus className="h-4 w-4" />
                          {editingLabelId ? "Сохранить метку" : "Создать метку"}
                        </Button>
                        {editingLabelId && (
                          <Button variant="ghost" onClick={handleCancelLabelEdit} disabled={isLabelPending}>
                            Отменить
                          </Button>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      {boardLabels.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          Для этой доски пока нет меток.
                        </div>
                      ) : (
                        boardLabels.map((label) => (
                          <div
                            key={label.id}
                            className="flex items-center justify-between gap-3 rounded-lg border bg-muted/20 px-3 py-2"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <span
                                className="inline-block h-3 w-3 rounded-full border border-border"
                                style={{ backgroundColor: label.color || "transparent" }}
                              />
                              <span className="truncate text-sm font-medium">{label.name}</span>
                              <span className="truncate text-xs text-muted-foreground">
                                {label.color || "без цвета"}
                              </span>
                            </div>
                            {canEditSelectedBoard && (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditLabel(label)}
                                  disabled={isLabelPending}
                                >
                                  Изменить
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteLabelMutation.mutate(label.id)}
                                  disabled={isLabelPending}
                                >
                                  Удалить
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {editingMemberId ? "Редактировать участника" : "Участники доски"}
                    </CardTitle>
                    <CardDescription>
                      {selectedBoard?.canManage
                        ? "Управляйте составом доски и правами viewer/editor/comment."
                        : "Список участников и их текущих прав на доску."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedBoard?.canManage && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium" htmlFor="kanban-member-user">
                            Пользователь
                          </label>
                          <select
                            id="kanban-member-user"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={memberForm.userId}
                            onChange={(event) => setMemberForm((prev) => ({ ...prev, userId: event.target.value }))}
                            disabled={Boolean(editingMemberId) || isMemberPending}
                          >
                            {availableBoardMembers.length === 0 && !editingMemberId && (
                              <option value="">Нет доступных пользователей</option>
                            )}
                            {editingMemberId && <option value={memberForm.userId}>{userById.get(memberForm.userId)?.name || memberForm.userId}</option>}
                            {availableBoardMembers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="kanban-member-role">
                              Роль
                            </label>
                            <select
                              id="kanban-member-role"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={memberForm.role}
                              onChange={(event) =>
                                setMemberForm((prev) => ({
                                  ...prev,
                                  role: event.target.value as "viewer" | "editor",
                                  canComment: event.target.value === "editor" ? true : prev.canComment,
                                }))
                              }
                              disabled={isMemberPending}
                            >
                              <option value="viewer">Viewer</option>
                              <option value="editor">Editor</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="text-sm font-medium" htmlFor="kanban-member-comment">
                              Комментарии
                            </label>
                            <select
                              id="kanban-member-comment"
                              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              value={memberForm.role === "editor" || memberForm.canComment ? "yes" : "no"}
                              onChange={(event) =>
                                setMemberForm((prev) => ({ ...prev, canComment: event.target.value === "yes" }))
                              }
                              disabled={isMemberPending || memberForm.role === "editor"}
                            >
                              <option value="yes">Разрешены</option>
                              <option value="no">Запрещены</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            className="gap-2"
                            onClick={() => saveMemberMutation.mutate()}
                            disabled={(!editingMemberId && !memberForm.userId) || isMemberPending}
                          >
                            <Plus className="h-4 w-4" />
                            {editingMemberId ? "Сохранить участника" : "Добавить участника"}
                          </Button>
                          {editingMemberId && (
                            <Button variant="ghost" onClick={handleCancelMemberEdit} disabled={isMemberPending}>
                              Отменить
                            </Button>
                          )}
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      {boardMembersLoading ? (
                        <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          Загружаем участников доски...
                        </div>
                      ) : boardMembers.length === 0 ? (
                        <div className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">
                          У этой доски пока нет участников.
                        </div>
                      ) : (
                        boardMembers.map((member) => {
                          const user = userById.get(member.userId);
                          return (
                            <div
                              key={member.id}
                              className="space-y-2 rounded-lg border bg-muted/20 px-3 py-3"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{user?.name || member.userId}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {user?.email || user?.username || member.userId}
                                  </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <Badge variant={member.role === "editor" ? "default" : "outline"}>
                                    {member.role}
                                  </Badge>
                                  <Badge variant={member.canComment ? "secondary" : "outline"}>
                                    {member.canComment ? "can comment" : "read only"}
                                  </Badge>
                                </div>
                              </div>
                              {selectedBoard?.canManage && (
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditMember(member)}
                                    disabled={isMemberPending}
                                  >
                                    Изменить
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteMemberMutation.mutate(member.id)}
                                    disabled={isMemberPending || member.userId === selectedBoard.createdByUserId}
                                  >
                                    Удалить
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailCardId} onOpenChange={(open) => !open && handleCloseCardDetail()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {!selectedDetailCard ? (
            <>
              <DialogHeader>
                <DialogTitle>Карточка</DialogTitle>
                <DialogDescription>Загружаем детали карточки...</DialogDescription>
              </DialogHeader>
              <div className="py-8 text-sm text-muted-foreground">Подождите, данные карточки загружаются.</div>
            </>
          ) : (
            <>
              {(() => {
                const isCompleteLikeList =
                  selectedDetailList?.type === "closed" ||
                  selectedDetailList?.type === "archive" ||
                  selectedDetailList?.type === "trash";
                const dueDateStatus = getDueDateStatus(selectedDetailCard.dueDate, { isComplete: isCompleteLikeList });
                const dueDateStatusClasses = getDueDateStatusClasses(dueDateStatus);

                return (
                  <>
              <DialogHeader className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                  <div className="space-y-1">
                    <DialogTitle className="break-words">{selectedDetailCard.title}</DialogTitle>
                    <DialogDescription className="break-words">
                      {selectedDetailCard.description || "У этой карточки пока нет описания."}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[selectedDetailCard.priority]}>
                      {CARD_PRIORITY_LABELS[selectedDetailCard.priority]}
                    </Badge>
                    {selectedDetailList && <Badge variant="outline">{selectedDetailList.name}</Badge>}
                    <Badge variant="outline" className={dueDateStatusClasses.badge}>
                      {getDueDateStatusLabel(dueDateStatus)}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-title">
                      Название карточки
                    </label>
                    <Input
                      id="kanban-detail-title"
                      value={detailCardForm.title}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      disabled={!canEditSelectedBoard || saveCardDetailMutation.isPending}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-list">
                      Список
                    </label>
                    <select
                      id="kanban-detail-list"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={detailCardForm.listId}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({ ...prev, listId: event.target.value }))
                      }
                      disabled={!canEditSelectedBoard || saveCardDetailMutation.isPending}
                    >
                      {lists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="kanban-detail-description">
                    Описание
                  </label>
                  <Textarea
                    id="kanban-detail-description"
                    value={detailCardForm.description}
                    onChange={(event) =>
                      setDetailCardForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    rows={6}
                    disabled={!canEditSelectedBoard || saveCardDetailMutation.isPending}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-priority">
                      Приоритет
                    </label>
                    <select
                      id="kanban-detail-priority"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={detailCardForm.priority}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({
                          ...prev,
                          priority: event.target.value as KanbanCardPriority,
                        }))
                      }
                      disabled={!canEditSelectedBoard || saveCardDetailMutation.isPending}
                    >
                      {Object.entries(CARD_PRIORITY_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-assignee">
                      Исполнитель
                    </label>
                    <select
                      id="kanban-detail-assignee"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={detailCardForm.assigneeUserId}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({ ...prev, assigneeUserId: event.target.value }))
                      }
                      disabled={!canEditSelectedBoard || saveCardDetailMutation.isPending}
                    >
                      <option value="">Без исполнителя</option>
                      {availableAssignees.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-due-date">
                      Срок
                    </label>
                    <Input
                      id="kanban-detail-due-date"
                      type="datetime-local"
                      value={detailCardForm.dueDate}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({ ...prev, dueDate: event.target.value }))
                      }
                      disabled={!canEditSelectedBoard || saveCardDetailMutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium">Метки</label>
                    {boardLabelsLoading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
                  </div>
                  {boardLabels.length === 0 ? (
                    <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                      У этой доски пока нет меток.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {boardLabels.map((label) => {
                        const selected = detailCardForm.labelIds.includes(label.id);
                        return (
                          <button
                            key={label.id}
                            type="button"
                            className={[
                              "rounded-full border px-3 py-1.5 text-sm transition",
                              selected ? "border-foreground shadow-sm" : "border-border",
                            ].join(" ")}
                            style={{ backgroundColor: label.color || "rgba(148, 163, 184, 0.16)" }}
                            onClick={() => toggleDetailCardFormLabel(label.id)}
                            disabled={!canEditSelectedBoard || saveCardDetailMutation.isPending}
                          >
                            {label.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/20 p-4">
                  <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>
                      Подзадачи: {getSubtaskProgress(selectedDetailCard.subtasks).completed}/
                      {getSubtaskProgress(selectedDetailCard.subtasks).total}
                    </p>
                    <p>Создатель: {userById.get(selectedDetailCard.creatorUserId)?.name || selectedDetailCard.creatorUserId}</p>
                    <p>Позиция в списке: {Number(selectedDetailCard.position) + 1}</p>
                    <p>Статус срока: {getDueDateStatusLabel(dueDateStatus)}</p>
                    <p>Срок: {formatDueDateLabel(selectedDetailCard.dueDate) || "Не задан"}</p>
                    <p>Создана: {formatDueDateLabel(selectedDetailCard.createdAt) || "Неизвестно"}</p>
                    <p>Обновлена: {formatDueDateLabel(selectedDetailCard.updatedAt) || "Еще не обновлялась"}</p>
                  </div>
                  {normalizeLabelIds(selectedDetailCard.labelIds).length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {normalizeLabelIds(selectedDetailCard.labelIds).map((labelId) => {
                        const label = labelById.get(labelId);
                        if (!label) return null;
                        return (
                          <Badge
                            key={label.id}
                            variant="outline"
                            className="border-transparent"
                            style={{
                              backgroundColor: label.color || "rgba(148, 163, 184, 0.18)",
                              color: "#111827",
                            }}
                          >
                            {label.name}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      Подзадачи ({getSubtaskProgress(selectedDetailCard.subtasks).completed}/{getSubtaskProgress(selectedDetailCard.subtasks).total})
                    </h3>
                  </div>

                  {normalizeSubtasks(selectedDetailCard.subtasks).length === 0 ? (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                      У этой карточки пока нет подзадач.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {normalizeSubtasks(selectedDetailCard.subtasks).map((subtask) => (
                        <div
                          key={subtask.id}
                          className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2"
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(subtask.completed)}
                            onChange={(event) => {
                              const next = normalizeSubtasks(selectedDetailCard.subtasks).map((item) =>
                                item.id === subtask.id ? { ...item, completed: event.target.checked } : item,
                              );
                              saveCardSubtasksMutation.mutate(next);
                            }}
                            disabled={!canEditSelectedBoard || saveCardSubtasksMutation.isPending}
                          />
                          <span
                            className={[
                              "flex-1 text-sm",
                              subtask.completed ? "line-through text-muted-foreground" : "",
                            ].join(" ")}
                          >
                            {subtask.title}
                          </span>
                          {canEditSelectedBoard && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const next = normalizeSubtasks(selectedDetailCard.subtasks).filter((item) => item.id !== subtask.id);
                                saveCardSubtasksMutation.mutate(next);
                              }}
                              disabled={saveCardSubtasksMutation.isPending}
                            >
                              Удалить
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {canEditSelectedBoard && (
                    <div className="flex gap-2">
                      <Input
                        value={detailSubtaskDraft}
                        onChange={(event) => setDetailSubtaskDraft(event.target.value)}
                        placeholder="Добавить подзадачу"
                        disabled={saveCardSubtasksMutation.isPending}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" || !detailSubtaskDraft.trim()) return;
                          event.preventDefault();
                          const next = [
                            ...normalizeSubtasks(selectedDetailCard.subtasks),
                            {
                              id: `kst-${Date.now()}`,
                              title: detailSubtaskDraft.trim(),
                              completed: false,
                            },
                          ];
                          saveCardSubtasksMutation.mutate(next, {
                            onSuccess: () => setDetailSubtaskDraft(""),
                          });
                        }}
                      />
                      <Button
                        onClick={() => {
                          if (!detailSubtaskDraft.trim()) return;
                          const next = [
                            ...normalizeSubtasks(selectedDetailCard.subtasks),
                            {
                              id: `kst-${Date.now()}`,
                              title: detailSubtaskDraft.trim(),
                              completed: false,
                            },
                          ];
                          saveCardSubtasksMutation.mutate(next, {
                            onSuccess: () => setDetailSubtaskDraft(""),
                          });
                        }}
                        disabled={!detailSubtaskDraft.trim() || saveCardSubtasksMutation.isPending}
                      >
                        Добавить
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Вложения</h3>
                    {detailCardAttachmentsLoading && (
                      <span className="text-xs text-muted-foreground">Загружаем файлы...</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {detailCardAttachments.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        У этой карточки пока нет вложений.
                      </div>
                    ) : (
                      detailCardAttachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-lg border bg-muted/20 p-4">
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
                              <div className="text-xs text-muted-foreground">
                                {formatFileSize(attachment.fileSize)} · {attachment.mimeType || "unknown"} ·{" "}
                                {formatDueDateLabel(attachment.createdAt) || "Неизвестное время"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Загрузил: {userById.get(attachment.uploadedByUserId)?.name || attachment.uploadedByUserId}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button asChild variant="ghost" size="sm">
                                <a href={attachment.fileUrl} target="_blank" rel="noreferrer">
                                  <Download className="h-4 w-4" />
                                </a>
                              </Button>
                              {canEditSelectedBoard && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteCardAttachmentMutation.mutate(attachment.id)}
                                  disabled={deleteCardAttachmentMutation.isPending}
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

                  {canEditSelectedBoard && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-detail-attachment">
                        Загрузить файл
                      </label>
                      <Input
                        id="kanban-detail-attachment"
                        type="file"
                        disabled={uploadCardAttachmentMutation.isPending}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) {
                            uploadCardAttachmentMutation.mutate(file);
                          }
                          event.currentTarget.value = "";
                        }}
                      />
                      <p className="text-xs text-muted-foreground">
                        Поддерживаются любые типы файлов до 25 МБ.
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Activity Log</h3>
                    {detailCardHistoryLoading && (
                      <span className="text-xs text-muted-foreground">Обновляем историю...</span>
                    )}
                  </div>

                  {detailCardHistory.length === 0 ? (
                    <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                      Для этой карточки пока нет записанной истории.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailCardHistory.map((entry) => {
                        const changeLines = getHistoryChangeLines(entry);

                        return (
                          <div key={entry.id} className="rounded-lg border bg-muted/20 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-medium">
                                {userById.get(entry.userId)?.name || entry.userId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {formatDueDateLabel(entry.createdAt) || "Неизвестное время"}
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-muted-foreground">
                              {getKanbanHistoryActionLabel(entry.action)}
                            </p>
                            {changeLines.length > 0 && (
                              <div className="mt-3 space-y-1">
                                {changeLines.map((line, index) => (
                                  <p key={`${entry.id}-${index}`} className="text-sm">
                                    {line}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Комментарии</h3>
                    {detailCardCommentsLoading && (
                      <span className="text-xs text-muted-foreground">Загружаем комментарии...</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {detailCardComments.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        У этой карточки пока нет комментариев.
                      </div>
                    ) : (
                      detailCardComments.map((comment) => (
                        <div key={comment.id} className="rounded-lg border bg-muted/20 p-4 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                              {userById.get(comment.userId)?.name || comment.userId}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {formatDueDateLabel(comment.createdAt) || "Неизвестное время"}
                              </span>
                              {canEditSelectedBoard && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => deleteCardCommentMutation.mutate(comment.id)}
                                  disabled={deleteCardCommentMutation.isPending}
                                >
                                  Удалить
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {canCommentSelectedBoard && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-detail-comment">
                        Новый комментарий
                      </label>
                      <Textarea
                        id="kanban-detail-comment"
                        value={detailCommentDraft}
                        onChange={(event) => setDetailCommentDraft(event.target.value)}
                        placeholder="Добавьте короткий комментарий по карточке"
                        rows={3}
                        disabled={createCardCommentMutation.isPending}
                      />
                      <div className="flex justify-end">
                        <Button
                          onClick={() => createCardCommentMutation.mutate()}
                          disabled={!detailCommentDraft.trim() || createCardCommentMutation.isPending}
                        >
                          Добавить комментарий
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" onClick={handleCloseCardDetail}>
                    Закрыть
                  </Button>
                  {canEditSelectedBoard && (
                    <Button
                      onClick={() => saveCardDetailMutation.mutate()}
                      disabled={!detailCardForm.title.trim() || !detailCardForm.listId || saveCardDetailMutation.isPending}
                    >
                      Сохранить изменения
                    </Button>
                  )}
                </div>
              </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
