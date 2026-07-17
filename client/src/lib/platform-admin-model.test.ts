import { describe, expect, it } from "vitest";
import {
  createEmptyTelemetry,
  formatBytes,
  formatUptime,
  issueListForCompany,
  normalizePlatformTab,
  num,
  pct,
  severityLabel,
  statusLabel,
} from "./platform-admin-model";

describe("platform admin model", () => {
  it("normalizes navigation and numeric values", () => {
    expect(normalizePlatformTab("companies")).toBe("companies");
    expect(normalizePlatformTab("unknown")).toBe("overview");
    expect(num("42.4")).toBe(42.4);
    expect(pct(42.6)).toBe("43%");
  });

  it("formats host metrics and labels", () => {
    expect(formatBytes(1536)).toBe("1.5 КБ");
    expect(formatUptime(90061)).toBe("1 д 1 ч");
    expect(statusLabel("investigating")).toBe("В работе");
    expect(severityLabel("critical")).toBe("Критично");
  });

  it("builds complete empty telemetry collections", () => {
    const telemetry = createEmptyTelemetry();

    expect(telemetry.activityHeatmap).toHaveLength(365);
    expect(telemetry.hourlyLoad).toHaveLength(24);
    expect(telemetry.hostLoad).toHaveLength(24);
  });

  it("describes company attention signals consistently", () => {
    expect(issueListForCompany({
      company: { status: "suspended" },
      systems: { total: 2, offline: 1 },
      incidents: { open: 2 },
      tasks: { overdue: 3 },
      workspace: { monitoringEnabled: false },
    }).map((issue) => issue.level)).toEqual(["critical", "warning", "warning", "info", "info"]);
  });
});
