import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function DashboardProfileCard() {
  let user: { name?: string; username?: string; email?: string; avatar?: string; role?: string } | null = null;
  try {
    const saved = localStorage.getItem("streamstudio_user");
    if (saved) user = JSON.parse(saved);
  } catch {}

  if (!user) return null;

  const roleLabel =
    user.role === "admin"
      ? "Администратор"
      : user.role === "manager"
        ? "Менеджер"
        : "Сотрудник";

  return (
    <Card className="min-w-0 overflow-hidden border-border/50 bg-surface-raised shadow-xs">
      <CardContent className="min-w-0 !p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0 border border-border/60">
            <AvatarImage src={user.avatar} />
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {user.name?.split(" ").map((n: string) => n[0]).join("") || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-foreground">{user.name || "Гость"}</h3>
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {roleLabel}
              </span>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {user.email || (user.username ? `@${user.username}` : "Личный профиль")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
