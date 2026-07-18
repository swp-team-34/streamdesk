type AuthRoutingUser = {
  id?: unknown;
  onboardingCompleted?: boolean | null;
  permissions?: unknown;
};

export function isPlatformAdminUser(user: AuthRoutingUser | null | undefined): boolean {
  return Array.isArray(user?.permissions) && user.permissions.includes("platform:admin");
}

export function requiresOnboarding(user: AuthRoutingUser | null | undefined): boolean {
  return Boolean(user?.id) && user?.onboardingCompleted !== true && !isPlatformAdminUser(user);
}

export function getAuthenticatedDestination(
  user: AuthRoutingUser,
  inviteToken = "",
): string {
  if (requiresOnboarding(user)) {
    const invite = inviteToken.trim();
    return invite ? `/onboarding?invite=${encodeURIComponent(invite)}` : "/onboarding";
  }
  return isPlatformAdminUser(user) ? "/platform-admin" : "/";
}
