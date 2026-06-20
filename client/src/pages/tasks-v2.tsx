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
  isMember?: boolean;
  membershipRole?: string | null;
}

const EMPTY_FORM = {
  companyId: "",
  name: "",
  description: "",
  visibility: "company" as BoardVisibility,
};

export default function TasksV2Page() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

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

  const companies = companiesResponse?.companies ?? [];
  const companyById = useMemo(
    () => new Map(companies.map((company) => [company.id, company])),
    [companies],
  );

  useEffect(() => {
    if (!editingBoardId && !form.companyId && companies[0]?.id) {
      setForm((prev) => ({ ...prev, companyId: companies[0].id }));
    }
  }, [companies, editingBoardId, form.companyId]);

  const saveBoardMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        companyId: form.companyId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        visibility: form.visibility,
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      toast({
        title: editingBoardId ? "Доска обновлена" : "Доска создана",
        description: "Базовый board core для Kanban V2 сохранен.",
      });
      setEditingBoardId(null);
      setForm((prev) => ({
        ...EMPTY_FORM,
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kanban/boards"] });
      toast({
        title: "Доска удалена",
        description: "Legacy Task Manager при этом не затронут.",
      });
      if (editingBoardId) {
        setEditingBoardId(null);
        setForm((prev) => ({ ...EMPTY_FORM, companyId: prev.companyId || companies[0]?.id || "" }));
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

  const handleEditBoard = (board: KanbanBoardView) => {
    setEditingBoardId(board.id);
    setForm({
      companyId: board.companyId,
      name: board.name,
      description: board.description || "",
      visibility: board.visibility,
    });
  };

  const handleCancelEdit = () => {
    setEditingBoardId(null);
    setForm((prev) => ({
      ...EMPTY_FORM,
      companyId: prev.companyId || companies[0]?.id || "",
    }));
  };

  const isPending = saveBoardMutation.isPending || deleteBoardMutation.isPending;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      <Card className="border-border/70">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle>Kanban V2</CardTitle>
              <CardDescription>
                Первая итерация нового модуля. Пока здесь только board core, без замены legacy Task Manager.
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
                    value={form.companyId}
                    onChange={(event) => setForm((prev) => ({ ...prev, companyId: event.target.value }))}
                    disabled={Boolean(editingBoardId) || companiesLoading || isPending}
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
                    value={form.visibility}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, visibility: event.target.value as BoardVisibility }))
                    }
                    disabled={isPending}
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
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Например: Продакшн / Июль"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="kanban-description">
                  Описание
                </label>
                <Textarea
                  id="kanban-description"
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Кратко опишите назначение доски"
                  rows={4}
                  disabled={isPending}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="gap-2"
                  onClick={() => saveBoardMutation.mutate()}
                  disabled={!form.companyId || !form.name.trim() || isPending}
                >
                  <Plus className="h-4 w-4" />
                  {editingBoardId ? "Сохранить изменения" : "Создать доску"}
                </Button>
                {editingBoardId && (
                  <Button variant="ghost" onClick={handleCancelEdit} disabled={isPending}>
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
                <p>Новые таблицы `kanban_boards` и `kanban_board_members`.</p>
                <p>Отдельный API `/api/kanban/boards` с company-scoped доступом.</p>
                <p>Legacy `/tasks` и текущая модель `tasks/project_columns` не изменялись.</p>
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
            {boards.map((board) => (
              <Card key={board.id} className="h-full">
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

                  {board.canManage && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleEditBoard(board)}
                        disabled={isPending}
                      >
                        <Pencil className="h-4 w-4" />
                        Редактировать
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        className="gap-2"
                        onClick={() => deleteBoardMutation.mutate(board.id)}
                        disabled={isPending}
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
    </div>
  );
}
