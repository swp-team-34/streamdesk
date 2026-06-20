import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type BoardVisibility = "company" | "members";
type KanbanListType = "active" | "closed" | "archive" | "trash";

interface CompanySummary {
  id: string;
  name: string;
}

interface CompaniesResponse {
  companies: CompanySummary[];
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

const LIST_TYPE_LABELS: Record<KanbanListType, string> = {
  active: "Активный",
  closed: "Закрытый",
  archive: "Архив",
  trash: "Корзина",
};

export default function TasksV2Page() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [boardForm, setBoardForm] = useState(EMPTY_BOARD_FORM);
  const [listForm, setListForm] = useState(EMPTY_LIST_FORM);

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

  const companies = companiesResponse?.companies ?? [];
  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

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
  }, [selectedBoardId]);

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
      toast({
        title: "Список удален",
        description: "Структура доски обновлена.",
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

  const isBoardPending = saveBoardMutation.isPending || deleteBoardMutation.isPending;
  const isListPending = saveListMutation.isPending || deleteListMutation.isPending;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <Card className="border-border/70">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Kanban V2</CardTitle>
              <CardDescription>
                Итерация 2: board core уже работает, теперь добавлены first-class lists и board detail.
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
                <p>Списки теперь тоже first-class сущности, а не `project_columns` суррогат.</p>
                <p>Следующий этап после этого: cards, потом DnD и оптимистичные перемещения.</p>
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
                <Badge variant="outline">{selectedBoard.canEdit ? "Editor access" : "View only"}</Badge>
                <Badge variant="secondary">{lists.length} списков</Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!selectedBoard ? (
            <div className="py-8 text-sm text-muted-foreground">
              Выберите доску выше, чтобы управлять ее списками.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
              <div className="space-y-4">
                {listsLoading ? (
                  <Card>
                    <CardContent className="py-8 text-sm text-muted-foreground">
                      Загружаем списки доски...
                    </CardContent>
                  </Card>
                ) : lists.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-sm text-muted-foreground">
                      В этой доске пока нет списков. Создайте первый список справа.
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {lists.map((list) => (
                      <Card key={list.id} className="h-full">
                        <CardHeader className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1 min-w-0">
                              <CardTitle className="text-base break-words">{list.name}</CardTitle>
                              <CardDescription>
                                Позиция: {Number(list.position) + 1}
                              </CardDescription>
                            </div>
                            <Badge variant={list.type === "active" ? "default" : "outline"}>
                              {LIST_TYPE_LABELS[list.type]}
                            </Badge>
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
                            <p>Карточки появятся на следующей итерации.</p>
                          </div>

                          {selectedBoard.canEdit && (
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => handleEditList(list)}
                                disabled={isListPending}
                              >
                                <Pencil className="h-4 w-4" />
                                Редактировать
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                                onClick={() => deleteListMutation.mutate(list.id)}
                                disabled={isListPending}
                              >
                                <Trash2 className="h-4 w-4" />
                                Удалить
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base">
                    {editingListId ? "Редактировать список" : "Новый список"}
                  </CardTitle>
                  <CardDescription>
                    {selectedBoard.canEdit
                      ? "Списки живут отдельно от legacy project columns и готовы к следующему этапу с cards."
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
                      disabled={!selectedBoard.canEdit || isListPending}
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
                      disabled={!selectedBoard.canEdit || isListPending}
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
                      disabled={!selectedBoard.canEdit || isListPending}
                    />
                  </div>

                  {selectedBoard.canEdit && (
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
