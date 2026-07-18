import { useState, type FormEvent } from "react";
import { Building2, Check, ChevronsUpDown, Loader2, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/contexts/workspace-context";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ className }: { className?: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const {
    data,
    workspace,
    activeCompany,
    isSwitching,
    isCreating,
    error,
    switchWorkspace,
    createWorkspace,
  } = useWorkspace();
  if (!data || !workspace?.type) return null;

  const activeName = workspace.type === "company"
    ? activeCompany?.name || "Компания"
    : data.personal.name;
  const ActiveIcon = workspace.type === "company" ? Building2 : UserRound;

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = await createWorkspace({
      name: companyName,
      description: companyDescription,
    });
    if (!created) return;
    setCreateOpen(false);
    setCompanyName("");
    setCompanyDescription("");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 min-w-0 max-w-[180px] gap-1.5 px-2 sm:max-w-[240px]",
              className,
            )}
            disabled={isSwitching || isCreating}
            aria-label={`Рабочее пространство: ${activeName}`}
            data-testid="workspace-switcher"
          >
            {isSwitching || isCreating
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
                disabled={selected || isSwitching || isCreating}
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
            disabled={workspace.type === "personal" || isSwitching || isCreating}
            onClick={() => void switchWorkspace({ type: "personal" })}
          >
            <UserRound className="h-4 w-4" />
            <span className="flex-1 truncate">{data.personal.name}</span>
            {workspace.type === "personal" && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer gap-2" onSelect={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 text-primary" />
            <span className="flex-1">Создать компанию</span>
          </DropdownMenuItem>
          {error && (
            <>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-xs text-destructive">{error}</p>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={createOpen} onOpenChange={(open) => !isCreating && setCreateOpen(open)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md">
          <DialogHeader>
            <DialogTitle>Новое рабочее пространство</DialogTitle>
            <DialogDescription>
              Создайте отдельную компанию. После создания StreamDesk сразу переключится в неё.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="space-y-2">
              <Label htmlFor="workspace-company-name">Название компании</Label>
              <Input
                id="workspace-company-name"
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Например, Stream Team"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-company-description">Описание</Label>
              <Textarea
                id="workspace-company-description"
                value={companyDescription}
                onChange={(event) => setCompanyDescription(event.target.value)}
                placeholder="Необязательно"
                rows={3}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isCreating} onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={isCreating || !companyName.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Создать
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
