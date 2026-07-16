import { describe, expect, it } from "vitest";
import {
  buildActiveProjectRows,
  buildEquipmentForTaskRows,
  buildTeamWorkloadRows,
  buildUnassignedTaskRows,
  buildUpcomingReturnRows,
} from "./dashboard-operational";

const now = new Date("2026-07-16T12:00:00.000Z");

describe("dashboard operational selectors", () => {
  it("prioritizes projects with overdue or blocked work", () => {
    const rows = buildActiveProjectRows(
      [
        { id: "healthy", name: "Healthy", status: "active" },
        { id: "blocked", name: "Blocked", status: "blocked" },
      ],
      [
        { id: "1", projectId: "healthy", listType: "closed" },
        { id: "2", projectId: "blocked", listType: "active", dueDate: "2026-07-15T12:00:00.000Z" },
      ],
      now,
    );

    expect(rows[0]).toMatchObject({ id: "blocked", blocked: true, overdue: 1, atRisk: true });
    expect(rows[1]).toMatchObject({ id: "healthy", percent: 100, atRisk: false });
  });

  it("returns only active unassigned Kanban cards in deadline order", () => {
    expect(buildUnassignedTaskRows([
      { id: "later", listType: "active", dueDate: "2026-07-20T12:00:00.000Z" },
      { id: "done", listType: "closed" },
      { id: "assigned", listType: "active", assigneeUserId: "u1" },
      { id: "earlier", listType: "active", dueDate: "2026-07-17T12:00:00.000Z" },
    ]).map((row) => row.id)).toEqual(["earlier", "later"]);
  });

  it("builds permission-ready workload rows from visible users and cards", () => {
    const rows = buildTeamWorkloadRows(
      [
        { id: "1", listType: "active", assigneeUserId: "u1", dueDate: "2026-07-15T12:00:00.000Z" },
        { id: "2", listType: "active", assigneeUserId: "u1" },
        { id: "3", listType: "active", assigneeUserId: "u2" },
      ],
      [{ id: "u1", name: "Анна" }, { id: "u2", name: "Борис" }],
      now,
    );

    expect(rows[0]).toMatchObject({ userId: "u1", name: "Анна", active: 2, overdue: 1 });
  });

  it("scopes linked equipment to mine or team cards and removes duplicates", () => {
    const cards = [
      { id: "mine", boardId: "b1", title: "Mine", listType: "active", assigneeUserId: "u1" },
      { id: "team", boardId: "b1", title: "Team", listType: "active", assigneeUserId: "u2" },
    ];
    const links = {
      mine: [
        { active: true, equipment: { id: "e1", name: "Camera" } },
        { active: true, equipment: { id: "e1", name: "Camera" } },
      ],
      team: [{ active: true, equipment: { id: "e2", name: "Mic" } }],
    };

    expect(buildEquipmentForTaskRows(cards, links, { scope: "mine", userId: "u1" })).toHaveLength(1);
    expect(buildEquipmentForTaskRows(cards, links, { scope: "team", userId: "u1" })).toHaveLength(2);
  });

  it("sorts overdue equipment returns before upcoming ones", () => {
    const rows = buildUpcomingReturnRows(
      [
        { equipmentId: "future", projectId: "p1", returnDate: "2026-07-18", sources: ["project-bundle"] },
        { equipmentId: "past", projectId: "p2", returnDate: "2026-07-15", sources: ["project-bundle"] },
        { equipmentId: "context", projectId: "p3", returnDate: "2026-07-14", sources: ["manual"] },
      ],
      [{ id: "future", name: "Future" }, { id: "past", name: "Past" }],
      now,
    );

    expect(rows.map((row) => row.equipmentId)).toEqual(["past", "future"]);
    expect(rows[0].overdue).toBe(true);
  });

  it("keeps a date-only return current until the Moscow calendar day ends", () => {
    const rows = buildUpcomingReturnRows(
      [{ equipmentId: "today", projectId: "p1", returnDate: "2026-07-16", sources: ["project-bundle"] }],
      [{ id: "today", name: "Today" }],
      new Date("2026-07-16T20:00:00.000Z"),
    );

    expect(rows[0].overdue).toBe(false);
  });
});
