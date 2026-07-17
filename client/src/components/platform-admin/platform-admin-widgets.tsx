import { useMemo, type ComponentType } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import {
  PLATFORM_COLORS,
  PLATFORM_MONTH_LABELS,
  num,
  type HeatPoint,
} from "@/lib/platform-admin-model";
import { cn } from "@/lib/utils";

export function ActivityHeatmap({
  title,
  points,
}: {
  title: string;
  points: HeatPoint[];
}) {
  const total = points.reduce((sum, point) => sum + point.count, 0);
  const weeks = useMemo(() => {
    const result: Array<Array<HeatPoint | null>> = [];
    let current = Array<HeatPoint | null>(7).fill(null);

    points.forEach((point, index) => {
      const date = new Date(`${point.date}T00:00:00`);
      const dayIndex = (date.getDay() + 6) % 7;
      if (dayIndex === 0 && index !== 0) {
        result.push(current);
        current = Array<HeatPoint | null>(7).fill(null);
      }
      current[dayIndex] = point;
    });

    if (current.some(Boolean)) result.push(current);
    return result;
  }, [points]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-sm text-muted-foreground">
            {total.toLocaleString("ru-RU")} событий за год
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-1 text-[11px] text-muted-foreground">
        {PLATFORM_MONTH_LABELS.map((label) => (
          <div key={label} className="text-center">{label}</div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-surface border border-border/50 bg-muted/20 p-3">
        <div className="grid w-max grid-flow-col gap-1">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-rows-7 gap-1">
              {week.map((cell, dayIndex) => {
                const intensity = cell?.intensity ?? 0;
                const color =
                  intensity >= 4 ? "bg-fuchsia-400" :
                  intensity === 3 ? "bg-violet-400" :
                  intensity === 2 ? "bg-violet-500/60" :
                  intensity === 1 ? "bg-violet-500/25" :
                  "bg-muted";
                return (
                  <div
                    key={`${weekIndex}-${dayIndex}`}
                    title={cell ? `${cell.date}: ${cell.count}` : ""}
                    className={cn("h-3 w-3 rounded-[3px] border border-white/5", color)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TodayUsageChart({ data }: { data: any[] }) {
  const chartData = (data || []).map((point) => ({
    label: point.label,
    heartbeats: num(point.heartbeats),
    activeSystems: num(point.activeSystems),
    cpuPercent: num(point.cpuPercent),
    memoryPercent: num(point.memoryPercent),
  }));

  return (
    <div className="space-y-2">
      <div>
        <div className="font-semibold">Использование сервиса сегодня</div>
        <div className="text-sm text-muted-foreground">
          Heartbeat, активные системы и нагрузка обновляются в выбранном интервале.
        </div>
      </div>
      <div className="h-44 rounded-surface border border-border/50 bg-muted/20 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.16)" />
            <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
            <RechartsTooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="heartbeats"
              name="Heartbeat"
              stroke={PLATFORM_COLORS.violet}
              fill={PLATFORM_COLORS.violet}
              fillOpacity={0.18}
            />
            <Line
              type="monotone"
              dataKey="activeSystems"
              name="Активные системы"
              stroke={PLATFORM_COLORS.green}
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="cpuPercent"
              name="CPU %"
              stroke={PLATFORM_COLORS.amber}
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardContent>
    </Card>
  );
}
