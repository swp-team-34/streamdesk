import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { KanbanCardView, KanbanListView } from "@/lib/kanban-board-model";
import {
  KanbanCardDetailDialog,
  KanbanCardDetailTabContent,
} from "./kanban-card-detail-dialog";

const card = {
  id: "card-1",
  listId: "list-1",
  title: "Prepare camera",
  priority: "medium",
} as KanbanCardView;
const list = { id: "list-1", name: "Todo", type: "active" } as KanbanListView;

afterEach(cleanup);

describe("KanbanCardDetailDialog", () => {
  it("shows the loading state before the card resolves", () => {
    render(
      <KanbanCardDetailDialog
        open
        card={null}
        list={null}
        formTitle=""
        saveStatus="idle"
        saveError=""
        onClose={vi.fn()}
      >
        Content
      </KanbanCardDetailDialog>,
    );
    expect(screen.getByText("Подождите, данные карточки загружаются.")).toBeInTheDocument();
  });

  it("renders content, autosave status and delegates closing", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <KanbanCardDetailDialog
        open
        card={card}
        list={list}
        formTitle={card.title}
        saveStatus="dirty"
        saveError=""
        onClose={onClose}
      >
        <KanbanCardDetailTabContent value="overview">
          <div>Overview content</div>
        </KanbanCardDetailTabContent>
        <KanbanCardDetailTabContent value="resources">
          <div>Resources content</div>
        </KanbanCardDetailTabContent>
        <KanbanCardDetailTabContent value="activity">
          <div>Activity content</div>
        </KanbanCardDetailTabContent>
      </KanbanCardDetailDialog>,
    );
    expect(screen.getByText("Overview content")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Связи" }));
    expect(screen.getByText("Resources content")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Активность" }));
    expect(screen.getByText("Activity content")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("Есть несохраненные изменения");
    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("can open directly on the resources tab", () => {
    render(
      <KanbanCardDetailDialog
        open
        card={card}
        list={list}
        formTitle={card.title}
        saveStatus="saved"
        saveError=""
        defaultTab="resources"
        onClose={vi.fn()}
      >
        <KanbanCardDetailTabContent value="overview">Overview content</KanbanCardDetailTabContent>
        <KanbanCardDetailTabContent value="resources">Resources content</KanbanCardDetailTabContent>
      </KanbanCardDetailDialog>,
    );

    expect(screen.getByRole("tab", { name: "Связи" })).toHaveAttribute("data-state", "active");
    expect(screen.getByText("Resources content")).toBeVisible();
  });
});
