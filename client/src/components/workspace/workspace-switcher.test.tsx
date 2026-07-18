import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceSwitcher } from "./workspace-switcher";

const workspaceMocks = vi.hoisted(() => ({
  createWorkspace: vi.fn(),
  switchWorkspace: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    data: {
      workspace: {
        type: "personal",
        companyId: null,
        requiresSelection: false,
        source: "session",
      },
      companies: [],
      personal: {
        id: "personal",
        name: "Личное пространство",
        modules: ["kanban", "calendar", "projects"],
      },
      isPlatformAdmin: false,
    },
    workspace: {
      type: "personal",
      companyId: null,
      requiresSelection: false,
      source: "session",
    },
    activeCompany: null,
    isSwitching: false,
    isCreating: false,
    error: "",
    ...workspaceMocks,
  }),
}));

describe("WorkspaceSwitcher", () => {
  beforeEach(() => {
    workspaceMocks.createWorkspace.mockReset().mockResolvedValue(true);
    workspaceMocks.switchWorkspace.mockReset().mockResolvedValue(true);
  });

  afterEach(cleanup);

  it("creates a company from the active workspace menu", async () => {
    const user = userEvent.setup();
    render(<WorkspaceSwitcher />);

    await user.click(screen.getByTestId("workspace-switcher"));
    await user.click(await screen.findByText("Создать компанию"));
    await user.type(screen.getByLabelText("Название компании"), "New Workspace");
    await user.type(screen.getByLabelText("Описание"), "Production team");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(workspaceMocks.createWorkspace).toHaveBeenCalledWith({
        name: "New Workspace",
        description: "Production team",
      });
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
