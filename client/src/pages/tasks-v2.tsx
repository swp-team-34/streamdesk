import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DraggableStyle, type DropResult } from "@hello-pangea/dnd";
import {
  ArrowDown,
  ArrowLeft,
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  KanbanBoardFormDialog,
  type BoardVisibility,
  type KanbanBoardFormState,
} from "@/components/kanban/kanban-board-form-dialog";
import {
  KanbanBoardMembersSection,
  type KanbanBoardMemberView,
  type MemberFormState,
} from "@/components/kanban/kanban-board-members-section";
import {
  KanbanBoardStatsDialog,
  type BoardCompletionGroup,
  type BoardCompletionSection,
} from "@/components/kanban/kanban-board-stats-dialog";
import { KanbanBoardSettingsDialog } from "@/components/kanban/kanban-board-settings-dialog";
import { KanbanBoardNavigation } from "@/components/kanban/kanban-board-navigation";
import { KanbanBoardCard } from "@/components/kanban/kanban-board-card";
import {
  KanbanBoardToolbar,
  type BoardListGrouping,
  type BoardViewMode,
} from "@/components/kanban/kanban-board-toolbar";
import {
  EMPTY_KANBAN_CARD_FILTERS,
  KanbanCardFiltersDialog,
} from "@/components/kanban/kanban-card-filters-dialog";
import { KanbanCardAdvancedSections } from "@/components/kanban/kanban-card-advanced-sections";
import { KanbanCardCustomFieldsEditor } from "@/components/kanban/kanban-card-custom-fields-editor";
import {
  KanbanCardDetailDialog,
  type KanbanDetailSaveStatus as DetailSaveStatus,
} from "@/components/kanban/kanban-card-detail-dialog";
import { KanbanCardDetailFields } from "@/components/kanban/kanban-card-detail-fields";
import {
  KanbanCardLocationContext,
  KanbanCardMetadata,
} from "@/components/kanban/kanban-card-detail-summary";
import { KanbanCardLabelsEditor } from "@/components/kanban/kanban-card-labels-editor";
import { KanbanCardListRow } from "@/components/kanban/kanban-card-list-row";
import { KanbanListViewGroup } from "@/components/kanban/kanban-list-view-group";
import {
  KanbanCustomFieldsSection,
  type KanbanCustomFieldFormState,
} from "@/components/kanban/kanban-custom-fields-section";
import {
  KanbanLabelGroupsSection,
  type KanbanLabelGroupFormState,
} from "@/components/kanban/kanban-label-groups-section";
import {
  KanbanLabelsSection,
  LABEL_COLOR_PRESETS,
} from "@/components/kanban/kanban-labels-section";
import { KanbanSmartInputHelpDialog } from "@/components/kanban/kanban-smart-input-help-dialog";
import {
  KANBAN_BOARD_GHOST_BADGE_CLASS,
  KANBAN_BOARD_SOFT_BADGE_CLASS,
  KANBAN_DETAIL_SECTION_CLASS,
  KANBAN_PANEL_CARD_CLASS,
  KANBAN_PANEL_HEADER_CLASS,
  KANBAN_PANEL_INPUT_CLASS,
  KANBAN_PANEL_SELECT_CLASS,
} from "@/components/kanban/kanban-styles";
import { useToast } from "@/hooks/use-toast";
import { useDeadlineNow } from "@/hooks/use-deadline-now";
import { useRealtimeSubscriptions } from "@/hooks/use-websocket";
import { apiRequest } from "@/lib/queryClient";
import { canEditEquipment } from "@/lib/equipment-permissions";
import { registerWorkspaceFlushHandler } from "@/lib/workspace-switch";
import { useWorkspace } from "@/contexts/workspace-context";
import {
  type DueDateStatus,
  formatDueDateLabel,
  getDueDateStatus,
  getDueDateStatusLabel,
  toDateTimeLocalValue,
} from "@/lib/task-dates";
import {
  getTaskManagerLocationValue,
  matchesTaskManagerWorkloadFilter,
} from "@/lib/task-manager-filters";
import {
  compareTaskManagerCards,
  type TaskManagerSortBy,
  type TaskManagerSortDirection,
} from "@/lib/task-manager-sort";
import {
  getKanbanBoardSelectionStorageKey,
  resolveKanbanBoardSelection,
} from "@/lib/kanban-board-selection";
import {
  getCardLocationIds,
  getCompletionSummary,
  getSubtaskProgress,
  moveKanbanCards,
  normalizeCustomFieldDefinitions,
  normalizeCustomFieldOptions,
  normalizeLabelGroups,
  normalizeLabelIds,
  normalizeLocationIds,
  normalizeSubtasks,
  reorderKanbanLists,
  type KanbanCardAttachmentView,
  type KanbanCardHistoryView,
  type KanbanCardPriority,
  type KanbanCardView,
  type KanbanCustomFieldDefinition,
  type KanbanCustomFieldType,
  type KanbanLabelGroupView,
  type KanbanLabelView,
  type KanbanListType,
  type KanbanListView,
  type KanbanSubtask,
} from "@/lib/kanban-board-model";
import {
  serializeCardForm,
  type KanbanCardDetailForm,
} from "@/lib/kanban-card-detail-state";
import {
  getAvailableEquipmentToLink,
  type EquipmentSummaryView,
  type KanbanBoardEquipmentLinksResponse,
  type KanbanEquipmentLinkView,
} from "@/lib/kanban-equipment-links";
import {
  CARD_PRIORITY_LABELS,
  LIST_TYPE_LABELS,
  formatCustomFieldValue,
  toSoftColor,
} from "@/lib/kanban-presentation";
import {
  matchesKanbanCustomFieldFilter,
} from "@/lib/kanban-custom-field-filters";
import {
  getKanbanMentionQuery,
  insertKanbanMention,
  parseKanbanSmartInput,
} from "@/lib/kanban-smart-input";
import {
  getKanbanCardAssigneeUserIds,
  getKanbanCardInitiatorUserId,
  getKanbanCardWorkloadUserIds,
} from "@shared/kanban-card-roles";

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
  customFields?: KanbanCustomFieldDefinition[];
  labelGroups?: KanbanLabelGroupView[];
  canManage?: boolean;
  canEdit?: boolean;
  canComment?: boolean;
  isMember?: boolean;
  membershipRole?: string | null;
}

const EMPTY_BOARD_FORM: KanbanBoardFormState = {
  companyId: "",
  name: "",
  description: "",
  visibility: "personal",
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

const BOARD_VIEW_MODE_STORAGE_KEY = "streamdesk.tasks.v2.viewMode";
const BOARD_LIST_GROUPING_STORAGE_KEY = "streamdesk.tasks.v2.listGrouping";
const LIST_VIEW_ALL_DROPPABLE_ID = "list-view:all";
const DETAIL_AUTOSAVE_DELAY_MS = 700;

const EMPTY_CARD_FORM: KanbanCardDetailForm = {
  listId: "",
  title: "",
  description: "",
  priority: "medium" as KanbanCardPriority,
  startDate: "",
  startDateHasTime: true,
  dueDate: "",
  dueDateHasTime: true,
  locationId: "",
  locationIds: [] as string[],
  initiatorUserId: "",
  responsibleUserId: "",
  assigneeUserIds: [] as string[],
  assigneeUserId: "",
  labelIds: [] as string[],
  customFieldValues: {} as Record<string, unknown>,
};

const EMPTY_LABEL_FORM = {
  name: "",
  color: "",
  groupId: "",
};

const EMPTY_CUSTOM_FIELD_FORM: KanbanCustomFieldFormState = {
  name: "",
  type: "text" as KanbanCustomFieldType,
  options: "",
  required: false,
  showOnCard: true,
  showInList: true,
};

const EMPTY_LABEL_GROUP_FORM: KanbanLabelGroupFormState = {
  name: "",
  color: "",
};

const EMPTY_MEMBER_FORM: MemberFormState = {
  userId: "",
  role: "viewer",
  canComment: false,
};

const DEFAULT_KANBAN_CUSTOM_FIELD_TEMPLATES = [
  { name: "File Storage Location", type: "text" as KanbanCustomFieldType, showOnCard: true, showInList: true },
  { name: "Recording Date", type: "date" as KanbanCustomFieldType, showOnCard: true, showInList: true },
];

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const getDraggableCardStyle = (
  style: DraggableStyle | undefined,
): CSSProperties | undefined => {
  return style as CSSProperties | undefined;
};

const confirmDelete = (message: string) =>
  typeof window !== "undefined" && window.confirm(message);

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
  startDateHasTime?: boolean;
  dueDate?: string | null;
  dueDateHasTime?: boolean;
  locationIds?: string[];
  initiatorUserId?: string | null;
  responsibleUserId?: string | null;
  assigneeUserIds?: string[];
  assigneeUserId?: string | null;
  labelIds?: string[];
  customFieldValues?: Record<string, unknown>;
  inlineListId?: string;
}

interface SaveLabelInput {
  labelId?: string | null;
  name?: string;
  color?: string | null;
  groupId?: string | null;
  attachToDetail?: boolean;
}

interface SaveCustomFieldInput {
  fieldId?: string | null;
  form?: typeof EMPTY_CUSTOM_FIELD_FORM;
}

interface SaveLabelGroupInput {
  groupId?: string | null;
  form?: typeof EMPTY_LABEL_GROUP_FORM;
}

interface SaveCardDetailInput {
  form?: typeof EMPTY_CARD_FORM;
  silent?: boolean;
  closeAfter?: boolean;
}

export default function TasksV2Page() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { workspace } = useWorkspace();
  const deadlineNow = useDeadlineNow();
  const currentUser = useMemo(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(window.localStorage.getItem("streamstudio_user") || "null");
    } catch {
      return null;
    }
  }, []);
  const boardSelectionStorageKey = useMemo(
    () => getKanbanBoardSelectionStorageKey({
      userId: currentUser?.id,
      workspaceType: workspace?.type,
      companyId: workspace?.companyId,
    }),
    [currentUser?.id, workspace?.companyId, workspace?.type],
  );
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
  const [cardFilters, setCardFilters] = useState(EMPTY_KANBAN_CARD_FILTERS);
  const [cardSortBy, setCardSortBy] = useState<TaskManagerSortBy>("position");
  const [cardSortDirection, setCardSortDirection] = useState<TaskManagerSortDirection>("asc");
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [smartInputHelpOpen, setSmartInputHelpOpen] = useState(false);
  const [boardStatsOpen, setBoardStatsOpen] = useState(false);
  const [detailCardForm, setDetailCardForm] = useState(EMPTY_CARD_FORM);
  const [detailSubtaskDraft, setDetailSubtaskDraft] = useState("");
  const [boardViewMode, setBoardViewMode] = useState<BoardViewMode>(() => {
    if (typeof window === "undefined") return "kanban";
    const stored = window.localStorage.getItem(BOARD_VIEW_MODE_STORAGE_KEY);
    return stored === "list" ? "list" : "kanban";
  });
  const [listGrouping, setListGrouping] = useState<BoardListGrouping>(() => {
    if (typeof window === "undefined") return "list";
    const stored = window.localStorage.getItem(BOARD_LIST_GROUPING_STORAGE_KEY);
    if (!stored) return "list";
    return stored === "none" || stored === "list" || stored === "due" || stored === "assignee" || stored === "priority" || stored.startsWith("field:")
      ? (stored as BoardListGrouping)
      : "list";
  });
  const [boardSettingsOpen, setBoardSettingsOpen] = useState(false);
  const [boardDialogOpen, setBoardDialogOpen] = useState(false);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [inlineListOpen, setInlineListOpen] = useState(false);
  const [inlineListTitle, setInlineListTitle] = useState("");
  const [inlineCardListId, setInlineCardListId] = useState<string | null>(null);
  const [inlineCardTitle, setInlineCardTitle] = useState("");
  const [inlineEditingCardId, setInlineEditingCardId] = useState<string | null>(null);
  const [inlineEditingCardTitle, setInlineEditingCardTitle] = useState("");
  const [detailLabelQuery, setDetailLabelQuery] = useState("");
  const [detailSaveStatus, setDetailSaveStatus] = useState<DetailSaveStatus>("idle");
  const [detailSaveError, setDetailSaveError] = useState("");
  const [detailAdvancedOpen, setDetailAdvancedOpen] = useState(false);
  const [inlineSmartCancelledTokenIds, setInlineSmartCancelledTokenIds] = useState<string[]>([]);
  const [detailSmartCancelledTokenIds, setDetailSmartCancelledTokenIds] = useState<string[]>([]);
  const [detailHistoryExpanded, setDetailHistoryExpanded] = useState(false);
  const [equipmentLinkSelection, setEquipmentLinkSelection] = useState("");
  const [settingsLabelDraft, setSettingsLabelDraft] = useState("");
  const [editingSettingsLabelId, setEditingSettingsLabelId] = useState<string | null>(null);
  const [editingSettingsLabelName, setEditingSettingsLabelName] = useState("");
  const [customFieldForm, setCustomFieldForm] = useState(EMPTY_CUSTOM_FIELD_FORM);
  const [editingCustomFieldId, setEditingCustomFieldId] = useState<string | null>(null);
  const [labelGroupForm, setLabelGroupForm] = useState(EMPTY_LABEL_GROUP_FORM);
  const [editingLabelGroupId, setEditingLabelGroupId] = useState<string | null>(null);
  const [listViewDraftListId, setListViewDraftListId] = useState("");
  const [listViewGroupDrafts, setListViewGroupDrafts] = useState<Record<string, string>>({});
  const detailAutosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailLastSavedSignatureRef = useRef("");
  const initialBoardIdRef = useRef<string | null>(
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("boardId"),
  );
  const initialCardIdRef = useRef<string | null>(
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("cardId"),
  );

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
  const { data: locations = [] } = useQuery<Array<{
    id: string;
    companyId?: string | null;
    name: string;
    archivedAt?: string | Date | null;
  }>>({
    queryKey: ["/api/locations", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/locations?archive=all");
      return await res.json();
    },
  });

  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === selectedBoardId) ?? null,
    [boards, selectedBoardId],
  );
  const invalidateProjectTaskStatsForBoard = (boardId?: string | null, projectId?: string | null) => {
    const resolvedProjectId = projectId || boards.find((board) => board.id === boardId)?.projectId;
    if (!resolvedProjectId) return;
    queryClient.invalidateQueries({ queryKey: ["/api/projects", resolvedProjectId, "task-stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
  };
  const invalidateEquipmentContext = (boardId?: string | null, projectId?: string | null) => {
    if (boardId) {
      queryClient.invalidateQueries({ queryKey: ["kanban-equipment-links", boardId] });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
    queryClient.invalidateQueries({ queryKey: ["/api/equipment-on-projects"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
    invalidateProjectTaskStatsForBoard(boardId, projectId);
  };

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
  const cardDiscussionChannels = useMemo(
    () => [
      ...cards.map((card) => `kanban-card:${card.id}:comments`),
      selectedBoard?.companyId ? `company:${selectedBoard.companyId}` : null,
    ].filter(Boolean) as string[],
    [cards, selectedBoard?.companyId],
  );
  useRealtimeSubscriptions(cardDiscussionChannels, (message) => {
    if (
      (message.type !== "discussion_event" && message.type !== "realtime_reconnected") ||
      !selectedBoardId
    ) {
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
    queryClient.invalidateQueries({ queryKey: ["kanban-equipment-links", selectedBoardId] });
    if (detailCardId) {
      queryClient.invalidateQueries({ queryKey: ["kanban-card", selectedBoardId, detailCardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-card-comments", selectedBoardId, detailCardId] });
    }
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
  const { data: boardCustomFields = [], isLoading: boardCustomFieldsLoading } = useQuery<KanbanCustomFieldDefinition[]>({
    queryKey: ["kanban-custom-fields", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/custom-fields`);
      return await res.json();
    },
  });
  const { data: boardLabelGroups = [], isLoading: boardLabelGroupsLoading } = useQuery<KanbanLabelGroupView[]>({
    queryKey: ["kanban-label-groups", selectedBoardId],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/label-groups`);
      return await res.json();
    },
  });
  const { data: equipment = [] } = useQuery<EquipmentSummaryView[]>({
    queryKey: ["/api/equipment"],
    enabled: !!selectedBoardId,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/equipment");
      return await res.json();
    },
  });
  const {
    data: boardEquipmentLinks = { cards: {} },
    isLoading: equipmentLinksLoading,
  } = useQuery<KanbanBoardEquipmentLinksResponse>({
    queryKey: ["kanban-equipment-links", selectedBoardId],
    enabled: !!selectedBoardId && Boolean(selectedBoard?.companyId),
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/kanban/boards/${selectedBoardId}/equipment-links`);
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
  const equipmentLinksByCardId = useMemo(
    () => new Map(Object.entries(boardEquipmentLinks.cards || {})),
    [boardEquipmentLinks.cards],
  );
  const activeCustomFields = useMemo(
    () => normalizeCustomFieldDefinitions(boardCustomFields.length > 0 ? boardCustomFields : selectedBoard?.customFields),
    [boardCustomFields, selectedBoard?.customFields],
  );
  const activeLabelGroups = useMemo(
    () => normalizeLabelGroups(boardLabelGroups.length > 0 ? boardLabelGroups : selectedBoard?.labelGroups),
    [boardLabelGroups, selectedBoard?.labelGroups],
  );
  const labelGroupById = useMemo(
    () => new Map(activeLabelGroups.map((group) => [group.id, group])),
    [activeLabelGroups],
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
  const inlineSmartInput = useMemo(
    () => parseKanbanSmartInput(inlineCardTitle, {
      users: availableAssignees,
      cancelledTokenIds: inlineSmartCancelledTokenIds,
    }),
    [availableAssignees, inlineCardTitle, inlineSmartCancelledTokenIds],
  );
  const inlineMentionSuggestions = useMemo(() => {
    const query = getKanbanMentionQuery(inlineCardTitle);
    if (query == null) return [];
    return availableAssignees
      .filter((user) => [user.name, user.username]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase("ru").includes(query)))
      .slice(0, 6);
  }, [availableAssignees, inlineCardTitle]);
  const detailSmartInput = useMemo(
    () => parseKanbanSmartInput(detailCardForm.title, {
      users: availableAssignees,
      cancelledTokenIds: detailSmartCancelledTokenIds,
    }),
    [availableAssignees, detailCardForm.title, detailSmartCancelledTokenIds],
  );
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
  const overdueCardsCount = useMemo(() => {
    const listById = new Map(lists.map((list) => [list.id, list]));
    return cards.filter((card) => {
      const listType = listById.get(card.listId)?.type;
      const isComplete = listType === "closed" || listType === "archive" || listType === "trash";
      return getDueDateStatus(card.dueDate, { isComplete, now: deadlineNow }) === "overdue";
    }).length;
  }, [cards, deadlineNow, lists]);
  const boardCompletionStats = useMemo(() => {
    const listById = new Map(lists.map((list) => [list.id, list]));
    const overview = getCompletionSummary(cards, listById);
    const locationFields = activeCustomFields.filter((field) => {
      const normalized = field.name.toLowerCase();
      return ["location", "мест", "локац", "студ"].some((marker) => normalized.includes(marker));
    });

    const makeGroup = (
      id: string,
      title: string,
      sourceCards: KanbanCardView[],
      hint?: string,
    ): BoardCompletionGroup => ({
      id,
      title,
      hint,
      summary: getCompletionSummary(sourceCards, listById),
    });

    const listGroups = lists.map((list) =>
      makeGroup(list.id, list.name, cards.filter((card) => card.listId === list.id), LIST_TYPE_LABELS[list.type]),
    );

    const assigneeIds = Array.from(new Set(cards.flatMap((card) => {
      const workloadUserIds = getKanbanCardWorkloadUserIds(card);
      return workloadUserIds.length > 0 ? workloadUserIds : ["unassigned"];
    })));
    const assigneeGroups = assigneeIds.map((assigneeId) =>
      makeGroup(
        assigneeId,
        assigneeId === "unassigned" ? "Без исполнителя" : userById.get(assigneeId)?.name || assigneeId,
        cards.filter((card) => {
          const workloadUserIds = getKanbanCardWorkloadUserIds(card);
          return assigneeId === "unassigned"
            ? workloadUserIds.length === 0
            : workloadUserIds.includes(assigneeId);
        }),
      ),
    );

    const locationGroups = locationFields.flatMap((field) => {
      const values = Array.from(
        new Set(cards.map((card) => formatCustomFieldValue(field, card.customFieldValues?.[field.id], userById)).filter(Boolean)),
      );
      return values.map((value) =>
        makeGroup(
          `${field.id}:${value}`,
          value,
          cards.filter((card) => formatCustomFieldValue(field, card.customFieldValues?.[field.id], userById) === value),
          field.name,
        ),
      );
    });

    const labelGroups = boardLabels.map((label) =>
      makeGroup(
        label.id,
        label.name,
        cards.filter((card) => normalizeLabelIds(card.labelIds).includes(label.id)),
        label.groupId ? labelGroupById.get(label.groupId)?.name : "Метка",
      ),
    );
    const groupedLabelGroups = activeLabelGroups.map((group) =>
      makeGroup(
        `group:${group.id}`,
        group.name,
        cards.filter((card) =>
          normalizeLabelIds(card.labelIds).some((labelId) => String(labelById.get(labelId)?.groupId || "") === group.id),
        ),
        "Группа меток",
      ),
    );

    const stageGroups = Object.entries(LIST_TYPE_LABELS).map(([type, label]) =>
      makeGroup(
        type,
        label,
        cards.filter((card) => listById.get(card.listId)?.type === type),
      ),
    );

    const sections: BoardCompletionSection[] = [
      {
        id: "stream",
        title: "Потоки / списки",
        description: "Completion по каждому списку текущей доски.",
        emptyLabel: "На доске пока нет списков.",
        groups: listGroups,
      },
      {
        id: "assignee",
        title: "Исполнители",
        description: "Completion по участникам, которым назначены карточки.",
        emptyLabel: "Назначенных задач пока нет.",
        groups: assigneeGroups,
      },
      {
        id: "location",
        title: "Локации",
        description: "Completion по custom fields, похожим на место или локацию.",
        emptyLabel: "Поле локации пока не найдено или не заполнено.",
        groups: locationGroups,
      },
      {
        id: "tags",
        title: "Метки и группы",
        description: "Completion по меткам и группам меток.",
        emptyLabel: "Метки пока не назначены карточкам.",
        groups: [...groupedLabelGroups, ...labelGroups],
      },
      {
        id: "stage",
        title: "Стадии проекта",
        description: "Completion по типам списков: активные, закрытые, архив, корзина.",
        emptyLabel: "Стадии пока не заполнены.",
        groups: stageGroups,
      },
    ].map((section) => ({
      ...section,
      groups: section.groups
        .filter((group) => group.summary.total > 0 || section.id === "stream" || section.id === "stage")
        .sort((a, b) => b.summary.total - a.summary.total || a.title.localeCompare(b.title, "ru")),
    }));

    return { overview, sections };
  }, [activeCustomFields, activeLabelGroups, boardLabels, cards, labelById, labelGroupById, lists, userById]);
  const boardCompletionLoading = cardsLoading || listsLoading || boardLabelsLoading || boardCustomFieldsLoading || boardLabelGroupsLoading;
  const hasActiveFilters = useMemo(
    () =>
      cardFilters.search.trim() !== "" ||
      cardFilters.status !== "all" ||
      cardFilters.assigneeUserId !== "" ||
      cardFilters.responsibleUserId !== "" ||
      cardFilters.initiatorUserId !== "" ||
      cardFilters.priority !== "all" ||
      cardFilters.dueStatus !== "all" ||
      cardFilters.workload !== "all" ||
      cardFilters.location !== "" ||
      cardFilters.labelId !== "" ||
      cardFilters.labelGroupId !== "" ||
      Object.values(cardFilters.customFieldValues).some((value) => value.trim() !== ""),
    [cardFilters],
  );

  const locationFilterOptions = useMemo(() => {
    const locations = new Set<string>();
    for (const card of cards) {
      const location = getTaskManagerLocationValue(card.customFieldValues, activeCustomFields);
      if (location) locations.add(location);
    }
    return Array.from(locations).sort((left, right) => left.localeCompare(right, "ru", { numeric: true, sensitivity: "base" }));
  }, [activeCustomFields, cards]);

  const filteredCards = useMemo(() => {
    const search = cardFilters.search.trim().toLowerCase();
    const listById = new Map(lists.map((list) => [list.id, list]));
    const now = deadlineNow;

    return cards.filter((card) => {
      const list = listById.get(card.listId);
      const isCompleteLikeList = list?.type === "closed" || list?.type === "archive" || list?.type === "trash";

      if (search) {
        const labelTexts = normalizeLabelIds(card.labelIds).flatMap((labelId) => {
          const label = labelById.get(labelId);
          const group = label?.groupId ? labelGroupById.get(label.groupId) : null;
          return [label?.name, group?.name].filter(Boolean) as string[];
        });
        const customFieldTexts = activeCustomFields
          .filter((field) => field.showOnCard !== false || field.showInList !== false)
          .map((field) => formatCustomFieldValue(field, card.customFieldValues?.[field.id], userById))
          .filter(Boolean);
        const roleUsers = [
          ...getKanbanCardAssigneeUserIds(card),
          card.responsibleUserId,
          getKanbanCardInitiatorUserId(card),
        ].filter(Boolean).map((userId) => userById.get(String(userId))?.name || String(userId));
        const haystack = [
          card.title,
          card.description || "",
          ...roleUsers,
          list?.name || "",
          list ? LIST_TYPE_LABELS[list.type] : "",
          CARD_PRIORITY_LABELS[card.priority],
          ...labelTexts,
          ...customFieldTexts,
        ].join(" ").toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      if (cardFilters.status !== "all") {
        if (cardFilters.status.startsWith("list:")) {
          if (card.listId !== cardFilters.status.slice(5)) return false;
        } else if (cardFilters.status.startsWith("type:")) {
          if (list?.type !== cardFilters.status.slice(5)) return false;
        }
      }

      if (
        cardFilters.assigneeUserId &&
        !getKanbanCardAssigneeUserIds(card).includes(cardFilters.assigneeUserId)
      ) {
        return false;
      }

      if (
        cardFilters.responsibleUserId &&
        String(card.responsibleUserId || "") !== cardFilters.responsibleUserId
      ) {
        return false;
      }

      if (
        cardFilters.initiatorUserId &&
        getKanbanCardInitiatorUserId(card) !== cardFilters.initiatorUserId
      ) {
        return false;
      }

      if (cardFilters.priority !== "all" && card.priority !== cardFilters.priority) {
        return false;
      }

      if (cardFilters.labelId && !normalizeLabelIds(card.labelIds).includes(cardFilters.labelId)) {
        return false;
      }

      if (cardFilters.labelGroupId) {
        const hasGroup = normalizeLabelIds(card.labelIds).some((labelId) => {
          const label = labelById.get(labelId);
          return String(label?.groupId || "") === cardFilters.labelGroupId;
        });
        if (!hasGroup) return false;
      }

      for (const [fieldId, rawNeedle] of Object.entries(cardFilters.customFieldValues)) {
        if (!rawNeedle.trim()) continue;
        const field = activeCustomFields.find((item) => item.id === fieldId);
        if (!field) continue;
        const rawValue = card.customFieldValues?.[field.id];
        const value = formatCustomFieldValue(field, rawValue, userById);
        if (!matchesKanbanCustomFieldFilter(field, rawValue, rawNeedle, value)) return false;
      }

      if (cardFilters.dueStatus !== "all") {
        const dueStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList, now });
        if (dueStatus !== cardFilters.dueStatus) return false;
      }

      if (!matchesTaskManagerWorkloadFilter(
        {
          assigneeUserId: getKanbanCardWorkloadUserIds(card)[0] || null,
          dueDate: card.dueDate,
          listType: list?.type,
        },
        cardFilters.workload,
        now,
      )) {
        return false;
      }

      if (cardFilters.location) {
        const location = getTaskManagerLocationValue(card.customFieldValues, activeCustomFields);
        if (location !== cardFilters.location) return false;
      }

      return true;
    });
  }, [activeCustomFields, cardFilters, cards, deadlineNow, labelById, labelGroupById, lists, userById]);

  const sortedFilteredCards = useMemo(() => {
    const listById = new Map(lists.map((list) => [list.id, list]));
    return [...filteredCards].sort((left, right) =>
      compareTaskManagerCards(left, right, {
        sortBy: cardSortBy,
        sortDirection: cardSortBy === "deadline" ? "asc" : cardSortDirection,
        listsById: listById,
        now: deadlineNow,
      }),
    );
  }, [cardSortBy, cardSortDirection, deadlineNow, filteredCards, lists]);

  const filteredCardsByListId = useMemo(() => {
    const groupedCards = new Map<string, KanbanCardView[]>();

    for (const card of sortedFilteredCards) {
      const listCards = groupedCards.get(card.listId) ?? [];
      listCards.push(card);
      groupedCards.set(card.listId, listCards);
    }

    return groupedCards;
  }, [sortedFilteredCards]);

  const listViewGroups = useMemo(() => {
    const groups = new Map<string, { id: string; title: string; cards: KanbanCardView[]; droppableListId?: string }>();
    const listById = new Map(lists.map((list) => [list.id, list]));
    const addCard = (id: string, title: string, card: KanbanCardView, droppableListId?: string) => {
      const group = groups.get(id) ?? { id, title, cards: [], droppableListId };
      group.cards.push(card);
      groups.set(id, group);
    };

    for (const card of sortedFilteredCards) {
      if (listGrouping === "none") {
        addCard("all", "Все задачи", card);
        continue;
      }

      if (listGrouping === "list") {
        const list = listById.get(card.listId);
        addCard(card.listId || "no-list", list?.name || "Без списка", card, card.listId || undefined);
        continue;
      }

      if (listGrouping === "due") {
        const list = listById.get(card.listId);
        const isCompleteLikeList = list?.type === "closed" || list?.type === "archive" || list?.type === "trash";
        const dueStatus = getDueDateStatus(card.dueDate, { isComplete: isCompleteLikeList, now: deadlineNow });
        addCard(dueStatus, getDueDateStatusLabel(dueStatus), card);
        continue;
      }

      if (listGrouping === "assignee") {
        const assigneeIds = getKanbanCardAssigneeUserIds(card);
        if (assigneeIds.length === 0) {
          addCard("unassigned", "Без исполнителя", card);
        } else {
          assigneeIds.forEach((assigneeId) =>
            addCard(assigneeId, userById.get(assigneeId)?.name || assigneeId, card),
          );
        }
        continue;
      }

      if (listGrouping.startsWith("field:")) {
        const fieldId = listGrouping.slice("field:".length);
        const field = activeCustomFields.find((item) => item.id === fieldId);
        const value = field ? formatCustomFieldValue(field, card.customFieldValues?.[field.id], userById) : "";
        addCard(value || "empty", value ? `${field?.name || "Поле"}: ${value}` : `${field?.name || "Поле"}: пусто`, card);
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

    return Array.from(groups.values()).map((group) => ({
      ...group,
      cards: [...group.cards].sort((a, b) => {
        const sortOrder = compareTaskManagerCards(a, b, {
          sortBy: cardSortBy,
          sortDirection: cardSortBy === "deadline" ? "asc" : cardSortDirection,
          listsById: listById,
          now: deadlineNow,
        });
        if (sortOrder !== 0 || !listGrouping.startsWith("field:")) return sortOrder;
        const fieldId = listGrouping.slice("field:".length);
        const field = activeCustomFields.find((item) => item.id === fieldId);
        if (!field) return sortOrder;
        const left = formatCustomFieldValue(field, a.customFieldValues?.[field.id], userById);
        const right = formatCustomFieldValue(field, b.customFieldValues?.[field.id], userById);
        return left.localeCompare(right, "ru", { numeric: true, sensitivity: "base" });
      }),
    }));
  }, [activeCustomFields, cardSortBy, cardSortDirection, deadlineNow, listGrouping, lists, sortedFilteredCards, userById]);

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

    if (entry.action === "roles_updated") {
      const oldAssignees = Array.isArray(oldValue?.assigneeUserIds)
        ? (oldValue.assigneeUserIds as unknown[]).map(getUserNameById)
        : [];
      const newAssignees = Array.isArray(newValue?.assigneeUserIds)
        ? (newValue.assigneeUserIds as unknown[]).map(getUserNameById)
        : [];
      if (String(oldValue?.initiatorUserId || "") !== String(newValue?.initiatorUserId || "")) {
        lines.push(`Инициатор: ${getUserNameById(oldValue?.initiatorUserId)} -> ${getUserNameById(newValue?.initiatorUserId)}`);
      }
      if (String(oldValue?.responsibleUserId || "") !== String(newValue?.responsibleUserId || "")) {
        lines.push(`Ответственный: ${getUserNameById(oldValue?.responsibleUserId)} -> ${getUserNameById(newValue?.responsibleUserId)}`);
      }
      if (oldAssignees.join("|") !== newAssignees.join("|")) {
        lines.push(`Исполнители: ${oldAssignees.join(", ") || "нет"} -> ${newAssignees.join(", ") || "нет"}`);
      }
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
      const isCreated = entry.action === "created";
      const oldDescription = String(oldValue?.description || "").trim();
      const newDescription = String(newValue?.description || "").trim();
      const oldStartDate = String(oldValue?.startDate || "");
      const newStartDate = String(newValue?.startDate || "");
      const oldDueDate = String(oldValue?.dueDate || "");
      const newDueDate = String(newValue?.dueDate || "");

      if (newValue?.title !== undefined && (isCreated || oldValue?.title !== newValue.title)) {
        lines.push(`Название: ${String(newValue.title || "Без названия")}`);
      }

      if (newValue?.description !== undefined && oldDescription !== newDescription) {
        if (newDescription) {
          lines.push(isCreated ? "Описание добавлено" : "Описание обновлено");
        } else if (!isCreated && oldDescription) {
          lines.push("Описание очищено");
        }
      }

      if (
        newValue?.priority !== undefined &&
        (isCreated ? newValue.priority && newValue.priority !== "medium" : oldValue?.priority !== newValue.priority)
      ) {
        lines.push(`Приоритет: ${CARD_PRIORITY_LABELS[String(newValue.priority) as KanbanCardPriority] || String(newValue.priority)}`);
      }

      if (newValue?.listId !== undefined && (isCreated ? newValue.listId : oldValue?.listId !== newValue.listId)) {
        lines.push(isCreated ? `Список: ${getListNameById(newValue.listId)}` : `Список: ${getListNameById(oldValue?.listId)} -> ${getListNameById(newValue.listId)}`);
      }

      if (
        newValue?.assigneeUserId !== undefined &&
        (isCreated ? newValue.assigneeUserId : oldValue?.assigneeUserId !== newValue.assigneeUserId)
      ) {
        lines.push(isCreated ? `Исполнитель: ${getUserNameById(newValue.assigneeUserId)}` : `Исполнитель: ${getUserNameById(oldValue?.assigneeUserId)} -> ${getUserNameById(newValue.assigneeUserId)}`);
      }

      if (newValue?.startDate !== undefined && (isCreated ? newStartDate : oldStartDate !== newStartDate)) {
        lines.push(isCreated ? `Старт: ${formatDueDateLabel(newValue.startDate as string | Date | null) || "Не задан"}` : `Старт: ${formatDueDateLabel(oldValue?.startDate as string | Date | null) || "Не задан"} -> ${formatDueDateLabel(newValue.startDate as string | Date | null) || "Не задан"}`);
      }

      if (newValue?.dueDate !== undefined && (isCreated ? newDueDate : oldDueDate !== newDueDate)) {
        lines.push(isCreated ? `Срок: ${formatDueDateLabel(newValue.dueDate as string | Date | null) || "Не задан"}` : `Срок: ${formatDueDateLabel(oldValue?.dueDate as string | Date | null) || "Не задан"} -> ${formatDueDateLabel(newValue.dueDate as string | Date | null) || "Не задан"}`);
      }

      if (entry.action === "created" && !lines.length) {
        lines.push("Карточка создана и готова к работе");
      }

      if (newValue?.subtasks !== undefined) {
        const before = getSubtaskProgress(oldValue?.subtasks as KanbanSubtask[] | null);
        const after = getSubtaskProgress(newValue?.subtasks as KanbanSubtask[] | null);
        const subtaskProgressChanged = before.completed !== after.completed || before.total !== after.total;
        if ((isCreated && after.total > 0) || (!isCreated && subtaskProgressChanged)) {
          lines.push(`Подзадачи: ${before.completed}/${before.total} -> ${after.completed}/${after.total}`);
        }
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
    if (editingBoardId || !workspace?.type) return;
    if (workspace.type === "personal") {
      if (boardForm.visibility !== "personal" || boardForm.companyId) {
        setBoardForm((prev) => ({ ...prev, visibility: "personal", companyId: "" }));
      }
      return;
    }
    if (boardForm.visibility === "personal" || boardForm.companyId !== workspace.companyId) {
      setBoardForm((prev) => ({
        ...prev,
        visibility: prev.visibility === "members" ? "members" : "company",
        companyId: workspace.companyId || "",
      }));
    }
  }, [
    boardForm.companyId,
    boardForm.visibility,
    editingBoardId,
    workspace?.companyId,
    workspace?.type,
  ]);

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
    if (boardsLoading) return;
    if (boards.length === 0) {
      setSelectedBoardId(null);
      return;
    }
    const requestedBoardId = initialBoardIdRef.current;
    const storedBoardId = boardSelectionStorageKey && typeof window !== "undefined"
      ? window.localStorage.getItem(boardSelectionStorageKey)
      : null;
    const nextBoardId = resolveKanbanBoardSelection({
      boardIds: boards.map((board) => board.id),
      requestedBoardId,
      currentBoardId: selectedBoardId,
      storedBoardId,
    });
    if (requestedBoardId) {
      initialBoardIdRef.current = null;
    }
    if (nextBoardId !== selectedBoardId) {
      setSelectedBoardId(nextBoardId);
    }
  }, [boardSelectionStorageKey, boards, boardsLoading, selectedBoardId]);

  useEffect(() => {
    if (!boardSelectionStorageKey || !selectedBoardId || typeof window === "undefined") return;
    window.localStorage.setItem(boardSelectionStorageKey, selectedBoardId);
  }, [boardSelectionStorageKey, selectedBoardId]);

  useEffect(() => {
    if (!initialCardIdRef.current || !selectedBoardId) return;
    if (!cards.some((card) => card.id === initialCardIdRef.current)) return;
    setDetailCardId(initialCardIdRef.current);
    initialCardIdRef.current = null;
  }, [cards, selectedBoardId]);

  useEffect(() => {
    setEditingListId(null);
    setListForm(EMPTY_LIST_FORM);
    setEditingCardId(null);
    setCardForm(EMPTY_CARD_FORM);
    setDetailCardId(null);
    setDetailCardForm(EMPTY_CARD_FORM);
    setDetailSaveStatus("idle");
    setDetailSaveError("");
    setDetailAdvancedOpen(false);
    setInlineSmartCancelledTokenIds([]);
    setDetailSmartCancelledTokenIds([]);
    setDetailHistoryExpanded(false);
    setEquipmentLinkSelection("");
    detailLastSavedSignatureRef.current = "";
    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }
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
      startDate: selectedDetailCard.startDateHasTime === false
        ? toDateTimeLocalValue(selectedDetailCard.startDate).slice(0, 10)
        : toDateTimeLocalValue(selectedDetailCard.startDate),
      startDateHasTime: selectedDetailCard.startDateHasTime !== false,
      dueDate: selectedDetailCard.dueDateHasTime === false
        ? toDateTimeLocalValue(selectedDetailCard.dueDate).slice(0, 10)
        : toDateTimeLocalValue(selectedDetailCard.dueDate),
      dueDateHasTime: selectedDetailCard.dueDateHasTime !== false,
      locationId: selectedDetailCard.locationId || "",
      locationIds: getCardLocationIds(selectedDetailCard),
      initiatorUserId: getKanbanCardInitiatorUserId(selectedDetailCard) || "",
      responsibleUserId: selectedDetailCard.responsibleUserId || "",
      assigneeUserIds: getKanbanCardAssigneeUserIds(selectedDetailCard),
      assigneeUserId: getKanbanCardAssigneeUserIds(selectedDetailCard)[0] || "",
      labelIds: normalizeLabelIds(selectedDetailCard.labelIds),
      customFieldValues: selectedDetailCard.customFieldValues || {},
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
      setBoardDialogOpen(false);
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
      invalidateProjectTaskStatsForBoard(selectedBoardId, selectedBoard?.projectId);
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
      invalidateProjectTaskStatsForBoard(selectedBoardId, selectedBoard?.projectId);
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
        startDateHasTime: input?.startDateHasTime ?? cardForm.startDateHasTime,
        dueDate: input?.dueDate !== undefined ? input.dueDate : (cardForm.dueDate || null),
        dueDateHasTime: input?.dueDateHasTime ?? cardForm.dueDateHasTime,
        locationIds: input?.locationIds !== undefined ? input.locationIds : normalizeLocationIds(cardForm.locationIds),
        initiatorUserId: input?.initiatorUserId !== undefined
          ? input.initiatorUserId
          : (cardForm.initiatorUserId || currentUser?.id || null),
        responsibleUserId: input?.responsibleUserId !== undefined
          ? input.responsibleUserId
          : (cardForm.responsibleUserId || null),
        assigneeUserIds: input?.assigneeUserIds !== undefined
          ? input.assigneeUserIds
          : getKanbanCardAssigneeUserIds(cardForm),
        labelIds: normalizeLabelIds(input?.labelIds ?? cardForm.labelIds),
        customFieldValues: input?.customFieldValues ?? cardForm.customFieldValues ?? {},
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
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      invalidateProjectTaskStatsForBoard(selectedBoardId, card.projectId || selectedBoard?.projectId);
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
        setInlineSmartCancelledTokenIds([]);
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
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      invalidateProjectTaskStatsForBoard(selectedBoardId, selectedBoard?.projectId);
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

  const attachEquipmentMutation = useMutation({
    mutationFn: async ({ cardId, equipmentId }: { cardId: string; equipmentId: string }) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      const response = await apiRequest(
        "POST",
        `/api/kanban/boards/${selectedBoardId}/cards/${cardId}/equipment-links`,
        { equipmentId },
      );
      return await response.json() as { items: KanbanEquipmentLinkView[] };
    },
    onSuccess: (response, input) => {
      queryClient.setQueryData<KanbanBoardEquipmentLinksResponse>(
        ["kanban-equipment-links", selectedBoardId],
        (current) => ({
          cards: {
            ...(current?.cards || {}),
            [input.cardId]: response.items || [],
          },
        }),
      );
      invalidateEquipmentContext(selectedBoardId, selectedBoard?.projectId);
      setEquipmentLinkSelection("");
      toast({
        title: "Оборудование прикреплено",
        description: "Связь добавлена без изменения складского статуса.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось прикрепить оборудование",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const detachEquipmentMutation = useMutation({
    mutationFn: async ({ cardId, equipmentId }: { cardId: string; equipmentId: string }) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      const response = await apiRequest(
        "DELETE",
        `/api/kanban/boards/${selectedBoardId}/cards/${cardId}/equipment-links/${equipmentId}`,
      );
      return await response.json() as { items: KanbanEquipmentLinkView[] };
    },
    onSuccess: (response, input) => {
      queryClient.setQueryData<KanbanBoardEquipmentLinksResponse>(
        ["kanban-equipment-links", selectedBoardId],
        (current) => ({
          cards: {
            ...(current?.cards || {}),
            [input.cardId]: response.items || [],
          },
        }),
      );
      invalidateEquipmentContext(selectedBoardId, selectedBoard?.projectId);
      toast({
        title: "Связь удалена",
        description: "Оборудование осталось в текущем складском состоянии.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Не удалось открепить оборудование",
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
          startDateHasTime: form.startDateHasTime,
          dueDate: form.dueDate || null,
          dueDateHasTime: form.dueDateHasTime,
          locationIds: normalizeLocationIds(form.locationIds),
          initiatorUserId: form.initiatorUserId || currentUser?.id || null,
          responsibleUserId: form.responsibleUserId || null,
          assigneeUserIds: getKanbanCardAssigneeUserIds(form),
          labelIds: normalizeLabelIds(form.labelIds),
          customFieldValues: form.customFieldValues ?? {},
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
      queryClient.invalidateQueries({ queryKey: ["/api/locations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      invalidateProjectTaskStatsForBoard(selectedBoardId, card.projectId || selectedBoard?.projectId);
      detailLastSavedSignatureRef.current = serializeCardForm(input?.form ?? {
        listId: card.listId,
        title: card.title,
        description: card.description || "",
        priority: card.priority,
        startDate: card.startDateHasTime === false
          ? toDateTimeLocalValue(card.startDate).slice(0, 10)
          : toDateTimeLocalValue(card.startDate),
        startDateHasTime: card.startDateHasTime !== false,
        dueDate: card.dueDateHasTime === false
          ? toDateTimeLocalValue(card.dueDate).slice(0, 10)
          : toDateTimeLocalValue(card.dueDate),
        dueDateHasTime: card.dueDateHasTime !== false,
        locationId: card.locationId || "",
        locationIds: getCardLocationIds(card),
        initiatorUserId: getKanbanCardInitiatorUserId(card) || "",
        responsibleUserId: card.responsibleUserId || "",
        assigneeUserIds: getKanbanCardAssigneeUserIds(card),
        assigneeUserId: getKanbanCardAssigneeUserIds(card)[0] || "",
        labelIds: normalizeLabelIds(card.labelIds),
        customFieldValues: card.customFieldValues || {},
      });
      setDetailSaveStatus("saved");
      setDetailSaveError("");

      if (editingCardId === card.id) {
        setCardForm({
          listId: card.listId,
          title: card.title,
          description: card.description || "",
          priority: card.priority,
          startDate: card.startDateHasTime === false
            ? toDateTimeLocalValue(card.startDate).slice(0, 10)
            : toDateTimeLocalValue(card.startDate),
          startDateHasTime: card.startDateHasTime !== false,
          dueDate: card.dueDateHasTime === false
            ? toDateTimeLocalValue(card.dueDate).slice(0, 10)
            : toDateTimeLocalValue(card.dueDate),
          dueDateHasTime: card.dueDateHasTime !== false,
          locationId: card.locationId || "",
          locationIds: getCardLocationIds(card),
          initiatorUserId: getKanbanCardInitiatorUserId(card) || "",
          responsibleUserId: card.responsibleUserId || "",
          assigneeUserIds: getKanbanCardAssigneeUserIds(card),
          assigneeUserId: getKanbanCardAssigneeUserIds(card)[0] || "",
          labelIds: normalizeLabelIds(card.labelIds),
          customFieldValues: card.customFieldValues || {},
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
        setEquipmentLinkSelection("");
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
      invalidateProjectTaskStatsForBoard(movement.boardId, _movedCard?.projectId);
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
        groupId: input?.groupId !== undefined ? input.groupId || null : labelForm.groupId || null,
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

  const saveLabelGroupMutation = useMutation({
    mutationFn: async (input?: SaveLabelGroupInput) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      const form = input?.form ?? labelGroupForm;
      const payload = {
        name: form.name.trim(),
        color: form.color.trim() || null,
      };
      if (!payload.name) throw new Error("Название группы не может быть пустым");
      const targetGroupId = input?.groupId ?? editingLabelGroupId;
      const res = await apiRequest(
        targetGroupId ? "PUT" : "POST",
        targetGroupId
          ? `/api/kanban/boards/${selectedBoardId}/label-groups/${targetGroupId}`
          : `/api/kanban/boards/${selectedBoardId}/label-groups`,
        payload,
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-label-groups", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      setEditingLabelGroupId(null);
      setLabelGroupForm(EMPTY_LABEL_GROUP_FORM);
      toast({ title: "Группа меток сохранена", description: "Структура меток обновлена." });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось сохранить группу", description: error.message, variant: "destructive" });
    },
  });

  const deleteLabelGroupMutation = useMutation({
    mutationFn: async (groupId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      await apiRequest("DELETE", `/api/kanban/boards/${selectedBoardId}/label-groups/${groupId}`);
      return groupId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-label-groups", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["kanban-labels", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      toast({ title: "Группа архивирована", description: "Метки остались на доске." });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось архивировать группу", description: error.message, variant: "destructive" });
    },
  });

  const saveCustomFieldMutation = useMutation({
    mutationFn: async (input?: SaveCustomFieldInput) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      const form = input?.form ?? customFieldForm;
      const payload = {
        name: form.name.trim(),
        type: form.type,
        options: normalizeCustomFieldOptions(form.options),
        required: form.required,
        showOnCard: form.showOnCard,
        showInList: form.showInList,
      };
      if (!payload.name) throw new Error("Название поля не может быть пустым");
      const targetFieldId = input?.fieldId ?? editingCustomFieldId;
      const res = await apiRequest(
        targetFieldId ? "PUT" : "POST",
        targetFieldId
          ? `/api/kanban/boards/${selectedBoardId}/custom-fields/${targetFieldId}`
          : `/api/kanban/boards/${selectedBoardId}/custom-fields`,
        payload,
      );
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-custom-fields", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      setEditingCustomFieldId(null);
      setCustomFieldForm(EMPTY_CUSTOM_FIELD_FORM);
      toast({ title: "Поле сохранено", description: "Карточки получили новое свойство." });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось сохранить поле", description: error.message, variant: "destructive" });
    },
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      if (!selectedBoardId) throw new Error("Сначала выберите доску");
      await apiRequest("DELETE", `/api/kanban/boards/${selectedBoardId}/custom-fields/${fieldId}`);
      return fieldId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-custom-fields", selectedBoardId] });
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      toast({ title: "Поле архивировано", description: "Значения на карточках сохранены в истории данных." });
    },
    onError: (error: Error) => {
      toast({ title: "Не удалось архивировать поле", description: error.message, variant: "destructive" });
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

  const handleCreateBoard = () => {
    setEditingBoardId(null);
    setBoardForm({
      ...EMPTY_BOARD_FORM,
      companyId: companies[0]?.id || "",
    });
    setBoardDialogOpen(true);
  };

  const handleEditBoard = (board: KanbanBoardView) => {
    setSelectedBoardId(board.id);
    setEditingBoardId(board.id);
    setBoardForm({
      companyId: board.companyId || "",
      name: board.name,
      description: board.description || "",
      visibility: board.visibility,
    });
    setBoardDialogOpen(true);
  };

  const handleCancelBoardEdit = () => {
    setEditingBoardId(null);
    setBoardForm((prev) => ({
      ...EMPTY_BOARD_FORM,
      companyId: prev.visibility === "personal" ? "" : prev.companyId || companies[0]?.id || "",
    }));
    setBoardDialogOpen(false);
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
      startDate: card.startDateHasTime === false
        ? toDateTimeLocalValue(card.startDate).slice(0, 10)
        : toDateTimeLocalValue(card.startDate),
      startDateHasTime: card.startDateHasTime !== false,
      dueDate: card.dueDateHasTime === false
        ? toDateTimeLocalValue(card.dueDate).slice(0, 10)
        : toDateTimeLocalValue(card.dueDate),
      dueDateHasTime: card.dueDateHasTime !== false,
      locationId: card.locationId || "",
      locationIds: getCardLocationIds(card),
      initiatorUserId: getKanbanCardInitiatorUserId(card) || "",
      responsibleUserId: card.responsibleUserId || "",
      assigneeUserIds: getKanbanCardAssigneeUserIds(card),
      assigneeUserId: getKanbanCardAssigneeUserIds(card)[0] || "",
      labelIds: normalizeLabelIds(card.labelIds),
      customFieldValues: card.customFieldValues || {},
    });
  };

  const handleCancelCardEdit = () => {
    setEditingCardId(null);
    setCardForm((prev) => ({
      ...EMPTY_CARD_FORM,
      listId: lists.some((list) => list.id === prev.listId) ? prev.listId : lists[0]?.id || "",
    }));
  };

  const handleOpenCardDetail = (cardId: string, openAdvanced = false) => {
    setDetailHistoryExpanded(false);
    setDetailAdvancedOpen(openAdvanced);
    setDetailSmartCancelledTokenIds([]);
    setEquipmentLinkSelection("");
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
    setDetailSubtaskDraft("");
    setDetailSaveStatus("idle");
    setDetailSaveError("");
    setDetailAdvancedOpen(false);
    setDetailSmartCancelledTokenIds([]);
    setDetailHistoryExpanded(false);
    setEquipmentLinkSelection("");
  };

  const handleEditLabel = (label: KanbanLabelView) => {
    setEditingLabelId(label.id);
    setLabelForm({
      name: label.name,
      color: label.color || "",
      groupId: label.groupId || "",
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
    const title = inlineSmartInput.title.trim();
    if (!title || inlineSmartInput.errors.length > 0 || !canEditSelectedBoard || saveCardMutation.isPending) return;
    saveCardMutation.mutate({
      listId,
      title,
      description: null,
      priority: inlineSmartInput.priority || "medium",
      startDate: inlineSmartInput.startDate,
      startDateHasTime: inlineSmartInput.startDateHasTime,
      dueDate: inlineSmartInput.dueDate,
      dueDateHasTime: inlineSmartInput.dueDateHasTime,
      initiatorUserId: currentUser?.id || null,
      responsibleUserId: null,
      assigneeUserIds: inlineSmartInput.assigneeUserIds,
      labelIds: [],
      customFieldValues: {},
      inlineListId: listId,
    });
  };

  const handleCancelInlineCard = () => {
    setInlineCardListId(null);
    setInlineCardTitle("");
    setInlineSmartCancelledTokenIds([]);
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
      startDateHasTime: card.startDateHasTime !== false,
      dueDate: card.dueDate ? toDateTimeLocalValue(card.dueDate) : null,
      dueDateHasTime: card.dueDateHasTime !== false,
      initiatorUserId: getKanbanCardInitiatorUserId(card),
      responsibleUserId: card.responsibleUserId || null,
      assigneeUserIds: getKanbanCardAssigneeUserIds(card),
      labelIds: normalizeLabelIds(card.labelIds),
      customFieldValues: card.customFieldValues || {},
    });
  };

  const handleCancelInlineCardTitleEdit = () => {
    setInlineEditingCardId(null);
    setInlineEditingCardTitle("");
  };

  const handleDuplicateCard = (card: KanbanCardView) => {
    saveCardMutation.mutate({
      listId: card.listId,
      title: `${card.title} (копия)`,
      description: card.description || null,
      priority: card.priority,
      startDate: card.startDate
        ? card.startDateHasTime === false
          ? toDateTimeLocalValue(card.startDate).slice(0, 10)
          : toDateTimeLocalValue(card.startDate)
        : null,
      startDateHasTime: card.startDateHasTime !== false,
      dueDate: card.dueDate
        ? card.dueDateHasTime === false
          ? toDateTimeLocalValue(card.dueDate).slice(0, 10)
          : toDateTimeLocalValue(card.dueDate)
        : null,
      dueDateHasTime: card.dueDateHasTime !== false,
      initiatorUserId: currentUser?.id || null,
      responsibleUserId: card.responsibleUserId || null,
      assigneeUserIds: getKanbanCardAssigneeUserIds(card),
      locationIds: getCardLocationIds(card),
      labelIds: normalizeLabelIds(card.labelIds),
      customFieldValues: card.customFieldValues || {},
    });
  };

  const handleMoveCardFromMenu = (card: KanbanCardView, targetListId: string) => {
    if (!selectedBoardId || targetListId === card.listId) return;
    const targetPosition = cards.filter((candidate) => candidate.listId === targetListId).length;
    moveCardMutation.mutate({
      boardId: selectedBoardId,
      cardId: card.id,
      targetListId,
      targetPosition,
    });
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
      { name, color, groupId: null },
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
      { labelId: label.id, name, color: label.color || null, groupId: label.groupId || null },
      { onSuccess: handleCancelSettingsLabelEdit },
    );
  };

  const handleEditLabelGroup = (group: KanbanLabelGroupView) => {
    setEditingLabelGroupId(group.id);
    setLabelGroupForm({
      name: group.name,
      color: group.color || "",
    });
  };

  const handleEditCustomField = (field: KanbanCustomFieldDefinition) => {
    setEditingCustomFieldId(field.id);
    setCustomFieldForm({
      name: field.name,
      type: field.type,
      options: (field.options ?? []).join(", "),
      required: Boolean(field.required),
      showOnCard: field.showOnCard !== false,
      showInList: field.showInList !== false,
    });
  };

  const handleCreateDefaultCustomFieldTemplates = () => {
    DEFAULT_KANBAN_CUSTOM_FIELD_TEMPLATES
      .filter((template) => !activeCustomFields.some((field) => field.name.toLowerCase() === template.name.toLowerCase()))
      .forEach((template) => {
        saveCustomFieldMutation.mutate({
          form: {
            ...EMPTY_CUSTOM_FIELD_FORM,
            ...template,
          },
        });
      });
  };

  const handleSubmitListViewGroupCard = (groupId: string, listId?: string | null) => {
    const title = (listViewGroupDrafts[groupId] || "").trim();
    const targetListId = listId || listViewDraftListId || lists[0]?.id || "";
    if (!title || !targetListId || !canEditSelectedBoard || saveCardMutation.isPending) return;

    saveCardMutation.mutate(
      {
        listId: targetListId,
        title,
        description: null,
        priority: "medium",
        startDate: null,
        startDateHasTime: true,
        dueDate: null,
        dueDateHasTime: true,
        initiatorUserId: currentUser?.id || null,
        responsibleUserId: null,
        assigneeUserIds: [],
        labelIds: [],
        customFieldValues: {},
      },
      {
        onSuccess: () => setListViewGroupDrafts((prev) => ({ ...prev, [groupId]: "" })),
      },
    );
  };

  const handleBoardDragEnd = (result: DropResult) => {
    if (!selectedBoardId || !canEditSelectedBoard || isCardEditPending) return;

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

    if (moveCardMutation.isPending) return;

    const cardId = draggableId.startsWith("card:") ? draggableId.slice("card:".length) : draggableId;
    const movingCard = cards.find((card) => card.id === cardId);
    let targetListId = destination.droppableId;
    let targetPosition = destination.index;

    if (destination.droppableId === LIST_VIEW_ALL_DROPPABLE_ID) {
      const visibleCards = [...(listViewGroups.find((group) => group.id === "all")?.cards ?? [])];
      const [visibleMovingCard] = visibleCards.splice(source.index, 1);

      if (!visibleMovingCard || visibleMovingCard.id !== cardId) return;

      visibleCards.splice(destination.index, 0, visibleMovingCard);
      targetListId = String(movingCard?.listId || visibleMovingCard.listId);
      targetPosition = visibleCards
        .slice(0, destination.index)
        .filter((card) => String(card.listId) === targetListId)
        .length;
    }

    moveCardMutation.mutate({
      boardId: selectedBoardId,
      cardId,
      targetListId,
      targetPosition,
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
    const assigneeNames = getKanbanCardAssigneeUserIds(card)
      .map((userId) => userById.get(userId)?.name || userId);
    const assigneeName = assigneeNames.length > 0 ? assigneeNames.join(", ") : "Без исполнителя";
    const cardLabels = normalizeLabelIds(card.labelIds)
      .map((labelId) => labelById.get(labelId))
      .filter((label): label is KanbanLabelView => Boolean(label));
    const equipmentLinkCount = equipmentLinksByCardId.get(card.id)?.length ?? 0;
    const customFields = activeCustomFields.flatMap((field) => {
      if (field.showInList === false) return [];
      const value = formatCustomFieldValue(field, card.customFieldValues?.[field.id], userById);
      return value ? [{ id: field.id, name: field.name, value }] : [];
    });

    return (
      <KanbanCardListRow
        card={card}
        list={list}
        lists={lists}
        labels={cardLabels}
        customFields={customFields}
        assigneeName={assigneeName}
        equipmentLinkCount={equipmentLinkCount}
        canEdit={canEditSelectedBoard}
        inlineEditing={inlineEditingCardId === card.id}
        inlineTitle={inlineEditingCardTitle}
        savePending={saveCardMutation.isPending}
        movePending={moveCardMutation.isPending}
        deletePending={deleteCardMutation.isPending}
        onInlineTitleChange={setInlineEditingCardTitle}
        onBeginInlineEdit={() => handleBeginInlineCardTitleEdit(card)}
        onCancelInlineEdit={handleCancelInlineCardTitleEdit}
        onCommitInlineEdit={() => handleCommitInlineCardTitleEdit(card)}
        onMove={(targetListId) => {
          if (!selectedBoardId) return;
          moveCardMutation.mutate({
            boardId: selectedBoardId,
            cardId: card.id,
            targetListId,
            targetPosition: 0,
          });
        }}
        onOpen={() => handleOpenCardDetail(card.id)}
        onDelete={() => {
          if (!confirmDelete(`Удалить карточку "${card.title}"? Это действие нельзя отменить.`)) return;
          deleteCardMutation.mutate(card.id);
        }}
      />
    );
  };

  const isBoardPending = saveBoardMutation.isPending || deleteBoardMutation.isPending;
  const isListPending =
    saveListMutation.isPending || deleteListMutation.isPending || moveListMutation.isPending;
  const isLabelPending = saveLabelMutation.isPending || deleteLabelMutation.isPending;
  const isMemberPending = saveMemberMutation.isPending || deleteMemberMutation.isPending;
  const isCardEditPending =
    saveCardMutation.isPending ||
    saveCardDetailMutation.isPending ||
    saveCardSubtasksMutation.isPending ||
    uploadCardAttachmentMutation.isPending ||
    deleteCardAttachmentMutation.isPending ||
    deleteCardMutation.isPending;
  const isCardPending = isCardEditPending || moveCardMutation.isPending;
  const canEditSelectedBoard = Boolean(selectedBoard?.canEdit);
  const canCommentSelectedBoard = Boolean(selectedBoard?.canComment);
  const canManageSelectedCardEquipment =
    Boolean(selectedBoard?.companyId) &&
    canEditSelectedBoard &&
    (
      canEditEquipment(currentUser) ||
      ["owner", "admin"].includes(String(selectedCompanyItem?.membership?.role || ""))
    );
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

  useEffect(() => registerWorkspaceFlushHandler(async () => {
    if (detailAutosaveTimerRef.current) {
      clearTimeout(detailAutosaveTimerRef.current);
      detailAutosaveTimerRef.current = null;
    }
    if (!detailCardId || !canEditSelectedBoard) return true;
    if (saveCardDetailMutation.isPending) return false;
    const currentSignature = serializeCardForm(detailCardForm);
    if (currentSignature === detailLastSavedSignatureRef.current) return true;
    if (!detailCardForm.title.trim() || !detailCardForm.listId) return false;
    try {
      await saveCardDetailMutation.mutateAsync({
        form: {
          ...detailCardForm,
          labelIds: [...detailCardForm.labelIds],
        },
        silent: true,
      });
      return true;
    } catch {
      return false;
    }
  }), [
    canEditSelectedBoard,
    detailCardForm,
    detailCardId,
    saveCardDetailMutation.isPending,
    saveCardDetailMutation.mutateAsync,
  ]);

  return (
    <div className="mx-auto w-full max-w-[min(1520px,100%)] min-w-0 space-y-3 p-3 pt-4 [--kanban-card-end:var(--muted)] [--kanban-card-start:var(--card)] [--kanban-drag-card-start:var(--card)] [--kanban-lane-empty:var(--muted)] [--kanban-lane-fallback:var(--muted)] [--kanban-list-end:var(--muted)] [--kanban-list-header:var(--card)] [--kanban-list-over-end:var(--muted)] [--kanban-list-over-start:var(--muted)] [--kanban-list-start:var(--muted)] dark:[--kanban-card-end:var(--muted)] dark:[--kanban-card-start:var(--card)] dark:[--kanban-drag-card-start:var(--card)] dark:[--kanban-lane-empty:var(--muted)] dark:[--kanban-lane-fallback:var(--muted)] dark:[--kanban-list-end:var(--muted)] dark:[--kanban-list-header:var(--card)] dark:[--kanban-list-over-end:var(--muted)] dark:[--kanban-list-over-start:var(--muted)] dark:[--kanban-list-start:var(--muted)] sm:p-5 sm:pt-5">
      <KanbanBoardNavigation
        boards={boards}
        boardsLoading={boardsLoading}
        selectedBoardId={selectedBoardId}
        selectedBoard={selectedBoard}
        canEditSelectedBoard={canEditSelectedBoard}
        listCount={lists.length}
        overdueCardsCount={overdueCardsCount}
        createMenuOpen={createMenuOpen}
        boardMutationPending={isBoardPending}
        onSelectBoard={setSelectedBoardId}
        onCreateMenuOpenChange={setCreateMenuOpen}
        onOpenSettings={() => setBoardSettingsOpen(true)}
        onCreateBoard={handleCreateBoard}
        onCreateList={() => {
          setInlineListOpen(true);
          setInlineListTitle("");
        }}
        onCreateCard={() => {
          setInlineCardListId(lists[0]?.id || null);
          setInlineCardTitle("");
          setInlineSmartCancelledTokenIds([]);
        }}
        onOpenStats={() => setBoardStatsOpen(true)}
        onOpenSmartInputHelp={() => setSmartInputHelpOpen(true)}
        onEditBoard={() => selectedBoard && handleEditBoard(selectedBoard)}
        onDeleteBoard={() => {
          if (!selectedBoard) return;
          if (!confirmDelete(`Удалить доску "${selectedBoard.name}"? Это действие нельзя отменить.`)) return;
          deleteBoardMutation.mutate(selectedBoard.id);
        }}
      />

      <Card className="mt-2 min-w-0 overflow-visible border-border/40 bg-card shadow-sm">
        <KanbanBoardToolbar
          selectedBoard={selectedBoard}
          search={cardFilters.search}
          sortBy={cardSortBy}
          sortDirection={cardSortDirection}
          hasActiveFilters={hasActiveFilters}
          viewMode={boardViewMode}
          listGrouping={listGrouping}
          customFields={activeCustomFields}
          onSearchChange={(search) => setCardFilters((prev) => ({ ...prev, search }))}
          onSortByChange={setCardSortBy}
          onSortDirectionChange={setCardSortDirection}
          onOpenFilters={() => setFiltersDialogOpen(true)}
          onViewModeChange={setBoardViewMode}
          onListGroupingChange={setListGrouping}
        />
        <CardContent className="min-w-0 overflow-visible px-3 pb-3 sm:px-6 sm:pb-6">
          {!selectedBoard ? (
	            <div className="rounded-[24px] border border-dashed border-border/40 bg-muted/30 px-5 py-10 text-sm leading-6 text-muted-foreground">
	              Выберите доску в верхнем списке или создайте новую через кнопку плюс.
            </div>
	          ) : (
	            <div className="space-y-4">
                {isBoardStructureLoading ? (
                  <Card className="border-border/45 bg-muted/20">
                    <CardContent className="py-10 text-sm text-muted-foreground">
                      Загружаем структуру доски и карточки...
                    </CardContent>
                  </Card>
                ) : boardViewMode === "kanban" ? (
                  <DragDropContext onDragEnd={handleBoardDragEnd}>
                    <div className="kanban-board-scroll w-full max-w-full min-w-0 px-1 pb-3 pr-6">
                      <Droppable droppableId="board-lists" direction="horizontal" type="LIST" ignoreContainerClipping>
                        {(listDropProvided) => (
                          <div
	                            ref={listDropProvided.innerRef}
	                            {...listDropProvided.droppableProps}
	                            className="dnd-board-root flex w-max min-w-full items-start gap-3 overflow-visible sm:gap-4"
	                          >
                      {lists.map((list, listIndex) => {
	                        const listCards = filteredCardsByListId.get(list.id) ?? [];
	                        const listTint = toSoftColor(list.color, listCards.length > 0 ? 0.16 : 0.12);
	                        const listHeaderTint = toSoftColor(list.color, 0.2);
	                        const listCardTint = toSoftColor(list.color, 0.05);

                        return (
                          <Draggable
                            key={list.id}
                            draggableId={`list:${list.id}`}
                            index={listIndex}
                            isDragDisabled={!canEditSelectedBoard || isListPending}
                          >
                            {(listDragProvided, listDragSnapshot) => {
                              const listNode = (
                              <div
                                ref={listDragProvided.innerRef}
                                {...listDragProvided.draggableProps}
                                className={["task-board-column flex w-[calc(100vw-2.5rem)] shrink-0 self-start sm:w-[320px]", listDragSnapshot.isDragging ? "task-dragging" : ""].join(" ").trim()}
                                style={{
                                  ...getDraggableCardStyle(listDragProvided.draggableProps.style),
                                  borderRadius: 24,
                                }}
                              >
                          <Droppable
                            droppableId={list.id}
                            type="CARD"
                            isDropDisabled={!canEditSelectedBoard || isCardEditPending}
                            ignoreContainerClipping
                          >
                            {(provided, snapshot) => (
                              <Card
                                className={[
                                  "flex h-full min-h-[360px] w-full flex-col overflow-visible rounded-[24px] border border-border/45 shadow-sm transition-[box-shadow,border-color,background-color] duration-200",
                                  snapshot.isDraggingOver || listDragSnapshot.isDragging
                                    ? "border-border/70 shadow-lg shadow-black/5 ring-2 ring-border/35"
                                    : "hover:border-border/70 hover:shadow-md",
                                ].join(" ").trim()}
                                style={{
                                  background: snapshot.isDraggingOver
                                    ? `linear-gradient(180deg, var(--kanban-list-over-start), ${listHeaderTint || listTint || "var(--kanban-list-over-end)"})`
                                    : `linear-gradient(180deg, var(--kanban-list-start), ${listTint || "var(--kanban-list-end)"})`,
                                }}
                              >
                                <CardHeader
                                  className="space-y-4 rounded-t-[24px] border-b border-border/35"
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
                                          <CardTitle className="text-base font-semibold tracking-tight text-foreground break-words">{list.name}</CardTitle>
                                        )}
                                        {list.color && (
                                          <span
                                            className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-border/35 shadow-sm"
                                            style={{ backgroundColor: list.color }}
                                          />
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      {canEditSelectedBoard && (
                                        <>
                                          <div
                                            role="button"
                                            tabIndex={0}
                                            className="flex h-8 w-8 cursor-grab items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground active:cursor-grabbing"
                                            aria-label="Перетащить список"
                                            title="Перетащить список"
                                            {...listDragProvided.dragHandleProps}
                                          >
                                            <GripVertical className="h-4 w-4" />
                                          </div>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                                            aria-label="Изменить список"
                                            title="Изменить список"
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
                                                className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
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
                                                      list.color === preset.value ? "border-primary/70 ring-2 ring-primary/30" : "border-border/50",
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
                                      <Badge variant="secondary" className="rounded-full border border-border/35 bg-muted/30 px-2.5 text-muted-foreground">
                                        {listCards.length}
                                      </Badge>
                                      <Badge variant={list.type === "active" ? "default" : "outline"} className="rounded-full px-2.5 shadow-sm">
                                        {LIST_TYPE_LABELS[list.type]}
                                      </Badge>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="flex min-h-0 flex-1 flex-col space-y-4 p-4">
                                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                    <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                                      Тип: {LIST_TYPE_LABELS[list.type]}
                                    </span>
                                    <span className={KANBAN_BOARD_GHOST_BADGE_CLASS}>
                                      {list.color ? "С цветом" : "Без цвета"}
                                    </span>
                                  </div>

                                  {canEditSelectedBoard && (
                                    <div className="rounded-[18px] border border-border/40 bg-muted/20 p-2">
                                      {inlineCardListId === list.id ? (
                                        <div className="space-y-2">
                                          <Input
                                            value={inlineCardTitle}
                                            onChange={(event) => setInlineCardTitle(event.target.value)}
                                            placeholder="Задача завтра 14:00 высокий приоритет @user"
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
                                          {inlineMentionSuggestions.length > 0 && (
                                            <div className="rounded-xl border border-border/40 bg-popover p-1 shadow-lg">
                                              {inlineMentionSuggestions.map((user) => (
                                                <button
                                                  key={user.id}
                                                  type="button"
                                                  className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                                                  onMouseDown={(event) => event.preventDefault()}
                                                  onClick={() => setInlineCardTitle((current) =>
                                                    insertKanbanMention(current, user.username || user.name),
                                                  )}
                                                >
                                                  <span>{user.name}</span>
                                                  {user.username && <span className="text-xs text-muted-foreground">@{user.username}</span>}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                          {inlineSmartInput.tokens.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                              {inlineSmartInput.tokens.map((token) => (
                                                <button
                                                  key={token.id}
                                                  type="button"
                                                  className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-1 text-xs text-primary"
                                                  title="Нажмите, чтобы оставить эту фразу обычным текстом"
                                                  onMouseDown={(event) => event.preventDefault()}
                                                  onClick={() => setInlineSmartCancelledTokenIds((current) => [...current, token.id])}
                                                >
                                                  <WandSparkles className="h-3 w-3" />
                                                  {token.label}
                                                  <X className="h-3 w-3" />
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                          {inlineSmartInput.errors.map((error) => (
                                            <p key={error} className="text-xs text-destructive">{error}</p>
                                          ))}
                                          <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" onMouseDown={(event) => event.preventDefault()} onClick={handleCancelInlineCard}>
                                              Отмена
                                            </Button>
                                            <Button
                                              size="sm"
                                              className="rounded-xl"
                                              onMouseDown={(event) => event.preventDefault()}
                                              onClick={() => handleSubmitInlineCard(list.id)}
                                              disabled={!inlineSmartInput.title.trim() || inlineSmartInput.errors.length > 0 || isCardPending}
                                            >
                                              Добавить
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                          onClick={() => {
                                            setInlineCardListId(list.id);
                                            setInlineCardTitle("");
                                            setInlineSmartCancelledTokenIds([]);
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
	                                    className={["task-drop-zone min-h-[180px] flex-1 space-y-3 overflow-y-auto pr-1 transition-[background-color,border-color] duration-150", snapshot.isDraggingOver ? "rounded-2xl bg-muted/30" : ""].join(" ")}
	                                  >
                                    {listCards.length === 0 && !snapshot.isDraggingOver && (
                                      <div className="rounded-[18px] border border-dashed border-border/45 bg-muted/20 px-3 py-5 text-sm leading-6 text-muted-foreground">
                                        {canEditSelectedBoard
                                          ? "Перетащите сюда карточку или добавьте задачу выше."
                                          : "В этом списке пока нет карточек."}
                                      </div>
                                    )}

                                    {listCards.map((card, index) => {
                                      const equipmentLinkCount = equipmentLinksByCardId.get(card.id)?.length ?? 0;

                                      return (
                                        <Draggable
                                          key={card.id}
                                          draggableId={`card:${card.id}`}
                                          index={index}
                                          isDragDisabled={!canEditSelectedBoard || isCardEditPending}
                                        >
                                          {(dragProvided, dragSnapshot) => (
                                            <div
                                              ref={dragProvided.innerRef}
                                              {...dragProvided.draggableProps}
                                              {...dragProvided.dragHandleProps}
                                              className={["task-drag-card w-full", dragSnapshot.isDragging ? "task-dragging" : ""].join(" ").trim()}
                                              style={getDraggableCardStyle(dragProvided.draggableProps.style)}
                                            >
                                              <KanbanBoardCard
                                                card={card}
                                                list={list}
                                                lists={lists}
                                                customFields={activeCustomFields}
                                                userById={userById}
                                                labelById={labelById}
                                                equipmentLinkCount={equipmentLinkCount}
                                                canEdit={canEditSelectedBoard}
                                                inlineEditing={inlineEditingCardId === card.id}
                                                inlineTitle={inlineEditingCardTitle}
                                                cardPending={isCardPending}
                                                movePending={moveCardMutation.isPending}
                                                detailLoading={detailCardLoading && detailCardId === card.id}
                                                isDragging={dragSnapshot.isDragging}
                                                isDropAnimating={Boolean(dragSnapshot.isDropAnimating)}
                                                listTint={listTint}
                                                listCardTint={listCardTint}
                                                onInlineTitleChange={setInlineEditingCardTitle}
                                                onBeginInlineTitleEdit={() => handleBeginInlineCardTitleEdit(card)}
                                                onCancelInlineTitleEdit={handleCancelInlineCardTitleEdit}
                                                onCommitInlineTitleEdit={() => handleCommitInlineCardTitleEdit(card)}
                                                onOpenDetail={(expanded) => {
                                                  if (expanded) {
                                                    handleOpenCardDetail(card.id, true);
                                                    return;
                                                  }
                                                  handleOpenCardDetail(card.id);
                                                }}
                                                onDuplicate={() => handleDuplicateCard(card)}
                                                onMove={(targetListId) => handleMoveCardFromMenu(card, targetListId)}
                                                onDelete={() => {
                                                  if (!confirmDelete(`Удалить карточку "${card.title}"? Это действие нельзя отменить.`)) return;
                                                  deleteCardMutation.mutate(card.id);
                                                }}
                                              />
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
                              );
                              return listNode;
                            }}
                          </Draggable>
	                        );
	                      })}
	                      {listDropProvided.placeholder}
	                      {canEditSelectedBoard && (
                        <Card className="task-board-column flex w-[calc(100vw-2.5rem)] shrink-0 items-stretch rounded-[24px] border border-dashed border-border/40 bg-muted/20 shadow-sm sm:w-[320px]">
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
                                className="flex min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-[20px] text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
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
                    </div>
		                  </DragDropContext>
	                ) : (
	                  <div className="space-y-3">
	                      <DragDropContext onDragEnd={handleBoardDragEnd}>
	                        {listViewGroups.map((group) => {
	                          const listViewDroppableId =
                              listGrouping === "list" && group.droppableListId
                                ? group.droppableListId
                                : listGrouping === "none" && group.id === "all"
                                  ? LIST_VIEW_ALL_DROPPABLE_ID
                                  : null;
	                          const draftValue = listViewGroupDrafts[group.id] || "";
	                          const draftListId = group.droppableListId || listViewDraftListId || lists[0]?.id || "";
	                          return (
                              <KanbanListViewGroup
                                key={group.id}
                                group={group}
                                lists={lists}
                                droppableId={listViewDroppableId}
                                draftValue={draftValue}
                                draftListId={draftListId}
                                canEdit={canEditSelectedBoard}
                                savePending={saveCardMutation.isPending}
                                cardEditPending={isCardEditPending}
                                onDraftChange={(value) => setListViewGroupDrafts((prev) => ({ ...prev, [group.id]: value }))}
                                onDraftListChange={setListViewDraftListId}
                                onResetDraft={() => setListViewGroupDrafts((prev) => ({ ...prev, [group.id]: "" }))}
                                onSubmitDraft={() => handleSubmitListViewGroupCard(group.id, draftListId)}
                                renderCard={renderListViewCardRow}
                              />
	                          );
	                        })}
	                      </DragDropContext>
	                  </div>
	                )}
              </div>
          )}
        </CardContent>
	      </Card>

      <KanbanSmartInputHelpDialog
        open={smartInputHelpOpen}
        onOpenChange={setSmartInputHelpOpen}
      />

      <KanbanCardFiltersDialog
        open={filtersDialogOpen}
        filters={cardFilters}
        lists={lists}
        users={availableAssignees}
        locations={locationFilterOptions}
        labels={boardLabels}
        labelGroups={activeLabelGroups}
        customFields={activeCustomFields}
        hasActiveFilters={hasActiveFilters}
        onOpenChange={setFiltersDialogOpen}
        onChange={setCardFilters}
        onReset={() => setCardFilters(EMPTY_KANBAN_CARD_FILTERS)}
      />

      <KanbanBoardFormDialog
        open={boardDialogOpen}
        editingBoardId={editingBoardId}
        form={boardForm}
        companies={companies}
        companiesLoading={companiesLoading}
        workspaceType={workspace?.type}
        pending={isBoardPending}
        onOpenChange={(open) => {
          if (open) {
            setBoardDialogOpen(true);
            return;
          }
          handleCancelBoardEdit();
        }}
        onChange={setBoardForm}
        onCancel={handleCancelBoardEdit}
        onSave={() => saveBoardMutation.mutate()}
      />

      <KanbanCardDetailDialog
        open={Boolean(detailCardId)}
        card={selectedDetailCard}
        list={selectedDetailList}
        formTitle={detailCardForm.title}
        saveStatus={detailSaveStatus}
        saveError={detailSaveError}
        onClose={handleCloseCardDetail}
      >
        {selectedDetailCard && (() => {
                const detailEquipmentLinks = equipmentLinksByCardId.get(selectedDetailCard.id) ?? [];
                const availableEquipmentToLink = getAvailableEquipmentToLink(
                  equipment,
                  detailEquipmentLinks,
                );

          return (
            <>
                <KanbanCardLocationContext card={selectedDetailCard} />
                <div className={KANBAN_DETAIL_SECTION_CLASS}>
                <KanbanCardDetailFields
                  form={detailCardForm}
                  canEdit={canEditSelectedBoard}
                  lists={lists}
                  users={availableAssignees}
                  locations={locations}
                  linkedLocations={selectedDetailCard.locations ?? []}
                  boardCompanyId={String(selectedBoard?.companyId || "")}
                  smartInput={detailSmartInput}
                  getUserName={(userId) => userById.get(userId)?.name || userId}
                  onChange={setDetailCardForm}
                  onCancelSmartToken={(tokenId) => setDetailSmartCancelledTokenIds((current) => [
                    ...current,
                    tokenId,
                  ])}
                  onSmartInputApplied={() => {
                    setDetailSmartCancelledTokenIds([]);
                    toast({
                      title: "Умный ввод применён",
                      description: "Ручные изменения полей после этого имеют приоритет.",
                    });
                  }}
                />

                <KanbanCardLabelsEditor
                  labels={boardLabels}
                  selectedLabelIds={detailCardForm.labelIds}
                  query={detailLabelQuery}
                  canEdit={canEditSelectedBoard}
                  loading={boardLabelsLoading}
                  saveLabelPending={saveLabelMutation.isPending}
                  saveCardPending={saveCardDetailMutation.isPending}
                  onQueryChange={setDetailLabelQuery}
                  onAttach={handleAttachDetailLabel}
                  onRemove={handleRemoveDetailLabel}
                  onCreate={handleCreateDetailLabel}
                />

                <Collapsible open={detailAdvancedOpen} onOpenChange={setDetailAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button type="button" variant="outline" className="w-full justify-between rounded-xl">
                      <span className="inline-flex items-center gap-2">
                        <Settings2 className="h-4 w-4" />
                        Дополнительные поля и активность
                      </span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${detailAdvancedOpen ? "rotate-180" : ""}`} />
                    </Button>
                  </CollapsibleTrigger>
                </Collapsible>

                <KanbanCardCustomFieldsEditor
                  expanded={detailAdvancedOpen}
                  fields={activeCustomFields}
                  values={detailCardForm.customFieldValues ?? {}}
                  users={availableAssignees}
                  canEdit={canEditSelectedBoard}
                  loading={boardCustomFieldsLoading}
                  form={customFieldForm}
                  savePending={saveCustomFieldMutation.isPending}
                  onValuesChange={(customFieldValues) => setDetailCardForm((current) => ({
                    ...current,
                    customFieldValues,
                  }))}
                  onFormChange={setCustomFieldForm}
                  onSave={() => saveCustomFieldMutation.mutate(undefined)}
                />
                </div>

                <KanbanCardMetadata
                  card={selectedDetailCard}
                  list={selectedDetailList}
                  labels={boardLabels}
                  creatorName={userById.get(selectedDetailCard.creatorUserId)?.name || selectedDetailCard.creatorUserId}
                  expanded={detailAdvancedOpen}
                  className={KANBAN_DETAIL_SECTION_CLASS}
                />

                <KanbanCardAdvancedSections
                  expanded={detailAdvancedOpen}
                  sectionClassName={KANBAN_DETAIL_SECTION_CLASS}
                  boardId={selectedBoardId || ""}
                  cardId={selectedDetailCard.id}
                  commentCount={selectedDetailCard.commentCount ?? 0}
                  canComment={canCommentSelectedBoard}
                  canEdit={canEditSelectedBoard}
                  companyScoped={Boolean(selectedBoard?.companyId)}
                  equipmentLinks={detailEquipmentLinks}
                  availableEquipment={availableEquipmentToLink}
                  equipmentLoading={equipmentLinksLoading}
                  canManageEquipment={canManageSelectedCardEquipment}
                  equipmentSelection={equipmentLinkSelection}
                  attachPending={attachEquipmentMutation.isPending}
                  detachPending={detachEquipmentMutation.isPending}
                  subtasks={selectedDetailCard.subtasks}
                  subtaskDraft={detailSubtaskDraft}
                  subtaskPending={saveCardSubtasksMutation.isPending}
                  attachments={detailCardAttachments}
                  attachmentsLoading={detailCardAttachmentsLoading}
                  uploadPending={uploadCardAttachmentMutation.isPending}
                  deleteAttachmentPending={deleteCardAttachmentMutation.isPending}
                  history={detailCardHistory}
                  historyLoading={detailCardHistoryLoading}
                  historyExpanded={detailHistoryExpanded}
                  getUserName={(userId) => {
                    const user = userById.get(userId);
                    return user?.name || user?.username || userId;
                  }}
                  getHistoryChangeLines={getHistoryChangeLines}
                  confirmDelete={confirmDelete}
                  onEquipmentSelectionChange={setEquipmentLinkSelection}
                  onAttachEquipment={(equipmentId) => attachEquipmentMutation.mutate({
                    cardId: selectedDetailCard.id,
                    equipmentId,
                  })}
                  onDetachEquipment={(equipmentId) => detachEquipmentMutation.mutate({
                    cardId: selectedDetailCard.id,
                    equipmentId,
                  })}
                  onSubtaskDraftChange={setDetailSubtaskDraft}
                  onSaveSubtasks={(subtasks, clearDraftOnSuccess) => {
                    saveCardSubtasksMutation.mutate(subtasks, {
                      onSuccess: clearDraftOnSuccess
                        ? () => setDetailSubtaskDraft("")
                        : undefined,
                    });
                  }}
                  onUploadAttachment={(file) => uploadCardAttachmentMutation.mutate(file)}
                  onDeleteAttachment={(attachmentId) => deleteCardAttachmentMutation.mutate(attachmentId)}
                  onToggleHistoryExpanded={() => setDetailHistoryExpanded((current) => !current)}
                  onCommentActivity={() => {
                    queryClient.invalidateQueries({ queryKey: ["kanban-cards", selectedBoardId] });
                    queryClient.invalidateQueries({ queryKey: ["kanban-card", selectedBoardId, selectedDetailCard.id] });
                    queryClient.invalidateQueries({ queryKey: ["kanban-card-history", selectedBoardId, selectedDetailCard.id] });
                  }}
                />

            </>
          );
        })()}
      </KanbanCardDetailDialog>

      <KanbanBoardStatsDialog
        open={boardStatsOpen}
        boardName={selectedBoard?.name}
        loading={boardCompletionLoading}
        stats={boardCompletionStats}
        onOpenChange={setBoardStatsOpen}
      />

      <KanbanBoardSettingsDialog
        open={boardSettingsOpen}
        boardName={selectedBoard?.name}
        onOpenChange={setBoardSettingsOpen}
      >
            <div className={KANBAN_DETAIL_SECTION_CLASS}>
              <KanbanBoardMembersSection
                personal={isSelectedBoardPersonal}
                canManage={Boolean(selectedBoard?.canManage)}
                creatorUserId={selectedBoard?.createdByUserId}
                loading={boardMembersLoading}
                members={boardMembers}
                availableMembers={availableBoardMembers}
                userById={userById}
                form={memberForm}
                editingMemberId={editingMemberId}
                pending={isMemberPending}
                onFormChange={setMemberForm}
                onCancelEdit={handleCancelMemberEdit}
                onSave={() => saveMemberMutation.mutate()}
                onEdit={handleEditMember}
                onDelete={(member, userName) => {
                  if (!confirmDelete(`Удалить участника "${userName}" из доски?`)) return;
                  deleteMemberMutation.mutate(member.id);
                }}
              />
            </div>


            <div className={KANBAN_DETAIL_SECTION_CLASS}>
              <KanbanLabelGroupsSection
                groups={activeLabelGroups}
                labels={boardLabels}
                form={labelGroupForm}
                editingGroupId={editingLabelGroupId}
                canEdit={canEditSelectedBoard}
                loading={boardLabelGroupsLoading}
                savePending={saveLabelGroupMutation.isPending}
                deletePending={deleteLabelGroupMutation.isPending}
                onFormChange={setLabelGroupForm}
                onCancelEdit={() => {
                  setEditingLabelGroupId(null);
                  setLabelGroupForm(EMPTY_LABEL_GROUP_FORM);
                }}
                onSave={() => saveLabelGroupMutation.mutate(undefined)}
                onEdit={handleEditLabelGroup}
                onDelete={(group) => {
                  if (!confirmDelete(`Архивировать группу "${group.name}"? Метки останутся.`)) return;
                  deleteLabelGroupMutation.mutate(group.id);
                }}
              />
            </div>


            <div className={KANBAN_DETAIL_SECTION_CLASS}>
              <KanbanLabelsSection
                labels={boardLabels}
                groups={activeLabelGroups}
                loading={boardLabelsLoading}
                canEdit={canEditSelectedBoard}
                draft={settingsLabelDraft}
                editingLabelId={editingSettingsLabelId}
                editingLabelName={editingSettingsLabelName}
                savePending={saveLabelMutation.isPending}
                deletePending={deleteLabelMutation.isPending}
                onDraftChange={setSettingsLabelDraft}
                onCreate={handleCreateSettingsLabel}
                onEditingLabelNameChange={setEditingSettingsLabelName}
                onBeginEdit={handleBeginSettingsLabelEdit}
                onCancelEdit={handleCancelSettingsLabelEdit}
                onCommitEdit={handleCommitSettingsLabelEdit}
                onGroupChange={(label, groupId) => saveLabelMutation.mutate({
                  labelId: label.id,
                  name: label.name,
                  color: label.color || null,
                  groupId,
                })}
                onColorChange={(label, color) => saveLabelMutation.mutate({
                  labelId: label.id,
                  name: label.name,
                  color,
                  groupId: label.groupId || null,
                })}
                onDelete={(label) => {
                  if (!confirmDelete(`Удалить метку "${label.name}"?`)) return;
                  deleteLabelMutation.mutate(label.id);
                }}
              />
            </div>


            <div className={KANBAN_DETAIL_SECTION_CLASS}>
              <KanbanCustomFieldsSection
                fields={activeCustomFields}
                form={customFieldForm}
                editingFieldId={editingCustomFieldId}
                canEdit={canEditSelectedBoard}
                loading={boardCustomFieldsLoading}
                savePending={saveCustomFieldMutation.isPending}
                deletePending={deleteCustomFieldMutation.isPending}
                onFormChange={setCustomFieldForm}
                onCancelEdit={() => {
                  setEditingCustomFieldId(null);
                  setCustomFieldForm(EMPTY_CUSTOM_FIELD_FORM);
                }}
                onCreateDefaults={handleCreateDefaultCustomFieldTemplates}
                onSave={() => saveCustomFieldMutation.mutate(undefined)}
                onEdit={handleEditCustomField}
                onDelete={(field) => {
                  if (!confirmDelete(`Архивировать поле "${field.name}"? Значения останутся в данных карточек.`)) return;
                  deleteCustomFieldMutation.mutate(field.id);
                }}
              />
            </div>
      </KanbanBoardSettingsDialog>
    </div>
  );
}
