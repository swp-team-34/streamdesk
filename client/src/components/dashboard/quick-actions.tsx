import { Button } from "@/components/ui/button";
import { Video, Package, CalendarPlus, ListTodo } from "lucide-react";
import { Link } from "wouter";

export default function QuickActions() {
  const actions = [
    {
      title: "Новый стрим",
      icon: Video,
      href: "/streams",
      tone: "bg-error-muted text-error",
    },
    {
      title: "Техника",
      icon: Package,
      href: "/equipment",
      tone: "bg-warning-muted text-warning",
    },
    {
      title: "Событие",
      icon: CalendarPlus,
      href: "/calendar",
      tone: "bg-primary/10 text-primary",
    },
    {
      title: "Задачи",
      icon: ListTodo,
      href: "/tasks",
      tone: "bg-info-muted text-info",
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {actions.map((action, index) => {
        const Icon = action.icon;
        return (
          <Link key={index} href={action.href}>
            <Button
              variant="outline"
              className={`
                w-full flex flex-col items-center justify-center gap-1 p-2.5 h-auto min-h-0
                border-border/50 bg-card
                transition-colors duration-150
                hover:border-primary/30 hover:bg-muted/40
                group
              `}
              data-testid={`quick-action-${index}`}
            >
              <div className={`
                w-8 h-8 rounded-control flex items-center justify-center shrink-0
                ${action.tone}
                transition-colors
              `}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-medium text-foreground">{action.title}</span>
            </Button>
          </Link>
        );
      })}
    </div>
  );
}
