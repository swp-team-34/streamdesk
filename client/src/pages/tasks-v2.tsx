import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DraggableStyle, type DropResult } from "@hello-pangea/dnd";
import {
  ArrowDown,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  GripVertical,
  Info,
  Layers3,
  LayoutList,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  Settings2,
  Sparkles,
  Tag,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  type DueDateStatus,
  formatDueDateLabel,
  getDueDateStatus,
  getDueDateStatusClasses,
  getDueDateStatusLabel,
  toDateTimeLocalValue,
} from "@/lib/task-dates";

type BoardVisibility = "personal" | "company" | "members";
type KanbanListType = "active" | "closed" | "archive" | "trash";
type KanbanCardPriority = "low" | "medium" | "high" | "urgent";
type BoardViewMode = "kanban" | "list";
type BoardListGrouping = "none" | "list" | "due" | "assignee" | "priority";
type DetailSaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

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
  companyId?: string | null;
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
  startDate?: string | Date | null;
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
  visibility: "personal" as BoardVisibility,
};

const EMPTY_LIST_FORM = {
  name: "",
  color: "",
  type: "active" as KanbanListType,
};

const LIST_COLOR_PRESETS = [
  { label: "Slate", value: "#64748b" },
  { label: "Blue", value: "#2563eb" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#e11d48" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Indigo", value: "#4f46e5" },
] as const;

const LABEL_COLOR_PRESETS = [
  { label: "Sky", value: "#0ea5e9" },
  { label: "Emerald", value: "#10b981" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Fuchsia", value: "#d946ef" },
  { label: "Indigo", value: "#6366f1" },
  { label: "Slate", value: "#64748b" },
] as const;

const BOARD_VIEW_MODE_STORAGE_KEY = "streamdesk.tasks.v2.viewMode";
const BOARD_LIST_GROUPING_STORAGE_KEY = "streamdesk.tasks.v2.listGrouping";
const DETAIL_AUTOSAVE_DELAY_MS = 700;

const EMPTY_CARD_FORM = {
  listId: "",
  title: "",
  description: "",
  priority: "medium" as KanbanCardPriority,
  startDate: "",
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

const BOARD_VISIBILITY_META: Record<
  BoardVisibility,
  { label: string; hint: string; accent: string; surface: string; icon: typeof UserRound }
> = {
  personal: {
    label: "Личная",
    hint: "Только для тебя, без компании",
    accent: "text-amber-300",
    surface: "border-amber-500/30 bg-amber-500/10",
    icon: UserRound,
  },
  company: {
    label: "Командная",
    hint: "Доступна всей компании",
    accent: "text-sky-300",
    surface: "border-sky-500/30 bg-sky-500/10",
    icon: Building2,
  },
  members: {
    label: "По приглашению",
    hint: "Видят только участники доски",
    accent: "text-emerald-300",
    surface: "border-emerald-500/30 bg-emerald-500/10",
    icon: Users,
  },
};

const KANBAN_PANEL_CARD_CLASS =
  "overflow-hidden border-slate-500/20 bg-[linear-gradient(180deg,rgba(226,232,240,0.62),rgba(148,163,184,0.10))] shadow-sm dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(23,32,51,0.94))] dark:text-slate-100";
const KANBAN_PANEL_HEADER_CLASS =
  "border-b border-slate-500/15 bg-slate-900/[0.03] dark:border-slate-700/70 dark:bg-slate-950/25";
const KANBAN_PANEL_INPUT_CLASS =
  "h-10 rounded-xl border-slate-500/15 bg-slate-50/80 shadow-none focus-visible:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950/75 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-blue-400/25";
const KANBAN_PANEL_SELECT_CLASS =
  "flex h-10 w-full rounded-xl border border-slate-500/15 bg-slate-50/80 px-3 py-2 text-sm shadow-none dark:border-slate-700 dark:bg-slate-950/75 dark:text-slate-100 dark:focus-visible:ring-blue-400/25";
const KANBAN_PANEL_TEXTAREA_CLASS =
  "rounded-2xl border-slate-500/15 bg-slate-50/80 shadow-none focus-visible:ring-slate-400/30 dark:border-slate-700 dark:bg-slate-950/75 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus-visible:ring-blue-400/25";
const KANBAN_DETAIL_SECTION_CLASS =
  "rounded-[22px] border border-slate-500/15 bg-[linear-gradient(180deg,rgba(226,232,240,0.52),rgba(148,163,184,0.08))] p-4 shadow-sm dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.96),rgba(23,32,51,0.9))]";
const KANBAN_BOARD_SOFT_BADGE_CLASS =
  "rounded-full border border-slate-500/20 bg-slate-900/[0.045] px-3 py-1 text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300";
const KANBAN_BOARD_GHOST_BADGE_CLASS =
  "rounded-full border border-slate-500/15 bg-slate-900/[0.04] px-2.5 py-1 text-slate-500 dark:border-slate-700/80 dark:bg-slate-950/50 dark:text-slate-400";
const KANBAN_HERO_STAT_CLASS =
  "rounded-[20px] border border-white/10 bg-white/5 p-4 backdrop-blur-sm";

const toSoftColor = (value?: string | null, alpha = 0.12) => {
  const normalized = String(value || "").trim();
  if (!normalized) return undefined;

  const shortHexMatch = normalized.match(/^#([\da-fA-F]{3})$/);
  if (shortHexMatch) {
    const [r, g, b] = shortHexMatch[1].split("").map((part) => parseInt(part + part, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const fullHexMatch = normalized.match(/^#([\da-fA-F]{6})$/);
  if (fullHexMatch) {
    const hex = fullHexMatch[1];
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return undefined;
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

const serializeCardForm = (form: typeof EMPTY_CARD_FORM) =>
  JSON.stringify({
    listId: form.listId,
    title: form.title.trim(),
    description: form.description.trim(),
    priority: form.priority,
    dueDate: form.dueDate || "",
    assigneeUserId: form.assigneeUserId || "",
    labelIds: normalizeLabelIds(form.labelIds).sort(),
  });

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

const getDraggableCardStyle = (
  style: DraggableStyle | undefined,
  options: { isDragging: boolean; isDropAnimating: boolean },
): CSSProperties | undefined => {
  if (!style) return style;

  return {
    ...(style as CSSProperties),
    transition: options.isDropAnimating
      ? "transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease"
      : "transform 180ms cubic-bezier(0.22, 1, 0.36, 1)",
    willChange: "transform",
  };
};

const stopInteractiveEvent = (event: {
  stopPropagation: () => void;
  preventDefault?: () => void;
}) => {
  event.stopPropagation();
  event.preventDefault?.();
};

const confirmDelete = (message: string) =>
  typeof window !== "undefined" && window.confirm(message);

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

interface SaveListInput {
  listId?: string | null;
  name?: string;
  color?: string | null;
  type?: KanbanListType;
  closeInline?: boolean;
}

interface SaveCardInput {
  cardId?: string | null;
  listId?: string;
  title?: string;
  description?: string | null;
  priority?: KanbanCardPriority;
  startDate?: string | null;
  dueDate?: string | null;
  assigneeUserId?: string | null;
  labelIds?: string[];
  inlineListId?: string;
}

interface SaveLabelInput {
  labelId?: string | null;
  name?: string;
  color?: string | null;
  attachToDetail?: boolean;
}

interface SaveCardDetailInput {
  form?: typeof EMPTY_CARD_FORM;
  silent?: boolean;
  closeAfter?: boolean;
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
  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(window.localStorage.getItem("streamstudio_user") || "null");
    } catch {
      return null;
    }
  }, []);
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
  const [boardViewMode, setBoardViewMode] = useState<BoardViewMode>(() => {
    if (typeof window === "undefined") return "kanban";
    const stored = window.localStorage.getItem(BOARD_VIEW_MODE_STORAGE_KEY);
    return stored === "list" ? "list" : "kanban";
  });
  const [listGrouping, setListGrouping] = useState<BoardListGrouping>(() => {
    if (typeof window === "undefined") return "list";
    const stored = window.localStorage.getItem(BOARD_LIST_GROUPING_STORAGE_KEY);
    return stored === "none" || stored === "list" || stored === "due" || stored === "assignee" || stored === "priority"
      ? stored
      : "list";
  });
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [inlineListOpen, setInlineListOpen] = useState(false);
  const [inlineListTitle, setInlineListTitle] = useState("");
  const [inlineCardListId, setInlineCardListId] = useState<string | null>(null);
  const [inlineCardTitle, setInlineCardTitle] = useState("");
  const [inlineEditingCardId, setInlineEditingCardId] = useState<string | null>(null);
  const [inlineEditingCardTitle, setInlineEditingCardTitle] = useState("");
  const [detailLabelQuery, setDetailLabelQuery] = useState("");
  const [detailSaveStatus, setDetailSaveStatus] = useState<DetailSaveStatus>("idle");
  const [detailSaveError, setDetailSaveError] = useState("");
  const [settingsLabelDraft, setSettingsLabelDraft] = useState("");
  const [editingSettingsLabelId, setEditingSettingsLabelId] = useState<string | null>(null);
  const [editingSettingsLabelName, setEditingSettingsLabelName] = useState("");
  const [listViewDraftTitle, setListViewDraftTitle] = useState("");
  const [listViewDraftListId, setListViewDraftListId] = useState("");
  const detailAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailLastSavedSignatureRef = useRef("");

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
  const isSelectedBoardPersonal = !selectedBoard?.companyId;
  const selectedDetailCard = detailCardData ?? selectedDetailCardSummary ?? null;
  const selectedDetailList = useMemo(
    () => lists.find((list) => list.id === selectedDetailCard?.listId) ?? null,
    [lists, selectedDetailCard?.listId],
  );
  const availableAssignees = useMemo(() => {
    if (!selectedBoard) return [];

    if (!selectedBoard.companyId) {
      return users.filter((user) => String(user.id) === String(currentUser?.id || ""));
    }

    if (!selectedCompanyItem) {
      return users.filter((user) => user.active !== false);
    }

    const activeMemberIds = new Set(
      selectedCompanyItem.members
        .filter((member) => member.status === "active")
        .map((member) => String(member.userId)),
    );

    return users.filter((user) => activeMemberIds.has(String(user.id)) && user.active !== false);
  }, [currentUser?.id, selectedBoard, selectedCompanyItem, users]);
  const availableBoardMembers = useMemo(() => {
    if (!selectedBoard?.companyId || !selectedCompanyItem) return [];
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
  }, [boardMembers, selectedBoard?.companyId, selectedCompanyItem, users]);
  const personalBoards = useMemo(() => boards.filter((board) => !board.companyId), [boards]);
  const sharedBoards = useMemo(() => boards.filter((board) => Boolean(board.companyId)), [boards]);
  const overdueCardsCount = useMemo(
    () => cards.filter((card) => getDueDateStatus(card.dueDate) === "overdue").length,
    [cards],
  );
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

  const matchingDetailLabels = useMemo(() => {
    const query = detailLabelQuery.trim().toLowerCase();
    return boardLabels.filter((label) => {
      if (detailCardForm.labelIds.includes(label.id)) return false;
      if (!query) return true;
      return label.name.toLowerCase().includes(query);
    });
  }, [boardLabels, detailCardForm.labelIds, detailLabelQuery]);

  const detailLabelExactMatch = useMemo(() => {
    const query = detailLabelQuery.trim().toLowerCase();
    if (!query) return null;
    return boardLabels.find((label) => label.name.toLowerCase() === query) ?? null;
  }, [boardLabels, detailLabelQuery]);

  const listViewGroups = useMemo(() => {
    const groups = new Map<string, { id: string; title: string; cards: KanbanCardView[]; droppableListId?: string }>();
    const addCard = (id: string, title: string, card: KanbanCardView, droppableListId?: string) => {
      const group = groups.get(id) ?? { id, title, cards: [], droppableListId };
      group.cards.push(card);
      groups.set(id, group);
    };

    for (const card of filteredCards) {
      if (listGrouping === "none") {
        addCard("all", "Все задачи", card);
        continue;
      }

      if (listGrouping === "list") {
        const list = lists.find((item) => item.id === card.listId);
        addCard(card.listId || "no-list", list?.name || "Без списка", card, card.listId || undefined);
        continue;
      }

      if (listGrouping === "due") {
        const list = lists.find((item) => item.id === card.listId);
        const isCompleteLikeList = list?.type === "closed" || list?.type === "archive" || list?.type === "trash";
        const dueStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList });
        addCard(dueStatus, getDueDateStatusLabel(dueStatus), card);
        continue;
      }

      if (listGrouping === "assignee") {
        const assigneeId = card.assigneeUserId || "unassigned";
        addCard(assigneeId, card.assigneeUserId ? userById.get(card.assigneeUserId)?.name || card.assigneeUserId : "Без исполнителя", card);
        continue;
      }

      addCard(card.priority, CARD_PRIORITY_LABELS[card.priority], card);
    }

    if (listGrouping === "list") {
      for (const list of lists) {
        if (!groups.has(list.id)) {
          groups.set(list.id, { id: list.id, title: list.name, cards: [], droppableListId: list.id });
        }
      }
    }

    return Array.from(groups.values());
  }, [filteredCards, listGrouping, lists, userById]);

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
        [String(oldValue?.startDate || "") !== String(newValue?.startDate || "") && newValue?.startDate !== undefined, `Старт: ${formatDueDateLabel(oldValue?.startDate as string | Date | null) || "Не задан"} -> ${formatDueDateLabel(newValue?.startDate as string | Date | null) || "Не задан"}`],
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
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BOARD_VIEW_MODE_STORAGE_KEY, boardViewMode);
  }, [boardViewMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(BOARD_LIST_GROUPING_STORAGE_KEY, listGrouping);
  }, [listGrouping]);

  useEffect(() => {
    if (
      !editingBoardId &&
      boardForm.visibility !== "personal" &&
      !boardForm.companyId &&
      companies[0]?.id
    ) {
      setBoardForm((prev) => ({ ...prev, companyId: companies[0].id }));
    }
  }, [boardForm.companyId, boardForm.visibility, companies, editingBoardId]);

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
    setDetailSaveStatus("idle");
    setDetailSaveError("");
    detailLastSavedSignatureRef.current = "";
    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }
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
    setListViewDraftListId((prev) => (lists.some((list) => list.id === prev) ? prev : lists[0]?.id || ""));
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

    const nextForm = {
      listId: selectedDetailCard.listId,
      title: selectedDetailCard.title,
      description: selectedDetailCard.description || "",
      priority: selectedDetailCard.priority,
      startDate: toDateTimeLocalValue(selectedDetailCard.startDate),
      dueDate: toDateTimeLocalValue(selectedDetailCard.dueDate),
      assigneeUserId: selectedDetailCard.assigneeUserId || "",
      labelIds: normalizeLabelIds(selectedDetailCard.labelIds),
    };
    setDetailCardForm(nextForm);
    detailLastSavedSignatureRef.current = serializeCardForm(nextForm);
    setDetailSaveStatus("saved");
    setDetailSaveError("");
  }, [detailCardId, selectedDetailCard]);

  useEffect(() => {
    if (!detailCardId) return;
    if (cards.some((card) => card.id === detailCardId)) return;
    if (cardsLoading) return;
    if (detailCardLoading) return;

    setDetailCardId(null);
    setDetailCardForm(EMPTY_CARD_FORM);
  }, [cards, cardsLoading, detailCardId, detailCardLoading]);

  const saveBoardMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyId: boardForm.visibility === "personal" ? null : boardForm.companyId || null,
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
        companyId: prev.visibility === "personal" ? "" : prev.companyId || companies[0]?.id || "",
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
          companyId: prev.visibility === "personal" ? "" : prev.companyId || companies[0]?.id || "",
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
    mutationFn: async (input?: SaveListInput) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");

      const targetListId = input?.listId ?? editingListId;
      const payload = {
        name: (input?.name ?? listForm.name).trim(),
        color: input?.color !== undefined ? (input.color?.trim() || null) : (listForm.color.trim() || null),
        type: input?.type ?? listForm.type,
      };

      if (targetListId) {
        const res = await apiRequest(
          "PUT",
          `/api/kanban/boards/${selectedBoardId}/lists/${targetListId}`,
          payload,
        );
        return await res.json();
      }

      const res = await apiRequest("POST", `/api/kanban/boards/${selectedBoardId}/lists`, payload);
      return await res.json();
    },
    onSuccess: (_list, input) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-lists", selectedBoardId] });
      toast({
        title: (input?.listId ?? editingListId) ? "Список обновлен" : "Список создан",
        description: "Список сохранен в текущей доске.",
      });
      setEditingListId(null);
      setListForm(EMPTY_LIST_FORM);
      if (input?.closeInline) {
        setInlineListOpen(false);
        setInlineListTitle("");
      }
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
    mutationFn: async (input?: SaveCardInput) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      const targetCardId = input?.cardId ?? editingCardId;
      const targetListId = input?.listId ?? cardForm.listId;
      if (!targetListId) throw new Error("Сначала выберите список");

      const payload = {
        listId: targetListId,
        title: (input?.title ?? cardForm.title).trim(),
        description: input?.description !== undefined ? input.description : (cardForm.description.trim() || null),
        priority: input?.priority ?? cardForm.priority,
        startDate: input?.startDate !== undefined ? input.startDate : (cardForm.startDate || null),
        dueDate: input?.dueDate !== undefined ? input.dueDate : (cardForm.dueDate || null),
        assigneeUserId: input?.assigneeUserId !== undefined ? input.assigneeUserId : (cardForm.assigneeUserId || null),
        labelIds: normalizeLabelIds(input?.labelIds ?? cardForm.labelIds),
      };

      if (targetCardId) {
        const res = await apiRequest(
          "PUT",
          `/api/kanban/boards/${selectedBoardId}/cards/${targetCardId}`,
          payload,
        );
        return await res.json();
      }

      const res = await apiRequest("POST", `/api/kanban/boards/${selectedBoardId}/cards`, payload);
      return await res.json();
    },
    onSuccess: (card: KanbanCardView, input) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      toast({
        title: (input?.cardId ?? editingCardId) ? "Карточка обновлена" : "Карточка создана",
        description: "Карточка сохранена в текущем списке.",
      });
      setEditingCardId(null);
      setCardForm({
        ...EMPTY_CARD_FORM,
        listId: card.listId || lists[0]?.id || "",
      });
      if (input?.inlineListId) {
        setInlineCardListId(null);
        setInlineCardTitle("");
      }
      if (input?.cardId) {
        setInlineEditingCardId(null);
        setInlineEditingCardTitle("");
      }
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
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
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
    mutationFn: async (input?: SaveCardDetailInput) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      if (!detailCardId) throw new Error("Сначала выберите карточку");
      const form = input?.form ?? detailCardForm;
      if (!form.listId) throw new Error("Сначала выберите список");
      if (!form.title.trim()) throw new Error("Название карточки не может быть пустым");

      const res = await apiRequest(
        "PUT",
        `/api/kanban/boards/${selectedBoardId}/cards/${detailCardId}`,
        {
          listId: form.listId,
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          startDate: form.startDate || null,
          dueDate: form.dueDate || null,
          assigneeUserId: form.assigneeUserId || null,
          labelIds: normalizeLabelIds(form.labelIds),
        },
      );
      return await res.json();
    },
    onMutate: (input) => {
      if (input?.silent) setDetailSaveStatus("saving");
    },
    onSuccess: (card: KanbanCardView, input) => {
      queryClient.setQueryData(["kanban-card", selectedBoardId, card.id], card);
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card", selectedBoardId, card.id] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card-history", selectedBoardId, card.id] });
      detailLastSavedSignatureRef.current = serializeCardForm(input?.form ?? {
        listId: card.listId,
        title: card.title,
        description: card.description || "",
        priority: card.priority,
        startDate: toDateTimeLocalValue(card.startDate),
        dueDate: toDateTimeLocalValue(card.dueDate),
        assigneeUserId: card.assigneeUserId || "",
        labelIds: normalizeLabelIds(card.labelIds),
      });
      setDetailSaveStatus("saved");
      setDetailSaveError("");

      if (editingCardId === card.id) {
        setCardForm({
          listId: card.listId,
          title: card.title,
          description: card.description || "",
          priority: card.priority,
          startDate: toDateTimeLocalValue(card.startDate),
          dueDate: toDateTimeLocalValue(card.dueDate),
          assigneeUserId: card.assigneeUserId || "",
          labelIds: normalizeLabelIds(card.labelIds),
        });
      }

      if (!input?.silent) {
        toast({
          title: "Карточка обновлена",
          description: "Изменения сохранены.",
        });
      }
      if (input?.closeAfter) {
        setDetailCardId(null);
        setDetailCardForm(EMPTY_CARD_FORM);
        setDetailSaveStatus("idle");
      }
    },
    onError: (error: Error) => {
      setDetailSaveStatus("error");
      setDetailSaveError(error.message);
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
      await queryClient.cancelQueries({ queryKey: ["kanban-card", movement.boardId, movement.cardId] });

      const previousCards = queryClient.getQueryData<KanbanCardView[]>([
        "kanban-cards",
        movement.boardId,
      ]) ?? [];
      const previousCard = previousCards.find((card) => card.id === movement.cardId) ?? null;
      const previousDetailCard =
        queryClient.getQueryData<KanbanCardView>(["kanban-card", movement.boardId, movement.cardId]) ?? null;

      queryClient.setQueryData<KanbanCardView[]>(
        ["kanban-cards", movement.boardId],
        moveKanbanCards(previousCards, movement),
      );
      queryClient.setQueryData<KanbanCardView | undefined>(
        ["kanban-card", movement.boardId, movement.cardId],
        (current) =>
          current
            ? {
                ...current,
                listId: movement.targetListId,
                position: movement.targetPosition,
              }
            : current,
      );

      if (editingCardId === movement.cardId) {
        setCardForm((prev) => ({ ...prev, listId: movement.targetListId }));
      }

      if (detailCardId === movement.cardId) {
        setDetailCardForm((prev) => ({ ...prev, listId: movement.targetListId }));
      }

      return { previousCards, previousCard, previousDetailCard };
    },
    onError: (error: Error, movement, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(["kanban-cards", movement.boardId], context.previousCards);
      }
      if (context?.previousDetailCard) {
        queryClient.setQueryData(
          ["kanban-card", movement.boardId, movement.cardId],
          context.previousDetailCard,
        );
      }

      if (editingCardId === movement.cardId && context?.previousCard) {
        setCardForm((prev) => ({ ...prev, listId: context.previousCard?.listId || prev.listId }));
      }
      if (detailCardId === movement.cardId && context?.previousCard) {
        setDetailCardForm((prev) => ({ ...prev, listId: context.previousCard?.listId || prev.listId }));
      }

      toast({
        title: "Не удалось переместить карточку",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_movedCard, _error, movement) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-cards", movement.boardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/cards"] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card", movement.boardId, movement.cardId] });
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
    mutationFn: async (input?: SaveLabelInput) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");

      const targetLabelId = input?.labelId ?? editingLabelId;
      const payload = {
        name: (input?.name ?? labelForm.name).trim(),
        color: input?.color !== undefined ? (input.color?.trim() || null) : (labelForm.color.trim() || null),
      };

      if (targetLabelId) {
        const res = await apiRequest(
          "PUT",
          `/api/kanban/boards/${selectedBoardId}/labels/${targetLabelId}`,
          payload,
        );
        return await res.json();
      }

      const res = await apiRequest("POST", `/api/kanban/boards/${selectedBoardId}/labels`, payload);
      return await res.json();
    },
    onSuccess: (label: KanbanLabelView, input) => {
      queryClient.invalidateQueries({ queryKey: ["kanban-labels", selectedBoardId] });
      if (input?.attachToDetail) {
        setDetailCardForm((prev) => ({
          ...prev,
          labelIds: prev.labelIds.includes(label.id) ? prev.labelIds : [...prev.labelIds, label.id],
        }));
        setDetailLabelQuery("");
      }
      toast({
        title: (input?.labelId ?? editingLabelId) ? "Метка обновлена" : "Метка создана",
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
      companyId: board.companyId || "",
      name: board.name,
      description: board.description || "",
      visibility: board.visibility,
    });
  };

  const handleCancelBoardEdit = () => {
    setEditingBoardId(null);
    setBoardForm((prev) => ({
      ...EMPTY_BOARD_FORM,
      companyId: prev.visibility === "personal" ? "" : prev.companyId || companies[0]?.id || "",
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
      startDate: toDateTimeLocalValue(card.startDate),
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
    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }

    const currentSignature = serializeCardForm(detailCardForm);
    const hasPendingChanges =
      detailCardId &&
      canEditSelectedBoard &&
      currentSignature !== detailLastSavedSignatureRef.current &&
      detailCardForm.title.trim() &&
      detailCardForm.listId;

    if (hasPendingChanges) {
      saveCardDetailMutation.mutate({
        form: detailCardForm,
        silent: true,
        closeAfter: true,
      });
      return;
    }

    setDetailCardId(null);
    setDetailCardForm(EMPTY_CARD_FORM);
    setDetailCommentDraft("");
    setDetailSubtaskDraft("");
    setDetailSaveStatus("idle");
    setDetailSaveError("");
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

  const handleSubmitInlineList = () => {
    const name = inlineListTitle.trim();
    if (!name || !canEditSelectedBoard || saveListMutation.isPending) return;
    saveListMutation.mutate({
      name,
      color: null,
      type: "active",
      closeInline: true,
    });
  };

  const handleCancelInlineList = () => {
    setInlineListOpen(false);
    setInlineListTitle("");
  };

  const handleSubmitInlineCard = (listId: string) => {
    const title = inlineCardTitle.trim();
    if (!title || !canEditSelectedBoard || saveCardMutation.isPending) return;
      saveCardMutation.mutate({
        listId,
        title,
        description: null,
        priority: "medium",
        startDate: null,
        dueDate: null,
        assigneeUserId: null,
        labelIds: [],
      inlineListId: listId,
    });
  };

  const handleCancelInlineCard = () => {
    setInlineCardListId(null);
    setInlineCardTitle("");
  };

  const handleBeginInlineCardTitleEdit = (card: KanbanCardView) => {
    if (!canEditSelectedBoard || isCardPending) return;
    setInlineEditingCardId(card.id);
    setInlineEditingCardTitle(card.title);
  };

  const handleCommitInlineCardTitleEdit = (card: KanbanCardView) => {
    const nextTitle = inlineEditingCardTitle.trim();
    if (!nextTitle || nextTitle === card.title) {
      setInlineEditingCardId(null);
      setInlineEditingCardTitle("");
      return;
    }

    saveCardMutation.mutate({
      cardId: card.id,
      listId: card.listId,
      title: nextTitle,
      description: card.description || null,
      priority: card.priority,
      startDate: card.startDate ? toDateTimeLocalValue(card.startDate) : null,
      dueDate: card.dueDate ? toDateTimeLocalValue(card.dueDate) : null,
      assigneeUserId: card.assigneeUserId || null,
      labelIds: normalizeLabelIds(card.labelIds),
    });
  };

  const handleCancelInlineCardTitleEdit = () => {
    setInlineEditingCardId(null);
    setInlineEditingCardTitle("");
  };

  const handleAttachDetailLabel = (labelId: string) => {
    setDetailCardForm((prev) => ({
      ...prev,
      labelIds: prev.labelIds.includes(labelId) ? prev.labelIds : [...prev.labelIds, labelId],
    }));
    setDetailLabelQuery("");
  };

  const handleRemoveDetailLabel = (labelId: string) => {
    setDetailCardForm((prev) => ({
      ...prev,
      labelIds: prev.labelIds.filter((value) => value !== labelId),
    }));
  };

  const handleCreateDetailLabel = () => {
    const name = detailLabelQuery.trim();
    if (!name || saveLabelMutation.isPending) return;
    const color = LABEL_COLOR_PRESETS[boardLabels.length % LABEL_COLOR_PRESETS.length].value;
    saveLabelMutation.mutate({ name, color, attachToDetail: true });
  };

  const handleCreateSettingsLabel = () => {
    const name = settingsLabelDraft.trim();
    if (!name || saveLabelMutation.isPending) return;
    const color = LABEL_COLOR_PRESETS[boardLabels.length % LABEL_COLOR_PRESETS.length].value;
    saveLabelMutation.mutate(
      { name, color },
      { onSuccess: () => setSettingsLabelDraft("") },
    );
  };

  const handleBeginSettingsLabelEdit = (label: KanbanLabelView) => {
    setEditingSettingsLabelId(label.id);
    setEditingSettingsLabelName(label.name);
  };

  const handleCancelSettingsLabelEdit = () => {
    setEditingSettingsLabelId(null);
    setEditingSettingsLabelName("");
  };

  const handleCommitSettingsLabelEdit = (label: KanbanLabelView) => {
    const name = editingSettingsLabelName.trim();
    if (!name || name === label.name) {
      handleCancelSettingsLabelEdit();
      return;
    }
    saveLabelMutation.mutate(
      { labelId: label.id, name, color: label.color || null },
      { onSuccess: handleCancelSettingsLabelEdit },
    );
  };

  const handleSubmitListViewCard = () => {
    const title = listViewDraftTitle.trim();
    const listId = listViewDraftListId || lists[0]?.id || "";
    if (!title || !listId || !canEditSelectedBoard || saveCardMutation.isPending) return;
    saveCardMutation.mutate(
      {
        listId,
        title,
        description: null,
        priority: "medium",
        startDate: null,
        dueDate: null,
        assigneeUserId: null,
        labelIds: [],
      },
      {
        onSuccess: () => setListViewDraftTitle(""),
      },
    );
  };

  const handleBoardDragEnd = (result: DropResult) => {
    if (!selectedBoardId || !canEditSelectedBoard || isCardPending) return;

    const { destination, source, draggableId, type } = result;
    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "LIST") {
      if (moveListMutation.isPending) return;
      const sourceIndex = source.index;
      const destinationIndex = destination.index;
      const reorderedIds = lists.map((list) => list.id);
      const [movedId] = reorderedIds.splice(sourceIndex, 1);
      if (!movedId) return;
      reorderedIds.splice(destinationIndex, 0, movedId);
      moveListMutation.mutate({
        boardId: selectedBoardId,
        listIds: reorderedIds,
      });
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

  const renderListViewCardRow = (card: KanbanCardView) => {
    const list = lists.find((item) => item.id === card.listId);
    const assigneeName = card.assigneeUserId ? userById.get(card.assigneeUserId)?.name || card.assigneeUserId : "Без исполнителя";
    const dueDateStatus = getDueDateStatus(card.dueDate, {
      isComplete: list?.type === "closed" || list?.type === "archive" || list?.type === "trash",
    });
    const cardLabels = normalizeLabelIds(card.labelIds)
      .map((labelId) => labelById.get(labelId))
      .filter((label): label is KanbanLabelView => Boolean(label));

    return (
      <div className="grid gap-3 rounded-2xl border border-slate-500/15 bg-slate-900/[0.03] px-4 py-3 text-sm dark:border-slate-700/80 dark:bg-slate-950/40 md:grid-cols-[minmax(220px,1.7fr)_160px_130px_160px_150px_auto]">
        <div className="min-w-0">
          {inlineEditingCardId === card.id ? (
            <Input
              value={inlineEditingCardTitle}
              onChange={(event) => setInlineEditingCardTitle(event.target.value)}
              autoFocus
              className={KANBAN_PANEL_INPUT_CLASS}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  handleCancelInlineCardTitleEdit();
                }
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleCommitInlineCardTitleEdit(card);
                }
              }}
              onBlur={() => handleCommitInlineCardTitleEdit(card)}
              disabled={saveCardMutation.isPending}
            />
          ) : (
            <button
              type="button"
              className="block max-w-full truncate text-left font-medium text-slate-900 hover:underline dark:text-slate-100"
              title={canEditSelectedBoard ? "Двойной клик для переименования" : card.title}
              onDoubleClick={() => handleBeginInlineCardTitleEdit(card)}
            >
              {card.title}
            </button>
          )}
          {card.description && <div className="mt-1 truncate text-xs text-muted-foreground">{card.description}</div>}
        </div>
        <select
          className={KANBAN_PANEL_SELECT_CLASS}
          value={card.listId}
          onChange={(event) => {
            if (!selectedBoardId) return;
            moveCardMutation.mutate({
              boardId: selectedBoardId,
              cardId: card.id,
              targetListId: event.target.value,
              targetPosition: 0,
            });
          }}
          disabled={!canEditSelectedBoard || moveCardMutation.isPending}
        >
          {lists.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[card.priority]} className="w-fit rounded-full">
          {CARD_PRIORITY_LABELS[card.priority]}
        </Badge>
        <span className="truncate text-muted-foreground">{assigneeName}</span>
        <Badge variant="outline" className="w-fit rounded-full">
          {getDueDateStatusLabel(dueDateStatus)}
        </Badge>
        <div className="flex items-center justify-end gap-1">
          {cardLabels.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: label.color || "rgba(148, 163, 184, 0.5)" }}
              title={label.name}
            />
          ))}
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => handleOpenCardDetail(card.id)}>
            <Info className="h-4 w-4" />
          </Button>
          {canEditSelectedBoard && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
              onClick={() => {
                if (!confirmDelete(`Удалить карточку "${card.title}"? Это действие нельзя отменить.`)) return;
                deleteCardMutation.mutate(card.id);
              }}
              disabled={deleteCardMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
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

  useEffect(() => {
    if (!detailCardId || !selectedDetailCard || !canEditSelectedBoard) return;
    if (saveCardDetailMutation.isPending) return;

    const currentSignature = serializeCardForm(detailCardForm);
    const lastSavedSignature = detailLastSavedSignatureRef.current;

    if (currentSignature === lastSavedSignature) {
      if (detailSaveStatus === "dirty") setDetailSaveStatus("saved");
      return;
    }

    if (!detailCardForm.title.trim() || !detailCardForm.listId) {
      setDetailSaveStatus("dirty");
      return;
    }

    setDetailSaveStatus("dirty");
    setDetailSaveError("");

    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
    }

    const formSnapshot = { ...detailCardForm, labelIds: [...detailCardForm.labelIds] };
    detailAutosaveTimerRef.current = setTimeout(() => {
      saveCardDetailMutation.mutate({ form: formSnapshot, silent: true });
      detailAutosaveTimerRef.current = null;
    }, DETAIL_AUTOSAVE_DELAY_MS);

    return () => {
      if (detailAutosaveTimerRef.current) {
        clearTimeout(detailAutosaveTimerRef.current);
        detailAutosaveTimerRef.current = null;
      }
    };
  }, [
    canEditSelectedBoard,
    detailCardForm,
    detailCardId,
    detailSaveStatus,
    selectedDetailCard,
  ]);

  return (
    <div className="mx-auto max-w-[1520px] space-y-6 p-4 [--kanban-card-end:rgba(148,163,184,0.26)] [--kanban-card-start:rgba(226,232,240,0.78)] [--kanban-drag-card-start:rgba(226,232,240,0.94)] [--kanban-lane-empty:rgba(15,23,42,0.05)] [--kanban-lane-fallback:rgba(100,116,139,0.16)] [--kanban-list-end:rgba(148,163,184,0.32)] [--kanban-list-header:rgba(226,232,240,0.72)] [--kanban-list-over-end:rgba(148,163,184,0.42)] [--kanban-list-over-start:rgba(226,232,240,0.84)] [--kanban-list-start:rgba(226,232,240,0.68)] dark:[--kanban-card-end:rgba(30,41,59,0.88)] dark:[--kanban-card-start:rgba(27,38,56,0.98)] dark:[--kanban-drag-card-start:rgba(30,41,59,0.98)] dark:[--kanban-lane-empty:rgba(15,23,42,0.72)] dark:[--kanban-lane-fallback:rgba(15,23,42,0.62)] dark:[--kanban-list-end:rgba(23,32,51,0.94)] dark:[--kanban-list-header:rgba(23,32,51,0.9)] dark:[--kanban-list-over-end:rgba(30,41,59,0.98)] dark:[--kanban-list-over-start:rgba(23,32,51,0.98)] dark:[--kanban-list-start:rgba(17,24,39,0.98)] sm:p-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.22),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_32%),linear-gradient(135deg,_#111827_0%,_#0f172a_45%,_#111827_100%)] text-white shadow-2xl shadow-slate-950/30 dark:border-slate-700/80 dark:bg-[radial-gradient(circle_at_top_left,_rgba(124,156,255,0.16),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_34%),linear-gradient(135deg,_#0b1020_0%,_#111827_52%,_#0b1020_100%)]">
        <div className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_420px] lg:p-8">
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Focus Workspace
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Streamdesk Boards</h1>
                  <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    Быстрый, спокойный workspace в духе TickTick: личные доски без лишней бюрократии, командные
                    пространства для совместной работы и понятный фокус на текущем потоке задач.
                  </p>
                </div>
              </div>
              <Link href="/tasks-legacy">
                <Button variant="outline" className="gap-2 border-white/15 bg-white/5 text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4" />
                  Legacy Tasks
                </Button>
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <Layers3 className="h-4 w-4" />
                  Всего досок
                </div>
                <p className="mt-3 text-3xl font-semibold">{boards.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <UserRound className="h-4 w-4" />
                  Личных
                </div>
                <p className="mt-3 text-3xl font-semibold">{personalBoards.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-2 text-slate-300">
                  <Clock3 className="h-4 w-4" />
                  Просрочено
                </div>
                <p className="mt-3 text-3xl font-semibold">{overdueCardsCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-slate-950/55 p-5 backdrop-blur">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{editingBoardId ? "Редактировать доску" : "Новая доска"}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Личная доска создается мгновенно. Компания нужна только для командного режима.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-2 sm:grid-cols-3">
                {(["personal", "company", "members"] as BoardVisibility[]).map((value) => {
                  const meta = BOARD_VISIBILITY_META[value];
                  const Icon = meta.icon;
                  const selected = boardForm.visibility === value;
                  const disabled = (value === "company" || value === "members") && companies.length === 0;
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={disabled || isBoardPending}
                      onClick={() =>
                        setBoardForm((prev) => ({
                          ...prev,
                          visibility: value,
                          companyId: value === "personal" ? "" : prev.companyId || companies[0]?.id || "",
                        }))
                      }
                      className={[
                        "rounded-2xl border px-3 py-3 text-left transition",
                        selected ? "border-white/30 bg-white/12" : "border-white/10 bg-white/5 hover:bg-white/8",
                        disabled ? "cursor-not-allowed opacity-40" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="h-4 w-4" />
                        {meta.label}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">{meta.hint}</p>
                    </button>
                  );
                })}
              </div>

              {boardForm.visibility !== "personal" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-200" htmlFor="kanban-company">
                    Компания
                  </label>
                  <select
                    id="kanban-company"
                    className="flex h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
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
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="kanban-name">
                  Название доски
                </label>
                <Input
                  id="kanban-name"
                  value={boardForm.name}
                  onChange={(event) => setBoardForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Например: Personal Focus или Product Sprint"
                  disabled={isBoardPending}
                  className="h-11 rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-200" htmlFor="kanban-description">
                  Описание
                </label>
                <Textarea
                  id="kanban-description"
                  value={boardForm.description}
                  onChange={(event) => setBoardForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Что будет жить на этой доске и зачем она тебе или команде"
                  rows={4}
                  disabled={isBoardPending}
                  className="rounded-xl border-white/10 bg-white/5 text-white placeholder:text-slate-500"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2 rounded-xl bg-white text-slate-950 hover:bg-slate-200"
                  onClick={() => saveBoardMutation.mutate()}
                  disabled={
                    !boardForm.name.trim() ||
                    (boardForm.visibility !== "personal" && !boardForm.companyId) ||
                    isBoardPending
                  }
                >
                  <Plus className="h-4 w-4" />
                  {editingBoardId ? "Сохранить доску" : "Создать доску"}
                </Button>
                {editingBoardId && (
                  <Button
                    variant="ghost"
                    onClick={handleCancelBoardEdit}
                    disabled={isBoardPending}
                    className="text-slate-300 hover:bg-white/10 hover:text-white"
                  >
                    Отменить
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="border-slate-500/20 bg-[linear-gradient(180deg,rgba(226,232,240,0.86),rgba(148,163,184,0.24))] shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(23,32,51,0.94))] dark:text-slate-100">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg">Навигатор досок</CardTitle>
                <CardDescription>Быстрый доступ к личным и командным потокам работы.</CardDescription>
              </div>
              <Badge variant="secondary" className="border border-slate-500/15 bg-slate-900/[0.045] text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{boards.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 pb-4 sm:px-6 sm:pb-6">
            {boardsLoading ? (
              <div className="rounded-[24px] border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-10 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                Загружаем навигатор досок...
              </div>
            ) : boards.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-10 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                Пока нет досок. Начни с личной доски сверху: она создаётся без компании и подойдёт для первого сценария.
              </div>
            ) : (
              <>
                {([["Личные", personalBoards], ["Командные", sharedBoards]] as const).map(([title, items]) =>
                  items.length > 0 ? (
                    <div key={title} className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{title}</p>
                        <span className="rounded-full border border-slate-500/15 bg-slate-900/[0.04] px-2 py-0.5 text-[11px] text-slate-500 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-400">
                          {items.length}
                        </span>
                      </div>
                      {items.map((board) => {
                        const isSelected = board.id === selectedBoardId;
                        const meta = BOARD_VISIBILITY_META[board.visibility];
                        const Icon = meta.icon;
                        return (
                          <button
                            key={board.id}
                            type="button"
                            onClick={() => setSelectedBoardId(board.id)}
                            className={[
                              "w-full rounded-[24px] border px-4 py-4 text-left transition-all duration-200",
                              isSelected
                                ? "border-slate-900 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] text-white shadow-lg shadow-slate-900/20 dark:border-blue-400/25 dark:bg-[linear-gradient(180deg,rgba(27,38,56,0.98),rgba(17,24,39,0.96))]"
                                : "border-slate-500/15 bg-slate-900/[0.04] hover:border-slate-400/35 hover:bg-slate-900/[0.065] dark:border-slate-700/80 dark:bg-slate-950/35 dark:hover:border-slate-600 dark:hover:bg-slate-900/70",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold tracking-tight">{board.name}</p>
                                <p className={["mt-1 text-sm leading-6", isSelected ? "text-slate-300" : "text-slate-500 dark:text-slate-400"].join(" ")}>
                                  {board.description || "Без описания"}
                                </p>
                              </div>
                              <div className={["rounded-full border px-2 py-1 text-xs shadow-sm", isSelected ? "border-white/10 bg-white/10" : meta.surface].join(" ")}>
                                <span className="inline-flex items-center gap-1">
                                  <Icon className="h-3.5 w-3.5" />
                                  {meta.label}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null,
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {selectedBoard && (
            <Card className="overflow-hidden border-slate-500/20 bg-[linear-gradient(135deg,rgba(15,23,42,0.10),rgba(148,163,184,0.14),rgba(203,213,225,0.22))] shadow-sm dark:border-slate-700/80 dark:bg-[linear-gradient(135deg,rgba(17,24,39,0.98),rgba(23,32,51,0.96),rgba(30,41,59,0.9))]">
              <CardContent className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full border-slate-500/20 bg-slate-900/[0.04] px-3 py-1 text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                      {BOARD_VISIBILITY_META[selectedBoard.visibility].label}
                    </Badge>
                    {selectedBoard.companyId ? (
                      <Badge variant="secondary" className={KANBAN_BOARD_SOFT_BADGE_CLASS}>
                        {companyById.get(selectedBoard.companyId)?.name || "Компания"}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className={KANBAN_BOARD_SOFT_BADGE_CLASS}>
                        Personal space
                      </Badge>
                    )}
                    <Badge variant="secondary" className={KANBAN_BOARD_SOFT_BADGE_CLASS}>
                      {canEditSelectedBoard ? "Можно редактировать" : canCommentSelectedBoard ? "Можно комментировать" : "Только просмотр"}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{selectedBoard.name}</h2>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
                      {selectedBoard.description || "Добавь короткое описание, чтобы команда быстрее понимала контекст."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <span className={["inline-flex items-center gap-1", KANBAN_BOARD_SOFT_BADGE_CLASS].join(" ")}><CheckCircle2 className="h-3.5 w-3.5" /> {lists.length} списков</span>
                    <span className={["inline-flex items-center gap-1", KANBAN_BOARD_SOFT_BADGE_CLASS].join(" ")}><Layers3 className="h-3.5 w-3.5" /> {filteredCards.length} карточек в фокусе</span>
                    <span className={["inline-flex items-center gap-1", KANBAN_BOARD_SOFT_BADGE_CLASS].join(" ")}><Users className="h-3.5 w-3.5" /> {boardMembers.length || 1} участников</span>
                  </div>
                </div>

	                {selectedBoard.canManage && (
	                  <div className="flex flex-wrap gap-2">
	                    <Button
	                      variant="outline"
	                      className="gap-2 rounded-xl border-slate-500/20 bg-slate-900/[0.045] dark:border-slate-700 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900"
	                      onClick={() => setBoardSettingsOpen(true)}
	                    >
	                      <Settings2 className="h-4 w-4" />
	                      Board settings
	                    </Button>
	                    <Button variant="outline" className="gap-2 rounded-xl border-slate-500/20 bg-slate-900/[0.045] dark:border-slate-700 dark:bg-slate-950/45 dark:text-slate-100 dark:hover:bg-slate-900" onClick={() => handleEditBoard(selectedBoard)} disabled={isBoardPending}>
	                      <Pencil className="h-4 w-4" />
	                      Редактировать
                    </Button>
                    <Button
                      variant="destructive"
                      className="gap-2 rounded-xl"
                      onMouseDown={stopInteractiveEvent}
                      onPointerDown={stopInteractiveEvent}
                      onTouchStart={stopInteractiveEvent}
                      onClick={(event) => {
                        stopInteractiveEvent(event);
                        if (!confirmDelete(`Удалить доску "${selectedBoard.name}"? Это действие нельзя отменить.`)) return;
                        deleteBoardMutation.mutate(selectedBoard.id);
                      }}
                      disabled={isBoardPending}
                    >
                      <Trash2 className="h-4 w-4" />
                      Удалить
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <Card className="border-slate-500/20 bg-[linear-gradient(180deg,rgba(15,23,42,0.05),rgba(148,163,184,0.08))] shadow-sm dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(11,16,32,0.94),rgba(17,24,39,0.96))] dark:text-slate-100">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>
                {selectedBoard ? `Доска: ${selectedBoard.name}` : "Выберите доску"}
              </CardTitle>
              <CardDescription>
                {selectedBoard
                  ? selectedBoard.description || "У доски пока нет описания."
                  : "Открой доску слева, чтобы увидеть ее поток задач, списки и карточки."}
              </CardDescription>
            </div>
            {selectedBoard && (
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-slate-500/20 bg-slate-900/[0.035] dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                    {canEditSelectedBoard ? "Редактирование" : canCommentSelectedBoard ? "Комментарии" : "Просмотр"}
                  </Badge>
                  <Badge variant="secondary" className="border border-slate-500/15 bg-slate-900/[0.045] text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{isSelectedBoardPersonal ? "Личное пространство" : `${boardMembers.length} участников`}</Badge>
                  <Badge variant="secondary" className="border border-slate-500/15 bg-slate-900/[0.045] text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{lists.length} списков</Badge>
                  <Badge variant="secondary" className="border border-slate-500/15 bg-slate-900/[0.045] text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">{filteredCards.length} из {cards.length} карточек</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex rounded-xl border border-slate-500/15 bg-slate-900/[0.035] p-1 dark:border-slate-700 dark:bg-slate-950/50">
                    <Button
                      variant={boardViewMode === "kanban" ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2 rounded-lg"
                      onClick={() => setBoardViewMode("kanban")}
                    >
                      <Layers3 className="h-4 w-4" />
                      Kanban
                    </Button>
                    <Button
                      variant={boardViewMode === "list" ? "secondary" : "ghost"}
                      size="sm"
                      className="gap-2 rounded-lg"
                      onClick={() => setBoardViewMode("list")}
                    >
                      <LayoutList className="h-4 w-4" />
                      List
                    </Button>
                  </div>
                  {boardViewMode === "list" && (
                    <select
                      className={KANBAN_PANEL_SELECT_CLASS}
                      value={listGrouping}
                      onChange={(event) => setListGrouping(event.target.value as BoardListGrouping)}
                    >
                      <option value="none">Без группировки</option>
                      <option value="list">По списку</option>
                      <option value="due">По сроку</option>
                      <option value="assignee">По исполнителю</option>
                      <option value="priority">По приоритету</option>
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedBoard ? (
            <div className="rounded-[24px] border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-5 py-10 text-sm leading-6 text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
              Выберите доску в левом навигаторе, чтобы открыть её поток задач, списки и карточки.
            </div>
          ) : (
            <div className="space-y-4">
                <Card className="overflow-hidden border-slate-500/20 bg-[linear-gradient(180deg,rgba(226,232,240,0.68),rgba(148,163,184,0.14))] shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(23,32,51,0.94))]">
                  <CardHeader className="border-b border-slate-500/15 bg-slate-900/[0.035] dark:border-slate-700/70 dark:bg-slate-950/25">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Фокус и фильтры</CardTitle>
                        <CardDescription>
                          Быстрый поиск и срезы по исполнителю, приоритету, сроку и меткам.
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full border border-slate-500/15 bg-slate-900/[0.045] px-3 py-1 dark:border-slate-700 dark:bg-slate-950/50">
                          {filteredCards.length} в выборке
                        </span>
                        <span className="rounded-full border border-slate-500/15 bg-slate-900/[0.045] px-3 py-1 dark:border-slate-700 dark:bg-slate-950/50">
                          {cards.length} всего
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                    <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-2 xl:col-span-2">
                      <label className="text-sm font-medium" htmlFor="kanban-filter-search">
                        Поиск
                      </label>
                      <Input
                        id="kanban-filter-search"
                        value={cardFilters.search}
                        onChange={(event) => setCardFilters((prev) => ({ ...prev, search: event.target.value }))}
                        placeholder="Название или описание карточки"
                        className={KANBAN_PANEL_INPUT_CLASS}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="kanban-filter-assignee">
                        Исполнитель
                      </label>
                      <select
                        id="kanban-filter-assignee"
                        className={KANBAN_PANEL_SELECT_CLASS}
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
                        className={KANBAN_PANEL_SELECT_CLASS}
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
                        className={KANBAN_PANEL_SELECT_CLASS}
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
                        className={KANBAN_PANEL_SELECT_CLASS}
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
                      <Button variant="ghost" className="rounded-xl" onClick={() => setCardFilters(EMPTY_FILTERS)}>
                        Сбросить фильтры
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {isBoardStructureLoading ? (
                  <Card className="border-slate-500/15 bg-slate-900/[0.035] dark:border-slate-700/80 dark:bg-slate-950/40">
                    <CardContent className="py-10 text-sm text-muted-foreground">
                      Загружаем структуру доски и карточки...
                    </CardContent>
                  </Card>
                ) : boardViewMode === "kanban" ? (
                  <DragDropContext onDragEnd={handleBoardDragEnd}>
                    <Droppable droppableId="board-lists" direction="horizontal" type="LIST">
                      {(listDropProvided) => (
                        <div
                          ref={listDropProvided.innerRef}
                          {...listDropProvided.droppableProps}
                          className="flex max-w-full items-stretch gap-4 overflow-x-auto px-1 pb-3 pr-6"
                        >
                      {lists.map((list, listIndex) => {
                        const listCards = filteredCardsByListId.get(list.id) ?? [];
                        const listTint = toSoftColor(list.color, listCards.length > 0 ? 0.16 : 0.12);
                        const listHeaderTint = toSoftColor(list.color, 0.2);
                        const listLaneTint = toSoftColor(list.color, 0.1);
                        const listCardTint = toSoftColor(list.color, 0.05);

                        return (
                          <Draggable
                            key={list.id}
                            draggableId={`list:${list.id}`}
                            index={listIndex}
                            isDragDisabled={!canEditSelectedBoard || isListPending}
                          >
                            {(listDragProvided, listDragSnapshot) => (
                              <div
                                ref={listDragProvided.innerRef}
                                {...listDragProvided.draggableProps}
                                className="h-full w-[320px] shrink-0"
                                style={getDraggableCardStyle(listDragProvided.draggableProps.style, {
                                  isDragging: listDragSnapshot.isDragging,
                                  isDropAnimating: listDragSnapshot.isDropAnimating,
                                })}
                              >
                          <Droppable
                            droppableId={list.id}
                            type="CARD"
                            isDropDisabled={!canEditSelectedBoard || isCardPending}
                          >
                            {(provided, snapshot) => (
                              <Card
                                className={[
                                  "h-full overflow-hidden rounded-[24px] border border-slate-500/20 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 dark:border-slate-700/80 dark:text-slate-100",
                                  snapshot.isDraggingOver || listDragSnapshot.isDragging
                                    ? "border-sky-400/70 shadow-lg shadow-sky-900/10 ring-2 ring-sky-300/30 dark:border-blue-400/60 dark:ring-blue-400/20"
                                    : "hover:border-slate-500/30 hover:shadow-md dark:hover:border-slate-600",
                                ].join(" ").trim()}
                                style={{
                                  background: snapshot.isDraggingOver
                                    ? `linear-gradient(180deg, var(--kanban-list-over-start), ${listHeaderTint || listTint || "var(--kanban-list-over-end)"})`
                                    : `linear-gradient(180deg, var(--kanban-list-start), ${listTint || "var(--kanban-list-end)"})`,
                                }}
                              >
                                <CardHeader
                                  className="space-y-4 border-b border-slate-500/15 dark:border-slate-700/70"
                                  style={{ backgroundColor: listHeaderTint || listTint || "var(--kanban-list-header)" }}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="space-y-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {editingListId === list.id ? (
                                          <Input
                                            value={listForm.name}
                                            onChange={(event) => setListForm((prev) => ({ ...prev, name: event.target.value }))}
                                            autoFocus
                                            className={KANBAN_PANEL_INPUT_CLASS}
                                            disabled={isListPending}
                                            onKeyDown={(event) => {
                                              if (event.key === "Escape") {
                                                event.preventDefault();
                                                handleCancelListEdit();
                                              }
                                              if (event.key === "Enter") {
                                                event.preventDefault();
                                                if (listForm.name.trim()) saveListMutation.mutate({ listId: list.id });
                                              }
                                            }}
                                            onBlur={() => {
                                              if (!listForm.name.trim()) {
                                                handleCancelListEdit();
                                                return;
                                              }
                                              saveListMutation.mutate({ listId: list.id });
                                            }}
                                          />
                                        ) : (
                                          <CardTitle className="text-base font-semibold tracking-tight text-slate-900 break-words dark:text-slate-100">{list.name}</CardTitle>
                                        )}
                                        {list.color && (
                                          <span
                                            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-slate-800/10 shadow-sm"
                                            style={{ backgroundColor: list.color }}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
	                                      {canEditSelectedBoard && (
	                                        <>
	                                          <Button
	                                            variant="ghost"
	                                            size="icon"
	                                            className="h-8 w-8 rounded-xl text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-950/60 dark:hover:text-slate-100"
	                                            aria-label="Перетащить список"
	                                            title="Перетащить список"
	                                            disabled={isListPending}
	                                            {...listDragProvided.dragHandleProps}
	                                          >
	                                            <GripVertical className="h-4 w-4" />
	                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-xl text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-950/60 dark:hover:text-slate-100"
                                            aria-label="Редактировать список"
                                            title="Редактировать список"
                                            onClick={() => handleEditList(list)}
                                            disabled={isListPending}
                                          >
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-xl text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-950/60 dark:hover:text-slate-100"
                                                aria-label="Настройки списка"
                                                title="Настройки списка"
                                                disabled={isListPending}
                                              >
                                                <MoreHorizontal className="h-4 w-4" />
                                              </Button>
	                                            </DropdownMenuTrigger>
	                                            <DropdownMenuContent align="end" className="w-64">
	                                              <DropdownMenuLabel>Позиция</DropdownMenuLabel>
	                                              <DropdownMenuItem onClick={() => handleShiftList(list.id, "up")} disabled={isListPending || listIndex === 0}>
	                                                <ArrowLeft className="mr-2 h-4 w-4" />
	                                                Move left
	                                              </DropdownMenuItem>
	                                              <DropdownMenuItem onClick={() => handleShiftList(list.id, "down")} disabled={isListPending || listIndex === lists.length - 1}>
	                                                <ArrowDown className="mr-2 h-4 w-4 rotate-[-90deg]" />
	                                                Move right
	                                              </DropdownMenuItem>
	                                              <DropdownMenuSeparator />
	                                              <DropdownMenuLabel>Тип списка</DropdownMenuLabel>
                                              {Object.entries(LIST_TYPE_LABELS).map(([value, label]) => (
                                                <DropdownMenuItem
                                                  key={value}
                                                  onClick={() =>
                                                    saveListMutation.mutate({
                                                      listId: list.id,
                                                      name: list.name,
                                                      color: list.color || null,
                                                      type: value as KanbanListType,
                                                    })
                                                  }
                                                >
                                                  {label}{list.type === value ? " ✓" : ""}
                                                </DropdownMenuItem>
                                              ))}
                                              <DropdownMenuSeparator />
                                              <DropdownMenuLabel>Цвет</DropdownMenuLabel>
                                              <DropdownMenuItem
                                                onClick={() =>
                                                  saveListMutation.mutate({
                                                    listId: list.id,
                                                    name: list.name,
                                                    color: null,
                                                    type: list.type,
                                                  })
                                                }
                                              >
                                                Без цвета{!list.color ? " ✓" : ""}
                                              </DropdownMenuItem>
                                              <div className="grid grid-cols-4 gap-2 p-2">
                                                {LIST_COLOR_PRESETS.map((preset) => (
                                                  <button
                                                    key={preset.value}
                                                    type="button"
                                                    className={[
                                                      "h-8 rounded-lg border transition hover:scale-105",
                                                      list.color === preset.value ? "border-foreground ring-2 ring-primary/40" : "border-border",
                                                    ].join(" ")}
                                                    style={{ backgroundColor: preset.value }}
                                                    aria-label={`Выбрать цвет ${preset.label}`}
                                                    title={preset.label}
                                                    onClick={() =>
                                                      saveListMutation.mutate({
                                                        listId: list.id,
                                                        name: list.name,
                                                        color: preset.value,
                                                        type: list.type,
                                                      })
                                                    }
                                                  />
                                                ))}
                                              </div>
                                            </DropdownMenuContent>
                                          </DropdownMenu>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                            aria-label="Удалить список"
                                            title="Удалить список"
                                            onClick={() => {
                                              if (!confirmDelete(`Удалить список "${list.name}"? Все карточки внутри списка тоже будут удалены.`)) return;
                                              deleteListMutation.mutate(list.id);
                                            }}
                                            disabled={isListPending}
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </>
                                      )}
                                      <Badge variant="secondary" className="rounded-full border border-slate-500/15 bg-slate-900/[0.05] px-2.5 text-slate-700 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                                        {listCards.length}
                                      </Badge>
                                      <Badge variant={list.type === "active" ? "default" : "outline"} className="rounded-full px-2.5 shadow-sm">
                                        {LIST_TYPE_LABELS[list.type]}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="space-y-4 p-4">
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                                      Тип: {LIST_TYPE_LABELS[list.type]}
                                    </span>
                                    <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                                      {list.color ? "С цветом" : "Без цвета"}
                                    </span>
                                  </div>

                                  {canEditSelectedBoard && (
                                    <div className="rounded-[18px] border border-slate-500/15 bg-slate-900/[0.035] p-2 dark:border-slate-700/80 dark:bg-slate-950/35">
                                      {inlineCardListId === list.id ? (
                                        <div className="space-y-2">
                                          <Input
                                            value={inlineCardTitle}
                                            onChange={(event) => setInlineCardTitle(event.target.value)}
                                            placeholder="Название задачи"
                                            autoFocus
                                            disabled={isCardPending}
                                            className={KANBAN_PANEL_INPUT_CLASS}
                                            onKeyDown={(event) => {
                                              if (event.key === "Escape") {
                                                event.preventDefault();
                                                handleCancelInlineCard();
                                              }
                                              if (event.key === "Enter") {
                                                event.preventDefault();
                                                handleSubmitInlineCard(list.id);
                                              }
                                            }}
                                            onBlur={() => {
                                              if (!inlineCardTitle.trim()) handleCancelInlineCard();
                                            }}
                                          />
                                          <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={handleCancelInlineCard}>
                                              Отмена
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="rounded-xl"
                                              onMouseDown={(event) => event.preventDefault()}
                                              onClick={() => handleSubmitInlineCard(list.id)}
                                              disabled={!inlineCardTitle.trim() || isCardPending}
                                            >
                                              Добавить
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-slate-900/[0.055] hover:text-slate-900 dark:hover:bg-slate-900/70 dark:hover:text-slate-100"
                                          onClick={() => {
                                            setInlineCardListId(list.id);
                                            setInlineCardTitle("");
                                          }}
                                          disabled={isCardPending}
                                        >
                                          <Plus className="h-4 w-4" />
                                          Добавить задачу
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  <div
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className="space-y-3 min-h-[180px] rounded-[20px] p-2.5 sm:p-3 transition-colors"
                                    style={{ backgroundColor: listLaneTint || "var(--kanban-lane-fallback)" }}
                                  >
                                    {listCards.length === 0 && !snapshot.isDraggingOver && (
                                      <div className="rounded-[18px] border border-dashed border-slate-400/30 bg-slate-900/[0.05] px-3 py-5 text-sm leading-6 text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/45">
                                        {canEditSelectedBoard
                                          ? "Перетащите сюда карточку или добавьте задачу выше."
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
                                              {...dragProvided.dragHandleProps}
                                              className="cursor-grab active:cursor-grabbing"
                                              style={getDraggableCardStyle(dragProvided.draggableProps.style, {
                                                isDragging: dragSnapshot.isDragging,
                                                isDropAnimating: dragSnapshot.isDropAnimating,
                                              })}
                                            >
                                              <div
                                                className={[
                                                  "group rounded-[20px] border p-3 sm:p-3.5 space-y-3 shadow-sm transition-[box-shadow,border-color,background-color] duration-200 ease-out select-none dark:text-slate-100",
                                                  dueDateStatusClasses.card,
                                                  dragSnapshot.isDragging
                                                    ? "border-sky-300/80 shadow-xl shadow-slate-900/15 ring-2 ring-sky-300/30 dark:border-blue-400/70 dark:ring-blue-400/20"
                                                    : dragSnapshot.isDropAnimating
                                                      ? "border-sky-200/70 shadow-lg shadow-slate-900/10 dark:border-blue-400/50"
                                                      : "hover:border-slate-500/25 hover:shadow-md dark:hover:border-slate-600",
                                                ].join(" ").trim()}
                                                style={{
                                                  background: dragSnapshot.isDragging
                                                    ? `linear-gradient(180deg, var(--kanban-drag-card-start), ${listTint || "var(--kanban-card-end)"})`
                                                    : `linear-gradient(180deg, var(--kanban-card-start), ${listCardTint || "var(--kanban-card-end)"})`,
                                                  borderColor: dragSnapshot.isDragging || dragSnapshot.isDropAnimating
                                                    ? undefined
                                                    : (list.color || "rgba(100,116,139,0.18)"),
                                                  transform: "translateZ(0)",
                                                }}
                                              >
                                                <div className="flex gap-3">
                                                  <div className="min-w-0 flex-1 space-y-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                      <div className="flex min-w-0 gap-2">
                                                        {canEditSelectedBoard && (
                                                          <div
                                                            className="shrink-0 self-center rounded-xl p-1.5 text-slate-500 transition group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200"
                                                            style={{ backgroundColor: listLaneTint || "rgba(100,116,139,0.14)" }}
                                                          >
                                                            <GripVertical className="h-4 w-4" />
                                                          </div>
                                                        )}
                                                        <div className="min-w-0 space-y-1">
                                                          {inlineEditingCardId === card.id ? (
                                                            <Input
                                                              value={inlineEditingCardTitle}
                                                              onChange={(event) => setInlineEditingCardTitle(event.target.value)}
                                                              autoFocus
                                                              className={KANBAN_PANEL_INPUT_CLASS}
                                                              onMouseDown={stopInteractiveEvent}
                                                              onPointerDown={stopInteractiveEvent}
                                                              onTouchStart={stopInteractiveEvent}
                                                              onKeyDown={(event) => {
                                                                if (event.key === "Escape") {
                                                                  event.preventDefault();
                                                                  handleCancelInlineCardTitleEdit();
                                                                }
                                                                if (event.key === "Enter") {
                                                                  event.preventDefault();
                                                                  handleCommitInlineCardTitleEdit(card);
                                                                }
                                                              }}
                                                              onBlur={() => handleCommitInlineCardTitleEdit(card)}
                                                              disabled={isCardPending}
                                                            />
                                                          ) : (
                                                            <p
                                                              className="font-medium break-words text-slate-900 dark:text-slate-100"
                                                              title={canEditSelectedBoard ? "Двойной клик для переименования" : undefined}
                                                              onDoubleClick={(event) => {
                                                                stopInteractiveEvent(event);
                                                                handleBeginInlineCardTitleEdit(card);
                                                              }}
                                                            >
                                                              {card.title}
                                                            </p>
                                                          )}
                                                          {card.description && (
                                                            <p className="text-sm leading-6 text-muted-foreground whitespace-pre-wrap break-words">
                                                              {card.description}
                                                            </p>
                                                          )}
                                                        </div>
                                                      </div>
                                                      <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[card.priority]} className="rounded-full">
                                                        {CARD_PRIORITY_LABELS[card.priority]}
                                                      </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2">
                                                      <Badge variant="outline" className={["rounded-full", dueDateStatusClasses.badge].join(" ")}>
                                                        {getDueDateStatusLabel(dueDateStatus)}
                                                      </Badge>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                      <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>#{Number(card.position) + 1}</span>
                                                      {assigneeName && <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>Исполнитель: {assigneeName}</span>}
                                                      {dueDateLabel && <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>Срок: {dueDateLabel}</span>}
                                                      {subtaskProgress.total > 0 && (
                                                        <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                                                          Подзадачи: {subtaskProgress.completed}/{subtaskProgress.total}
                                                        </span>
                                                      )}
                                                    </div>

                                                    {cardLabels.length > 0 && (
                                                      <div className="flex flex-wrap gap-2">
                                                        {cardLabels.map((label) => (
                                                          <Badge
                                                            key={label.id}
                                                            variant="outline"
                                                            className="gap-1 rounded-full border-transparent"
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
                                                  </div>

                                                  <div className="flex shrink-0 flex-col items-center gap-2 border-l border-slate-500/10 pl-2 dark:border-slate-700/60">
                                                    <Button
                                                      variant="ghost"
                                                      size="icon"
                                                      className="h-8 w-8 rounded-xl text-slate-500 hover:bg-slate-900/[0.06] hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-950/60 dark:hover:text-slate-100"
                                                      aria-label="Подробнее"
                                                      title="Подробнее"
                                                      onMouseDown={stopInteractiveEvent}
                                                      onPointerDown={stopInteractiveEvent}
                                                      onTouchStart={stopInteractiveEvent}
                                                      onClick={(event) => {
                                                        stopInteractiveEvent(event);
                                                        handleOpenCardDetail(card.id);
                                                      }}
                                                      disabled={detailCardLoading && detailCardId === card.id}
                                                    >
                                                      <Info className="h-4 w-4" />
                                                    </Button>
                                                    {canEditSelectedBoard && (
                                                      <>
                                                        <Button
                                                          variant="ghost"
                                                          size="icon"
                                                          className="h-8 w-8 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                                          aria-label="Удалить"
                                                          title="Удалить"
                                                          onMouseDown={stopInteractiveEvent}
                                                          onPointerDown={stopInteractiveEvent}
                                                          onTouchStart={stopInteractiveEvent}
                                                          onClick={(event) => {
                                                            stopInteractiveEvent(event);
                                                            if (!confirmDelete(`Удалить карточку "${card.title}"? Это действие нельзя отменить.`)) return;
                                                            deleteCardMutation.mutate(card.id);
                                                          }}
                                                          disabled={isCardPending}
                                                        >
                                                          <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                      </>
                                                    )}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </Draggable>
                                      );
                                    })}

                                    {provided.placeholder}
                                  </div>

                                </CardContent>
                              </Card>
                            )}
                          </Droppable>
                              </div>
                            )}
                          </Draggable>
	                        );
	                      })}
	                      {listDropProvided.placeholder}
	                      {canEditSelectedBoard && (
                        <Card className="flex h-auto min-h-[220px] w-[320px] shrink-0 items-stretch rounded-[24px] border border-dashed border-slate-500/25 bg-slate-900/[0.025] shadow-sm dark:border-slate-700/80 dark:bg-slate-950/35">
                          <CardContent className="flex w-full flex-col justify-start p-4">
                            {inlineListOpen ? (
                              <div className="space-y-3">
                                <Input
                                  value={inlineListTitle}
                                  onChange={(event) => setInlineListTitle(event.target.value)}
                                  placeholder="Название столбца"
                                  autoFocus
                                  disabled={isListPending}
                                  className={KANBAN_PANEL_INPUT_CLASS}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      handleCancelInlineList();
                                    }
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      handleSubmitInlineList();
                                    }
                                  }}
                                  onBlur={() => {
                                    if (!inlineListTitle.trim()) handleCancelInlineList();
                                  }}
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={handleCancelInlineList}>
                                    Отмена
                                  </Button>
                                  <Button
                                    size="sm"
                                    className="rounded-xl"
                                    onMouseDown={(event) => event.preventDefault()}
                                    onClick={handleSubmitInlineList}
                                    disabled={!inlineListTitle.trim() || isListPending}
                                  >
                                    Создать
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-[20px] text-sm font-medium text-muted-foreground transition hover:bg-slate-900/[0.045] hover:text-slate-900 dark:hover:bg-slate-900/70 dark:hover:text-slate-100"
                                onClick={() => {
                                  setInlineListOpen(true);
                                  setInlineListTitle("");
                                }}
                                disabled={isListPending}
                              >
                                <Plus className="h-5 w-5" />
                                Новый столбец
                              </button>
                            )}
                          </CardContent>
	                        </Card>
	                      )}
	                    </div>
                      )}
                    </Droppable>
		                  </DragDropContext>
	                ) : (
	                  <Card className="overflow-hidden border-slate-500/20 bg-[linear-gradient(180deg,rgba(226,232,240,0.66),rgba(148,163,184,0.12))] shadow-sm dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(23,32,51,0.94))]">
	                    <CardHeader className="border-b border-slate-500/15 bg-slate-900/[0.035] dark:border-slate-700/70 dark:bg-slate-950/25">
	                      <div className="flex flex-wrap items-start justify-between gap-3">
	                        <div>
	                          <CardTitle className="text-base">Список задач</CardTitle>
	                          <CardDescription>Табличный вид с группировками. Drag доступен при группировке по списку.</CardDescription>
	                        </div>
	                        {canEditSelectedBoard && (
	                          <div className="flex min-w-[min(100%,540px)] flex-wrap items-center gap-2">
	                            <Input
	                              value={listViewDraftTitle}
	                              onChange={(event) => setListViewDraftTitle(event.target.value)}
	                              placeholder="Новая задача"
	                              className={`${KANBAN_PANEL_INPUT_CLASS} min-w-[220px] flex-1`}
	                              disabled={saveCardMutation.isPending || lists.length === 0}
	                              onKeyDown={(event) => {
	                                if (event.key !== "Enter") return;
	                                event.preventDefault();
	                                handleSubmitListViewCard();
	                              }}
	                            />
	                            <select
	                              className={`${KANBAN_PANEL_SELECT_CLASS} w-[180px]`}
	                              value={listViewDraftListId}
	                              onChange={(event) => setListViewDraftListId(event.target.value)}
	                              disabled={saveCardMutation.isPending || lists.length === 0}
	                            >
	                              {lists.length === 0 ? (
	                                <option value="">Нет списков</option>
	                              ) : (
	                                lists.map((list) => (
	                                  <option key={list.id} value={list.id}>{list.name}</option>
	                                ))
	                              )}
	                            </select>
	                            <Button className="rounded-xl" onClick={handleSubmitListViewCard} disabled={!listViewDraftTitle.trim() || !listViewDraftListId || saveCardMutation.isPending}>
	                              <Plus className="mr-1 h-4 w-4" />
	                              Добавить
	                            </Button>
	                          </div>
	                        )}
	                      </div>
	                    </CardHeader>
	                    <CardContent className="space-y-4 p-4">
	                      <DragDropContext onDragEnd={handleBoardDragEnd}>
	                        {listViewGroups.map((group) => {
	                          const canDropInGroup = listGrouping === "list" && Boolean(group.droppableListId);
	                          return (
	                            <section key={group.id} className="overflow-hidden rounded-[24px] border border-slate-500/15 bg-slate-900/[0.025] dark:border-slate-700/80 dark:bg-slate-950/30">
	                              <div className="flex items-center justify-between gap-3 border-b border-slate-500/15 px-4 py-3 dark:border-slate-700/70">
	                                <h3 className="font-semibold">{group.title}</h3>
	                                <Badge variant="secondary" className="rounded-full">{group.cards.length}</Badge>
	                              </div>
	                              {canDropInGroup ? (
	                                <Droppable droppableId={group.droppableListId!} type="CARD">
	                                  {(provided) => (
	                                    <div ref={provided.innerRef} {...provided.droppableProps} className="min-h-[96px] space-y-2 p-3">
	                                      {group.cards.map((card, index) => (
	                                        <Draggable key={card.id} draggableId={card.id} index={index} isDragDisabled={!canEditSelectedBoard || isCardPending}>
	                                          {(dragProvided, dragSnapshot) => (
	                                            <div
	                                              ref={dragProvided.innerRef}
	                                              {...dragProvided.draggableProps}
	                                              {...dragProvided.dragHandleProps}
	                                              style={getDraggableCardStyle(dragProvided.draggableProps.style, {
	                                                isDragging: dragSnapshot.isDragging,
	                                                isDropAnimating: dragSnapshot.isDropAnimating,
	                                              })}
	                                            >
	                                              {renderListViewCardRow(card)}
	                                            </div>
	                                          )}
	                                        </Draggable>
	                                      ))}
	                                      {group.cards.length === 0 && (
	                                        <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-5 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">В этой группе пока нет задач.</div>
	                                      )}
	                                      {provided.placeholder}
	                                    </div>
	                                  )}
	                                </Droppable>
	                              ) : (
	                                <div className="space-y-2 p-3">
	                                  {group.cards.length === 0 ? (
	                                    <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-5 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">В этой группе пока нет задач.</div>
	                                  ) : (
	                                    group.cards.map((card) => <div key={card.id}>{renderListViewCardRow(card)}</div>)
	                                  )}
	                                </div>
	                              )}
	                            </section>
	                          );
	                        })}
	                      </DragDropContext>
	                    </CardContent>
	                  </Card>
	                )}
              </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailCardId} onOpenChange={(open) => !open && handleCloseCardDetail()}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-slate-500/20 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(226,232,240,0.92))] p-0 shadow-2xl shadow-slate-900/20 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(11,16,32,0.98))] dark:text-slate-100">
          {!selectedDetailCard ? (
            <>
              <DialogHeader className="border-b border-slate-500/15 bg-slate-900/[0.03] px-6 py-5 dark:border-slate-700/70 dark:bg-slate-950/30">
                <DialogTitle>Карточка</DialogTitle>
                <DialogDescription>Загружаем детали карточки...</DialogDescription>
              </DialogHeader>
              <div className="px-6 py-8 text-sm text-muted-foreground">Подождите, данные карточки загружаются.</div>
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
              <DialogHeader className="space-y-3 border-b border-slate-500/15 bg-slate-900/[0.03] px-6 py-5 dark:border-slate-700/70 dark:bg-slate-950/30">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                  <div className="space-y-1">
                    <DialogTitle className="break-words text-2xl font-semibold tracking-tight">{selectedDetailCard.title}</DialogTitle>
                    <DialogDescription className="break-words">
                      {selectedDetailCard.description || "У этой карточки пока нет описания."}
                    </DialogDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={CARD_PRIORITY_BADGE_VARIANTS[selectedDetailCard.priority]} className="rounded-full">
                      {CARD_PRIORITY_LABELS[selectedDetailCard.priority]}
                    </Badge>
                    {selectedDetailList && <Badge variant="outline" className="rounded-full border-slate-500/20 bg-slate-900/[0.04] dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">{selectedDetailList.name}</Badge>}
                    <Badge variant="outline" className={["rounded-full", dueDateStatusClasses.badge].join(" ")}>
                      {getDueDateStatusLabel(dueDateStatus)}
                    </Badge>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 px-6 py-6">
                <div className={KANBAN_DETAIL_SECTION_CLASS}>
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
                      disabled={!canEditSelectedBoard}
                      className={KANBAN_PANEL_INPUT_CLASS}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-list">
                      Список
                    </label>
                    <select
                      id="kanban-detail-list"
                      className={KANBAN_PANEL_SELECT_CLASS}
                      value={detailCardForm.listId}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({ ...prev, listId: event.target.value }))
                      }
                      disabled={!canEditSelectedBoard}
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
                    disabled={!canEditSelectedBoard}
                    className={KANBAN_PANEL_TEXTAREA_CLASS}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-priority">
                      Приоритет
                    </label>
                    <select
                      id="kanban-detail-priority"
                      className={KANBAN_PANEL_SELECT_CLASS}
                      value={detailCardForm.priority}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({
                          ...prev,
                          priority: event.target.value as KanbanCardPriority,
                        }))
                      }
                      disabled={!canEditSelectedBoard}
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
                      className={KANBAN_PANEL_SELECT_CLASS}
                      value={detailCardForm.assigneeUserId}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({ ...prev, assigneeUserId: event.target.value }))
                      }
                      disabled={!canEditSelectedBoard}
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
                    <label className="text-sm font-medium" htmlFor="kanban-detail-start-date">
                      Дата старта
                    </label>
                    <Input
                      id="kanban-detail-start-date"
                      type="datetime-local"
                      value={detailCardForm.startDate}
                      onChange={(event) =>
                        setDetailCardForm((prev) => ({ ...prev, startDate: event.target.value }))
                      }
                      disabled={!canEditSelectedBoard}
                      className={KANBAN_PANEL_INPUT_CLASS}
                    />
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
                      disabled={!canEditSelectedBoard}
                      className={KANBAN_PANEL_INPUT_CLASS}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium" htmlFor="kanban-detail-label-query">Метки</label>
                    {boardLabelsLoading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {detailCardForm.labelIds.map((labelId) => {
                      const label = labelById.get(labelId);
                      if (!label) return null;
                      return (
                        <button
                          key={label.id}
                          type="button"
                          className="inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-sm"
                          style={{
                            backgroundColor: label.color || "rgba(148, 163, 184, 0.18)",
                            color: "#111827",
                          }}
                          onClick={() => handleRemoveDetailLabel(label.id)}
                          disabled={!canEditSelectedBoard}
                          title="Снять метку"
                        >
                          <Tag className="h-3.5 w-3.5" />
                          {label.name}
                          <span aria-hidden>×</span>
                        </button>
                      );
                    })}
                    {detailCardForm.labelIds.length === 0 && (
                      <span className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-3 py-2 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                        У карточки пока нет меток.
                      </span>
                    )}
                  </div>

                  {canEditSelectedBoard && (
                    <div className="space-y-2 rounded-2xl border border-slate-500/15 bg-slate-900/[0.025] p-3 dark:border-slate-700/80 dark:bg-slate-950/40">
                      <Input
                        id="kanban-detail-label-query"
                        value={detailLabelQuery}
                        onChange={(event) => setDetailLabelQuery(event.target.value)}
                        placeholder="Найти или создать метку"
                        disabled={saveLabelMutation.isPending}
                        className={KANBAN_PANEL_INPUT_CLASS}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          event.preventDefault();
                          if (detailLabelExactMatch) {
                            handleAttachDetailLabel(detailLabelExactMatch.id);
                          } else {
                            handleCreateDetailLabel();
                          }
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
                        {matchingDetailLabels.slice(0, 8).map((label) => (
                          <button
                            key={label.id}
                            type="button"
                            className="rounded-full border border-slate-500/15 px-3 py-1.5 text-sm transition hover:border-slate-500/35"
                            style={{ backgroundColor: label.color || "rgba(148, 163, 184, 0.16)" }}
                            onClick={() => handleAttachDetailLabel(label.id)}
                            disabled={saveCardDetailMutation.isPending}
                          >
                            {label.name}
                          </button>
                        ))}
                        {detailLabelQuery.trim() && !detailLabelExactMatch && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full"
                            onClick={handleCreateDetailLabel}
                            disabled={saveLabelMutation.isPending}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Создать “{detailLabelQuery.trim()}”
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                </div>

                <div className={KANBAN_DETAIL_SECTION_CLASS}>
                  <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    <p>
                      Подзадачи: {getSubtaskProgress(selectedDetailCard.subtasks).completed}/
                      {getSubtaskProgress(selectedDetailCard.subtasks).total}
                    </p>
                    <p>Создатель: {userById.get(selectedDetailCard.creatorUserId)?.name || selectedDetailCard.creatorUserId}</p>
                    <p>Позиция в списке: {Number(selectedDetailCard.position) + 1}</p>
                    <p>Старт: {formatDueDateLabel(selectedDetailCard.startDate) || "Не задан"}</p>
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
                            className="rounded-full border-transparent"
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

                <div className={KANBAN_DETAIL_SECTION_CLASS}>
                  <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">
                      Подзадачи ({getSubtaskProgress(selectedDetailCard.subtasks).completed}/{getSubtaskProgress(selectedDetailCard.subtasks).total})
                    </h3>
                  </div>

                  {normalizeSubtasks(selectedDetailCard.subtasks).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-6 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                      У этой карточки пока нет подзадач.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {normalizeSubtasks(selectedDetailCard.subtasks).map((subtask) => (
                        <div
                          key={subtask.id}
                          className="flex items-center gap-2 rounded-2xl border border-slate-500/15 bg-slate-900/[0.03] px-3 py-2.5 dark:border-slate-700/80 dark:bg-slate-950/40"
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
                                if (!confirmDelete(`Удалить подзадачу "${subtask.title}"?`)) return;
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
                        className={KANBAN_PANEL_INPUT_CLASS}
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
                        className="rounded-xl"
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
                </div>

                <div className={KANBAN_DETAIL_SECTION_CLASS}>
                  <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Вложения</h3>
                    {detailCardAttachmentsLoading && (
                      <span className="text-xs text-muted-foreground">Загружаем файлы...</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {detailCardAttachments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-6 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                        У этой карточки пока нет вложений.
                      </div>
                    ) : (
                      detailCardAttachments.map((attachment) => (
                        <div key={attachment.id} className="rounded-2xl border border-slate-500/15 bg-slate-900/[0.03] p-4 dark:border-slate-700/80 dark:bg-slate-950/40">
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
                                <span className="rounded-full border border-slate-500/15 bg-slate-900/[0.04] px-2 py-1">
                                {formatFileSize(attachment.fileSize)} · {attachment.mimeType || "unknown"} ·{" "}
                                {formatDueDateLabel(attachment.createdAt) || "Неизвестное время"}
                                </span>
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
                                  onClick={() => {
                                    if (!confirmDelete(`Удалить вложение "${attachment.fileName}"?`)) return;
                                    deleteCardAttachmentMutation.mutate(attachment.id);
                                  }}
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
                        className={KANBAN_PANEL_INPUT_CLASS}
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
                </div>

                <div className={KANBAN_DETAIL_SECTION_CLASS}>
                  <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Activity Log</h3>
                    {detailCardHistoryLoading && (
                      <span className="text-xs text-muted-foreground">Обновляем историю...</span>
                    )}
                  </div>

                  {detailCardHistory.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-6 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                      Для этой карточки пока нет записанной истории.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {detailCardHistory.map((entry) => {
                        const changeLines = getHistoryChangeLines(entry);

                        return (
                          <div key={entry.id} className="rounded-2xl border border-slate-500/15 bg-slate-900/[0.03] p-4 dark:border-slate-700/80 dark:bg-slate-950/40">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="text-sm font-medium">
                                {userById.get(entry.userId)?.name || entry.userId}
                              </div>
                              <div className="rounded-full border border-slate-500/15 bg-slate-900/[0.04] px-2 py-1 text-xs text-muted-foreground">
                                {formatDueDateLabel(entry.createdAt) || "Неизвестное время"}
                              </div>
                            </div>
                            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                              {getKanbanHistoryActionLabel(entry.action)}
                            </p>
                            {changeLines.length > 0 && (
                              <div className="mt-3 space-y-2">
                                {changeLines.map((line, index) => (
                                  <div
                                    key={`${entry.id}-${index}`}
                                    className="rounded-xl border border-slate-500/10 bg-slate-50/70 px-3 py-2 text-sm dark:border-slate-700/70 dark:bg-slate-900/70"
                                  >
                                    {line}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                </div>

                <div className={KANBAN_DETAIL_SECTION_CLASS}>
                  <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">Комментарии</h3>
                    {detailCardCommentsLoading && (
                      <span className="text-xs text-muted-foreground">Загружаем комментарии...</span>
                    )}
                  </div>

                  <div className="space-y-3">
                    {detailCardComments.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-6 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                        У этой карточки пока нет комментариев.
                      </div>
                    ) : (
                      detailCardComments.map((comment) => (
                        <div key={comment.id} className="rounded-2xl border border-slate-500/15 bg-slate-900/[0.03] p-4 space-y-3 dark:border-slate-700/80 dark:bg-slate-950/40">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="text-sm font-medium">
                              {userById.get(comment.userId)?.name || comment.userId}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-full border border-slate-500/15 bg-slate-900/[0.04] px-2 py-1 text-xs text-muted-foreground">
                                {formatDueDateLabel(comment.createdAt) || "Неизвестное время"}
                              </span>
                              {canEditSelectedBoard && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => {
                                    if (!confirmDelete("Удалить комментарий?")) return;
                                    deleteCardCommentMutation.mutate(comment.id);
                                  }}
                                  disabled={deleteCardCommentMutation.isPending}
                                >
                                  Удалить
                                </Button>
                              )}
                            </div>
                          </div>
                          <p className="rounded-xl border border-slate-500/10 bg-slate-50/70 px-3 py-3 text-sm leading-6 whitespace-pre-wrap break-words dark:border-slate-700/70 dark:bg-slate-900/70">
                            {comment.content}
                          </p>
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
                        className={KANBAN_PANEL_TEXTAREA_CLASS}
                      />
                      <div className="flex justify-end">
                        <Button
                          className="rounded-xl"
                          onClick={() => createCardCommentMutation.mutate()}
                          disabled={!detailCommentDraft.trim() || createCardCommentMutation.isPending}
                        >
                          Добавить комментарий
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                </div>

	                <div className="sticky bottom-0 -mx-6 mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-500/15 bg-slate-50/95 px-6 py-4 backdrop-blur dark:border-slate-700/70 dark:bg-slate-950/95">
	                  <div className="text-sm text-muted-foreground">
	                    {detailSaveStatus === "saving" && "Сохраняется..."}
	                    {detailSaveStatus === "saved" && "Сохранено"}
	                    {detailSaveStatus === "dirty" && (detailCardForm.title.trim() ? "Есть несохраненные изменения" : "Введите название, чтобы сохранить")}
	                    {detailSaveStatus === "error" && `Ошибка сохранения: ${detailSaveError}`}
	                    {detailSaveStatus === "idle" && "Изменения сохраняются автоматически"}
	                  </div>
	                  <div className="flex flex-wrap justify-end gap-2">
	                    <Button variant="outline" className="rounded-xl" onClick={handleCloseCardDetail}>
	                      Закрыть
	                    </Button>
	                    {canEditSelectedBoard && (
	                      <Button
	                        className="rounded-xl"
	                        onClick={() => saveCardDetailMutation.mutate({ form: detailCardForm })}
	                        disabled={!detailCardForm.title.trim() || !detailCardForm.listId || saveCardDetailMutation.isPending}
	                      >
	                        {saveCardDetailMutation.isPending ? "Сохраняется..." : "Сохранить сейчас"}
	                      </Button>
	                    )}
	                  </div>
	                </div>
              </div>
                  </>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={boardSettingsOpen} onOpenChange={setBoardSettingsOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-slate-500/20 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(226,232,240,0.92))] p-0 shadow-2xl shadow-slate-900/20 dark:border-slate-700/80 dark:bg-[linear-gradient(180deg,rgba(17,24,39,0.98),rgba(11,16,32,0.98))] dark:text-slate-100">
          <DialogHeader className="border-b border-slate-500/15 bg-slate-900/[0.03] px-6 py-5 dark:border-slate-700/70 dark:bg-slate-950/30">
            <DialogTitle>Настройки доски</DialogTitle>
            <DialogDescription>
              {selectedBoard ? `${selectedBoard.name}: участники и палитра меток.` : "Выберите доску, чтобы управлять настройками."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 px-6 py-6">
            <div className={KANBAN_DETAIL_SECTION_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Участники</h3>
                  <p className="text-sm text-muted-foreground">
                    {isSelectedBoardPersonal
                      ? "Личная доска принадлежит тебе. Для командной совместной работы создай доску компании."
                      : "Управляй доступом участников к текущей доске."}
                  </p>
                </div>
                {!isSelectedBoardPersonal && boardMembersLoading && (
                  <span className="text-xs text-muted-foreground">Загружаем...</span>
                )}
              </div>

              {!isSelectedBoardPersonal && selectedBoard?.canManage && (
                <div className="mt-4 grid gap-3 rounded-2xl border border-slate-500/15 bg-slate-900/[0.025] p-3 dark:border-slate-700/80 dark:bg-slate-950/40 md:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
                  <select
                    className={KANBAN_PANEL_SELECT_CLASS}
                    value={memberForm.userId}
                    onChange={(event) => setMemberForm((prev) => ({ ...prev, userId: event.target.value }))}
                    disabled={Boolean(editingMemberId) || isMemberPending}
                  >
                    {editingMemberId ? (
                      <option value={memberForm.userId}>
                        {userById.get(memberForm.userId)?.name || memberForm.userId}
                      </option>
                    ) : availableBoardMembers.length === 0 ? (
                      <option value="">Нет доступных участников</option>
                    ) : (
                      availableBoardMembers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))
                    )}
                  </select>

                  <select
                    className={KANBAN_PANEL_SELECT_CLASS}
                    value={memberForm.role}
                    onChange={(event) =>
                      setMemberForm((prev) => ({
                        ...prev,
                        role: event.target.value as MemberFormState["role"],
                        canComment: event.target.value === "editor" ? true : prev.canComment,
                      }))
                    }
                    disabled={isMemberPending}
                  >
                    <option value="viewer">viewer</option>
                    <option value="editor">editor</option>
                  </select>

                  <label className="flex items-center gap-2 rounded-xl border border-slate-500/15 bg-slate-950/[0.02] px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950/50">
                    <input
                      type="checkbox"
                      checked={memberForm.role === "editor" ? true : memberForm.canComment}
                      onChange={(event) => setMemberForm((prev) => ({ ...prev, canComment: event.target.checked }))}
                      disabled={memberForm.role === "editor" || isMemberPending}
                    />
                    can comment
                  </label>

                  <div className="flex gap-2">
                    {editingMemberId && (
                      <Button variant="ghost" size="sm" className="rounded-xl" onClick={handleCancelMemberEdit} disabled={isMemberPending}>
                        Отмена
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="rounded-xl"
                      onClick={() => saveMemberMutation.mutate()}
                      disabled={(!memberForm.userId && !editingMemberId) || isMemberPending}
                    >
                      {editingMemberId ? "Сохранить" : "Добавить"}
                    </Button>
                  </div>
                </div>
              )}

              {!isSelectedBoardPersonal && (
                <div className="mt-4 space-y-2">
                  {boardMembers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-5 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                      В этой доске пока нет отдельных участников.
                    </div>
                  ) : (
                    boardMembers.map((member) => {
                      const user = userById.get(member.userId);
                      const isCreator = String(member.userId) === String(selectedBoard?.createdByUserId);
                      return (
                        <div
                          key={member.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-500/15 bg-slate-900/[0.03] px-4 py-3 dark:border-slate-700/80 dark:bg-slate-950/40"
                        >
                          <div className="min-w-0">
                            <div className="font-medium">{user?.name || member.userId}</div>
                            <div className="text-xs text-muted-foreground">{user?.email || "Без email"}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="rounded-full">{member.role}</Badge>
                            <Badge variant="outline" className="rounded-full">{member.canComment || member.role === "editor" ? "can comment" : "read only"}</Badge>
                            {isCreator && <Badge variant="outline" className="rounded-full">creator</Badge>}
                            {selectedBoard?.canManage && (
                              <>
                                <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => handleEditMember(member)} disabled={isMemberPending}>
                                  Изменить
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                  onClick={() => {
                                    if (!confirmDelete(`Удалить участника "${user?.name || member.userId}" из доски?`)) return;
                                    deleteMemberMutation.mutate(member.id);
                                  }}
                                  disabled={isMemberPending || isCreator}
                                >
                                  Удалить
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            <div className={KANBAN_DETAIL_SECTION_CLASS}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">Метки доски</h3>
                  <p className="text-sm text-muted-foreground">
                    Новые метки создаются прямо в карточке. Здесь можно поменять цвет через палитру или удалить метку.
                  </p>
                </div>
	                {boardLabelsLoading && <span className="text-xs text-muted-foreground">Загружаем...</span>}
	              </div>

	              {canEditSelectedBoard && (
	                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-500/15 bg-slate-900/[0.025] p-3 dark:border-slate-700/80 dark:bg-slate-950/40">
	                  <Input
	                    value={settingsLabelDraft}
	                    onChange={(event) => setSettingsLabelDraft(event.target.value)}
	                    placeholder="Название новой метки"
	                    className={`${KANBAN_PANEL_INPUT_CLASS} min-w-[220px] flex-1`}
	                    disabled={saveLabelMutation.isPending}
	                    onKeyDown={(event) => {
	                      if (event.key !== "Enter") return;
	                      event.preventDefault();
	                      handleCreateSettingsLabel();
	                    }}
	                  />
	                  <Button className="rounded-xl" onClick={handleCreateSettingsLabel} disabled={!settingsLabelDraft.trim() || saveLabelMutation.isPending}>
	                    <Plus className="mr-1 h-4 w-4" />
	                    Добавить метку
	                  </Button>
	                </div>
	              )}

	              <div className="mt-4 space-y-3">
                {boardLabels.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-400/25 bg-slate-900/[0.025] px-4 py-5 text-sm text-muted-foreground dark:border-slate-700/80 dark:bg-slate-950/40">
                    Меток пока нет. Создай первую из detail modal карточки.
                  </div>
                ) : (
                  boardLabels.map((label) => (
                    <div
                      key={label.id}
                      className="rounded-2xl border border-slate-500/15 bg-slate-900/[0.03] p-4 dark:border-slate-700/80 dark:bg-slate-950/40"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
	                        {editingSettingsLabelId === label.id ? (
	                          <Input
	                            value={editingSettingsLabelName}
	                            onChange={(event) => setEditingSettingsLabelName(event.target.value)}
	                            autoFocus
	                            className={`${KANBAN_PANEL_INPUT_CLASS} max-w-[260px]`}
	                            disabled={saveLabelMutation.isPending}
	                            onKeyDown={(event) => {
	                              if (event.key === "Escape") {
	                                event.preventDefault();
	                                handleCancelSettingsLabelEdit();
	                              }
	                              if (event.key === "Enter") {
	                                event.preventDefault();
	                                handleCommitSettingsLabelEdit(label);
	                              }
	                            }}
	                            onBlur={() => handleCommitSettingsLabelEdit(label)}
	                          />
	                        ) : (
	                          <Badge
	                            variant="outline"
	                            className="cursor-text rounded-full border-transparent px-3 py-1.5"
	                            style={{ backgroundColor: label.color || "rgba(148, 163, 184, 0.18)", color: "#111827" }}
	                            onDoubleClick={() => handleBeginSettingsLabelEdit(label)}
	                          >
	                            {label.name}
	                          </Badge>
	                        )}
	                        {canEditSelectedBoard && (
	                          <div className="flex items-center gap-1">
	                            <Button
	                              variant="ghost"
	                              size="icon"
	                              className="h-8 w-8 rounded-xl"
	                              onClick={() => handleBeginSettingsLabelEdit(label)}
	                              disabled={saveLabelMutation.isPending}
	                              title="Переименовать"
	                            >
	                              <Pencil className="h-4 w-4" />
	                            </Button>
	                            <Button
	                              variant="ghost"
	                              size="sm"
	                              className="rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300"
	                              onClick={() => {
	                                if (!confirmDelete(`Удалить метку "${label.name}"?`)) return;
	                                deleteLabelMutation.mutate(label.id);
	                              }}
	                              disabled={deleteLabelMutation.isPending}
	                            >
	                              Удалить
	                            </Button>
	                          </div>
	                        )}
                      </div>

                      {canEditSelectedBoard && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {LABEL_COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              className={[
                                "h-8 w-8 rounded-xl border transition hover:scale-105",
                                label.color === preset.value ? "border-slate-950 ring-2 ring-slate-950/20 dark:border-white dark:ring-white/25" : "border-white/50",
                              ].join(" ")}
                              style={{ backgroundColor: preset.value }}
                              title={preset.label}
                              aria-label={`Цвет метки ${preset.label}`}
                              onClick={() => saveLabelMutation.mutate({ labelId: label.id, name: label.name, color: preset.value })}
                              disabled={saveLabelMutation.isPending}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-500/15 bg-slate-900/[0.03] px-6 py-4 dark:border-slate-700/70 dark:bg-slate-950/30">
            <Button variant="outline" className="rounded-xl" onClick={() => setBoardSettingsOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
