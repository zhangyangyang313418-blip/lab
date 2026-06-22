import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { appReducer, createSeedAppState } from "../store/appState";
import { saveProjectDraft } from "../services/localStore";

describe("environment outline fee detail", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps DV and PV fee details collapsed by default and expands them independently", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const dvToggle = screen.getByRole("button", { name: "展开 DV 费用明细" });
    const pvToggle = screen.getByRole("button", { name: "展开 PV 费用明细" });

    expect(dvToggle).toHaveAttribute("aria-expanded", "false");
    expect(pvToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table", { name: "DV 费用细则" })).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "PV 费用细则" })).not.toBeInTheDocument();

    await user.click(dvToggle);

    expect(screen.getByRole("button", { name: "收起 DV 费用明细" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("table", { name: "DV 费用细则" })).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "PV 费用细则" })).not.toBeInTheDocument();
    expect(screen.getAllByText("实验室单价中值").length).toBeGreaterThan(0);
    expect(screen.getAllByText("单项费用（预计）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SGS 单价").length).toBeGreaterThan(0);
    expect(screen.getAllByText("华测 单项费用").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Particle Exposure").length).toBeGreaterThan(0);
    for (const label of [
      "K28 HALT Cold",
      "K28 HALT Hot",
      "K28 HALT Thermal Shock",
      "K28 HALT Vibration",
      "K28 HALT TST & Vibration",
    ]) {
      expect(screen.getByRole("button", { name: `PV / Group D-8 / ${label} 费用 ¥6,400.00` })).toBeInTheDocument();
    }
    expect(screen.getAllByText("¥720").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "收起 DV 费用明细" }));

    expect(screen.getByRole("button", { name: "展开 DV 费用明细" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("table", { name: "DV 费用细则" })).not.toBeInTheDocument();
  });

  it("opens a read-only median fee calculation from an outline Fee", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButton = screen.getByRole("button", { name: "PV / Group A / K1 Low Temperature Exposure 费用 ¥720.00" });
    expect(screen.queryByLabelText("PV / Group A / K1 Low Temperature Exposure Fee")).not.toBeInTheDocument();

    await user.dblClick(feeButton);

    expect(screen.getByRole("heading", { name: "K1 Low Temperature Exposure 费用计算", level: 3 })).toBeInTheDocument();
    const editor = screen.getByRole("heading", { name: "K1 Low Temperature Exposure 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(editor).not.toBeNull();
    const feeEditor = within(editor as HTMLElement);
    expect(feeEditor.queryByRole("combobox")).not.toBeInTheDocument();
    expect(feeEditor.queryByRole("textbox", { name: "K1 Low Temperature Exposure 计费方式" })).not.toBeInTheDocument();
    expect(feeEditor.queryByRole("textbox", { name: "K1 Low Temperature Exposure 中值单价" })).not.toBeInTheDocument();
    expect(feeEditor.getByText("计费方式")).toBeInTheDocument();
    expect(feeEditor.getByText("按 h")).toBeInTheDocument();
    expect(feeEditor.getByText("中值单价")).toBeInTheDocument();
    expect(feeEditor.getByText("30")).toBeInTheDocument();
    expect(feeEditor.getByText("计费基数")).toBeInTheDocument();
    expect(screen.getByLabelText("K1 Low Temperature Exposure 计费基数")).toHaveValue("24");
    expect(feeEditor.queryByText("公式")).not.toBeInTheDocument();
    expect(feeEditor.queryByText("30 × 24 h = ¥720")).not.toBeInTheDocument();
    expect(screen.getByText("实验室报价明细")).toBeInTheDocument();
    const k1LabDetail = within(screen.getByLabelText("K1 Low Temperature Exposure 实验室报价明细"));
    expect(k1LabDetail.getByText("SGS（中值）")).toBeInTheDocument();
    expect(k1LabDetail.getByText("华测")).toBeInTheDocument();
    expect(k1LabDetail.getByText("苏勃")).toBeInTheDocument();
    expect(k1LabDetail.queryByText("信测")).not.toBeInTheDocument();
    expect(k1LabDetail.getByText("30 × 24 h")).toBeInTheDocument();
    expect(k1LabDetail.getByText("25 × 24 h")).toBeInTheDocument();
    expect(k1LabDetail.getByText("40 × 24 h")).toBeInTheDocument();
    expect(k1LabDetail.getByText("¥720")).toBeInTheDocument();
    expect(k1LabDetail.getByText("¥600")).toBeInTheDocument();
    expect(k1LabDetail.getByText("¥960")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PV / Group A / K1 Low Temperature Exposure 费用 ¥720.00" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("K1 Low Temperature Exposure 计费基数"));
    await user.type(screen.getByLabelText("K1 Low Temperature Exposure 计费基数"), "48");

    expect(screen.getByRole("button", { name: "PV / Group A / K1 Low Temperature Exposure 费用 ¥1,440.00" })).toBeInTheDocument();
    expect(feeEditor.queryByText("30 × 48 h = ¥1,440")).not.toBeInTheDocument();
  });

  it("keeps phase total costs read-only because they are calculated from fixed fee rules", () => {
    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    for (const totalCostInput of screen.getAllByRole("textbox", { name: "Total Cost" })) {
      expect(totalCostInput).toHaveAttribute("readonly");
    }
  });

  it("shows total, group, computer, and report fees on a dedicated fee summary row", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const totalCostInput = screen.getAllByRole("textbox", { name: "Total Cost" })[0]!;
    const initialTotal = Number(totalCostInput.getAttribute("value")?.replace(/[^\d.]/g, ""));
    const feeRow = totalCostInput.closest(".meta-fee-row") as HTMLElement | null;

    expect(feeRow).not.toBeNull();
    const feeRowQueries = within(feeRow as HTMLElement);
    const computerFeeAmount = feeRowQueries.getByLabelText("DV Computer Fee 费用 ¥12,000.00");
    const reportFeeAmount = feeRowQueries.getByLabelText("DV Report Fee 费用 ¥1,950.00");

    for (const label of ["Group A", "Group B", "Group C", "Group D", "Group E"]) {
      expect(feeRowQueries.getByText(label)).toBeInTheDocument();
    }
    expect(feeRowQueries.getByText("Computer Fee")).toBeInTheDocument();
    expect(feeRowQueries.getByText("Report Fee")).toBeInTheDocument();
    expect(computerFeeAmount.closest(".meta-extra-fee-card")).toBe(feeRow?.lastElementChild?.previousElementSibling);
    expect(reportFeeAmount.closest(".meta-extra-fee-card")).toBe(feeRow?.lastElementChild);
    expect(feeRowQueries.queryByText("实验室报价明细")).not.toBeInTheDocument();

    await user.dblClick(computerFeeAmount);

    const computerFeeDetail = within(screen.getByLabelText("DV 电脑费用报价"));
    expect(computerFeeDetail.getByText("实验室报价明细")).toBeInTheDocument();
    expect(computerFeeDetail.getByText("SGS（中值）")).toBeInTheDocument();
    expect(computerFeeDetail.getByText("250/月/台 × 48")).toBeInTheDocument();
    expect(computerFeeDetail.getByText("450/月/台 × 48")).toBeInTheDocument();
    expect(computerFeeDetail.getByText("150/月/台 × 48")).toBeInTheDocument();
    expect(computerFeeDetail.getByText("¥12,000")).toBeInTheDocument();
    expect(computerFeeDetail.getByText("¥21,600")).toBeInTheDocument();
    expect(computerFeeDetail.getByText("¥7,200")).toBeInTheDocument();
    expect(screen.getByLabelText("Computer Fee 系数")).toHaveValue("48");

    await user.clear(screen.getByLabelText("Computer Fee 系数"));
    await user.type(screen.getByLabelText("Computer Fee 系数"), "50");

    expect(totalCostInput).toHaveValue(
      new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(initialTotal + 500),
    );
    expect(within(feeRow as HTMLElement).getByLabelText("DV Computer Fee 费用 ¥12,500.00")).toBeInTheDocument();

    await user.click(screen.getByRole("heading", { name: "DV 环境测试流程图" }));

    expect(screen.queryByLabelText("DV 电脑费用报价")).not.toBeInTheDocument();

    await user.dblClick(within(feeRow as HTMLElement).getByLabelText("DV Report Fee 费用 ¥1,950.00"));

    const reportFeeDetail = within(screen.getByLabelText("DV 报告费用报价"));
    expect(reportFeeDetail.getByText("实验室报价明细")).toBeInTheDocument();
    expect(reportFeeDetail.getByText("SGS")).toBeInTheDocument();
    expect(reportFeeDetail.getByText("华测")).toBeInTheDocument();
    expect(reportFeeDetail.getByText("苏勃（计入）")).toBeInTheDocument();
    expect(reportFeeDetail.getAllByText("0/份 × 13 份")).toHaveLength(2);
    expect(reportFeeDetail.getByText("150/份 × 13 份")).toBeInTheDocument();
    expect(reportFeeDetail.getByText("¥1,950")).toBeInTheDocument();
    expect(screen.getByLabelText("Report Fee 报告份数")).toHaveValue("");

    await user.type(screen.getByLabelText("Report Fee 报告份数"), "14");

    expect(totalCostInput).toHaveValue(
      new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(initialTotal + 500 + 150),
    );
    expect(within(feeRow as HTMLElement).getByLabelText("DV Report Fee 费用 ¥2,100.00")).toBeInTheDocument();
  });

  it("downloads the MLA fee workbook from the environment outline page", async () => {
    const user = userEvent.setup();
    const createObjectUrlMock = vi.fn(() => "blob:mla-fee-export");
    const revokeObjectUrlMock = vi.fn();
    const clickMock = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const exportButtons = screen.getAllByRole("button", { name: "导出 MLA 费用 Excel" });
    expect(exportButtons).toHaveLength(2);

    await user.click(exportButtons[0]!);

    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
  });

  it("uses the selected platform in the environment outline header and fee export labels", () => {
    const seedState = createSeedAppState();
    const emaRhdDraft = appReducer(seedState, {
      type: "applyProjectSetup",
      updates: {
        platform: "EMA",
        steeringSides: ["RHD"],
        projectCode: "L463",
        reuseEnvironmentTemplate: false,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft(emaRhdDraft);

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("参考 EMA test flow chart 展示，可直接编辑各组内容。")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "导出 EMA 费用 Excel" })).toHaveLength(2);
    expect(screen.queryByText("参考 MLA test flow chart 展示，可直接编辑各组内容。")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "导出 MLA 费用 Excel" })).toHaveLength(0);
    expect(screen.getAllByDisplayValue("L463 RHD").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("K27 85/85 High Temperature -High Humidity Endurance").length).toBeGreaterThan(0);
    expect(screen.queryAllByDisplayValue("K14 Dust Blowing Test")).toHaveLength(0);
  });

  it("shows optical fee split details and keeps the original fee when opened without edits", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButtons = screen.getAllByRole("button", { name: "PV / Group A / Optical Test 费用 ¥784.00" });
    expect(feeButtons.length).toBeGreaterThanOrEqual(2);
    const feeButton = feeButtons[0]!;

    await user.dblClick(feeButton);

    expect(screen.getByRole("heading", { name: "Optical Test 费用计算", level: 3 })).toBeInTheDocument();
    const editor = screen.getByRole("heading", { name: "Optical Test 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(editor).not.toBeNull();
    const opticalEditor = within(editor as HTMLElement);
    expect(opticalEditor.getByText("51 点位样品")).toBeInTheDocument();
    expect(opticalEditor.getByText("1")).toBeInTheDocument();
    expect(opticalEditor.getByText("单价 134")).toBeInTheDocument();
    expect(opticalEditor.getByText("总价 ¥134")).toBeInTheDocument();
    expect(opticalEditor.getByText("19 点位样品")).toBeInTheDocument();
    expect(opticalEditor.getByText("13")).toBeInTheDocument();
    expect(opticalEditor.getByText("单价 50")).toBeInTheDocument();
    expect(opticalEditor.getByText("总价 ¥650")).toBeInTheDocument();
    expect(opticalEditor.getByText("合计 ¥784")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "PV / Group A / Optical Test 费用 ¥784.00" }).length).toBeGreaterThanOrEqual(2);
  });

  it("shows the external L6 basis as samples by points while keeping the 33-point fee", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButton = screen.getByRole("button", { name: "PV / Group D-3 / L6-SEM&SECTION 费用 ¥21,450.00" });

    await user.dblClick(feeButton);

    const editor = screen.getByRole("heading", { name: "L6-SEM&SECTION 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(editor).not.toBeNull();
    const feeEditor = within(editor as HTMLElement);
    expect(feeEditor.getByText("计费基数")).toBeInTheDocument();
    expect(screen.getByLabelText("L6-SEM&SECTION 计费基数")).toHaveValue("33");
    expect(feeEditor.getByText("3 样品 × 11 点位")).toBeInTheDocument();

    const l6LabDetail = within(screen.getByLabelText("L6-SEM&SECTION 实验室报价明细"));
    expect(l6LabDetail.getByText("650 × 3 样品 × 11 点位")).toBeInTheDocument();
    expect(l6LabDetail.getByText("500 × 3 样品 × 11 点位")).toBeInTheDocument();
    expect(l6LabDetail.getByText("700 × 3 样品 × 11 点位")).toBeInTheDocument();
    expect(l6LabDetail.getByText("¥21,450")).toBeInTheDocument();
  });

  it("shows operating noise as an SGS reference price without unavailable lab cards", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButton = screen.getByRole("button", { name: "PV / Group E-2 / E-2 Operating Noise & Transient Noise 费用 ¥42,500.00" });

    await user.dblClick(feeButton);

    const editor = screen.getByRole("heading", { name: "E-2 Operating Noise & Transient Noise 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(editor).not.toBeNull();
    const feeEditor = within(editor as HTMLElement);
    expect(feeEditor.getByText("参考单价")).toBeInTheDocument();
    expect(feeEditor.queryByText("中值单价")).not.toBeInTheDocument();

    const labDetail = within(screen.getByLabelText("E-2 Operating Noise & Transient Noise 实验室报价明细"));
    expect(labDetail.getByText("SGS")).toBeInTheDocument();
    expect(labDetail.queryByText("SGS（中值）")).not.toBeInTheDocument();
    expect(labDetail.getByText("1,700 × 25 台样机")).toBeInTheDocument();
    expect(labDetail.getByText("¥42,500")).toBeInTheDocument();
    expect(labDetail.queryByText("华测")).not.toBeInTheDocument();
    expect(labDetail.queryByText("苏勃")).not.toBeInTheDocument();
    expect(labDetail.queryByText("无报价 / 无能力")).not.toBeInTheDocument();
  });

  it("shows all particle exposure lab calculations in the fee detail editor", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const feeButton = screen.getByRole("button", { name: "PV / Group A / Particle Exposure 费用 ¥24,000.00" });

    await user.dblClick(feeButton);

    expect(screen.getByRole("heading", { name: "Particle Exposure 费用计算", level: 3 })).toBeInTheDocument();
    const particleEditorElement = screen.getByRole("heading", { name: "Particle Exposure 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(particleEditorElement).not.toBeNull();
    const particleEditor = within(particleEditorElement as HTMLElement);
    const particleMedianSummary = within((particleEditorElement as HTMLElement).querySelector(".fee-calculation-editor__median-summary") as HTMLElement);
    expect(particleMedianSummary.getByText("中值（华测）")).toBeInTheDocument();
    expect(particleMedianSummary.getByText("¥24,000")).toBeInTheDocument();
    expect(particleEditor.queryByText("合计 ¥24,000")).not.toBeInTheDocument();
    const particleLabDetail = within(screen.getByLabelText("Particle Exposure 实验室报价明细"));
    expect(particleLabDetail.getByText("SGS")).toBeInTheDocument();
    expect(particleLabDetail.getByText("2 批 × 2500 + 粉尘费 8000")).toBeInTheDocument();
    expect(particleLabDetail.getByText("¥13,000")).toBeInTheDocument();
    expect(particleLabDetail.getByText("华测（中值）")).toBeInTheDocument();
    expect(particleLabDetail.getByText("4 批 × 1500 + 粉尘费 6000 + 清洁费 12000")).toBeInTheDocument();
    expect(particleLabDetail.getByText("苏勃")).toBeInTheDocument();
    expect(particleLabDetail.getByText("4 批 × 6500 + 粉尘费 5000")).toBeInTheDocument();
    expect(particleLabDetail.getByText("¥31,000")).toBeInTheDocument();
    expect(particleLabDetail.queryByText("报价 ¥13,000")).not.toBeInTheDocument();
  });

  it("shows component-based fee composition for B group chemical, connector, and K26 tests", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const chemicalFeeButton = screen.getByRole("button", { name: "PV / Group B / K22 Chemical Resistance 费用 ¥11,190.00" });

    await user.dblClick(chemicalFeeButton);

    expect(screen.getByRole("heading", { name: "K22 Chemical Resistance 费用计算", level: 3 })).toBeInTheDocument();
    const chemicalEditorElement = screen.getByRole("heading", { name: "K22 Chemical Resistance 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(chemicalEditorElement).not.toBeNull();
    const chemicalEditor = within(chemicalEditorElement as HTMLElement);
    const chemicalMedianSummary = within((chemicalEditorElement as HTMLElement).querySelector(".fee-calculation-editor__median-summary") as HTMLElement);
    expect(chemicalMedianSummary.getByText("中值（SGS）")).toBeInTheDocument();
    expect(chemicalMedianSummary.getByText("¥11,190")).toBeInTheDocument();
    expect(chemicalEditor.queryByText("合计 ¥11,190")).not.toBeInTheDocument();
    expect(chemicalEditor.getByText("实验室报价明细")).toBeInTheDocument();
    const chemicalLabDetail = within(screen.getByLabelText("K22 Chemical Resistance 实验室报价明细"));
    expect(chemicalLabDetail.getByText("SGS（中值）")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("报价 ¥11,190")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("¥11,190")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("华测")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("报价 ¥12,300")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("¥12,300")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("苏勃")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("报价 ¥6,660")).toBeInTheDocument();
    expect(chemicalLabDetail.getByText("¥6,660")).toBeInTheDocument();
    expect(chemicalLabDetail.queryByText("15 种试剂 × 650 + 72 h × 20")).not.toBeInTheDocument();
    expect(chemicalLabDetail.queryByText("信测")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭 K22 Chemical Resistance 费用计算" }));

    const connectorFeeButton = screen.getByRole("button", { name: "PV / Group B / K18 Connector and lead/lock strength 费用 ¥19,000.00" });

    await user.dblClick(connectorFeeButton);

    expect(screen.getByRole("heading", { name: "K18 Connector and lead/lock strength 费用计算", level: 3 })).toBeInTheDocument();
    const connectorEditorElement = screen.getByRole("heading", { name: "K18 Connector and lead/lock strength 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(connectorEditorElement).not.toBeNull();
    const connectorEditor = within(connectorEditorElement as HTMLElement);
    const connectorMedianSummary = within((connectorEditorElement as HTMLElement).querySelector(".fee-calculation-editor__median-summary") as HTMLElement);
    expect(connectorMedianSummary.getByText("中值（SGS）")).toBeInTheDocument();
    expect(connectorMedianSummary.getByText("¥19,000")).toBeInTheDocument();
    expect(connectorEditor.queryByText("合计 ¥19,000")).not.toBeInTheDocument();
    const connectorLabDetail = within(screen.getByLabelText("K18 Connector and lead/lock strength 实验室报价明细"));
    expect(connectorLabDetail.getByText("四项单价 325；微应力 3400")).toBeInTheDocument();
    expect(connectorLabDetail.getByText("¥19,000")).toBeInTheDocument();
    expect(connectorLabDetail.getByText("华测")).toBeInTheDocument();
    expect(connectorLabDetail.getByText("四项单价 500；微应力 3500")).toBeInTheDocument();
    expect(connectorLabDetail.getByText("¥27,500")).toBeInTheDocument();
    expect(connectorLabDetail.getByText("苏勃")).toBeInTheDocument();
    expect(connectorLabDetail.getByText("四项单价 125；微应力 3500")).toBeInTheDocument();
    expect(connectorLabDetail.getByText("¥9,500")).toBeInTheDocument();
    expect(connectorLabDetail.queryByText("K18.1-K18.4 四项 × 12 台样机 × 325 + K18.1 微应力 3400")).not.toBeInTheDocument();
    expect(connectorLabDetail.queryByText("信测")).not.toBeInTheDocument();
    expect(connectorEditor.getByText("K18.1-K18.4 四项 × 12 台样机 × 单价 + K18.1 微应力费用")).toBeInTheDocument();
    expect(connectorEditor.queryByText("信测无微应力测试能力")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "PV / Group B / K18 Connector and lead/lock strength 费用 ¥19,000.00" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "关闭 K18 Connector and lead/lock strength 费用计算" }));

    const wearOutFeeButton = screen.getByRole("button", { name: "PV / Group C / K26 Mechanical Wear-Out 费用 ¥7,158.00" });

    await user.dblClick(wearOutFeeButton);

    expect(screen.getByRole("heading", { name: "K26 Mechanical Wear-Out 费用计算", level: 3 })).toBeInTheDocument();
    const wearOutEditorElement = screen.getByRole("heading", { name: "K26 Mechanical Wear-Out 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(wearOutEditorElement).not.toBeNull();
    const wearOutEditor = within(wearOutEditorElement as HTMLElement);
    const wearOutMedianSummary = within((wearOutEditorElement as HTMLElement).querySelector(".fee-calculation-editor__median-summary") as HTMLElement);
    expect(wearOutMedianSummary.getByText("中值（SGS）")).toBeInTheDocument();
    expect(wearOutMedianSummary.getByText("¥7,158")).toBeInTheDocument();
    expect(wearOutEditor.queryByText("合计 ¥7,158")).not.toBeInTheDocument();
    const wearOutLabDetail = within(screen.getByLabelText("K26 Mechanical Wear-Out 实验室报价明细"));
    const sgsWearOutCard = within(wearOutLabDetail.getByText("SGS（中值）").closest(".fee-calculation-editor__lab-card") as HTMLElement);
    expect(sgsWearOutCard.getByText("常温 10")).toBeInTheDocument();
    expect(sgsWearOutCard.getByText("高温 23")).toBeInTheDocument();
    expect(sgsWearOutCard.getByText("低温 23")).toBeInTheDocument();
    expect(wearOutLabDetail.getByText("¥7,158")).toBeInTheDocument();
    const ctiWearOutCard = within(wearOutLabDetail.getByText("华测").closest(".fee-calculation-editor__lab-card") as HTMLElement);
    expect(ctiWearOutCard.getByText("常温 7")).toBeInTheDocument();
    expect(ctiWearOutCard.getByText("高温 25")).toBeInTheDocument();
    expect(ctiWearOutCard.getByText("低温 25")).toBeInTheDocument();
    expect(wearOutLabDetail.getByText("¥6,488")).toBeInTheDocument();
    const sumeiWearOutCard = within(wearOutLabDetail.getByText("苏勃").closest(".fee-calculation-editor__lab-card") as HTMLElement);
    expect(sumeiWearOutCard.getByText("常温 20")).toBeInTheDocument();
    expect(sumeiWearOutCard.getByText("高温 30")).toBeInTheDocument();
    expect(sumeiWearOutCard.getByText("低温 30")).toBeInTheDocument();
    expect(wearOutLabDetail.getByText("¥11,660")).toBeInTheDocument();
    expect(wearOutLabDetail.queryByText("报价 ¥7,158")).not.toBeInTheDocument();
    expect(wearOutLabDetail.queryByText("334 h × 10 + 83 h × 23 + 83 h × 23")).not.toBeInTheDocument();
    expect(wearOutLabDetail.queryByText("信测")).not.toBeInTheDocument();
  });

  it("keeps the K26 fee button aligned with the expanded calculation when an old draft stores a stale fee", async () => {
    const seedState = createSeedAppState();
    const mlaDraft = appReducer(seedState, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...mlaDraft,
      environmentPlanVersion: 21,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) => (row.id === "c-k26" ? { ...row, fee: "15000" } : row)),
          })),
        })),
      },
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    const wearOutFeeButton = screen.getByRole("button", { name: "PV / Group C / K26 Mechanical Wear-Out 费用 ¥7,158.00" });

    await user.dblClick(wearOutFeeButton);

    const wearOutEditorElement = screen.getByRole("heading", { name: "K26 Mechanical Wear-Out 费用计算", level: 3 }).closest(".fee-calculation-editor");
    expect(wearOutEditorElement).not.toBeNull();
    const wearOutMedianSummary = within((wearOutEditorElement as HTMLElement).querySelector(".fee-calculation-editor__median-summary") as HTMLElement);
    expect(wearOutMedianSummary.getByText("¥7,158")).toBeInTheDocument();
  });
});
