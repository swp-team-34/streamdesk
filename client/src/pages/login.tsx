import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation } from "@tanstack/react-query";
import { LogIn, Loader2, Tv, UserPlus, X } from "lucide-react";
import { apiRequest, apiUrl } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LoginProps {
  onLogin: (user: any) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { toast } = useToast();
  const inviteToken = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("invite") || ""
    : "";

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, invite: inviteToken || undefined }),
        credentials: "include",
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Ошибка авторизации" }));
        throw new Error(errorData.message || "Ошибка авторизации");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      if (!data?.user) {
        toast({ title: "Ошибка", description: "Сервер вернул неполный ответ", variant: "destructive" });
        return;
      }
      localStorage.setItem("streamstudio_user", JSON.stringify(data.user));
      setIsAnimating(true);
      toast({ title: "Добро пожаловать", description: `Вы вошли как ${data.user.name}`, duration: 1200 });
      setTimeout(() => onLogin(data.user), 1100);
    },
    onError: (error: any) => {
      toast({ title: "Ошибка", description: error.message || "Не удалось войти", variant: "destructive" });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; name: string; email?: string; invite?: string }) => {
      const response = await apiRequest("POST", "/api/auth/register", data);
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Аккаунт создан", description: data.message || "Осталось выбрать формат рабочего пространства." });
      setShowRegister(false);
      if (data?.user) {
        localStorage.setItem("streamstudio_user", JSON.stringify(data.user));
        setIsAnimating(true);
        setTimeout(() => onLogin(data.user), 1100);
      }
    },
    onError: (error: any) => {
      toast({ title: "Ошибка регистрации", description: error.message || "Не удалось создать аккаунт", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="fixed inset-0 relative flex min-h-screen items-center justify-center overflow-auto bg-background p-3 text-foreground sm:p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute left-[12%] top-[10%] h-80 w-80 animate-pulse rounded-full motion-reduce:animate-none"
          style={{
            background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 30%, transparent) 0%, color-mix(in srgb, var(--primary) 15%, transparent) 42%, transparent 72%)",
          }}
        />
        <div
          className="absolute bottom-[8%] right-[10%] h-96 w-96 animate-pulse rounded-full motion-reduce:animate-none"
          style={{
            animationDelay: "1s",
            background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 38%, transparent) 0%, color-mix(in srgb, var(--primary) 20%, transparent) 42%, transparent 72%)",
          }}
        />
        <div
          className="absolute left-[48%] top-[48%] h-72 w-72 animate-pulse rounded-full motion-reduce:animate-none"
          style={{
            animationDelay: "2s",
            background: "radial-gradient(circle, color-mix(in srgb, var(--primary) 22%, transparent) 0%, color-mix(in srgb, var(--primary) 11%, transparent) 42%, transparent 72%)",
          }}
        />
      </div>

      {isAnimating && (
        <div className="animate-in fade-in absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 duration-300 backdrop-blur-md motion-reduce:animate-none">
          <div className="animate-in zoom-in-95 relative duration-500 motion-reduce:animate-none">
            <div className="absolute -inset-4 animate-pulse rounded-dialog bg-primary/20 blur-2xl motion-reduce:animate-none" />
            <div className="relative overflow-hidden rounded-2xl border-[12px] border-gray-800 bg-gray-900 shadow-[0_0_40px_rgba(6,182,212,0.25),0_0_80px_rgba(139,92,246,0.15)] sm:border-[16px]">
              <div
                className="relative h-[180px] w-[300px] sm:h-[228px] sm:w-[380px] md:h-[264px] md:w-[440px]"
                style={{
                  background:
                    "linear-gradient(to right, #fff 0%, #fff 12.5%, #c4b000 12.5%, #c4b000 25%, #00c4b0 25%, #00c4b0 37.5%, #00c400 37.5%, #00c400 50%, #c400c4 50%, #c400c4 62.5%, #c40000 62.5%, #c40000 75%, #0000c4 75%, #0000c4 87.5%, #000 87.5%, #000 100%)",
                }}
              />
              <div className="h-5 bg-gradient-to-b from-gray-800 to-gray-900 sm:h-6" />
              <div className="-mt-0.5 mx-auto h-4 w-28 rounded-b-full bg-gray-700/90 shadow-inner sm:h-5 sm:w-36" />
            </div>
          </div>
          <p className="mt-8 animate-pulse text-base font-medium text-muted-foreground motion-reduce:animate-none">Загрузка...</p>
        </div>
      )}

      <div className={cn("relative z-10 w-full max-w-md transition-all duration-500 motion-reduce:transition-none", isAnimating && "scale-95 opacity-0")}>
        <div className="mb-6 text-center sm:mb-8">
          <div className="relative mb-4 inline-block">
            <div className="absolute inset-0 animate-pulse rounded-2xl bg-primary/40 opacity-50 blur-xl motion-reduce:animate-none" />
            <div className="absolute -inset-1 animate-logo-frame rounded-[1.35rem] bg-[conic-gradient(from_0deg,transparent_0deg,#22d3ee_70deg,#8b5cf6_170deg,#ec4899_260deg,transparent_360deg)] opacity-90 motion-reduce:animate-none" />
            <div className="relative inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-purple-500 to-pink-500 shadow-2xl shadow-cyan-500/50 ring-4 ring-cyan-500/20">
              <Tv className="h-10 w-10 text-white drop-shadow-lg" />
            </div>
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent">
            StreamDesk
          </h1>
          <p className="text-sm text-muted-foreground">Платформа для команд, проектов и вещания</p>
        </div>

        <Card className="border-border/60 bg-card/90 shadow-overlay backdrop-blur-xl">
          <CardHeader className="pb-2 text-center">
            <CardTitle className="text-2xl">Вход в систему</CardTitle>
            <CardDescription>Введите почту или логин</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Почта или логин</Label>
                <Input
                  id="username"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="name@company.ru"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                />
              </div>
              <Button
                type="submit"
                className="h-12 w-full font-semibold"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Вход...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 h-5 w-5" />
                    Войти
                  </>
                )}
              </Button>
            </form>

            <div className="border-t border-border/50 pt-4">
              {!showRegister ? (
                <div className="space-y-3 text-center">
                  <p className="text-sm font-medium text-muted-foreground">Нет аккаунта?</p>
                  <Button type="button" variant="outline" className="w-full" onClick={() => setShowRegister(true)}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Зарегистрироваться
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="font-medium">Регистрация</p>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowRegister(false)} className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <form
                    className="space-y-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const formData = new FormData(e.currentTarget);
                      registerMutation.mutate({
                        name: String(formData.get("reg_name") || ""),
                        username: String(formData.get("reg_username") || ""),
                        email: String(formData.get("reg_email") || "") || undefined,
                        password: String(formData.get("reg_password") || ""),
                        invite: inviteToken || undefined,
                      });
                    }}
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <Input name="reg_name" placeholder="Имя *" required />
                      <Input name="reg_username" placeholder="Логин *" required />
                    </div>
                    <Input name="reg_email" type="email" placeholder="Почта *" required />
                    <Input name="reg_password" type="password" placeholder="Пароль *" required />
                    <Button type="submit" variant="secondary" className="w-full" disabled={registerMutation.isPending}>
                      {registerMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                      Создать аккаунт
                    </Button>
                  </form>
                  <p className="text-center text-xs text-muted-foreground">
                    После регистрации вы сразу выберете: работать лично, создать компанию или вступить по приглашению.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">StreamDesk Platform</p>
      </div>
    </div>
  );
}
