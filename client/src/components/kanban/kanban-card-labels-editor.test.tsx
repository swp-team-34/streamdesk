import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanLabelView } from "@/lib/kanban-board-model";
import { KanbanCardLabelsEditor } from "./kanban-card-labels-editor";

const labels = [
  { id: "urgent", name: "Urgent", color: "#ef4444" },
  { id: "video", name: "Video", color: "#3b82f6" },
] as KanbanLabelView[];

const baseProps = {
  labels,
  selectedLabelIds: ["urgent"],
  query: "",
  canEdit: true,
  loading: false,
  saveLabelPending: false,
  saveCardPending: false,
  onQueryChange: vi.fn(),
  onAttach: vi.fn(),
  onRemove: vi.fn(),
  onCreate: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("KanbanCardLabelsEditor", () => {
  it("delegates attach and remove actions", () => {
    const onAttach = vi.fn();
    const onRemove = vi.fn();
    render(
      <KanbanCardLabelsEditor {...baseProps} onAttach={onAttach} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByTitle("Снять метку"));
    fireEvent.click(screen.getByRole("button", { name: "Video" }));
    expect(onRemove).toHaveBeenCalledWith("urgent");
    expect(onAttach).toHaveBeenCalledWith("video");
  });

  it("uses an exact Enter match or offers creation", () => {
    const onAttach = vi.fn();
    const onCreate = vi.fn();
    const { rerender } = render(
      <KanbanCardLabelsEditor
        {...baseProps}
        query="urgent"
        selectedLabelIds={[]}
        onAttach={onAttach}
        onCreate={onCreate}
      />,
    );
    fireEvent.keyDown(screen.getByLabelText("Метки"), { key: "Enter" });
    expect(onAttach).toHaveBeenCalledWith("urgent");

    rerender(
      <KanbanCardLabelsEditor {...baseProps} query="New label" onCreate={onCreate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Создать “New label”/ }));
    expect(onCreate).toHaveBeenCalledOnce();
  });

  it("keeps selected labels visible but immutable in read-only mode", () => {
    render(<KanbanCardLabelsEditor {...baseProps} canEdit={false} />);
    expect(screen.getByTitle("Снять метку")).toBeDisabled();
    expect(screen.queryByLabelText("Метки")).not.toBeInTheDocument();
  });
});
