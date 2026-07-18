import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CALENDAR_TIMELINE_BUFFER_DAYS,
  getCalendarTimelineDayWidth,
  getCalendarTimelineScrollLeft,
} from "@/lib/calendar-timeline";
import Calendar from "./calendar";

const queryState = vi.hoisted(() => ({ loading: true }));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useQuery: ({ queryKey }: { queryKey: string[] }) => ({
      data: [],
      isLoading: queryKey[0] === "/api/users" ? false : queryState.loading,
    }),
  };
});

vi.mock("@/lib/calendar-timeline", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/calendar-timeline")>();
  return {
    ...actual,
    CALENDAR_TIMELINE_BUFFER_DAYS: 12,
    CALENDAR_TIMELINE_PREFETCH_THRESHOLD_DAYS: 1,
  };
});

vi.mock("@/hooks/use-websocket", () => ({
  useWebSocket: () => undefined,
}));

vi.mock("@/components/forms/event-form", () => ({
  EventForm: () => null,
}));

vi.mock("@/components/calendar/calendar-entry-detail-dialog", () => ({
  CalendarEntryDetailDialog: () => null,
}));

vi.mock("@/components/calendar/calendar-settings-dialog", () => ({
  CalendarSettingsDialog: () => null,
}));

const VIEWPORT_WIDTH = 756;
const DAY_WIDTH = getCalendarTimelineDayWidth({
  viewportWidth: VIEWPORT_WIDTH,
  viewMode: "week",
  showWeekends: true,
});

let originalScrollTo: PropertyDescriptor | undefined;
let scrollToMock: ReturnType<typeof vi.fn>;

function renderCalendar() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <Calendar />
    </QueryClientProvider>,
  );
  return { ...result, queryClient };
}

describe("calendar timeline initialization", () => {
  beforeAll(() => {
    originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      width: VIEWPORT_WIDTH,
      height: 600,
      top: 0,
      right: VIEWPORT_WIDTH,
      bottom: 600,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
  });

  beforeEach(() => {
    queryState.loading = true;
    window.localStorage.clear();
    window.history.replaceState({}, "", "/calendar?date=2026-07-17&view=week");
    scrollToMock = vi.fn(function scrollTo(this: HTMLElement, options: ScrollToOptions) {
      if (options.left != null) this.scrollLeft = options.left;
      if (options.top != null) this.scrollTop = options.top;
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      writable: true,
      value: scrollToMock,
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
  });

  afterAll(() => {
    vi.restoreAllMocks();
    if (originalScrollTo) {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
    } else {
      delete (HTMLElement.prototype as { scrollTo?: typeof HTMLElement.prototype.scrollTo }).scrollTo;
    }
  });

  it("centers the selected week when the timeline mounts after initial loading", async () => {
    const { rerender, queryClient } = renderCalendar();
    expect(screen.queryByLabelText(/Временная шкала календаря/)).not.toBeInTheDocument();

    queryState.loading = false;
    rerender(
      <QueryClientProvider client={queryClient}>
        <Calendar />
      </QueryClientProvider>,
    );

    const timeline = await screen.findByLabelText(/Временная шкала календаря/);
    await waitFor(() => {
      expect(timeline.scrollLeft).toBe(getCalendarTimelineScrollLeft(
        CALENDAR_TIMELINE_BUFFER_DAYS,
        DAY_WIDTH,
      ));
    });
  });

  it("updates the toolbar period as soon as the timeline has snapped", async () => {
    queryState.loading = false;
    renderCalendar();

    const timeline = screen.getByLabelText(/Временная шкала календаря/);
    await waitFor(() => {
      expect(timeline.scrollLeft).toBe(getCalendarTimelineScrollLeft(
        CALENDAR_TIMELINE_BUFFER_DAYS,
        DAY_WIDTH,
      ));
    });
    expect(screen.getByRole("button", {
      name: "Выбрать дату. 17 июл. – 23 июл. 2026",
    })).toBeInTheDocument();

    vi.useFakeTimers();
    timeline.scrollLeft = getCalendarTimelineScrollLeft(
      CALENDAR_TIMELINE_BUFFER_DAYS + 1,
      DAY_WIDTH,
    ) + DAY_WIDTH * 0.3;
    fireEvent.scroll(timeline);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(520);
    });

    expect(scrollToMock).toHaveBeenCalled();
    expect(screen.getByRole("button", {
      name: "Выбрать дату. 18 июл. – 24 июл. 2026",
    })).toBeInTheDocument();
  });
});
