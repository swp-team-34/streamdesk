import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  GripVertical,
  MoveDiagonal2,
} from "lucide-react";
import type { DashboardWidgetPlacement } from "@/lib/dashboard-layout";
import type {
  DashboardWidgetDefinition,
  DashboardWidgetId,
} from "@/lib/dashboard-page-model";

export function DashboardGridWidget({
  widget,
  index,
  total,
  placement,
  isInteracting,
  isInvalidTarget,
  onMove,
  onPointerInteraction,
  onResizeStep,
}: {
  widget: DashboardWidgetDefinition;
  index: number;
  total: number;
  placement: DashboardWidgetPlacement;
  isInteracting: boolean;
  isInvalidTarget: boolean;
  onMove: (index: number, direction: "up" | "down") => void;
  onPointerInteraction: (
    widgetId: DashboardWidgetId,
    mode: "move" | "resize",
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onResizeStep: (widgetId: DashboardWidgetId, deltaW: number, deltaH: number) => void;
}) {
  return (
    <div
      className={[
        "dashboard-widget-placement min-w-0",
        isInteracting ? "dashboard-widget-dragging" : "",
        isInvalidTarget ? "dashboard-widget-invalid-target" : "",
      ].join(" ")}
      style={{
        "--dashboard-widget-x": placement.x + 1,
        "--dashboard-widget-y": placement.y + 1,
        "--dashboard-widget-w": placement.w,
        "--dashboard-widget-h": placement.h,
      } as CSSProperties}
    >
      <div className="relative flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/35 bg-background/30 p-1 shadow-sm transition-colors">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            className="dashboard-direct-drag-handle flex min-w-0 flex-1 touch-none items-center gap-1.5 rounded-md text-left text-xs font-medium text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            onPointerDown={(event) => onPointerInteraction(widget.id, "move", event)}
            aria-label={`Переместить виджет ${widget.title}`}
            title="Перетащить виджет"
          >
            <GripVertical className="h-4 w-4 shrink-0" />
            <span className="truncate">{widget.title}</span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg"
                  aria-label={`Настроить размер виджета ${widget.title}`}
                  title="Размер виджета"
                >
                  <MoveDiagonal2 className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, -1, 0)}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Уже
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, 1, 0)}>
                  <ArrowRight className="mr-2 h-4 w-4" /> Шире
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, 0, -1)}>
                  <ArrowUp className="mr-2 h-4 w-4" /> Меньше по высоте
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onResizeStep(widget.id, 0, 1)}>
                  <ArrowDown className="mr-2 h-4 w-4" /> Больше по высоте
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onMove(index, "up")}
              disabled={index === 0}
              aria-label="Переместить выше"
              title="Переместить выше"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg"
              onClick={() => onMove(index, "down")}
              disabled={index === total - 1}
              aria-label="Переместить ниже"
              title="Переместить ниже"
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <div className="dashboard-widget-content min-h-[96px] min-w-0 flex-1 overflow-auto">
          {widget.render()}
        </div>
        <button
          type="button"
          className="dashboard-resize-handle absolute bottom-0 right-0 h-7 w-7 touch-none rounded-tl-lg text-muted-foreground outline-none transition hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60"
          onPointerDown={(event) => onPointerInteraction(widget.id, "resize", event)}
          onKeyDown={(event) => {
            const delta =
              event.key === "ArrowLeft" ? [-1, 0] :
              event.key === "ArrowRight" ? [1, 0] :
              event.key === "ArrowUp" ? [0, -1] :
              event.key === "ArrowDown" ? [0, 1] :
              null;
            if (!delta) return;
            event.preventDefault();
            onResizeStep(widget.id, delta[0], delta[1]);
          }}
          aria-label={`Изменить размер виджета ${widget.title}. Используйте клавиши со стрелками.`}
          title="Потяните для изменения размера"
        >
          <MoveDiagonal2 className="ml-auto mt-auto h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
