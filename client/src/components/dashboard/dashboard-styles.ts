export const DASHBOARD_WIDGET_CARD_CLASS =
  "h-full min-w-0 overflow-hidden border-border/50 bg-surface-raised shadow-xs";

export const DASHBOARD_WIDGET_SCROLL_CARD_CLASS =
  `${DASHBOARD_WIDGET_CARD_CLASS} flex min-h-0 flex-col`;

export const DASHBOARD_WIDGET_SCROLL_CONTENT_CLASS =
  "min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]";

export const DASHBOARD_WIDGET_ROW_CLASS =
  "rounded-control border border-border/50 bg-surface-subtle";

export const DASHBOARD_WIDGET_ENTITY_LINK_CLASS =
  "transition-colors hover:border-primary/30 hover:bg-surface-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export const DASHBOARD_WIDGET_EMPTY_CLASS =
  "rounded-control border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground";

export const DASHBOARD_WIDGET_WARNING_CLASS =
  "rounded-control border border-warning/30 bg-warning-muted px-3 py-2 text-xs text-warning";

export const DASHBOARD_WIDGET_ERROR_CLASS =
  "rounded-control border border-error/30 bg-error-muted px-3 py-2 text-xs text-error";
