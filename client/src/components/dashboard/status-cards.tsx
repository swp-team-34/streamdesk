import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Monitor, Video, Zap, Calendar } from "lucide-react";
import { tabPermission } from "@shared/schema";

interface StatusCardsProps {
  stats: any;
  user?: any;
}

function canAccessTab(user: any, tabKey: string): boolean {
  if (!user) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const hasTabPermissions = permissions.some((permission: string) => permission.startsWith("tab:"));
  if (hasTabPermissions) return permissions.includes(tabPermission(tabKey));
  return true;
}

export default function StatusCards({ stats, user }: StatusCardsProps) {
  if (!stats) {
    return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse border-border/50 bg-surface-raised">
            <CardContent className="p-3">
              <div className="h-10 rounded-control bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const cards = [
    {
      title: "Системы",
      tabKey: "monitoring",
      value: stats.onlineSystems,
      icon: Monitor,
      iconColor: "text-success",
      bgColor: "bg-success-muted",
      description: "онлайн"
    },
    {
      title: "Стримы", 
      tabKey: "streams",
      value: stats.activeStreams,
      icon: Video,
      iconColor: "text-info",
      bgColor: "bg-info-muted",
      indicator: "pulse",
      description: "активных"
    },
    {
      title: "Сеть",
      tabKey: "monitoring",
      value: stats.networkMbps ?? 0,
      icon: Zap,
      iconColor: "text-warning",
      bgColor: "bg-warning-muted",
      description: "Mbps"
    },
    {
      title: "Событий",
      tabKey: "calendar",
      value: stats.todayEvents,
      icon: Calendar,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
      description: "сегодня"
    },
    ...(stats.kanbanCompletion ? [{
      title: "Задачи",
      tabKey: "tasks",
      value: `${stats.kanbanCompletion.percent ?? 0}%`,
      icon: CheckCircle2,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
      description: `${stats.kanbanCompletion.completed ?? 0}/${stats.kanbanCompletion.total ?? 0} готово`
    }] : [])
  ];

  const visibleCards = cards.filter((card) => canAccessTab(user, card.tabKey));

  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {visibleCards.map((card, index) => {
        const Icon = card.icon;
        return (
          <Card
            key={index}
            className="relative min-w-0 overflow-hidden border-border/50 bg-surface-raised shadow-xs"
            data-testid={`status-card-${index}`}
          >
            <CardContent className="min-w-0 p-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-control ${card.bgColor}`}>
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline gap-1.5">
                    <span className="truncate text-xl font-semibold tabular-nums text-foreground">{card.value}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{card.description}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{card.title}</p>
                </div>
                {card.indicator === "pulse" && (
                  <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-success" aria-label="Активно" />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
