import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocationCard } from "./location-card";

afterEach(cleanup);

describe("LocationCard", () => {
  it("renders operational context and delegates opening", () => {
    const onOpen = vi.fn();
    render(
      <LocationCard
        location={{
          id: "location-1",
          name: "Studio A",
          type: "recording",
          address: "Main hall",
          description: "Production floor",
          status: "available",
          attachments: [{ id: "file-1", fileName: "plan.pdf", fileUrl: "/files/plan.pdf" }],
        }}
        issueCount={2}
        canManage={false}
        onOpen={onOpen}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Studio A")).toBeInTheDocument();
    expect(screen.getByText("Активные проблемы: 2")).toBeInTheDocument();
    expect(screen.getByText("Файлы: 1")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Studio A"));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("marks archived locations and hides status management", () => {
    render(
      <LocationCard
        location={{ id: "location-1", name: "Studio A", archivedAt: "2026-07-17" }}
        issueCount={0}
        canManage
        onOpen={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Архив")).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
