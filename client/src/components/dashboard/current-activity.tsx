import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Video, Camera, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_WIDGET_CARD_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
} from "@/components/dashboard/dashboard-styles";

interface CurrentActivityProps {
  streams?: any[];
  events?: any[];
}

export default function CurrentActivity({ streams, events }: CurrentActivityProps) {
  const activeStreams = streams?.filter(stream => stream.status === "live") || [];
  const upcomingEvents = events?.filter(event => {
    const eventTime = new Date(event.startTime);
    const now = new Date();
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    return eventTime > now && eventTime <= in2Hours;
  }) || [];

  const activities = [
    ...activeStreams.map(stream => ({
      ...stream,
      type: 'stream',
      icon: Video,
      status: 'В эфире',
      duration: stream.startTime ? `${Math.floor((Date.now() - new Date(stream.startTime).getTime()) / (1000 * 60))}м` : null
    })),
    ...upcomingEvents.map(event => ({
      ...event,
      type: 'event',
      icon: Camera,
      status: 'Подготовка',
      timeLeft: `через ${Math.floor((new Date(event.startTime).getTime() - Date.now()) / (1000 * 60))} мин`
    }))
  ];

  return (
    <Card className={DASHBOARD_WIDGET_CARD_CLASS}>
      <CardHeader className="py-2 px-3 sm:px-3 pb-1">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-error" />
          <CardTitle className="text-sm font-semibold text-foreground">Текущая активность</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-0 pb-0 pt-0">
        {activities.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground">
            <Radio className="mx-auto mb-1.5 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs">Нет активных трансляций</p>
            <p className="mt-0.5 text-[10px]">Запланированные события появятся здесь</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {activities.map((activity, index) => {
              const Icon = activity.icon;
              const isStream = activity.type === 'stream';
              return (
                <div
                  key={index}
                  className={cn(
                    "flex min-w-0 items-center justify-between overflow-hidden",
                    DASHBOARD_WIDGET_ROW_CLASS,
                  )}
                  data-testid={`activity-${index}`}
                >
                  <div className={`flex items-center gap-3 p-3 w-full`}>
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-control",
                      isStream ? "bg-error-muted text-error" : "bg-warning-muted text-warning",
                    )}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground sm:text-base">{activity.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                        {activity.location} • {isStream ? 'В эфире' : `Начало в ${new Date(activity.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`}
                      </p>
                    </div>
                    <div className="text-right flex flex-col items-end justify-center gap-0.5">
                      <span className={cn("text-sm font-semibold", isStream ? "text-error" : "text-warning")}>{activity.status}</span>
                      <p className="text-xs text-muted-foreground">{activity.duration || activity.timeLeft}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
