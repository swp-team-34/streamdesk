import { describe, expect, it, vi } from "vitest";
import {
  applyWorkspaceClientSwitch,
  getWorkspaceSwitchDestination,
} from "./workspace-client";

describe("workspace client switch", () => {
  it("resets realtime and replaces the query cache with the selected workspace", () => {
    const realtime = { reset: vi.fn() };
    const queryCache = {
      clear: vi.fn(),
      setQueryData: vi.fn(),
    };
    const nextData = {
      workspace: {
        type: "company",
        companyId: "company-2",
        requiresSelection: false,
      },
    };

    applyWorkspaceClientSwitch(nextData, { realtime, queryCache });

    expect(realtime.reset).toHaveBeenCalledOnce();
    expect(queryCache.clear).toHaveBeenCalledOnce();
    expect(queryCache.setQueryData).toHaveBeenCalledWith(
      ["/api/workspace-context"],
      nextData,
    );
  });

  it("keeps supported personal modules and redirects company-only modules", () => {
    expect(getWorkspaceSwitchDestination("personal", "/projects")).toBe("/projects");
    expect(getWorkspaceSwitchDestination("personal", "/onboarding")).toBe("/onboarding");
    expect(getWorkspaceSwitchDestination("personal", "/equipment")).toBe("/");
    expect(getWorkspaceSwitchDestination("company", "/equipment")).toBe("/equipment");
  });
});
