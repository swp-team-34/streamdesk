import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  MapPinned,
  Pencil,
  Plus,
  Tags,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type WarehouseCategoryOption = {
  id: string;
  companyId: string;
  name: string;
  parentId?: string | null;
  position: number;
  archivedAt?: string | null;
  equipmentCount?: number;
  childCount?: number;
};

export type WarehouseStorageLocationOption = {
  id: string;
  companyId: string;
  name: string;
  code?: string | null;
  type: string;
  parentId?: string | null;
  position: number;
  path?: string | null;
  archivedAt?: string | null;
  equipmentCount?: number;
  childCount?: number;
};

const STORAGE_TYPES = [
  { value: "room", label: "Комната" },
  { value: "zone", label: "Зона" },
  { value: "rack", label: "Стеллаж" },
  { value: "shelf", label: "Полка" },
  { value: "case", label: "Кейс" },
  { value: "bin", label: "Ячейка" },
  { value: "other", label: "Другое" },
] as const;

function storageTypeLabel(value: string) {
  return STORAGE_TYPES.find((type) => type.value === value)?.label || "Другое";
}

function sortSettingsRows<T extends { position: number; name: string }>(rows: T[]) {
  return [...rows].sort((left, right) =>
    Number(left.position || 0) - Number(right.position || 0) ||
    left.name.localeCompare(right.name, "ru"),
  );
}

function flattenStorageLocations(rows: WarehouseStorageLocationOption[]) {
  const childrenByParent = new Map<string, WarehouseStorageLocationOption[]>();
  for (const row of rows) {
    const key = String(row.parentId || "");
    childrenByParent.set(key, [...(childrenByParent.get(key) || []), row]);
  }
  const result: Array<{ row: WarehouseStorageLocationOption; depth: number }> = [];
  const visit = (parentId: string, depth: number, visited: Set<string>) => {
    for (const row of sortSettingsRows(childrenByParent.get(parentId) || [])) {
      if (visited.has(row.id)) continue;
      result.push({ row, depth });
      visit(row.id, depth + 1, new Set([...visited, row.id]));
    }
  };
  visit("", 0, new Set());
  return result;
}

export function WarehouseSettings({
  open,
  onOpenChange,
  canManage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryParentId, setCategoryParentId] = useState("root");
  const [editingStorageId, setEditingStorageId] = useState<string | null>(null);
  const [storageName, setStorageName] = useState("");
  const [storageCode, setStorageCode] = useState("");
  const [storageType, setStorageType] = useState("other");
  const [storageParentId, setStorageParentId] = useState("root");

  const { data: categories = [] } = useQuery<WarehouseCategoryOption[]>({
    queryKey: ["/api/warehouse/categories", { archive: "all" }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/warehouse/categories?archive=all");
      return response.json();
    },
    enabled: open,
  });

  const { data: storageLocations = [] } = useQuery<WarehouseStorageLocationOption[]>({
    queryKey: ["/api/warehouse/storage-locations", { archive: "all" }],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/warehouse/storage-locations?archive=all");
      return response.json();
    },
    enabled: open,
  });

  const invalidateWarehouse = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/categories"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/warehouse/storage-locations"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] }),
    ]);
  };

  const settingsMutation = useMutation({
    mutationFn: async ({
      method,
      path,
      body,
    }: {
      method: "POST" | "PUT";
      path: string;
      body: Record<string, unknown>;
    }) => {
      const response = await apiRequest(method, path, body);
      return response.json();
    },
    onSuccess: invalidateWarehouse,
    onError: (error: any) => {
      toast({
        title: "Не удалось изменить настройки склада",
        description: error?.message || "Повторите действие.",
        variant: "destructive",
      });
    },
  });

  const rootCategories = sortSettingsRows(categories.filter((category) => !category.parentId));
  const categoryRows = rootCategories.flatMap((category) => [
    { row: category, depth: 0 },
    ...sortSettingsRows(categories.filter((child) => child.parentId === category.id))
      .map((row) => ({ row, depth: 1 })),
  ]);
  const storageRows = useMemo(() => flattenStorageLocations(storageLocations), [storageLocations]);

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryName("");
    setCategoryParentId("root");
  };

  const resetStorageForm = () => {
    setEditingStorageId(null);
    setStorageName("");
    setStorageCode("");
    setStorageType("other");
    setStorageParentId("root");
  };

  const submitCategory = async () => {
    if (!categoryName.trim()) return;
    await settingsMutation.mutateAsync({
      method: editingCategoryId ? "PUT" : "POST",
      path: editingCategoryId
        ? `/api/warehouse/categories/${editingCategoryId}`
        : "/api/warehouse/categories",
      body: {
        name: categoryName.trim(),
        parentId: categoryParentId === "root" ? null : categoryParentId,
      },
    });
    resetCategoryForm();
  };

  const submitStorage = async () => {
    if (!storageName.trim()) return;
    await settingsMutation.mutateAsync({
      method: editingStorageId ? "PUT" : "POST",
      path: editingStorageId
        ? `/api/warehouse/storage-locations/${editingStorageId}`
        : "/api/warehouse/storage-locations",
      body: {
        name: storageName.trim(),
        code: storageCode.trim() || null,
        type: storageType,
        parentId: storageParentId === "root" ? null : storageParentId,
      },
    });
    resetStorageForm();
  };

  const reorderRows = async (
    kind: "category" | "storage",
    id: string,
    direction: -1 | 1,
  ) => {
    const allRows = kind === "category" ? categories : storageLocations;
    const current = allRows.find((row) => row.id === id);
    if (!current) return;
    const siblings = sortSettingsRows(allRows.filter((row) =>
      String(row.parentId || "") === String(current.parentId || ""),
    ));
    const index = siblings.findIndex((row) => row.id === id);
    const target = siblings[index + direction];
    if (!target) return;
    await Promise.all([
      settingsMutation.mutateAsync({
        method: "PUT",
        path: kind === "category"
          ? `/api/warehouse/categories/${current.id}`
          : `/api/warehouse/storage-locations/${current.id}`,
        body: { position: target.position },
      }),
      settingsMutation.mutateAsync({
        method: "PUT",
        path: kind === "category"
          ? `/api/warehouse/categories/${target.id}`
          : `/api/warehouse/storage-locations/${target.id}`,
        body: { position: current.position },
      }),
    ]);
  };

  const setArchived = async (
    kind: "category" | "storage",
    row: WarehouseCategoryOption | WarehouseStorageLocationOption,
    archived: boolean,
  ) => {
    if (archived) {
      const affected = Number(row.equipmentCount || 0);
      const children = Number(row.childCount || 0);
      const suffix = [
        affected ? `используется в ${affected} карточках` : "",
        children ? `дочерних элементов: ${children}` : "",
      ].filter(Boolean).join(", ");
      if (!window.confirm(`Архивировать «${row.name}»${suffix ? ` (${suffix})` : ""}?`)) return;
    }
    await settingsMutation.mutateAsync({
      method: "PUT",
      path: kind === "category"
        ? `/api/warehouse/categories/${row.id}`
        : `/api/warehouse/storage-locations/${row.id}`,
      body: { archived },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] max-w-4xl overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Настройки склада</DialogTitle>
          <DialogDescription>
            Категории и физические места хранения относятся только к активной компании.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="categories" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="categories">
              <Tags className="mr-2 h-4 w-4" />
              Категории
            </TabsTrigger>
            <TabsTrigger value="storage">
              <MapPinned className="mr-2 h-4 w-4" />
              Места хранения
            </TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="space-y-4">
            {canManage && (
              <div className="grid gap-2 rounded-surface border border-border/50 bg-surface-subtle p-3 sm:grid-cols-[1fr_1fr_auto]">
                <Input
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  placeholder="Название категории"
                />
                <Select value={categoryParentId} onValueChange={setCategoryParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Уровень" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Основная категория</SelectItem>
                    {rootCategories.filter((category) => !category.archivedAt && category.id !== editingCategoryId).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        Подкатегория в «{category.name}»
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button
                    onClick={submitCategory}
                    disabled={!categoryName.trim() || settingsMutation.isPending}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {editingCategoryId ? "Обновить" : "Добавить"}
                  </Button>
                  {editingCategoryId && (
                    <Button variant="outline" size="icon" onClick={resetCategoryForm}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {categoryRows.length === 0 ? (
                <div className="rounded-control border border-dashed border-border/60 bg-surface-subtle p-8 text-center text-sm text-muted-foreground">
                  Категорий пока нет.
                </div>
              ) : categoryRows.map(({ row, depth }) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-control border border-border/45 bg-surface-raised p-3 shadow-xs sm:flex-row sm:items-center",
                    row.archivedAt && "opacity-60",
                  )}
                  style={{ marginLeft: `${Math.min(depth, 1) * 20}px` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      {depth > 0 && <Badge variant="outline">Подкатегория</Badge>}
                      {row.archivedAt && <Badge variant="secondary">Архив</Badge>}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Оборудование: {Number(row.equipmentCount || 0)}
                      {Number(row.childCount || 0) > 0 ? ` · Подкатегории: ${row.childCount}` : ""}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="icon" onClick={() => reorderRows("category", row.id, -1)} title="Выше">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => reorderRows("category", row.id, 1)} title="Ниже">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCategoryId(row.id);
                          setCategoryName(row.name);
                          setCategoryParentId(row.parentId || "root");
                        }}
                        title="Изменить"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setArchived("category", row, !row.archivedAt)}
                        title={row.archivedAt ? "Восстановить" : "Архивировать"}
                      >
                        {row.archivedAt ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            {canManage && (
              <div className="grid gap-2 rounded-surface border border-border/50 bg-surface-subtle p-3 md:grid-cols-2">
                <Input
                  value={storageName}
                  onChange={(event) => setStorageName(event.target.value)}
                  placeholder="Название: стеллаж B, полка 3"
                />
                <Input
                  value={storageCode}
                  onChange={(event) => setStorageCode(event.target.value)}
                  placeholder="Код или маркировка (необязательно)"
                />
                <Select value={storageType} onValueChange={setStorageType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Тип места" />
                  </SelectTrigger>
                  <SelectContent>
                    {STORAGE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={storageParentId} onValueChange={setStorageParentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Родительское место" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Корневое место</SelectItem>
                    {storageRows
                      .filter(({ row }) => !row.archivedAt && row.id !== editingStorageId)
                      .map(({ row, depth }) => (
                        <SelectItem key={row.id} value={row.id}>
                          {"— ".repeat(Math.min(depth, 5))}{row.path || row.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 md:col-span-2">
                  <Button
                    onClick={submitStorage}
                    disabled={!storageName.trim() || settingsMutation.isPending}
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {editingStorageId ? "Обновить" : "Добавить"}
                  </Button>
                  {editingStorageId && (
                    <Button variant="outline" onClick={resetStorageForm}>
                      Отмена
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {storageRows.length === 0 ? (
                <div className="rounded-control border border-dashed border-border/60 bg-surface-subtle p-8 text-center text-sm text-muted-foreground">
                  Мест хранения пока нет.
                </div>
              ) : storageRows.map(({ row, depth }) => (
                <div
                  key={row.id}
                  className={cn(
                    "flex flex-col gap-2 rounded-control border border-border/45 bg-surface-raised p-3 shadow-xs sm:flex-row sm:items-center",
                    row.archivedAt && "opacity-60",
                  )}
                  style={{ marginLeft: `${Math.min(depth, 5) * 14}px` }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{row.name}</span>
                      <Badge variant="outline">{storageTypeLabel(row.type)}</Badge>
                      {row.code && <Badge variant="secondary">{row.code}</Badge>}
                      {row.archivedAt && <Badge variant="secondary">Архив</Badge>}
                    </div>
                    <div className="mt-1 break-words text-xs text-muted-foreground">
                      {row.path || row.name} · Оборудование: {Number(row.equipmentCount || 0)}
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="icon" onClick={() => reorderRows("storage", row.id, -1)} title="Выше">
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => reorderRows("storage", row.id, 1)} title="Ниже">
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingStorageId(row.id);
                          setStorageName(row.name);
                          setStorageCode(row.code || "");
                          setStorageType(row.type || "other");
                          setStorageParentId(row.parentId || "root");
                        }}
                        title="Изменить"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setArchived("storage", row, !row.archivedAt)}
                        title={row.archivedAt ? "Восстановить" : "Архивировать"}
                      >
                        {row.archivedAt ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
