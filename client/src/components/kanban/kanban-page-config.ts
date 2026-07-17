import type { CSSProperties } from "react";
import type { DraggableStyle } from "@hello-pangea/dnd";

import type {
  BoardVisibility,
  KanbanBoardFormState,
} from "@/components/kanban/kanban-board-form-dialog";
import type {
  KanbanBoardMemberView,
  MemberFormState,
} from "@/components/kanban/kanban-board-members-section";
import type { KanbanCustomFieldFormState } from "@/components/kanban/kanban-custom-fields-section";
import type { KanbanLabelGroupFormState } from "@/components/kanban/kanban-label-groups-section";
import {
  type KanbanCardPriority,
  type KanbanCustomFieldDefinition,
  type KanbanCustomFieldType,
  type KanbanLabelGroupView,
  type KanbanListType,
} from "@/lib/kanban-board-model";
import type { KanbanCardDetailForm } from "@/lib/kanban-card-detail-state";

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

export interface CompaniesResponse {
  companies: CompanyWorkspaceItem[];
}

export interface UserSummary {
  id: string;
  name: string;
  email?: string | null;
  username?: string | null;
  active?: boolean | null;
}

export interface KanbanBoardView {
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

export const EMPTY_BOARD_FORM: KanbanBoardFormState = {
  companyId: "",
  name: "",
  description: "",
  visibility: "personal",
};

export const EMPTY_LIST_FORM = {
  name: "",
  color: "",
  type: "active" as KanbanListType,
};

export const LIST_COLOR_PRESETS = [
  { label: "Slate", value: "#64748b" },
  { label: "Blue", value: "#2563eb" },
  { label: "Cyan", value: "#0891b2" },
  { label: "Emerald", value: "#059669" },
  { label: "Amber", value: "#d97706" },
  { label: "Rose", value: "#e11d48" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Indigo", value: "#4f46e5" },
] as const;

export const BOARD_VIEW_MODE_STORAGE_KEY = "streamdesk.tasks.v2.viewMode";
export const BOARD_LIST_GROUPING_STORAGE_KEY = "streamdesk.tasks.v2.listGrouping";
export const LIST_VIEW_ALL_DROPPABLE_ID = "list-view:all";
export const DETAIL_AUTOSAVE_DELAY_MS = 700;

export const EMPTY_CARD_FORM: KanbanCardDetailForm = {
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

export const EMPTY_LABEL_FORM = {
  name: "",
  color: "",
  groupId: "",
};

export const EMPTY_CUSTOM_FIELD_FORM: KanbanCustomFieldFormState = {
  name: "",
  type: "text" as KanbanCustomFieldType,
  options: "",
  required: false,
  showOnCard: true,
  showInList: true,
};

export const EMPTY_LABEL_GROUP_FORM: KanbanLabelGroupFormState = {
  name: "",
  color: "",
};

export const EMPTY_MEMBER_FORM: MemberFormState = {
  userId: "",
  role: "viewer",
  canComment: false,
};

export const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

export const getDraggableCardStyle = (
  style: DraggableStyle | undefined,
): CSSProperties | undefined => style as CSSProperties | undefined;

export interface KanbanCardMoveInput {
  boardId: string;
  cardId: string;
  targetListId: string;
  targetPosition: number;
}

export interface KanbanListReorderInput {
  boardId: string;
  listIds: string[];
}

export interface SaveListInput {
  listId?: string | null;
  name?: string;
  color?: string | null;
  type?: KanbanListType;
  closeInline?: boolean;
}

export interface SaveCardInput {
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

export interface SaveLabelInput {
  labelId?: string | null;
  name?: string;
  color?: string | null;
  groupId?: string | null;
  attachToDetail?: boolean;
}

export interface SaveCustomFieldInput {
  fieldId?: string | null;
  form?: typeof EMPTY_CUSTOM_FIELD_FORM;
}

export interface SaveLabelGroupInput {
  groupId?: string | null;
  form?: typeof EMPTY_LABEL_GROUP_FORM;
}

export interface SaveCardDetailInput {
  form?: typeof EMPTY_CARD_FORM;
  silent?: boolean;
  closeAfter?: boolean;
}

export type { KanbanBoardMemberView };
