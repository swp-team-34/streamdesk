export type WorkspaceFlushHandler = () => Promise<boolean>;

const flushHandlers = new Set<WorkspaceFlushHandler>();

export function registerWorkspaceFlushHandler(handler: WorkspaceFlushHandler) {
  flushHandlers.add(handler);
  return () => {
    flushHandlers.delete(handler);
  };
}

export async function flushWorkspaceChanges(): Promise<boolean> {
  for (const handler of Array.from(flushHandlers)) {
    try {
      if (!(await handler())) return false;
    } catch {
      return false;
    }
  }
  return true;
}
