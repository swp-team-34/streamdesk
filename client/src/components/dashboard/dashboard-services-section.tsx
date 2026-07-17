import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Filter, Video, Calendar, Map, CalendarDays, Package, ClipboardList, Monitor, Network, FileSpreadsheet } from "lucide-react";
import { Link } from "wouter";
import { tabPermission } from "@shared/schema";
const SERVICES = [
  { tabKey: "streams", title: "Стриминг", href: "/streams", icon: Video },
  { tabKey: "calendar", title: "Календарь", href: "/calendar", icon: Calendar },
  { tabKey: "maps", title: "Карты", href: "/maps", icon: Map },
  { tabKey: "room-booking", title: "Бронирование комнат", href: "/room-booking", icon: CalendarDays },
  { tabKey: "equipment", title: "Склад техники", href: "/equipment", icon: Package },
  { tabKey: "estimates", title: "Смета", href: "/estimates", icon: FileSpreadsheet },
  { tabKey: "tasks", title: "Задачи", href: "/tasks", icon: ClipboardList },
  { tabKey: "monitoring", title: "Мониторинг", href: "/monitoring", icon: Monitor },
  { tabKey: "connection-schemas", title: "Схемы подключения", href: "/connection-schemas", icon: Network },
];

function canAccessTab(user: any, tabKey: string): boolean {
  if (!user) return true;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const hasTabPermissions = permissions.some((permission: string) => permission.startsWith("tab:"));
  if (hasTabPermissions) return permissions.includes(tabPermission(tabKey));
  return true;
}

export default function DashboardServicesSection({ user }: { user?: any }) {
  const services = SERVICES.filter((service) => canAccessTab(user, service.tabKey));
  if (services.length === 0) return null;

  return (
    <div className="w-full min-w-0 space-y-2">
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="shrink-0 text-base font-semibold text-foreground">
          Все сервисы
        </h3>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto min-w-0">
          <Button variant="outline" size="sm" className="h-9 border-border shrink-0">
            <Filter className="h-4 w-4 mr-1.5" />
            Фильтр
          </Button>
        </div>
      </div>
      <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {services.map((service) => {
          const Icon = service.icon;
          return (
            <Link key={service.href} href={service.href} className="min-w-0">
              <Card className="h-full cursor-pointer overflow-hidden border-border/50 bg-surface-raised transition-[border-color,background-color] hover:border-primary/40 hover:bg-primary/5">
                <CardContent className="flex min-w-0 items-center gap-2.5 !p-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-foreground truncate min-w-0">{service.title}</span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
