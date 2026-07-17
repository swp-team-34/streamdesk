import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useState } from "react";

import { AppDialogProvider, useAppDialog } from "./app-dialog-provider";

afterEach(cleanup);

function DialogHarness() {
  const { confirm, prompt } = useAppDialog();
  const [result, setResult] = useState("idle");

  return (
    <div>
      <button
        type="button"
        onClick={async () => setResult(await confirm({
          title: "Удалить запись?",
          description: "Действие нельзя отменить.",
          confirmLabel: "Удалить",
          destructive: true,
        }) ? "confirmed" : "cancelled")}
      >
        Confirm
      </button>
      <button
        type="button"
        onClick={async () => setResult(await prompt({
          title: "Новое значение",
          label: "Название",
          required: true,
        }) ?? "cancelled")}
      >
        Prompt
      </button>
      <output>{result}</output>
    </div>
  );
}

describe("AppDialogProvider", () => {
  it("resolves a custom confirmation dialog", async () => {
    render(
      <AppDialogProvider>
        <DialogHarness />
      </AppDialogProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Действие нельзя отменить.")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(screen.getByText("confirmed")).toBeInTheDocument());
  });

  it("uses a custom prompt and prevents an empty required value", async () => {
    render(
      <AppDialogProvider>
        <DialogHarness />
      </AppDialogProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Prompt" }));
    const dialog = await screen.findByRole("dialog");
    const submit = within(dialog).getByRole("button", { name: "Применить" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Название"), { target: { value: "  Studio  " } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    await waitFor(() => expect(screen.getByText("Studio")).toBeInTheDocument());
  });
});
