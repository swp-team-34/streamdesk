import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KanbanInlineCardComposer } from "./kanban-inline-card-composer";
import { KanbanInlineListCreator } from "./kanban-inline-list-creator";

afterEach(cleanup);

describe("Kanban inline creators", () => {
  it("delegates inline card editing and submission", () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();
    render(
      <KanbanInlineCardComposer
        open
        value="New task"
        smartInput={{
          title: "New task",
          tokens: [],
          startDate: null,
          dueDate: null,
          startDateHasTime: true,
          dueDateHasTime: true,
          priority: null,
          assigneeUserIds: [],
          errors: [],
        }}
        mentionSuggestions={[]}
        pending={false}
        onOpen={vi.fn()}
        onChange={onChange}
        onCancelToken={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/Задача завтра/), { target: { value: "Updated" } });
    fireEvent.keyDown(screen.getByPlaceholderText(/Задача завтра/), { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Добавить" }));

    expect(onChange).toHaveBeenCalledWith("Updated");
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it("opens the list composer and submits a title", () => {
    const onOpen = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <KanbanInlineListCreator
        open={false}
        title=""
        pending={false}
        onOpen={onOpen}
        onTitleChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Новый столбец" }));
    expect(onOpen).toHaveBeenCalledOnce();

    rerender(
      <KanbanInlineListCreator
        open
        title="Review"
        pending={false}
        onOpen={onOpen}
        onTitleChange={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Создать" }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });
});
