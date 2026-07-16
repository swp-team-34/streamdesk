export type GlobalSyncStatus = "syncing" | "synced" | "error";

export type GlobalSyncDetail = {
  source: string;
  status: GlobalSyncStatus;
  error?: string;
  occurredAt: string;
};

export const GLOBAL_SYNC_EVENT = "streamdesk-global-sync-state";

export function publishGlobalSyncState(
  source: string,
  status: GlobalSyncStatus,
  error?: string,
) {
  if (typeof window === "undefined") return;
  const detail: GlobalSyncDetail = {
    source,
    status,
    error: error || undefined,
    occurredAt: new Date().toISOString(),
  };
  window.dispatchEvent(new CustomEvent<GlobalSyncDetail>(GLOBAL_SYNC_EVENT, { detail }));
}
