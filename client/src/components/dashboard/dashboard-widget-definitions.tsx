import CurrentActivity from "@/components/dashboard/current-activity";
import DeadlineTasksWidget from "@/components/dashboard/deadline-tasks-widget";
import EquipmentStatus from "@/components/dashboard/equipment-status";
import {
  AttentionSummaryWidget,
  MyWorkloadWidget,
  OverdueTasksWidget,
  UpcomingEventsWidget,
} from "@/components/dashboard/follow-up-widgets";
import LocationIssuesWidget from "@/components/dashboard/location-issues-widget";
import {
  ActiveProjectsOperationalWidget,
  EquipmentForTasksWidget,
  TeamWorkloadOperationalWidget,
  UnassignedTasksWidget,
  UpcomingReturnsOperationalWidget,
} from "@/components/dashboard/operational-widgets";
import QuickCalendar from "@/components/dashboard/quick-calendar";
import StatusCards from "@/components/dashboard/status-cards";
import StreamingStats from "@/components/dashboard/streaming-stats";
import SystemStatus from "@/components/dashboard/system-status";
import VmixScheduler from "@/components/dashboard/vmix-scheduler";
import WorkProgressWidget from "@/components/dashboard/work-progress-widget";
import {
  canAccessTab,
  type DashboardWidgetDefinition,
  type DashboardUser,
} from "@/lib/dashboard-page-model";

export function buildDashboardWidgetDefinitions({
  currentUser,
  stats,
  events,
  systems,
  equipment,
  streams,
}: {
  currentUser: DashboardUser | null;
  stats: any;
  events: any[];
  systems: any[];
  equipment: any[];
  streams: any[];
}): DashboardWidgetDefinition[] {
  const widgets: DashboardWidgetDefinition[] = [
    {
      id: "status",
      title: "Статус",
      layout: { defaultW: 12, defaultH: 5, minW: 6, maxW: 12, minH: 5, maxH: 12 },
      render: () => (
        <div className="h-full p-1">
          <StatusCards stats={stats} user={currentUser} />
        </div>
      ),
    },
  ];

  if (canAccessTab(currentUser, "tasks")) {
    widgets.push(
      {
        id: "attention-summary",
        title: "Требует внимания",
        layout: { defaultW: 4, defaultH: 10, minW: 3, maxW: 8, minH: 8, maxH: 20 },
        render: () => <AttentionSummaryWidget />,
      },
      {
        id: "work-progress",
        title: "Ход работ",
        layout: { defaultW: 12, defaultH: 18, minW: 6, maxW: 12, minH: 12, maxH: 32 },
        render: () => <WorkProgressWidget />,
      },
      {
        id: "deadline-tasks",
        title: "Задачи по срокам",
        layout: { defaultW: 8, defaultH: 22, minW: 5, maxW: 12, minH: 12, maxH: 34 },
        render: () => <DeadlineTasksWidget limit={5} />,
      },
      {
        id: "overdue-tasks",
        title: "Просроченные задачи",
        layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
        render: () => <OverdueTasksWidget />,
      },
      {
        id: "my-workload",
        title: "Моя нагрузка",
        layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
        render: () => <MyWorkloadWidget user={currentUser} />,
      },
      {
        id: "unassigned-tasks",
        title: "Задачи без исполнителя",
        layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
        render: () => <UnassignedTasksWidget />,
      },
      {
        id: "team-workload",
        title: "Нагрузка команды",
        layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
        render: () => <TeamWorkloadOperationalWidget />,
      },
    );
  }

  if (canAccessTab(currentUser, "locations")) {
    widgets.push({
      id: "location-issues",
      title: "Обновления площадок",
      layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
      render: () => <LocationIssuesWidget />,
    });
  }

  if (canAccessTab(currentUser, "tasks") && canAccessTab(currentUser, "equipment")) {
    widgets.push({
      id: "equipment-current-tasks",
      title: "Оборудование текущих задач",
      layout: { defaultW: 6, defaultH: 18, minW: 4, maxW: 12, minH: 12, maxH: 30 },
      render: () => <EquipmentForTasksWidget user={currentUser} />,
    });
  }

  if (canAccessTab(currentUser, "equipment")) {
    widgets.push({
      id: "equipment-attention",
      title: "Ближайшие возвраты",
      layout: { defaultW: 6, defaultH: 14, minW: 4, maxW: 12, minH: 10, maxH: 26 },
      render: () => <UpcomingReturnsOperationalWidget />,
    });
  }

  if (canAccessTab(currentUser, "calendar")) {
    widgets.push({
      id: "upcoming-events",
      title: "Ближайшие события",
      layout: { defaultW: 6, defaultH: 16, minW: 4, maxW: 12, minH: 10, maxH: 28 },
      render: () => <UpcomingEventsWidget events={events} />,
    });
  }

  if (canAccessTab(currentUser, "projects")) {
    widgets.push({
      id: "active-projects",
      title: "Активные проекты",
      layout: { defaultW: 8, defaultH: 18, minW: 5, maxW: 12, minH: 12, maxH: 30 },
      render: () => <ActiveProjectsOperationalWidget />,
    });
  }

  if (canAccessTab(currentUser, "streams") || canAccessTab(currentUser, "calendar")) {
    widgets.push({
      id: "current-activity",
      title: "Текущая активность",
      layout: { defaultW: 8, defaultH: 16, minW: 5, maxW: 12, minH: 10, maxH: 28 },
      render: () => (
        <CurrentActivity
          streams={canAccessTab(currentUser, "streams") ? streams : []}
          events={canAccessTab(currentUser, "calendar") ? events : []}
        />
      ),
    });
  }

  if (canAccessTab(currentUser, "vmix-scheduler")) {
    widgets.push({
      id: "vmix-scheduler",
      title: "vMix Scheduler",
      layout: { defaultW: 8, defaultH: 20, minW: 5, maxW: 12, minH: 12, maxH: 34 },
      render: () => <VmixScheduler />,
    });
  }

  if (canAccessTab(currentUser, "calendar")) {
    widgets.push({
      id: "quick-calendar",
      title: "Календарь",
      layout: { defaultW: 8, defaultH: 18, minW: 5, maxW: 12, minH: 12, maxH: 30 },
      render: () => <QuickCalendar events={events} />,
    });
  }

  if (canAccessTab(currentUser, "streams")) {
    widgets.push({
      id: "streaming-stats",
      title: "Статистика стримов",
      layout: { defaultW: 4, defaultH: 16, minW: 3, maxW: 8, minH: 10, maxH: 28 },
      render: () => <StreamingStats />,
    });
  }

  if (canAccessTab(currentUser, "monitoring")) {
    widgets.push({
      id: "system-status",
      title: "Системы",
      layout: { defaultW: 4, defaultH: 14, minW: 3, maxW: 8, minH: 10, maxH: 26 },
      render: () => <SystemStatus systems={systems} />,
    });
  }

  if (canAccessTab(currentUser, "equipment")) {
    widgets.push({
      id: "equipment-status",
      title: "Склад техники",
      layout: { defaultW: 4, defaultH: 16, minW: 3, maxW: 8, minH: 10, maxH: 28 },
      render: () => <EquipmentStatus equipment={equipment} />,
    });
  }

  return widgets;
}
