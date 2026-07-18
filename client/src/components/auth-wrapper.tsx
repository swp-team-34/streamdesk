import { useCallback } from "react";
import Login from "@/pages/login";
import { getAuthenticatedDestination } from "@/lib/auth-routing";

export default function AuthWrapper() {
  const handleLogin = useCallback((userData: any) => {
    if (!userData?.id) return;
    try {
      const userJson = JSON.stringify(userData);
      localStorage.setItem("streamstudio_user", userJson);
      if (localStorage.getItem("streamstudio_user")) {
        const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
        const invite = search?.get("invite");
        const nextPath = getAuthenticatedDestination(userData, invite || "");
        setTimeout(() => { window.location.href = nextPath; }, 400);
      }
    } catch (_) {}
  }, []);

  return <Login onLogin={handleLogin} />;
}
