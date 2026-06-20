import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  isMember?: boolean;
  membershipRole?: string | null;
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
  creatorUserId: string;
  assigneeUserId?: string | null;
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
  const [boardForm, setBoardForm] = useState(EMPTY_BOARD_FORM);
  const [listForm, setListForm] = useState(EMPTY_LIST_FORM);
  const [cardForm, setCardForm] = useState(EMPTY_CARD_FORM);

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
  const selectedCompanyItem = useMemo(
    () => companyItems.find((item) => item.company.id === selectedBoard?.companyId) ?? null,
    [companyItems, selectedBoard?.companyId],
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
  const cardsByListId = useMemo(() => {
    const groupedCards = new Map<string, KanbanCardView[]>();

    for (const card of cards) {
      const listCards = groupedCards.get(card.listId) ?? [];
      listCards.push(card);
      groupedCards.set(card.listId, listCards);
    }

    return groupedCards;
  }, [cards]);

  useEffect(() => {
    if (!editingBoardId && !boardForm.companyId && companies[0]?.id) {
      setBoardForm((prev) => ({ ...prev, companyId: companies[0].id }));
    }
  }, [boardForm.companyId, companies, editingBoardId]);

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
    });
  };

  const handleCancelCardEdit = () => {
    setEditingCardId(null);
    setCardForm((prev) => ({
      ...EMPTY_CARD_FORM,
      listId: lists.some((list) => list.id === prev.listId) ? prev.listId : lists[0]?.id || "",
    }));
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
  const isCardPending =
    saveCardMutation.isPending || deleteCardMutation.isPending || moveCardMutation.isPending;
  const canEditSelectedBoard = Boolean(selectedBoard?.canEdit);
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
                Итерация 4: карточки уже можно перетаскивать между списками с optimistic reorder.
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
              <p>Следующий этап после этого: assignees, detail view и activity log для карточек.</p>
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
                <Badge variant="outline">{canEditSelectedBoard ? "Editor access" : "View only"}</Badge>
                <Badge variant="secondary">{lists.length} списков</Badge>
                <Badge variant="secondary">{cards.length} карточек</Badge>
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
                        const listCards = cardsByListId.get(list.id) ?? [];

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
                                      const dueDateLabel = formatDueDateLabel(card.dueDate);
                                      const assigneeName = card.assigneeUserId
                                        ? userById.get(card.assigneeUserId)?.name || card.assigneeUserId
                                        : null;

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

                                              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                <span>Порядок: {Number(card.position) + 1}</span>
                                                {assigneeName && <span>Исполнитель: {assigneeName}</span>}
                                                {dueDateLabel && <span>Срок: {dueDateLabel}</span>}
                                              </div>

                                              {canEditSelectedBoard && (
                                                <div className="flex flex-wrap gap-2">
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
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
