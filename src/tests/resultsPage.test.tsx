import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";

function getSummaryValue(testId: string) {
  return screen.getByTestId(testId).textContent ?? "";
}

function parseMoney(value: string) {
  return Number(value.replace(/[^\d.-]/g, ""));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("results page", () => {
  it("shows the richer MLA environment outline groups from the template baseline", () => {
    render(
      <MemoryRouter initialEntries={["/results"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("Group A Sequence Tests")).toBeInTheDocument();
    expect(screen.getByText("Group B Sequence Tests")).toBeInTheDocument();
    expect(screen.getByText("Group C Sequence Tests")).toBeInTheDocument();
    expect(screen.getByText("Group D Parallel Tests")).toBeInTheDocument();
    expect(screen.getByText("D-3 PCBA")).toBeInTheDocument();
    expect(screen.getByText("Group E EMC Tests")).toBeInTheDocument();
    expect(screen.getByText("Group F Other Tests")).toBeInTheDocument();
    expect(screen.getAllByText("Thermal Shock Endurance").length).toBeGreaterThan(0);
    expect(screen.getAllByText("85/85High Temperature -High Humidity Endurance--No need to verify the TFT screen").length).toBeGreaterThan(0);
  });

  it("updates totals when a test item is disabled", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/results"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "测试结果", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "环境" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "材料" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "EMC" })).toBeInTheDocument();

    const initialTotalCost = parseMoney(getSummaryValue("summary-totalCost"));
    const firstEnableToggle = screen.getAllByLabelText(/^启用 /)[0]!;

    await user.click(firstEnableToggle);

    await waitFor(() => {
      expect(parseMoney(getSummaryValue("summary-totalCost"))).toBeLessThan(initialTotalCost);
    });
  });

  it("keeps export actions disabled until the plan is confirmed", async () => {
    const user = userEvent.setup();
    const createObjectUrlMock = vi.fn(() => "blob:mock");
    const revokeObjectUrlMock = vi.fn();
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const printMock = vi.fn();

    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });

    vi.spyOn(window, "open").mockReturnValue({
      document: {
        open: vi.fn(),
        write: vi.fn(),
        close: vi.fn(),
        readyState: "complete",
      },
      focus: vi.fn(),
      print: printMock,
    } as unknown as Window);

    render(
      <MemoryRouter initialEntries={["/results"]}>
        <App />
      </MemoryRouter>,
    );

    const excelButton = screen.getByRole("button", { name: "导出 Excel" });
    const pdfButton = screen.getByRole("button", { name: "导出 PDF" });
    expect(excelButton).toBeDisabled();
    expect(pdfButton).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "确认方案" }));

    await waitFor(() => {
      expect(excelButton).toBeEnabled();
      expect(pdfButton).toBeEnabled();
    });

    await user.click(excelButton);
    await user.click(pdfButton);

    expect(createObjectUrlMock).toHaveBeenCalledTimes(4);
    expect(clickMock).toHaveBeenCalledTimes(4);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(4);
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(printMock).toHaveBeenCalledTimes(1);
  });
});
