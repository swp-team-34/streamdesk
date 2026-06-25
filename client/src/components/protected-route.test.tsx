import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { tabPermission } from "@shared/schema";
import { ProtectedRoute } from "./protected-route";

const routeState = vi.hoisted(() => ({
  path: "/equipment",
  setLocation: vi.fn(),
}));

vi.mock("wouter", () => ({
  useLocation: () => [routeState.path, routeState.setLocation],
}));

describe("ProtectedRoute", () => {
  beforeEach(() => {
    routeState.path = "/equipment";
    routeState.setLocation.mockClear();
    localStorage.clear();
  });

  it("prompts anonymous users to sign in and routes them to login", () => {
    render(
      React.createElement(ProtectedRoute, null, React.createElement("div", null, "Protected content")),
    );

    expect(screen.getByText("Требуется авторизация")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Войти" }));

    expect(routeState.setLocation).toHaveBeenCalledWith("/login");
  });

  it("blocks users without the required page permission", () => {
    render(
      React.createElement(
        ProtectedRoute,
        {
          user: { id: "user-1", role: "operator", permissions: ["tasks:view"] },
          requiredPermission: "equipment:view",
          children: React.createElement("div", null, "Protected content"),
        },
      ),
    );

    expect(screen.getByText("Доступ ограничен")).toBeInTheDocument();
    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
  });

  it("renders protected content when required permission and tab access are granted", () => {
    render(
      React.createElement(
        ProtectedRoute,
        {
          user: {
            id: "user-1",
            role: "operator",
            permissions: ["equipment:view", tabPermission("equipment")],
          },
          requiredPermission: "equipment:view",
          children: React.createElement("div", null, "Protected content"),
        },
      ),
    );

    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });
});
