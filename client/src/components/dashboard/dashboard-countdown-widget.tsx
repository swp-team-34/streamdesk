import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ru } from "date-fns/locale";

interface DashboardCountdownWidgetProps {
  nextEvent?: { startTime: string; title: string } | null;
}

export default function DashboardCountdownWidget({ nextEvent }: DashboardCountdownWidgetProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = nextEvent ? new Date(nextEvent.startTime) : null;
  const isPast = target ? target.getTime() <= now.getTime() : true;
  const text = nextEvent ? nextEvent.title : "Нет запланированных событий";
  const distance = target && !isPast ? formatDistanceToNow(target, { locale: ru, addSuffix: false }) : nextEvent ? "0 дн. 0 ч. 0 мин." : "Нет запланированных";

  return (
    <Card className="min-w-0 overflow-hidden border-border/50 bg-surface-raised shadow-xs">
      <CardContent className="min-w-0 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-warning-muted">
            <CalendarClock className="h-5 w-5 text-warning" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Ближайшее событие</p>
            <p className="truncate text-sm font-semibold text-foreground">{text}</p>
            <p className="mt-0.5 text-xs font-medium tabular-nums text-primary">{distance}</p>
          </div>
          <div className="shrink-0">
            <Link href="/calendar">
              <span className="inline-flex min-h-9 cursor-pointer items-center rounded-control px-2 text-xs font-medium text-primary hover:bg-primary/10">
                Календарь →
              </span>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
