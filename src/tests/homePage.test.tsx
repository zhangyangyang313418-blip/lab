import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";

function getFlowItemSample(ariaLabel: string) {
  const input = screen.getByLabelText(ariaLabel);
  return input.closest(".flow-item")?.querySelector(".flow-item__sample")?.textContent?.trim();
}

function getFlowItemTime(ariaLabel: string) {
  return (screen.getByLabelText(ariaLabel) as HTMLInputElement).value;
}

function getFlowItemFee(ariaLabel: string) {
  return screen.getByLabelText(ariaLabel).closest(".flow-item")?.querySelector(".fee-display-button")?.textContent?.trim();
}

function countExactSampleBadges(text: string) {
  return Array.from(document.querySelectorAll(".d-mini"))
    .filter((node) => {
      const input = node.querySelector("input") as HTMLInputElement | null;
      const normalized = input ? `Samples:${input.value}` : (node.textContent ?? "").replace(/\s+/g, "");

      return normalized === text;
    }).length;
}

function countExactNormalizedText(selector: string, text: string) {
  return Array.from(document.querySelectorAll(selector))
    .filter((node) => (node.textContent ?? "").replace(/\s+/g, "") === text).length;
}

function clickUndoButton(user: ReturnType<typeof userEvent.setup>) {
  return user.click(screen.getAllByRole("button", { name: "撤回上一步" })[0]!);
}

describe("app bootstrap", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("starts a fully reused MLA new-project flow", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("项目代号"));
    await user.type(screen.getByLabelText("项目代号"), "L463");
    await user.click(screen.getByLabelText("MLA"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));

    expect(screen.getByRole("heading", { name: "项目输入", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("新增项目")).toBeInTheDocument();
    expect(screen.getByText("MLA")).toBeInTheDocument();
    expect(screen.getByText("驾驶方向")).toBeInTheDocument();
    expect(screen.queryByText("左右舵")).not.toBeInTheDocument();
    expect(screen.queryByText("已选变更项")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "选择变更项", level: 2 })).not.toBeInTheDocument();
    expect(screen.getByText("环境可靠性将使用 MLA 平台 LHD 完整大纲作为推荐基础。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "查看环境测试大纲" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "直接查看测试结果" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "直接查看推荐结果" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "添加测试项", level: 2 })).not.toBeInTheDocument();
  });

  it("requires at least one steering side before starting the flow", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("LHD"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));

    expect(screen.getByRole("heading", { name: "创建 HUD 评估项目", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("请至少选择一个驾驶方向配置。")).toBeInTheDocument();
  });

  it("allows selecting both LHD and RHD for one platform", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("RHD"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));

    expect(screen.getByRole("heading", { name: "项目输入", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("LHD / RHD")).toBeInTheDocument();
    expect(screen.getByText("环境可靠性将使用 MLA 平台 LHD / RHD 完整大纲作为推荐基础。")).toBeInTheDocument();
  });

  it("splits the environment outline by steering direction when both LHD and RHD are selected", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("EMA"));
    await user.click(screen.getByLabelText("RHD"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));
    await user.click(screen.getByRole("button", { name: "查看环境测试大纲" }));

    expect(screen.getAllByDisplayValue("L463 LHD").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("L463 RHD").length).toBeGreaterThan(0);
    expect(screen.queryAllByDisplayValue("L463 LHD / RHD")).toHaveLength(0);
    expect(screen.getAllByDisplayValue("K22 Chemical Resistance").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("Operating Noise & Transient Noise").length).toBeGreaterThan(0);
  });

  it("omits MLA RHD no-test groups from the environment outline", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("LHD"));
    await user.click(screen.getByLabelText("RHD"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));
    await user.click(screen.getByRole("button", { name: "查看环境测试大纲" }));

    expect(screen.getByRole("heading", { name: "环境测试大纲", level: 1 })).toBeInTheDocument();
    expect(screen.queryByDisplayValue("K22 Chemical Resistance")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("K21 Corrosive Gases")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("K27 85/85 High Temperature -High Humidity Endurance")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("E-1 Restricted Substance Management")).not.toBeInTheDocument();
    expect(screen.queryAllByDisplayValue("JLR-EMC-CS")).toHaveLength(0);
    expect(screen.queryByLabelText("dv-Group E-1-e1-emc-label")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("pv-Group E-1-e1-emc-label")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("dv-Group D-3-d3-optical-label")).not.toBeInTheDocument();
    expect(screen.getAllByDisplayValue("K23 Thermal Shock Endurance").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("K52.351 Condensing humidity").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("E-2 Operating Noise & Transient Noise").length).toBeGreaterThan(0);
  });

  it("omits EMA RHD no-test groups and shows operating noise under Group E-2", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("EMA"));
    await user.click(screen.getByLabelText("LHD"));
    await user.click(screen.getByLabelText("RHD"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));
    await user.click(screen.getByRole("button", { name: "查看环境测试大纲" }));

    expect(screen.getByRole("heading", { name: "环境测试大纲", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("L463 RHD").length).toBeGreaterThan(0);
    expect(screen.queryAllByDisplayValue("K22 Chemical Resistance")).toHaveLength(0);
    expect(screen.queryAllByDisplayValue("K18 Connector and lead/lock strength")).toHaveLength(0);
    expect(screen.queryAllByDisplayValue("K21 Corrosive Gases")).toHaveLength(0);
    expect(screen.queryAllByDisplayValue("K20 Solar Radiation")).toHaveLength(0);
    expect(screen.queryAllByDisplayValue("E-1 Restricted Substance Management")).toHaveLength(0);
    expect(screen.queryAllByDisplayValue("E-2 Noise test")).toHaveLength(0);
    expect(screen.queryByLabelText("dv-Group D-1-ed1-k21-label")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("dv-Group D-2-ed2-k20-label")).not.toBeInTheDocument();
    expect(screen.getAllByDisplayValue("K27 85/85 High Temperature -High Humidity Endurance").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("dv-Group E-1-ef2-item-label")).not.toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group E-2-ef2-item-label")).toHaveValue("Operating Noise & Transient Noise");
    expect(document.querySelectorAll(".branch-node")).toHaveLength(6);
  });

  it("shows baseline optical and L1&L4 only once per phase in the environment outline", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("项目代号"));
    await user.type(screen.getByLabelText("项目代号"), "L463");
    await user.click(screen.getByLabelText("MLA"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));
    await user.click(screen.getByRole("button", { name: "查看环境测试大纲" }));

    expect(screen.getByRole("heading", { name: "环境测试大纲", level: 1 })).toBeInTheDocument();
    expect(screen.getByDisplayValue("108")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("¥799,678.00").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("111").length).toBeGreaterThan(0);
    expect(screen.getAllByText("• 以上时间为测试时间，实际测试执行时，需考虑样品流转时间，会增加约 20d").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("68");
    expect(screen.getAllByText("PCBA 样品无需进行光学测试").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("DV Baseline L1&L4 样品")).toHaveValue("82");
    expect(
      Array.from(document.querySelectorAll(".banner .test-metric input"))
        .map((node) => (node as HTMLInputElement).value)
        .filter((value) => value === "7").length,
    ).toBeGreaterThan(0);
    expect(
      Array.from(document.querySelectorAll(".banner .test-metric input"))
        .map((node) => (node as HTMLInputElement).value)
        .filter((value) => value === "3").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("Optical Test").length).toBeGreaterThan(2);
    expect(screen.getAllByText((content) => content.includes("L1&L4 Performance")).length).toBeGreaterThan(1);
    const aParticle = screen.getByLabelText("dv-Group A-a-particle-label");
    const aK1 = screen.getByLabelText("dv-Group A-a-k1-label");
    const cK7 = screen.getByLabelText("dv-Group C-c-k7-label");
    const cParticle = screen.getByLabelText("dv-Group C-c-particle-label");
    const dPrimary = screen.getByLabelText("dv-Group D-1-d1-k21-label");
    const ePrimary = screen.getByLabelText("dv-Group E-1-e1-item-label");
    expect(aParticle.compareDocumentPosition(aK1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(cK7.compareDocumentPosition(cParticle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(getComputedStyle(dPrimary).fontSize).toBe(getComputedStyle(aK1).fontSize);
    expect(getComputedStyle(dPrimary).fontWeight).toBe(getComputedStyle(aK1).fontWeight);
    expect(getComputedStyle(ePrimary).fontSize).toBe(getComputedStyle(aK1).fontSize);
    expect(getComputedStyle(ePrimary).fontWeight).toBe(getComputedStyle(aK1).fontWeight);
    expect(screen.getAllByDisplayValue("Particle Exposure")).toHaveLength(4);
    expect(screen.getAllByDisplayValue("K1 Low Temperature Exposure").length).toBeGreaterThan(1);
    expect(getFlowItemSample("dv-Group A-a-particle-label")).toBe("1-12");
    expect(getFlowItemSample("dv-Group A-a-k1-label")).toBe("1-12");
    expect(getFlowItemSample("dv-Group A-a-k16-1-label")).toBe("1-14");
    expect(getFlowItemSample("dv-Group B-b-k22-label")).toBe("15-26");
    expect(getFlowItemSample("dv-Group C-c-k7-label")).toBe("27-32");
    expect(getFlowItemSample("dv-Group C-c-particle-label")).toBe("27-32");
    expect(screen.getByLabelText("dv-Group A-a-post-l1l4-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group A-a-post-optical-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group A-a-post-l6-label")).toHaveValue("L6-photo&xray");
    expect(getFlowItemTime("dv-Group A-a-post-l6-hours")).toBe("7");
    expect(screen.getByLabelText("dv-Group B-b-post-l1l4-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group B-b-post-optical-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group B-b-post-l6-label")).toHaveValue("L6-photo&xray");
    expect(getFlowItemTime("dv-Group B-b-post-l6-hours")).toBe("7");
    expect(screen.getByLabelText("dv-Group C-c-post-l1l4-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group C-c-post-optical-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group C-c-post-l6-label")).toHaveValue("L6-photo&xray");
    expect(getFlowItemTime("dv-Group C-c-post-l6-hours")).toBe("3");
    expect(screen.getAllByDisplayValue("K26 Mechanical Wear-Out")).toHaveLength(2);
    expect(getFlowItemTime("dv-Group A-a-particle-hours")).toBe("5");
    expect(getFlowItemTime("dv-Group A-a-k7-hours")).toBe("6");
    expect(getFlowItemTime("dv-Group C-c-particle-hours")).toBe("2");
    expect(getFlowItemTime("dv-Group A-a-k14-hours")).toBe("5");
    expect(getFlowItemTime("dv-Group C-c-k26-hours")).toBe("23");
    expect(getFlowItemTime("dv-Group D-1-d1-k21-hours")).toBe("16");
    expect(getFlowItemTime("dv-Group D-2-d2-k20-hours")).toBe("32");
    expect((screen.getByLabelText("dv-Group E-2-e2-item-hours") as HTMLInputElement).value).toBe("20");
    expect(screen.getByLabelText("dv-Group D-1-d1-k21-hours")).toHaveClass("flow-inline-input--duration");
    expect(screen.getByLabelText("dv-Group E-2-e2-item-hours")).toHaveClass("flow-inline-input--duration");
    expect(screen.getByLabelText("dv-Group D-1-d1-k21-hours").closest(".d-side")).toHaveClass("d-side--wide");
    expect(screen.getByLabelText("dv-Group E-2-e2-item-hours").closest(".d-side")).toHaveClass("d-side--wide");
    expect(screen.queryByDisplayValue("K26 Mechanical Wear-Out (Room)")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("K26 Mechanical Wear-Out (Cold)")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("K26 Mechanical Wear-Out (Hot)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("DV / Group A 样本量")).toHaveValue("14");
    expect(screen.getByLabelText("DV / Group B 样本量")).toHaveValue("12");
    expect(screen.getByLabelText("DV / Group C 样本量")).toHaveValue("6");
    expect(countExactSampleBadges("Samples:1-6")).toBe(0);
    expect(countExactSampleBadges("Samples:1")).toBeGreaterThan(0);
    expect(countExactSampleBadges("Samples:6")).toBeGreaterThan(1);
    expect(countExactSampleBadges("Samples:25")).toBeGreaterThan(0);
    expect(countExactNormalizedText(".section-title", "GroupDParallelTestsSamples:50")).toBeGreaterThan(0);
    expect(countExactNormalizedText(".section-title", "GroupEOtherTestsSamples:26")).toBeGreaterThan(0);
    const dSubgroupCode = document.querySelector(".d-card .d-group-code");
    const aGroupHead = document.querySelector(".group .head");
    expect(dSubgroupCode).not.toBeNull();
    expect(aGroupHead).not.toBeNull();
    expect(getComputedStyle(dSubgroupCode as Element).fontSize).toBe(getComputedStyle(aGroupHead as Element).fontSize);
    expect(getComputedStyle(dSubgroupCode as Element).fontWeight).toBe(getComputedStyle(aGroupHead as Element).fontWeight);
    expect(screen.getByLabelText("dv-Group D-1-d1-post-l1l4-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group D-1-d1-post-optical-label")).toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group D-1-d1-post-l6-label")).toHaveValue("L6-photo&xray");
    expect(getFlowItemTime("dv-Group D-1-d1-post-l6-hours")).toBe("3");
    expect(screen.getByLabelText("dv-Group D-3-d3-post-l1l4-label")).toBeInTheDocument();
    expect(screen.queryByLabelText("dv-Group D-3-d3-post-optical-label")).not.toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group D-3-d3-post-l6-internal-label")).toHaveValue("L6-photo&xray");
    expect(getFlowItemTime("dv-Group D-3-d3-post-l6-internal-hours")).toBe("3");
    expect(screen.getByLabelText("dv-Group D-3-d3-post-l6-external-label")).toHaveValue("L6-SEM&SECTION");
    expect((screen.getByLabelText("pv-Group D-8-d8-cold-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-d8-hot-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-d8-tst-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-d8-vibration-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-d8-mix-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-d8-post-l1l4-hours") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("pv-Group D-8-d8-post-optical-hours") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("pv-Group D-8-d8-post-l6-hours") as HTMLInputElement).value).toBe("3");
    expect(
      screen.getByLabelText("pv-Group D-8-d8-cold-label").closest(".d-card")?.querySelector(".subtotal")?.textContent?.replace(/\s+/g, ""),
    ).toContain("Subtotal14d");
    expect(screen.getByText("HALT 为开放实验，以上为预估时间")).toBeInTheDocument();
    expect(screen.queryAllByText("E-1 Restricted Substance Management").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryAllByText("E-2 Operating Noise & Transient Noise").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/Current basis:/i)).not.toBeInTheDocument();
    expect(document.querySelectorAll(".branch-node")).toHaveLength(8);
    expect(screen.getAllByText((content) => content.includes("Group E Other Tests")).length).toBeGreaterThan(1);
    expect(document.querySelectorAll(".d-card .subtotal").length).toBeGreaterThan(0);
  });

  it("shows change selectors and manual add sections for a non-fully-reused change project", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("变更项目"));
    await user.click(screen.getByLabelText("不完全复用"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));

    expect(screen.getByRole("heading", { name: "项目输入", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "选择变更项", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("环境可靠性将基于变更矩阵与平台基线联合推荐，并保留人工调整。")).toBeInTheDocument();
    expect(screen.getByText("EMC 变更项可在本页选择，系统会据此补充推荐测试。")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "添加测试项", level: 2 }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "查看环境测试大纲" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "直接查看推荐结果" })).toBeInTheDocument();
  });

  it("lets a non-fully-reused new project insert and delete environment items on the flow chart", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("项目代号"));
    await user.type(screen.getByLabelText("项目代号"), "L463");
    await user.click(screen.getByLabelText("MLA"));
    await user.click(screen.getByLabelText("不完全复用"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));

    expect(screen.queryByText("已选变更项")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "环境推荐清单", level: 2 })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "添加测试项", level: 2 })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "直接查看测试结果" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "直接查看推荐结果" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "查看环境测试大纲" }));

    expect(screen.getByRole("heading", { name: "环境测试大纲", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("不完全复用：可在流程图中插入或删除测试项目")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("DV Baseline Optical Test 名称"));
    await user.type(screen.getByLabelText("DV Baseline Optical Test 名称"), "Custom Optical Test");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("68");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveAttribute("readonly");
    await user.clear(screen.getByLabelText("DV / Group A 样本量"));
    await user.type(screen.getByLabelText("DV / Group A 样本量"), "20");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("74");
    expect(screen.getAllByDisplayValue("114").length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText("DV / Group D-1 样本量"));
    await user.type(screen.getByLabelText("DV / Group D-1 样本量"), "8");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("76");
    expect(screen.getAllByDisplayValue("116").length).toBeGreaterThan(0);
    await user.clear(screen.getByLabelText("DV Baseline Optical Test 时间"));
    await user.type(screen.getByLabelText("DV Baseline Optical Test 时间"), "9");

    expect(screen.getByLabelText("DV Baseline Optical Test 名称")).toHaveValue("Custom Optical Test");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("76");
    expect(screen.getByLabelText("DV Baseline Optical Test 时间")).toHaveValue("9");

    await user.click(screen.getByRole("button", { name: "在 DV / Baseline / Group A / Custom Optical Test 后插入测试项" }));

    expect(screen.getByLabelText("DV Baseline 新测试项 名称")).toHaveValue("新测试项");

    await user.click(screen.getByRole("button", { name: "删除 DV / Baseline / Group A / L1&L4 Performance Evaluation & Functional Evaluation" }));

    expect(screen.queryByLabelText("DV Baseline L1&L4 名称")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "在 DV / Group A / K1 Low Temperature Exposure 前插入测试项" }));

    expect(screen.getByLabelText("dv-Group A-manual-dv-Group A-a-k1-label")).toHaveValue("新测试项");
    expect(
      screen.getByLabelText("dv-Group A-manual-dv-Group A-a-k1-label").compareDocumentPosition(screen.getByLabelText("dv-Group A-a-k1-label")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "在 DV / Group A / K1 Low Temperature Exposure 后插入测试项" }));

    expect(screen.getByLabelText("dv-Group A-manual-dv-Group A-a-k1-2-label")).toHaveValue("新测试项");

    const insertedAfterK1 = screen.getByLabelText("dv-Group A-manual-dv-Group A-a-k1-2-label");
    await user.clear(insertedAfterK1);
    await user.type(insertedAfterK1, "K6 Power Thermal Cycle");

    expect(screen.getByLabelText("dv-Group A-manual-dv-Group A-a-k1-2-hours")).toHaveValue("11");
    expect(getFlowItemFee("dv-Group A-manual-dv-Group A-a-k1-2-label")).toBe("¥7,200.00");

    await user.click(screen.getByRole("button", { name: "删除 DV / Group A / K1 Low Temperature Exposure" }));

    expect(screen.queryByLabelText("dv-Group A-a-k1-label")).not.toBeInTheDocument();
    expect(screen.getByLabelText("dv-Group A-a-k2-label")).toBeInTheDocument();

    await clickUndoButton(user);

    expect(screen.getByLabelText("dv-Group A-a-k1-label")).toHaveValue("K1 Low Temperature Exposure");
  }, 10000);

  it("lets a non-fully-reused new project insert and delete whole environment groups", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("项目代号"));
    await user.type(screen.getByLabelText("项目代号"), "L463");
    await user.click(screen.getByLabelText("MLA"));
    await user.click(screen.getByLabelText("不完全复用"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));
    await user.click(screen.getByRole("button", { name: "查看环境测试大纲" }));

    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("68");

    await user.click(screen.getByRole("button", { name: "在 DV / Group A 右侧插入组" }));

    const sequenceGroupTitleInput = screen.getByLabelText("DV / Group 新增 1 组名称");
    await user.clear(sequenceGroupTitleInput);
    await user.type(sequenceGroupTitleInput, "Group X");
    expect(screen.getByLabelText("DV / Group X 组名称")).toHaveValue("Group X");
    expect(screen.getByLabelText("DV / Group X 样本量")).toHaveValue("1");
    expect(screen.getByLabelText("dv-Group X-manual-group-row-label")).toHaveValue("新测试项");
    const renamedSequenceGroupTitleInput = screen.getByLabelText("DV / Group X 组名称");
    await user.clear(renamedSequenceGroupTitleInput);
    await user.type(renamedSequenceGroupTitleInput, "Group 新增 1");
    expect(screen.getByLabelText("DV / Group 新增 1 样本量")).toHaveValue("1");
    expect(screen.getByLabelText("dv-Group 新增 1-manual-group-row-label")).toHaveValue("新测试项");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("69");

    await user.click(screen.getByRole("button", { name: "删除 DV / Group 新增 1 整组" }));

    expect(screen.queryByLabelText("DV / Group 新增 1 样本量")).not.toBeInTheDocument();
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("68");

    await clickUndoButton(user);

    expect(screen.getByLabelText("DV / Group 新增 1 样本量")).toHaveValue("1");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("69");

    await user.click(screen.getByRole("button", { name: "删除 DV / Group 新增 1 整组" }));

    expect(screen.queryByLabelText("DV / Group 新增 1 样本量")).not.toBeInTheDocument();
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("68");

    await user.click(screen.getByRole("button", { name: "在 DV / Group D-1 下方插入组" }));

    expect(screen.getByLabelText("DV / Group D-新增 1 样本量")).toHaveValue("1");
    expect(screen.getByLabelText("dv-Group D-新增 1-manual-group-row-label")).toHaveValue("新测试项");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("69");

    await user.click(screen.getByRole("button", { name: "删除 DV / Group D-新增 1 整组" }));

    expect(screen.queryByLabelText("DV / Group D-新增 1 样本量")).not.toBeInTheDocument();
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("68");

    await user.click(screen.getByRole("button", { name: "在 DV / Group E-1 下方插入组" }));

    expect(screen.getByLabelText("DV / Group E-新增 1 样本量")).toHaveValue("1");
    expect(screen.getByLabelText("dv-Group E-新增 1-manual-group-row-label")).toHaveValue("新测试项");
    expect(screen.getByLabelText("DV Baseline Optical Test 样品")).toHaveValue("68");
  });

  it("recommends impacted test items for a change project after selecting change points", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.click(screen.getByLabelText("变更项目"));
    await user.click(screen.getByLabelText("不完全复用"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));

    await user.click(screen.getByLabelText(/PCB\(A\) 材料变更/i));
    await user.click(screen.getByRole("button", { name: "直接查看推荐结果" }));
    await user.click(screen.getByRole("tab", { name: "EMC" }));

    expect(screen.getByRole("heading", { name: "测试结果", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("RE310")).toBeInTheDocument();
    expect(screen.getByText("CE420")).toBeInTheDocument();
    expect(screen.getByText("RI112")).toBeInTheDocument();
  });

  it("allows returning from the results page to the environment outline", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("项目代号"));
    await user.type(screen.getByLabelText("项目代号"), "L463");
    await user.click(screen.getByLabelText("MLA"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));
    await user.click(screen.getByRole("button", { name: "直接查看测试结果" }));

    expect(screen.getByRole("heading", { name: "测试结果", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "返回上一页" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回上一页" }));

    expect(screen.getByRole("heading", { name: "环境测试大纲", level: 1 })).toBeInTheDocument();
  });

  it("renders the EMA environment outline with MLA-style flow sections and EMA timings", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    await user.clear(screen.getByLabelText("项目代号"));
    await user.type(screen.getByLabelText("项目代号"), "L481");
    await user.click(screen.getByLabelText("EMA"));
    await user.click(screen.getByRole("button", { name: "开始评估" }));
    await user.click(screen.getByRole("button", { name: "查看环境测试大纲" }));

    expect(screen.getByRole("heading", { name: "环境测试大纲", level: 1 })).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("7").length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue("3").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("DV / Group A 样本量")).toHaveValue("14");
    expect(screen.getByLabelText("DV / Group B 样本量")).toHaveValue("12");
    expect(screen.getByLabelText("DV / Group C 样本量")).toHaveValue("6");
    expect(countExactNormalizedText(".section-title", "GroupDParallelTestsSamples:59")).toBeGreaterThan(0);
    expect(countExactNormalizedText(".section-title", "GroupEOtherTestsSamples:26")).toBeGreaterThan(0);
    expect(countExactSampleBadges("Samples:1")).toBeGreaterThan(0);
    expect(getFlowItemSample("dv-Group A-ea-k1-label")).toBe("1-12");
    expect(getFlowItemSample("dv-Group A-ea-k16-1-label")).toBe("1-14");
    expect(getFlowItemSample("dv-Group B-eb-k22-label")).toBe("15-26");
    expect(getFlowItemSample("dv-Group C-ec-k7-label")).toBe("27-32");
    expect(countExactSampleBadges("Samples:6")).toBeGreaterThan(1);
    expect((screen.getByLabelText("dv-Group A-ea-k7-hours") as HTMLInputElement).value).toBe("14");
    expect((screen.getByLabelText("dv-Group B-eb-k22-hours") as HTMLInputElement).value).toBe("5");
    expect((screen.getByLabelText("dv-Group C-ec-k26-hours") as HTMLInputElement).value).toBe("23");
    expect((screen.getByLabelText("dv-Group D-1-ed1-k21-hours") as HTMLInputElement).value).toBe("42");
    expect((screen.getByLabelText("dv-Group D-2-ed2-k20-hours") as HTMLInputElement).value).toBe("2");
    expect(screen.queryByLabelText("dv-Group D-8-ed8-cold-hours")).not.toBeInTheDocument();
    expect((screen.getByLabelText("pv-Group D-8-ed8-cold-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-ed8-hot-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-ed8-tst-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-ed8-vibration-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-ed8-mix-hours") as HTMLInputElement).value).toBe("8h");
    expect((screen.getByLabelText("pv-Group D-8-ed8-post-l1l4-hours") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("pv-Group D-8-ed8-post-optical-hours") as HTMLInputElement).value).toBe("3");
    expect((screen.getByLabelText("pv-Group D-8-ed8-post-l6-hours") as HTMLInputElement).value).toBe("3");
    expect(screen.getByLabelText("pv-Group D-8-ed8-post-l6-label")).toHaveValue("L6-photo&xray");
    expect((screen.getByLabelText("dv-Group E-2-ee2-item-hours") as HTMLInputElement).value).toBe("10");
    expect(screen.queryByLabelText("dv-Group D-9-d9-k52-label")).not.toBeInTheDocument();
  });
});
