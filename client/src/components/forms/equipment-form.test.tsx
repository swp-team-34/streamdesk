import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EquipmentForm } from "./equipment-form";

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@/lib/queryClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queryClient")>();
  return {
    ...actual,
    apiRequest: mocks.apiRequest,
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/lib/barcode-label", () => ({
  downloadBarcodeLabelPng: vi.fn(),
  openBarcodePrintWindow: vi.fn(),
  renderCompactBarcodeLabel: vi.fn(),
  sanitizeBarcodeFilePart: (value: string) => value,
}));

describe("EquipmentForm return storage workflow", () => {
  beforeEach(() => {
    Object.defineProperties(HTMLElement.prototype, {
      hasPointerCapture: { configurable: true, value: () => false },
      setPointerCapture: { configurable: true, value: () => undefined },
      releasePointerCapture: { configurable: true, value: () => undefined },
      scrollIntoView: { configurable: true, value: () => undefined },
    });
    localStorage.clear();
    localStorage.setItem("streamstudio_user", JSON.stringify({
      id: "worker-1",
      role: "admin",
      name: "Warehouse manager",
      permissions: ["equipment:reserve"],
    }));
    mocks.apiRequest.mockReset();
    mocks.toast.mockReset();
    mocks.apiRequest.mockResolvedValue({
      json: async () => ({ id: "equipment-1", status: "available" }),
    });
  });

  it("requires a storage location and submits its id together with the return", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EquipmentForm
          isOpen
          onClose={onClose}
          mode="take_return"
          companyId="company-1"
          equipment={{
            id: "equipment-1",
            name: "Camera",
            type: "camera",
            status: "in-use",
            operabilityStatus: "working",
            specifications: { companyId: "company-1" },
          }}
          storageLocations={[
            {
              id: "shelf-3",
              name: "Shelf 3",
              path: "Room 204 / Rack B / Shelf 3",
              type: "shelf",
            },
          ]}
        />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Вернуть оборудование")).toBeInTheDocument();
    expect(screen.getByText("Место хранения *")).toBeInTheDocument();
    expect(screen.queryByText("Резервный тип")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Вернуть" }));
    expect(mocks.apiRequest).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Укажите место хранения",
      variant: "destructive",
    }));

    await user.click(screen.getByRole("combobox"));
    await user.click(await screen.findByText("Room 204 / Rack B / Shelf 3"));
    await user.click(screen.getByRole("button", { name: "Вернуть" }));

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledWith(
        "PUT",
        "/api/equipment/equipment-1",
        expect.objectContaining({
          status: "available",
          assignedTo: null,
          storageLocationId: "shelf-3",
          storageLocation: "Room 204 / Rack B / Shelf 3",
        }),
      );
    });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
