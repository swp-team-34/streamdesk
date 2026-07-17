import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { KanbanCardView, KanbanLabelView, KanbanListView } from "@/lib/kanban-board-model";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  KanbanCardDetailHeader,
  KanbanCardLocationContext,
  KanbanCardMetadata,
} from "./kanban-card-detail-summary";

const card = {
  id: "card-1",
  listId: "list-1",
  title: "Prepare camera",
  description: "Check batteries",
  priority: "high",
  position: 1,
  creatorUserId: "user-1",
  labelIds: ["urgent"],
  subtasks: [{ id: "sub-1", title: "Battery", completed: true }],
  locationWarnings: [{ id: "issue-1", locationName: "Studio", title: "Power issue" }],
  locationTopics: [{ id: "topic-1", locationId: "location-1", locationName: "Studio", title: "Setup" }],
} as KanbanCardView;

const list = { id: "list-1", name: "In progress", type: "active" } as KanbanListView;

afterEach(cleanup);

describe("kanban card detail summary", () => {
  it("renders title, priority and list context", () => {
    render(
      <Dialog open>
        <DialogContent>
          <KanbanCardDetailHeader card={card} list={list} />
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByRole("heading", { name: "Prepare camera" })).toBeInTheDocument();
    expect(screen.getByText("Высокий")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders location warnings and discussion links", () => {
    render(<KanbanCardLocationContext card={card} />);
    expect(screen.getByText(/Studio: Power issue/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Studio: Setup" })).toHaveAttribute(
      "href",
      "/locations?locationId=location-1&topicId=topic-1",
    );
  });

  it("renders advanced metadata and labels only while expanded", () => {
    const labels = [{ id: "urgent", name: "Urgent", color: "#ef4444" }] as KanbanLabelView[];
    const { rerender } = render(
      <KanbanCardMetadata
        card={card}
        list={list}
        labels={labels}
        creatorName="Alex"
        expanded
        className="metadata"
      />,
    );
    expect(screen.getByText("Подзадачи: 1/1")).toBeInTheDocument();
    expect(screen.getByText("Создатель: Alex")).toBeInTheDocument();
    expect(screen.getByText("Urgent")).toBeInTheDocument();

    rerender(
      <KanbanCardMetadata
        card={card}
        list={list}
        labels={labels}
        creatorName="Alex"
        expanded={false}
        className="metadata"
      />,
    );
    expect(screen.getByText("Создатель: Alex").closest("div")?.parentElement).toHaveClass("hidden");
  });
});
