import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppDialogProvider } from "@/components/ui/app-dialog-provider";
import { CalendarEntryDetailDialog } from "./calendar-entry-detail-dialog";
import type { EventEntry } from "@/lib/calendar-page-model";

const entry: EventEntry = {
  id: "event-1",
  title: "Recording",
  startTime: "2026-07-17T10:00:00Z",
  endTime: "2026-07-17T11:00:00Z",
  kind: "event",
  type: "recording",
  badgeText: "Запись",
  statusLabel: null,
  responsibleLabel: null,
};

describe("CalendarEntryDetailDialog", () => {
  it("keeps event edit, delete and close actions controlled by the page", async () => {
    const onOpenChange = vi.fn();
    const onEditEvent = vi.fn();
    const onDeleteEvent = vi.fn();
    render(
      <AppDialogProvider>
        <CalendarEntryDetailDialog
          open
          onOpenChange={onOpenChange}
          entry={entry}
          currentTime={new Date("2026-07-17T09:00:00Z")}
          getEventDotClass={() => "bg-primary"}
          getEntryDotStyle={() => undefined}
          getEventBadgeClasses={() => "bg-primary"}
          getEntryColorStyle={() => undefined}
          onRespondParticipant={vi.fn()}
          isResponding={false}
          onEditEvent={onEditEvent}
          onDeleteEvent={onDeleteEvent}
          isDeleting={false}
        />
      </AppDialogProvider>,
    );

    expect(screen.getByText("Recording")).toBeTruthy();
    fireEvent.click(screen.getByText("Изменить"));
    fireEvent.click(screen.getByText("Удалить"));
    const confirmationDialog = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmationDialog).getByRole("button", { name: "Удалить" }));
    fireEvent.click(screen.getByText("Закрыть"));

    expect(onEditEvent).toHaveBeenCalledOnce();
    await waitFor(() => expect(onDeleteEvent).toHaveBeenCalledWith("event-1"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
