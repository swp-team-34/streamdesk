import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock, FileText, History } from "lucide-react";
import type { User } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StreamDatePicker } from "@/components/ui/stream-date-picker";
import { apiRequest } from "@/lib/queryClient";

export function formatUserLogDate(date: string) {
  return new Date(date).toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getUserLogActionLabel(action: string) {
  const labels: Record<string, string> = {
    created: "Создано",
    updated: "Обновлено",
    status_changed: "Изменен статус",
    assigned: "Назначено",
    commented: "Комментарий",
    deleted: "Удалено",
  };
  return labels[action] || action;
}

export function UserLogsTab() {
  const [selectedUserId, setSelectedUserId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: logs = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/user-logs", selectedUserId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedUserId !== "all") params.append("userId", selectedUserId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await apiRequest("GET", `/api/admin/user-logs?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch logs");
      return response.json();
    },
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return "Неизвестно";
    const user = users.find((item) => item.id === userId);
    return user?.name || user?.username || "Неизвестно";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Логи активности сотрудников</CardTitle>
          <CardDescription>Просмотр истории действий пользователей в системе</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label>Пользователь</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Все пользователи" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все пользователи</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name || user.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <StreamDatePicker
                id="user-log-start-date"
                label="Начало периода"
                value={startDate}
                maxValue={endDate || null}
                onChange={setStartDate}
              />
            </div>
            <div>
              <StreamDatePicker
                id="user-log-end-date"
                label="Конец периода"
                value={endDate}
                minValue={startDate || null}
                onChange={setEndDate}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            История действий ({logs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">Загрузка...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-gray-500">Нет записей</div>
          ) : (
            <div className="hide-scrollbar max-h-[600px] space-y-3 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                    {log.type === "task_history" ? (
                      <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold">{getUserName(log.userId)}</span>
                      <Badge variant="outline">{getUserLogActionLabel(log.action)}</Badge>
                      <span className="text-sm text-gray-500">{formatUserLogDate(log.timestamp)}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{log.description}</p>
                    {log.data?.taskId && (
                      <p className="mt-1 text-xs text-gray-500">ID задачи: {log.data.taskId}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
