import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { realtimeTransport } from "@/lib/realtime";
import { flushWorkspaceChanges } from "@/lib/workspace-switch";
import {
  applyWorkspaceClientSwitch,
  getWorkspaceSwitchDestination,
} from "@/lib/workspace-client";

export type WorkspaceType = "company" | "personal";

export type ActiveWorkspace = {
  type: WorkspaceType | null;
  companyId: string | null;
  requiresSelection: boolean;
  source: "session" | "persisted" | "automatic" | "none";
};

export type WorkspaceCompany = {
  id: string;
  name: string;
  status: string;
  role: string | null;
};

export type WorkspaceContextResponse = {
  workspace: ActiveWorkspace;
  companies: WorkspaceCompany[];
  personal: {
    id: "personal";
    name: string;
    modules: string[];
  };
  isPlatformAdmin: boolean;
};

export type WorkspaceSelection =
  | { type: "company"; companyId: string }
  | { type: "personal"; companyId?: null };

type WorkspaceContextValue = {
  data: WorkspaceContextResponse | null;
  workspace: ActiveWorkspace | null;
  activeCompany: WorkspaceCompany | null;
  workspaceKey: string;
  isLoading: boolean;
  isSwitching: boolean;
  error: string;
  switchWorkspace: (selection: WorkspaceSelection) => Promise<boolean>;
  retry: () => Promise<unknown>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [isSwitching, setIsSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [epoch, setEpoch] = useState(0);
  const [selectedData, setSelectedData] = useState<WorkspaceContextResponse | null>(null);
  const {
    data: queriedData = null,
    isLoading,
    error: queryError,
    refetch,
  } = useQuery<WorkspaceContextResponse>({
    queryKey: ["/api/workspace-context"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/workspace-context");
      return await response.json();
    },
    staleTime: 0,
    retry: 1,
  });

  const switchWorkspace = useCallback(async (selection: WorkspaceSelection) => {
    if (isSwitching) return false;
    setIsSwitching(true);
    setSwitchError("");
    try {
      const flushed = await flushWorkspaceChanges();
      if (!flushed) {
        setSwitchError("Не удалось сохранить текущие изменения. Исправьте данные или повторите сохранение.");
        return false;
      }
      const response = await apiRequest("POST", "/api/workspace-context", selection);
      const nextData = await response.json() as WorkspaceContextResponse;
      applyWorkspaceClientSwitch(nextData, {
        realtime: realtimeTransport,
        queryCache: queryClient,
      });
      setSelectedData(nextData);
      setEpoch((value) => value + 1);

      const path = window.location.pathname;
      const destination = getWorkspaceSwitchDestination(selection.type, path);
      if (destination !== path) {
        window.history.replaceState({}, "", destination);
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
      return true;
    } catch (error: any) {
      setSwitchError(error?.message || "Не удалось переключить рабочее пространство");
      return false;
    } finally {
      setIsSwitching(false);
    }
  }, [isSwitching]);

  const data = selectedData || queriedData;
  const retry = useCallback(() => {
    setSelectedData(null);
    return refetch();
  }, [refetch]);
  const workspace = data?.workspace ?? null;
  const activeCompany = workspace?.type === "company"
    ? data?.companies.find((company) => company.id === workspace.companyId) ?? null
    : null;
  const workspaceKey = `${workspace?.type || "none"}:${workspace?.companyId || "personal"}:${epoch}`;
  const value = useMemo<WorkspaceContextValue>(() => ({
    data,
    workspace,
    activeCompany,
    workspaceKey,
    isLoading,
    isSwitching,
    error: switchError || (queryError instanceof Error ? queryError.message : ""),
    switchWorkspace,
    retry,
  }), [
    activeCompany,
    data,
    isLoading,
    isSwitching,
    queryError,
    retry,
    switchError,
    switchWorkspace,
    workspace,
    workspaceKey,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
