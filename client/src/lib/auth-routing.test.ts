import { describe, expect, it } from "vitest";
import {
  getAuthenticatedDestination,
  requiresOnboarding,
} from "./auth-routing";

describe("authenticated routing", () => {
  it.each([
    ["missing", { id: "legacy-user" }],
    ["null", { id: "legacy-user", onboardingCompleted: null }],
    ["false", { id: "legacy-user", onboardingCompleted: false }],
  ])("recovers an existing account with a %s onboarding flag", (_label, user) => {
    expect(requiresOnboarding(user)).toBe(true);
    expect(getAuthenticatedDestination(user)).toBe("/onboarding");
  });

  it("preserves an invite while recovering onboarding", () => {
    expect(getAuthenticatedDestination(
      { id: "legacy-user", onboardingCompleted: false },
      "invite token",
    )).toBe("/onboarding?invite=invite%20token");
  });

  it("keeps completed and platform-admin accounts out of onboarding", () => {
    expect(getAuthenticatedDestination({
      id: "completed-user",
      onboardingCompleted: true,
    })).toBe("/");
    expect(getAuthenticatedDestination({
      id: "platform-admin",
      permissions: ["platform:admin"],
    })).toBe("/platform-admin");
  });
});
