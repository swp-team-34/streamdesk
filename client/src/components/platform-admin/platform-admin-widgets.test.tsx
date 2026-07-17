import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ActivityHeatmap, StatCard } from "./platform-admin-widgets";

afterEach(cleanup);

describe("platform admin widgets", () => {
  it("summarizes yearly heatmap activity", () => {
    const { container } = render(
      <ActivityHeatmap
        title="Активность платформы"
        points={[
          { date: "2026-07-13", count: 2, intensity: 1 },
          { date: "2026-07-14", count: 4, intensity: 3 },
        ]}
      />,
    );

    expect(screen.getByText("Активность платформы")).toBeTruthy();
    expect(screen.getByText("6 событий за год")).toBeTruthy();
    expect(container.querySelector('[title="2026-07-14: 4"]')?.className).toContain("bg-violet-400");
  });

  it("renders a metric card with its icon", () => {
    function MetricIcon({ className }: { className?: string }) {
      return <svg data-testid="metric-icon" className={className} />;
    }

    render(<StatCard label="Компании" value={12} icon={MetricIcon} />);

    expect(screen.getByText("Компании")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByTestId("metric-icon").getAttribute("class")).toContain("text-primary");
  });
});
