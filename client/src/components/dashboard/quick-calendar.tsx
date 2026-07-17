import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { Calendar } from "lucide-react";
import {
  DASHBOARD_WIDGET_CARD_CLASS,
  DASHBOARD_WIDGET_ENTITY_LINK_CLASS,
  DASHBOARD_WIDGET_ROW_CLASS,
} from "@/components/dashboard/dashboard-styles";
import { getCalendarEventHref } from "@/lib/entity-navigation";

interface QuickCalendarProps {
  events?: any[];
}

export default function QuickCalendar({ events }: QuickCalendarProps) {
  const today = new Date();
  const todayEvents = events?.filter(event => {
    const eventDate = new Date(event.startTime);
    return eventDate.toDateString() === today.toDateString();
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()) || [];

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "stream": return "bg-info";
      case "recording": return "bg-success";
      case "maintenance": return "bg-warning";
      case "meeting": return "bg-chart-4";
      default: return "bg-muted-foreground";
    }
  };

  return (
    <Card className={DASHBOARD_WIDGET_CARD_CLASS}>
      <CardHeader className="py-2 px-3 pb-1">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-foreground">Календарь на сегодня</CardTitle>
          <Link href="/calendar">
            <span className="text-primary hover:underline text-xs font-medium cursor-pointer">
              Открыть календарь
            </span>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-2.5 pt-0">
        {todayEvents.length === 0 ? (
          <div className="py-3 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs">На сегодня событий нет</p>
          </div>
        ) : (
          <div className="space-y-1">
            {todayEvents.map((event) => (
              <Link
                key={event.id}
                href={getCalendarEventHref(event.id, event.startTime)}
                className={`flex items-center space-x-2 p-1.5 ${DASHBOARD_WIDGET_ROW_CLASS} ${DASHBOARD_WIDGET_ENTITY_LINK_CLASS}`}
              >
                <div className="w-10 text-center shrink-0">
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(event.startTime).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{event.title}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {event.location} • {event.userId ? 'Назначено' : 'Свободное'}
                  </p>
                </div>
                <div className={`w-2.5 h-2.5 shrink-0 ${getEventTypeColor(event.type)} rounded-full`}></div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
