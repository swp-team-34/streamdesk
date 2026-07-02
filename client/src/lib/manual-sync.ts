import type { QueryClient, QueryKey } from "@tanstack/react-query";

export const MANUAL_SYNC_COOLDOWN_MS = 45_000;
export const MANUAL_SYNC_TIMEOUT_MS = 12_000;

export const MANUAL_SYNC_QUERY_KEYS: QueryKey[] = [
  ["/api/dashboard/stats"],
  ["/api/events"],
  ["/api/tasks"],
  ["/api/kanban/cards"],
  ["/api/users"],
  ["/api/systems"],
  ["/api/equipment"],
  ["/api/equipment-checkout-requests"],
  ["/api/equipment-on-projects"],
  ["/api/streams"],
  ["/api/integrations/youtube/stats"],
  ["/api/integrations/vk/stats"],
  ["/api/integrations/vmix/scheduler"],
  ["/api/companies/me"],
  ["/api/projects"],
  ["/api/yougile/projects"],
  ["/api/yougile/boards-all"],
  ["/api/yougile/columns"],
  ["/api/notifications"],
  ["/api/connection-schemas"],
  ["/api/otis"],
  ["kanban-lists"],
  ["kanban-cards"],
  ["kanban-labels"],
  ["kanban-board-members"],
  ["kanban-custom-fields"],
  ["kanban-label-groups"],
  ["kanban-card"],
  ["kanban-card-history"],
  ["kanban-card-comments"],
  ["kanban-card-attachments"],
];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Manual sync timed out"));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export async function runManualSync(
  client: Pick<QueryClient, "invalidateQueries" | "refetchQueries">,
  timeoutMs = MANUAL_SYNC_TIMEOUT_MS,
): Promise<void> {
  const invalidateResults = await Promise.allSettled(
    MANUAL_SYNC_QUERY_KEYS.map((queryKey) => client.invalidateQueries({ queryKey })),
  );
  const invalidateError = invalidateResults.find((result) => result.status === "rejected");

  if (invalidateError?.status === "rejected") {
    throw invalidateError.reason;
  }

  const refetchResults = await withTimeout(
    Promise.allSettled(
      MANUAL_SYNC_QUERY_KEYS.map((queryKey) => client.refetchQueries({ queryKey, type: "active" })),
    ),
    timeoutMs,
  );
  const refetchError = refetchResults.find((result) => result.status === "rejected");

  if (refetchError?.status === "rejected") {
    throw refetchError.reason;
  }
}
