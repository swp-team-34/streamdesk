import { describe, expect, it } from "vitest";
import {
  buildVmixEventActions,
  findSelectedVmixAgent,
  getTimeUntilVmixEvent,
  getVmixAgentState,
  getVmixEventStatusLabel,
  selectUpcomingVmixEvents,
  selectVmixAgents,
  type VmixEvent,
} from "./vmix-scheduler-model";

describe("vMix scheduler model", () => {
  const agents = [
    { id: "plain", specifications: {} },
    {
      id: "vmix-1",
      name: "Studio vMix",
      specifications: {
        agent: { agentKey: "agent-1", capabilities: ["vmix-scheduler"] },
        vmix: { connected: true, active: 2, inputs: [{ number: 1, title: "Camera", state: "Running" }] },
      },
    },
  ];

  it("selects and normalizes vMix agents", () => {
    const selectedAgents = selectVmixAgents(agents);
    const selected = findSelectedVmixAgent(selectedAgents, "agent-1");
    const state = getVmixAgentState(selected);

    expect(selectedAgents).toHaveLength(1);
    expect(state.effectiveAgentKey).toBe("agent-1");
    expect(state.connection).toMatchObject({ connected: true, program: 2 });
  });

  it("adds a default cut only when an input has no explicit transition", () => {
    expect(buildVmixEventActions("3", ["StartRecording"])).toEqual([
      "StartRecording",
      "PreviewInput3",
      "Cut",
    ]);
    expect(buildVmixEventActions("3", ["Fade"])).toEqual(["Fade", "PreviewInput3"]);
  });

  it("formats status and remaining time consistently", () => {
    expect(getVmixEventStatusLabel("scheduled")).toBe("Запланировано");
    expect(getTimeUntilVmixEvent("2026-07-17T12:15:00.000Z", new Date("2026-07-17T10:00:00.000Z"))).toBe("2ч 15м");
  });

  it("keeps live and future events in the schedule", () => {
    const events: VmixEvent[] = [
      { id: "past", title: "Past", startTime: "2026-07-17T09:00:00.000Z", status: "completed", actions: [] },
      { id: "live", title: "Live", startTime: "2026-07-17T09:00:00.000Z", status: "live", actions: [] },
      { id: "future", title: "Future", startTime: "2026-07-17T11:00:00.000Z", status: "scheduled", actions: [] },
      { id: "legacy", title: "Legacy", startTime: "unknown", status: "scheduled", actions: [] },
    ];

    expect(selectUpcomingVmixEvents(events, new Date("2026-07-17T10:00:00.000Z")).map((event) => event.id)).toEqual([
      "live",
      "future",
      "legacy",
    ]);
  });
});
