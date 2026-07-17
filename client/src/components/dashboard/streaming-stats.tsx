import React, { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { Youtube } from "lucide-react";
import { SiVk } from "react-icons/si";
import {
  DASHBOARD_WIDGET_CARD_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
} from "@/components/dashboard/dashboard-styles";

interface PlatformStats {
  viewers: number;
  duration: string;
  bitrate?: number;
  status?: string;
}

interface PlatformRowProps {
  name: string;
  icon: any;
  stats?: PlatformStats;
  toneClass?: string;
}

const PlatformRow = memo(function PlatformRow({ name, icon: Icon, stats, toneClass = "bg-muted text-muted-foreground" }: PlatformRowProps) {
  if (!stats) return null;

  return (
    <div className={`flex items-center justify-between overflow-hidden ${DASHBOARD_WIDGET_ROW_CLASS}`}>
      <div className="flex items-center gap-3 p-3 w-full">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground sm:text-base">{name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{stats.viewers?.toLocaleString()} зрит.</p>
        </div>
        <div className="text-right flex flex-col items-end justify-center gap-0.5">
          <span className="text-sm font-semibold text-success">{stats.status || "Активно"}</span>
          <p className="text-xs text-muted-foreground">{stats.duration || "—"}</p>
        </div>
      </div>
    </div>
  );
});

PlatformRow.displayName = "PlatformRow";

export default function StreamingStats() {
  const { data: youtubeStats } = useQuery<PlatformStats>({
    queryKey: ["/api/integrations/youtube/stats"],
    refetchInterval: 10000,
  });

  const { data: vkStats } = useQuery<PlatformStats>({
    queryKey: ["/api/integrations/vk/stats"],
    refetchInterval: 10000,
  });

  const totalViewers = (youtubeStats?.viewers || 0) + (vkStats?.viewers || 0);
  const avgBitrate = Math.round(((youtubeStats?.bitrate || 0) + (vkStats?.bitrate || 0)) / 2 / 1000 * 10) / 10;

  return (
    <Card className={DASHBOARD_WIDGET_CARD_CLASS}>
      <CardHeader className="px-3 pb-1.5 pt-2.5">
        <CardTitle className="text-sm font-semibold text-foreground">Статистика стримов</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3 pt-0">
        <div className="space-y-2">
          <PlatformRow name="YouTube" icon={Youtube} stats={youtubeStats} toneClass="bg-error-muted text-error" />
          <PlatformRow name="ВКонтакте" icon={SiVk} stats={vkStats} toneClass="bg-info-muted text-info" />

          {(youtubeStats || vkStats) && (
            <div className="space-y-1 border-t border-border/50 px-1 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Общие просмотры</span>
                <span className="font-semibold text-foreground">{totalViewers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Средний битрейт</span>
                <span className="font-semibold text-foreground">{avgBitrate} Mbps</span>
              </div>
            </div>
          )}

          {!youtubeStats && !vkStats && (
            <div className="text-center py-6">
              <Youtube className="mx-auto mb-2 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Нет активных стримов</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
