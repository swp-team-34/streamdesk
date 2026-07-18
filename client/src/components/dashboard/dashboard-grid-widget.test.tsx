import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardGridWidget } from "./dashboard-grid-widget";

afterEach(cleanup);

describe("DashboardGridWidget", () => {
  it("renders widget content and keeps direct move and resize controls wired", () => {
    const onMove = vi.fn();
    const onPointerInteraction = vi.fn();
    const onResizeStep = vi.fn();

    render(
      <DashboardGridWidget
        widget={{
          id: "status",
          title: "Статус",
          layout: { defaultW: 12, defaultH: 8, minW: 6, maxW: 12, minH: 6, maxH: 18 },
          render: () => <div>Widget content</div>,
        }}
        index={1}
        total={3}
        placement={{ x: 2, y: 4, w: 6, h: 8 }}
        isEditing
        isInteracting
        isInvalidTarget
        onMove={onMove}
        onPointerInteraction={onPointerInteraction}
        onResizeStep={onResizeStep}
      />,
    );

    expect(screen.getByText("Widget content")).toBeTruthy();
    const placement = screen.getByText("Widget content").closest(".dashboard-widget-placement");
    expect(placement?.className).toContain("dashboard-widget-dragging");
    expect(placement?.className).toContain("dashboard-widget-invalid-target");

    fireEvent.pointerDown(screen.getByRole("button", { name: "Переместить виджет Статус" }));
    expect(onPointerInteraction).toHaveBeenCalledWith("status", "move", expect.anything());

    fireEvent.click(screen.getByRole("button", { name: "Переместить выше" }));
    expect(onMove).toHaveBeenCalledWith(1, "up");

    fireEvent.keyDown(screen.getByRole("button", { name: /Изменить размер виджета Статус/ }), {
      key: "ArrowRight",
    });
    expect(onResizeStep).toHaveBeenCalledWith("status", 1, 0);
  });

  it("hides layout controls outside edit mode", () => {
    render(
      <DashboardGridWidget
        widget={{
          id: "status",
          title: "Статус",
          layout: { defaultW: 12, defaultH: 8, minW: 6, maxW: 12, minH: 6, maxH: 18 },
          render: () => <div>Widget content</div>,
        }}
        index={0}
        total={1}
        placement={{ x: 0, y: 0, w: 12, h: 8 }}
        isEditing={false}
        isInteracting={false}
        isInvalidTarget={false}
        onMove={vi.fn()}
        onPointerInteraction={vi.fn()}
        onResizeStep={vi.fn()}
      />,
    );

    expect(screen.getByText("Widget content")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Переместить виджет Статус" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Изменить размер виджета Статус/ })).toBeNull();
  });
});
