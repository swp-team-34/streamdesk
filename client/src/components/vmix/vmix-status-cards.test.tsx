import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VmixStatusCards } from "./vmix-status-cards";

afterEach(cleanup);

describe("VmixStatusCards", () => {
  it("renders live connection state", () => {
    render(
      <VmixStatusCards connection={{
        connected: true,
        host: "studio",
        port: 8088,
        inputs: [],
        preview: 2,
        program: 4,
        recording: true,
        streaming: false,
      }} />,
    );

    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getAllByText("ON")).toHaveLength(1);
    expect(screen.getAllByText("OFF")).toHaveLength(1);
  });
});
