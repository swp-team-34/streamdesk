import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MapPin, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeSubscriptions } from "@/hooks/use-websocket";
import { queryClient } from "@/lib/queryClient";

type Topic = {
  id: string;
  locationId: string;
  type: "note" | "issue";
  title: string;
  severity: "low" | "medium" | "high" | "critical" | null;
  status: "active" | "resolved" | "archived";
  updatedAt?: string | null;
};

type Location = { id: string; companyId?: string | null; name: string };

const SEVERITY_LABELS: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

export default function LocationIssuesWidget() {
  const issuesQuery = useQuery<Topic[]>({
    queryKey: ["/api/location-issues"],
    refetchInterval: 30_000,
  });
  const locationsQuery = useQuery<Location[]>({
    queryKey: ["/api/locations"],
    staleTime: 30_000,
  });
  const locationRows = locationsQuery.data ?? [];
  const locations = new Map(locationRows.map((location) => [location.id, location.name]));
  const companyChannels = Array.from(new Set(
    locationRows.map((location) => location.companyId).filter(Boolean),
  )).map((companyId) => `company:${companyId}`);

  useRealtimeSubscriptions(companyChannels, (message) => {
    if (message.type !== "discussion_event" && message.type !== "realtime_reconnected") return;
    queryClient.invalidateQueries({ queryKey: ["/api/location-issues"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
  });

  const active = (issuesQuery.data ?? [])
    .filter((topic) => topic.type === "issue" && topic.status === "active")
    .sort((left, right) =>
      new Date(right.updatedAt || 0).getTime() - new Date(left.updatedAt || 0).getTime(),
    )
    .slice(0, 5);

  return (
    <Card className="h-full border-l-4 border-l-amber-500/80">
      <CardHeader className="flex flex-row items-center justify-between px-3 py-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Обновления площадок
        </CardTitle>
        <div className="flex items-center gap-1">
          <Link href="/locations" className="px-1 text-xs text-primary hover:underline">Все</Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              issuesQuery.refetch();
              locationsQuery.refetch();
            }}
            disabled={issuesQuery.isFetching || locationsQuery.isFetching}
            aria-label="Обновить площадки"
          >
            <RefreshCw className={issuesQuery.isFetching || locationsQuery.isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-3 pb-3 pt-0">
        {(issuesQuery.isError || locationsQuery.isError) && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Не удалось обновить данные. Показаны последние доступные значения.
          </div>
        )}
        {issuesQuery.isLoading || locationsQuery.isLoading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-md bg-muted/60" />
          ))
        ) : active.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
            Активных проблем нет
          </div>
        ) : active.map((topic) => (
          <Link
            key={topic.id}
            href={`/locations?locationId=${encodeURIComponent(topic.locationId)}&topicId=${encodeURIComponent(topic.id)}`}
            className="flex items-center justify-between gap-2 rounded-md border px-2 py-2 transition hover:bg-muted/40"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{topic.title}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {locations.get(topic.locationId) || "Площадка"}
              </div>
            </div>
            <Badge variant="outline" className="shrink-0">
              {SEVERITY_LABELS[String(topic.severity)] || "Проблема"}
            </Badge>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
