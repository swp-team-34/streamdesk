import { Badge } from "@/components/ui/badge";
import { DiscussionThread } from "@/components/discussion-thread";
import { KanbanCardActivitySection } from "@/components/kanban/kanban-card-activity-section";
import { KanbanCardAttachmentsSection } from "@/components/kanban/kanban-card-attachments-section";
import { KanbanCardEquipmentSection } from "@/components/kanban/kanban-card-equipment-section";
import { KanbanCardSubtasksSection } from "@/components/kanban/kanban-card-subtasks-section";
import type {
  KanbanCardAttachmentView,
  KanbanCardHistoryView,
  KanbanSubtask,
} from "@/lib/kanban-board-model";
import type {
  EquipmentSummaryView,
  KanbanEquipmentLinkView,
} from "@/lib/kanban-equipment-links";

interface KanbanCardAdvancedSectionsProps {
  expanded: boolean;
  sectionClassName: string;
  boardId: string;
  cardId: string;
  commentCount: number;
  canComment: boolean;
  canEdit: boolean;
  companyScoped: boolean;
  equipmentLinks: KanbanEquipmentLinkView[];
  availableEquipment: EquipmentSummaryView[];
  equipmentLoading: boolean;
  canManageEquipment: boolean;
  equipmentSelection: string;
  attachPending: boolean;
  detachPending: boolean;
  subtasks?: KanbanSubtask[] | null;
  subtaskDraft: string;
  subtaskPending: boolean;
  attachments: KanbanCardAttachmentView[];
  attachmentsLoading: boolean;
  uploadPending: boolean;
  deleteAttachmentPending: boolean;
  history: KanbanCardHistoryView[];
  historyLoading: boolean;
  historyExpanded: boolean;
  getUserName: (userId: string) => string;
  getHistoryChangeLines: (entry: KanbanCardHistoryView) => string[];
  confirmDelete: (message: string) => boolean;
  onEquipmentSelectionChange: (equipmentId: string) => void;
  onAttachEquipment: (equipmentId: string) => void;
  onDetachEquipment: (equipmentId: string) => void;
  onSubtaskDraftChange: (value: string) => void;
  onSaveSubtasks: (subtasks: KanbanSubtask[], clearDraftOnSuccess?: boolean) => void;
  onUploadAttachment: (file: File) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onToggleHistoryExpanded: () => void;
  onCommentActivity: () => void;
}

export function KanbanCardAdvancedSections({
  expanded,
  sectionClassName,
  boardId,
  cardId,
  commentCount,
  canComment,
  canEdit,
  companyScoped,
  equipmentLinks,
  availableEquipment,
  equipmentLoading,
  canManageEquipment,
  equipmentSelection,
  attachPending,
  detachPending,
  subtasks,
  subtaskDraft,
  subtaskPending,
  attachments,
  attachmentsLoading,
  uploadPending,
  deleteAttachmentPending,
  history,
  historyLoading,
  historyExpanded,
  getUserName,
  getHistoryChangeLines,
  confirmDelete,
  onEquipmentSelectionChange,
  onAttachEquipment,
  onDetachEquipment,
  onSubtaskDraftChange,
  onSaveSubtasks,
  onUploadAttachment,
  onDeleteAttachment,
  onToggleHistoryExpanded,
  onCommentActivity,
}: KanbanCardAdvancedSectionsProps) {
  const className = expanded ? sectionClassName : "hidden";
  return (
    <>
      <div className={className}>
        <KanbanCardEquipmentSection
          companyScoped={companyScoped}
          links={equipmentLinks}
          availableEquipment={availableEquipment}
          loading={equipmentLoading}
          canManage={canManageEquipment}
          selection={equipmentSelection}
          attachPending={attachPending}
          detachPending={detachPending}
          getUserName={getUserName}
          onSelectionChange={onEquipmentSelectionChange}
          onAttach={onAttachEquipment}
          onDetach={onDetachEquipment}
        />
      </div>

      <div className={className}>
        <KanbanCardSubtasksSection
          subtasks={subtasks}
          draft={subtaskDraft}
          canEdit={canEdit}
          pending={subtaskPending}
          onDraftChange={onSubtaskDraftChange}
          onSave={onSaveSubtasks}
          confirmDelete={confirmDelete}
        />
      </div>

      <div className={className}>
        <KanbanCardAttachmentsSection
          attachments={attachments}
          loading={attachmentsLoading}
          canEdit={canEdit}
          uploadPending={uploadPending}
          deletePending={deleteAttachmentPending}
          getUserName={getUserName}
          onUpload={onUploadAttachment}
          onDelete={onDeleteAttachment}
          confirmDelete={confirmDelete}
        />
      </div>

      <div className={className}>
        <KanbanCardActivitySection
          entries={history}
          loading={historyLoading}
          expanded={historyExpanded}
          getUserName={getUserName}
          getChangeLines={getHistoryChangeLines}
          onToggleExpanded={onToggleHistoryExpanded}
        />
      </div>

      <div className={className}>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Комментарии и ответы</h3>
            {commentCount > 0 && <Badge variant="outline" className="rounded-full">{commentCount}</Badge>}
          </div>
          {boardId && cardId && (
            <DiscussionThread
              apiPath={`/api/kanban/boards/${boardId}/cards/${cardId}/comments`}
              channel={`kanban-card:${cardId}:comments`}
              queryKey={["kanban-card-comments", boardId, cardId]}
              canComment={canComment}
              emptyLabel="У этой карточки пока нет комментариев."
              onActivity={onCommentActivity}
            />
          )}
        </div>
      </div>
    </>
  );
}
