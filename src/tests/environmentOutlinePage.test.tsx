import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";

describe("environment outline fee detail", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows MLA fee detail below the outline and exposes calculated fee columns", () => {
    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "PV 费用细则", level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText("实验室单价中值").length).toBeGreaterThan(0);
    expect(screen.getAllByText("单项费用（预计）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SGS 单价").length).toBeGreaterThan(0);
    expect(screen.getAllByText("华测 单项费用").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Particle Exposure").length).toBeGreaterThan(0);
    expect(screen.getAllByText("¥36,000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("¥960").length).toBeGreaterThan(0);
  });

  it("opens a one-time editable median fee calculation from a read-only outline Fee", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButton = screen.getByRole("button", { name: "PV / Group A / K1 Low Temperature Exposure 费用 ¥960.00" });
    expect(screen.queryByLabelText("PV / Group A / K1 Low Temperature Exposure Fee")).not.toBeInTheDocument();

    await user.dblClick(feeButton);

    expect(screen.getByRole("heading", { name: "K1 Low Temperature Exposure 费用计算", level: 3 })).toBeInTheDocument();
    expect(screen.getByLabelText("K1 Low Temperature Exposure 计费方式")).toHaveValue("hour");
    expect(screen.getByLabelText("K1 Low Temperature Exposure 中位单价")).toHaveValue("40");
    expect(screen.getByLabelText("K1 Low Temperature Exposure 计费基数")).toHaveValue("24");
    expect(screen.getByText("40 × 24 = ¥960")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("K1 Low Temperature Exposure 中位单价"));
    await user.type(screen.getByLabelText("K1 Low Temperature Exposure 中位单价"), "50");

    expect(screen.getByRole("button", { name: "PV / Group A / K1 Low Temperature Exposure 费用 ¥1,200.00" })).toBeInTheDocument();
    expect(screen.getByText("50 × 24 = ¥1,200")).toBeInTheDocument();
  });

  it("shows optical fee split details and keeps the original fee when opened without edits", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButton = screen.getByRole("button", { name: "PV / Group A / Optical Test 费用 ¥25,140.00" });

    await user.dblClick(feeButton);

    expect(screen.getByRole("heading", { name: "Optical Test 费用计算", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("51 点位样品 9")).toBeInTheDocument();
    expect(screen.getByText("单价 460")).toBeInTheDocument();
    expect(screen.getByText("总价 ¥4,140")).toBeInTheDocument();
    expect(screen.getByText("19 点位样品 100")).toBeInTheDocument();
    expect(screen.getByText("单价 210")).toBeInTheDocument();
    expect(screen.getByText("总价 ¥21,000")).toBeInTheDocument();
    expect(screen.getByText("合计 ¥25,140")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PV / Group A / Optical Test 费用 ¥25,140.00" })).toBeInTheDocument();
  });

  it("shows only the median-lab particle exposure calculation in the fee detail editor", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButton = screen.getByRole("button", { name: "PV / Group A / Particle Exposure 费用 ¥24,000.00" });

    await user.dblClick(feeButton);

    expect(screen.getByRole("heading", { name: "Particle Exposure 费用计算", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("中值（华测）")).toBeInTheDocument();
    expect(screen.getByText("4 批 × 1500 + 粉尘费 6000 + 清洁费 12000")).toBeInTheDocument();
    expect(screen.queryByText(/^华测$/)).not.toBeInTheDocument();
    expect(screen.queryByText("SGS")).not.toBeInTheDocument();
    expect(screen.queryByText("苏劢")).not.toBeInTheDocument();
    expect(screen.getByText("合计 ¥24,000")).toBeInTheDocument();
  });

  it("shows component-based fee composition for B group chemical and connector tests", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const chemicalFeeButton = screen.getByRole("button", { name: "PV / Group B / K22 Chemical Resistance 费用 ¥6,300.00" });

    await user.dblClick(chemicalFeeButton);

    expect(screen.getByRole("heading", { name: "K22 Chemical Resistance 费用计算", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("中值（华测）")).toBeInTheDocument();
    expect(screen.getByText("15 种试剂 × 300 + 72 小时 × 25")).toBeInTheDocument();
    expect(screen.getByText("合计 ¥6,300")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭 K22 Chemical Resistance 费用计算" }));

    const connectorFeeButton = screen.getByRole("button", { name: "PV / Group B / K18 Connector and lead/lock strength 费用 ¥15,600.00" });

    await user.dblClick(connectorFeeButton);

    expect(screen.getByRole("heading", { name: "K18 Connector and lead/lock strength 费用计算", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("中值（SGS）")).toBeInTheDocument();
    expect(screen.getByText("K18.1-K18.4 四项 × 12 台样机 × 325")).toBeInTheDocument();
    expect(screen.getByText("合计 ¥15,600")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PV / Group B / K18 Connector and lead/lock strength 费用 ¥15,600.00" })).toBeInTheDocument();
  });
});
