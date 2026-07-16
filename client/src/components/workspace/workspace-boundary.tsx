import { useEffect, type ReactNode } from "react";
import { Building2, Loader2, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/contexts/workspace-context";
import { getWorkspaceSwitchDestination } from "@/lib/workspace-client";

export function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const {
    data,
    workspace,
    workspaceKey,
    isLoading,
    isSwitching,
    error,
    switchWorkspace,
    retry,
  } = useWorkspace();
  const currentPath = typeof window === "undefined" ? "/" : window.location.pathname;
  const redirectPersonalWorkspace = workspace?.type === "personal" &&
    getWorkspaceSwitchDestination("personal", currentPath) !== currentPath;

  useEffect(() => {
    if (!redirectPersonalWorkspace) return;
    window.history.replaceState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, [redirectPersonalWorkspace]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Загрузка рабочего пространства" />
      </div>
    );
  }

  if (!data || (!workspace?.type && !workspace?.requiresSelection)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Рабочее пространство недоступно</CardTitle>
            <CardDescription>{error || "Не удалось загрузить доступные рабочие пространства."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => void retry()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (workspace.requiresSelection || !workspace.type) {
    return (
      <div className="min-h-screen bg-starry bg-background flex items-center justify-center p-4 sm:p-6">
        <Card className="w-full max-w-xl border-border/50 shadow-xl">
          <CardHeader>
            <CardTitle>Выберите рабочее пространство</CardTitle>
            <CardDescription>
              Данные компаний и личные данные изолированы. Выбор можно изменить позднее в верхней панели.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.companies.map((company) => (
              <Button
                key={company.id}
                type="button"
                variant="outline"
                className="h-auto w-full justify-start gap-3 p-4 text-left"
                disabled={isSwitching}
                onClick={() => void switchWorkspace({ type: "company", companyId: company.id })}
              >
                <Building2 className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{company.name}</span>
                  <span className="block text-xs font-normal text-muted-foreground">Компания</span>
                </span>
              </Button>
            ))}
            <Button
              type="button"
              variant="outline"
              className="h-auto w-full justify-start gap-3 p-4 text-left"
              disabled={isSwitching}
              onClick={() => void switchWorkspace({ type: "personal" })}
            >
              <UserRound className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{data.personal.name}</span>
                <span className="block text-xs font-normal text-muted-foreground">
                  Kanban V2, календарь и проекты
                </span>
              </span>
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {isSwitching && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Переключение…
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (redirectPersonalWorkspace) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Переход в личное пространство" />
      </div>
    );
  }

  return <div key={workspaceKey} className="contents">{children}</div>;
}
