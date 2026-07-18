import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import DashboardCountdownWidget from "./dashboard-countdown-widget";
import DashboardProfileCard from "./dashboard-profile-card";
import DashboardServicesSection from "./dashboard-services-section";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("streamstudio_user", JSON.stringify({
    name: "Tim",
    username: "tim",
    role: "employee",
  }));
});

function expectUniformResponsivePadding(element: Element | null, size: string) {
  expect(element).not.toBeNull();
  const classes = element?.className.split(/\s+/) ?? [];
  expect(
    classes.includes(`!p-${size}`) || classes.includes(`sm:p-${size}`),
  ).toBe(true);
}

describe("Dashboard compact card spacing", () => {
  it("keeps uniform compact padding in the profile and countdown cards at desktop breakpoints", () => {
    const profile = render(<DashboardProfileCard />);
    expectUniformResponsivePadding(profile.container.firstElementChild?.firstElementChild ?? null, "3");
    profile.unmount();

    const countdown = render(<DashboardCountdownWidget nextEvent={null} />);
    expectUniformResponsivePadding(countdown.container.firstElementChild?.firstElementChild ?? null, "3");
  });

  it("keeps uniform compact padding in service cards at desktop breakpoints", () => {
    render(<DashboardServicesSection />);

    const serviceCard = screen.getByText("Стриминг").closest("a")?.firstElementChild;
    expectUniformResponsivePadding(serviceCard?.firstElementChild ?? null, "2.5");
  });
});
