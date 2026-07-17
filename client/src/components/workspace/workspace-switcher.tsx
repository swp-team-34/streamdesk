import { Building2, Check, ChevronsUpDown, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const {
    data,
    workspace,
    activeCompany,
    isSwitching,
    error,
    switchWorkspace,
  } = useWorkspace();
  if (!data || !workspace?.type) return null;

  const activeName = workspace.type === "company"
    ? activeCompany?.name || "Компания"
    : data.personal.name;
  const ActiveIcon = workspace.type === "company" ? Building2 : UserRound;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 min-w-0 max-w-[180px] gap-1.5 px-2 sm:max-w-[240px]",
            className,
          )}
          disabled={isSwitching}
          aria-label={`Рабочее пространство: ${activeName}`}
          data-testid="workspace-switcher"
        >
          {isSwitching
            ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            : <ActiveIcon className="h-4 w-4 shrink-0 text-primary" />}
          <span className="hidden truncate text-xs font-medium sm:inline">{activeName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Рабочее пространство</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data.companies.map((company) => {
          const selected = workspace.type === "company" && workspace.companyId === company.id;
          return (
            <DropdownMenuItem
              key={company.id}
              className="cursor-pointer gap-2"
              disabled={selected || isSwitching}
              onClick={() => void switchWorkspace({ type: "company", companyId: company.id })}
            >
              <Building2 className="h-4 w-4" />
              <span className="flex-1 truncate">{company.name}</span>
              {selected && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem
          className="cursor-pointer gap-2"
          disabled={workspace.type === "personal" || isSwitching}
          onClick={() => void switchWorkspace({ type: "personal" })}
        >
          <UserRound className="h-4 w-4" />
          <span className="flex-1 truncate">{data.personal.name}</span>
          {workspace.type === "personal" && <Check className="h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        {error && (
          <>
            <DropdownMenuSeparator />
            <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
