type WorkspaceQueryCache = {
  clear: () => void;
  setQueryData: (queryKey: readonly unknown[], data: unknown) => unknown;
};

type WorkspaceRealtimeTransport = {
  reset: () => void;
};

const PERSONAL_WORKSPACE_PATHS = new Set([
  "/",
  "/calendar",
  "/projects",
  "/tasks",
  "/tasks-v2",
  "/settings",
  "/notifications",
  "/platform-admin",
]);

export function applyWorkspaceClientSwitch(
  nextData: unknown,
  dependencies: {
    queryCache: WorkspaceQueryCache;
    realtime: WorkspaceRealtimeTransport;
  },
) {
  dependencies.realtime.reset();
  dependencies.queryCache.clear();
  dependencies.queryCache.setQueryData(["/api/workspace-context"], nextData);
}

export function getWorkspaceSwitchDestination(
  workspaceType: "company" | "personal",
  currentPath: string,
) {
  if (workspaceType === "personal" && !PERSONAL_WORKSPACE_PATHS.has(currentPath)) {
    return "/";
  }
  return currentPath;
}
