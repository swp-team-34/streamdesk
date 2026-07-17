import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanListView } from "@/lib/kanban-board-model";
import type { KanbanCardDetailForm } from "@/lib/kanban-card-detail-state";
import type { KanbanSmartInputResult } from "@/lib/kanban-smart-input";
import { KanbanCardDetailFields } from "./kanban-card-detail-fields";

vi.mock("@/components/ui/stream-date-time-picker", () => ({
  StreamDateTimePicker: ({ id, label, value, allDay, onChange, onAllDayChange }: {
    id: string;
    label: string;
    value: string;
    allDay: boolean;
    onChange: (value: string) => void;
    onAllDayChange?: (allDay: boolean, nextValue: string) => void;
  }) => (
    <div>
      <label htmlFor={id}>
        {label}
        <input id={id} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
      <button
        type="button"
        aria-label={`${label} весь день`}
        onClick={() => onAllDayChange?.(!allDay, allDay ? "2026-07-17T09:00" : "2026-07-17T00:00")}
      >
        Toggle all day
      </button>
    </div>
  ),
}));

vi.mock("@/components/kanban/kanban-user-multi-select", () => ({
  KanbanUserMultiSelect: ({ id, value, onChange }: {
    id: string;
    value: string[];
    onChange: (value: string[]) => void;
  }) => (
    <button type="button" id={id} onClick={() => onChange([...value, "user-2"])}>
      Select assignee
    </button>
  ),
}));

const form: KanbanCardDetailForm = {
  listId: "list-1",
  title: "Prepare camera",
  description: "",
  priority: "medium",
  startDate: "",
  startDateHasTime: true,
  dueDate: "",
  dueDateHasTime: true,
  locationId: "",
  locationIds: [],
  initiatorUserId: "user-1",
  responsibleUserId: "",
  assigneeUserIds: ["user-1"],
  assigneeUserId: "user-1",
  labelIds: [],
  customFieldValues: {},
};

const emptySmartInput: KanbanSmartInputResult = {
  title: form.title,
  tokens: [],
  startDate: null,
  dueDate: null,
  startDateHasTime: false,
  dueDateHasTime: false,
  priority: null,
  assigneeUserIds: [],
  errors: [],
};

const baseProps = {
  form,
  canEdit: true,
  lists: [{ id: "list-1", name: "Todo" } as KanbanListView],
  users: [
    { id: "user-1", name: "Alex" },
    { id: "user-2", name: "Tim" },
  ],
  locations: [{ id: "location-1", name: "Studio", companyId: "company-1" }],
  linkedLocations: [],
  boardCompanyId: "company-1",
  smartInput: emptySmartInput,
  getUserName: (userId: string) => userId,
  onChange: vi.fn(),
  onCancelSmartToken: vi.fn(),
  onSmartInputApplied: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("KanbanCardDetailFields", () => {
  it("returns controlled title, assignee and location changes", () => {
    const onChange = vi.fn();
    render(<KanbanCardDetailFields {...baseProps} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Название карточки"), {
      target: { value: "Updated title" },
    });
    expect(onChange).toHaveBeenNthCalledWith(1, { ...form, title: "Updated title" });

    fireEvent.click(screen.getByRole("button", { name: "Исполнители" }));
    expect(onChange).toHaveBeenNthCalledWith(2, {
      ...form,
      assigneeUserIds: ["user-1", "user-2"],
      assigneeUserId: "user-1",
    });

    fireEvent.click(screen.getByRole("checkbox", { name: "Связать площадку «Studio»" }));
    expect(onChange).toHaveBeenNthCalledWith(3, { ...form, locationIds: ["location-1"] });
  });

  it("applies parsed smart-input fields without dropping existing assignees", () => {
    const onChange = vi.fn();
    const onSmartInputApplied = vi.fn();
    render(
      <KanbanCardDetailFields
        {...baseProps}
        smartInput={{
          ...emptySmartInput,
          title: "Parsed title",
          priority: "high",
          dueDate: "2026-07-18T14:00",
          dueDateHasTime: true,
          assigneeUserIds: ["user-2"],
          tokens: [{
            id: "priority:high",
            kind: "priority",
            text: "high",
            label: "Высокий",
            start: 0,
            end: 4,
          }],
        }}
        onChange={onChange}
        onSmartInputApplied={onSmartInputApplied}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Применить" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      title: "Parsed title",
      priority: "high",
      dueDate: "2026-07-18T14:00",
      dueDateHasTime: true,
      assigneeUserIds: ["user-1", "user-2"],
    }));
    expect(onSmartInputApplied).toHaveBeenCalledOnce();
  });

  it("keeps fields disabled for read-only board members", () => {
    render(<KanbanCardDetailFields {...baseProps} canEdit={false} />);
    expect(screen.getByLabelText("Название карточки")).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Связать площадку «Studio»" })).toBeDisabled();
  });

  it("updates the all-day flag and date in one controlled change", () => {
    const onChange = vi.fn();
    render(
      <KanbanCardDetailFields
        {...baseProps}
        form={{ ...form, startDate: "2026-07-17T14:00", startDateHasTime: true }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Дата старта весь день" }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      startDate: "2026-07-17T00:00",
      startDateHasTime: false,
    }));
  });
});
