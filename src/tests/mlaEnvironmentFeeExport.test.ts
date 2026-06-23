import { describe, expect, it } from "vitest";
import { createSeedAppState } from "../store/appState";
import { buildMlaEnvironmentFeeWorkbook } from "../services/mlaEnvironmentFeeExport";

function sheetRows(workbook: ReturnType<typeof buildMlaEnvironmentFeeWorkbook>, name: string) {
  const sheet = workbook.sheets.find((item) => item.name === name);
  expect(sheet).toBeDefined();
  return sheet!.rows;
}

function bodyRows(workbook: ReturnType<typeof buildMlaEnvironmentFeeWorkbook>, name: string) {
  return sheetRows(workbook, name).slice(7);
}

function dataRows(workbook: ReturnType<typeof buildMlaEnvironmentFeeWorkbook>, name: string) {
  return bodyRows(workbook, name).filter((row) => row[2] === "DV" || row[2] === "PV");
}

describe("MLA environment fee workbook export", () => {
  it("adds project metadata to the top of every sheet", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);

    for (const sheet of workbook.sheets) {
      expect(sheet.rows.slice(0, 6)).toEqual([
        ["项目概要", "", "", ""],
        ["OEM", "JLR", "平台", "MLA"],
        ["项目名称/编号", "L463", "驾驶方向", "LHD"],
        ["项目类型", "新增项目", "导出范围", "DV + PV"],
        ["是否完全复用", "是", "环境模板", "完全复用"],
        [],
      ]);
    }
  });

  it("builds the forecast sheet from DV and PV flow order with median fees split by ownership", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);
    const forecast = bodyRows(workbook, "费用预估");
    const forecastData = dataRows(workbook, "费用预估");

    expect(workbook.filename).toBe("MLA测试项目及费用预估.xls");
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["费用预估", "SGS", "华测", "苏勃", "费用对比", "特殊项目费用", "费用规则校验"]);
    expect(forecast.slice(0, 5)).toEqual([
      ["DV 组别顺序", "Group A -> Group B -> Group C -> Group D-1 -> Group D-2 -> Group D-3 -> Group D-4 -> Group D-5 -> Group D-6 -> Group D-7 -> Group D-9", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Phase: DV", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Group A：DV / Group A Sequence Tests", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["组别顺序", "组内顺序", "Phase", "Group", "测试编号", "测试项目", "样品范围", "计费基数", "测试时间", "计费方式", "费用归属", "内部费用", "委外费用", "费用合计", "费用计算公式", "备注"],
      [
      "Group A",
      1,
      "DV",
      "Group A Sequence Tests",
      "Optical",
      "Optical Test",
      "1-14",
      "14 个样品",
      "168 h",
      "按样品数量",
      "内部费用",
      784,
      "",
      784,
      "1台×51点位(¥134) + 13台×19点位(¥50) = 134 + 650 = 784",
      "Optical Test: 1 台按 51 点位，其余按 19 点位计费",
      ],
    ]);
    expect(forecastData[1]?.slice(0, 9)).toEqual([
      "Group A",
      2,
      "DV",
      "Group A Sequence Tests",
      "L1&L4",
      "L1&L4 Performance Evaluation & Functional Evaluation",
      "1-14",
      "14 个样品",
      "72 h",
    ]);

    const groupCOptical = forecastData.find((row) => row[2] === "PV" && row[3] === "Group C Sequence Tests" && row[5] === "Optical Test");
    expect(groupCOptical?.[6]).toBe("27-32");
    expect(groupCOptical?.[7]).toBe("6 个样品");
    expect(groupCOptical?.[13]).toBe(384);

    const groupD3L1L4Rows = forecastData.filter((row) => row[3] === "Group D Parallel Tests / D-3 PCBA" && row[5] === "L1&L4 Performance Evaluation & Functional Evaluation");
    expect(groupD3L1L4Rows).toHaveLength(4);
    for (const l1l4 of groupD3L1L4Rows) {
      expect(l1l4[6]).toBe("45-52");
      expect(l1l4[7]).toBe("8 个样品");
      expect(l1l4[9]).toBe("按样品数量");
      expect(l1l4[12]).toBe(3200);
      expect(l1l4[13]).toBe(3200);
    }

    const internalL6 = forecastData.find((row) => row[2] === "PV" && row[3] === "Group D Parallel Tests / D-3 PCBA" && row[5] === "L6-photo&xray");
    expect(internalL6).toBeDefined();
    expect(internalL6?.[10]).toBe("内部费用");
    expect(internalL6?.[11]).toBe(3200);
    expect(internalL6?.[12]).toBe("");
    expect(internalL6?.[13]).toBe(3200);

    const externalL6Rows = forecastData.filter((row) => row[3] === "Group D Parallel Tests / D-3 PCBA" && row[5] === "L6-SEM&SECTION");
    expect(externalL6Rows).toHaveLength(2);
    expect(externalL6Rows.map((row) => row[2]).sort()).toEqual(["DV", "PV"]);
    for (const externalL6 of externalL6Rows) {
      expect(externalL6[7]).toBe("33 个点位");
      expect(externalL6[9]).toBe("按点位");
      expect(externalL6[10]).toBe("委外费用");
      expect(externalL6[11]).toBe("");
      expect(externalL6[12]).toBe(21450);
      expect(externalL6[13]).toBe(21450);
    }

    const groupD8Rows = forecastData.filter((row) => row[2] === "PV" && row[3] === "Group D Parallel Tests / D-8");
    expect(groupD8Rows.find((row) => row[1] === 1 && row[5] === "Optical Test")?.slice(6, 14)).toEqual([
      "77-88",
      "12 个样品",
      "168 h",
      "按样品数量",
      "内部费用",
      600,
      "",
      600,
    ]);
    expect(groupD8Rows.find((row) => row[1] === 2 && row[5] === "L1&L4 Performance Evaluation & Functional Evaluation")?.slice(6, 14)).toEqual([
      "77-88",
      "12 个样品",
      "72 h",
      "按样品数量",
      "委外费用",
      "",
      4800,
      4800,
    ]);
    expect(groupD8Rows.find((row) => row[1] === 8 && row[5] === "L1&L4 Performance Evaluation & Functional Evaluation")?.slice(6, 14)).toEqual([
      "77-88",
      "9 个样品",
      "72 h",
      "按样品数量",
      "委外费用",
      "",
      3600,
      3600,
    ]);
    expect(groupD8Rows.find((row) => row[1] === 9 && row[5] === "Optical Test")?.slice(6, 14)).toEqual([
      "77-88",
      "9 个样品",
      "72 h",
      "按样品数量",
      "内部费用",
      450,
      "",
      450,
    ]);
    expect(groupD8Rows.find((row) => row[1] === 10 && row[5] === "L6-photo&xray")?.slice(6, 14)).toEqual([
      "77-88",
      "9 个样品",
      "72 h",
      "按样品数量",
      "内部费用",
      3600,
      "",
      3600,
    ]);
  });

  it("exports sample identifiers as continuous phase group ranges", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);
    const forecastRows = dataRows(workbook, "费用预估");
    const sgsRows = dataRows(workbook, "SGS");
    const specialRows = dataRows(workbook, "特殊项目费用");

    const pvGroupAOptical = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "Optical Test");
    const pvGroupAK1 = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "K1 Low Temperature Exposure");
    const pvGroupADrop = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "K16.1 Mechanical Shock Package Drop");
    const pvGroupAMidL1L4 = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "L1&L4 Performance Evaluation & Functional Evaluation" && row[6] === "1-12");
    const pvGroupAPostL1L4 = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "L1&L4 Performance Evaluation & Functional Evaluation" && row[6] === "1-14");
    const pvGroupAPostOptical = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "Optical Test" && row[6] === "1-14" && row[1] !== 1);
    const pvGroupAPostL6 = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "L6-photo&xray");
    const pvGroupAK14 = specialRows.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "K14 Dust Blowing Test");
    const pvGroupCOptical = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group C Sequence Tests" && row[5] === "Optical Test");
    const pvGroupD3L6 = forecastRows.find((row) => row[2] === "PV" && row[3] === "Group D Parallel Tests / D-3 PCBA" && row[5] === "L6-photo&xray");
    const pvGroupD8Halt = sgsRows.find((row) => row[2] === "PV" && row[3] === "Group D Parallel Tests / D-8" && row[5] === "K28 HALT Cold");
    const pvGroupD9Condensing = sgsRows.find((row) => row[2] === "PV" && row[3] === "Group D Parallel Tests / D-9" && row[5] === "K52.351 Condensing humidity");
    const pvGroupE1 = specialRows.find((row) => row[2] === "PV" && row[3] === "Group F Other Tests / Restricted Substance");
    const pvGroupE2 = specialRows.find((row) => row[2] === "PV" && row[3] === "Group F Other Tests / Noise test");

    expect(pvGroupAOptical?.[6]).toBe("1-14");
    expect(pvGroupAOptical?.[7]).toBe("14 个样品");
    expect(pvGroupAK1?.[6]).toBe("1-12");
    expect(pvGroupADrop?.[6]).toBe("1-14");
    expect(pvGroupAMidL1L4?.[7]).toBe("12 个样品");
    expect(pvGroupAMidL1L4?.[13]).toBe(4800);
    expect(pvGroupAPostL1L4?.[6]).toBe("1-14");
    expect(pvGroupAPostOptical?.[6]).toBe("1-14");
    expect(pvGroupAPostL6?.[6]).toBe("1-14");
    expect(pvGroupAK14?.[6]).toBe("1-12");
    expect(pvGroupCOptical?.[6]).toBe("27-32");
    expect(pvGroupCOptical?.[7]).toBe("6 个样品");
    expect(pvGroupD3L6?.[6]).toBe("45-52");
    expect(pvGroupD8Halt?.[6]).toBe("77-88");
    expect(pvGroupD9Condensing?.[6]).toBe("89-94");
    expect(pvGroupE1?.[6]).toBe("95");
    expect(pvGroupE2?.[6]).toBe("96-120");
  });

  it("omits optical rows from exported fee groups that only run K8 or K23", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);
    const forecastRows = dataRows(workbook, "费用预估");
    const k8AndK23Groups = [
      "Group D Parallel Tests / D-3 PCBA",
      "Group D Parallel Tests / D-4 Dewing Test",
    ];

    for (const groupName of k8AndK23Groups) {
      const groupRows = forecastRows.filter((row) => row[3] === groupName);

      expect(groupRows.some((row) => row[5] === "Optical Test")).toBe(false);
      expect(groupRows.some((row) => /K8|K23/.test(String(row[5])))).toBe(true);
    }
  });

  it("keeps lab sheets to outsourced non-special rows and prices them by each lab", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);

    for (const labName of ["SGS", "华测", "苏勃"]) {
      const rows = dataRows(workbook, labName);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => row[5] === "Optical Test")).toBe(false);
      expect(rows.some((row) => row[5] === "L6-photo&xray")).toBe(false);
      expect(rows.some((row) => String(row[5]).includes("K14"))).toBe(false);
      expect(rows.some((row) => String(row[5]).includes("Restricted Substance"))).toBe(false);
      expect(rows.some((row) => String(row[5]).includes("Operating Noise"))).toBe(false);
    }

    const sgsK1 = dataRows(workbook, "SGS").find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "K1 Low Temperature Exposure");
    const ctiK1 = dataRows(workbook, "华测").find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "K1 Low Temperature Exposure");
    const suboK1 = dataRows(workbook, "苏勃").find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && row[5] === "K1 Low Temperature Exposure");

    expect(sgsK1?.[11]).toBe(720);
    expect(ctiK1?.[11]).toBe(600);
    expect(suboK1?.[11]).toBe(960);
  });

  it("summarizes outsourced lab fees by phase and group in the comparison sheet", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);
    const comparison = dataRows(workbook, "费用对比");
    const groupA = comparison.find((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests");

    expect(groupA).toBeDefined();
    expect(groupA?.[0]).toBe("Group A");
    expect(groupA?.[4]).toBeGreaterThan(0);
    expect(groupA?.[5]).toBeGreaterThan(0);
    expect(groupA?.[6]).toBeGreaterThan(0);
    expect(["SGS", "华测", "苏勃"]).toContain(groupA?.[7]);
    expect(["SGS", "华测", "苏勃"]).toContain(groupA?.[8]);
    expect(groupA?.[9]).toBe(Math.max(Number(groupA?.[4]), Number(groupA?.[5]), Number(groupA?.[6])) - Math.min(Number(groupA?.[4]), Number(groupA?.[5]), Number(groupA?.[6])));
  });

  it("exports K14, E-1, E-2, and additional fees in the special project sheet", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);
    const specialRows = dataRows(workbook, "特殊项目费用");

    expect(specialRows.length).toBeGreaterThan(0);
    expect(specialRows.every((row) =>
      String(row[5]).includes("K14")
      || String(row[5]).includes("Restricted Substance")
      || String(row[5]).includes("Operating Noise")
      || String(row[5]).includes("Transient Noise")
      || row[5] === "Computer Fee"
      || row[5] === "Report Fee",
    )).toBe(true);
    expect(specialRows.some((row) => row[2] === "PV" && row[3] === "Group A Sequence Tests" && String(row[5]).includes("K14"))).toBe(true);
    expect(specialRows.some((row) => row[0] === "Group E-1" && row[3] === "Group F Other Tests / Restricted Substance" && String(row[5]).includes("Restricted Substance"))).toBe(true);
    expect(specialRows.some((row) => row[0] === "Group E-2" && row[3] === "Group F Other Tests / Noise test" && String(row[5]).includes("Operating Noise"))).toBe(true);
    expect(specialRows.some((row) => row[2] === "PV" && row[3] === "Group F Other Tests / Restricted Substance" && String(row[5]).includes("Restricted Substance"))).toBe(true);
    expect(specialRows.some((row) => row[2] === "PV" && row[3] === "Group F Other Tests / Noise test" && String(row[5]).includes("Operating Noise"))).toBe(true);
    expect(specialRows.some((row) => row[2] === "PV" && row[4] === "Computer Fee" && row[5] === "Computer Fee")).toBe(true);
    expect(specialRows.some((row) => row[2] === "PV" && row[4] === "Report Fee" && row[5] === "Report Fee")).toBe(true);
  });

  it("keeps fee calculation formula columns and validation sheet in the export model", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);

    expect(bodyRows(workbook, "费用预估").some((row) => row.includes("费用计算公式"))).toBe(true);
    expect(bodyRows(workbook, "SGS").some((row) => row.includes("费用计算公式"))).toBe(true);
    expect(bodyRows(workbook, "华测").some((row) => row.includes("费用计算公式"))).toBe(true);
    expect(bodyRows(workbook, "苏勃").some((row) => row.includes("费用计算公式"))).toBe(true);
    expect(bodyRows(workbook, "特殊项目费用").some((row) => row.includes("费用计算公式"))).toBe(true);

    const validationRows = bodyRows(workbook, "费用规则校验");
    expect(validationRows[0]).toEqual(["实验室", "Excel行号", "Phase", "Group", "测试编号", "测试项目", "样品范围", "计费基数", "当前费用", "规则费用", "差异", "校验结果", "规则/公式说明"]);
    expect(validationRows.some((row) => row[4] === "Computer Fee" && row[11] === "一致")).toBe(true);
    expect(validationRows.some((row) => row[4] === "Report Fee" && row[11] === "一致")).toBe(true);
  });

  it("exports computer and report fees in the forecast and special fee sheets", () => {
    const state = createSeedAppState();
    const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);
    const forecastRows = dataRows(workbook, "费用预估");
    const specialRows = dataRows(workbook, "特殊项目费用");

    const dvComputer = forecastRows.find((row) => row[2] === "DV" && row[4] === "Computer Fee");
    const dvReport = forecastRows.find((row) => row[2] === "DV" && row[4] === "Report Fee");
    const pvComputer = forecastRows.find((row) => row[2] === "PV" && row[4] === "Computer Fee");
    const pvReport = forecastRows.find((row) => row[2] === "PV" && row[4] === "Report Fee");

    expect(dvComputer?.slice(0, 15)).toEqual([
      "Additional Fee",
      1,
      "DV",
      "费用汇总附加费用",
      "Computer Fee",
      "Computer Fee",
      "",
      "48 月/台系数",
      "",
      "按系数",
      "委外费用",
      "",
      12000,
      12000,
      "SGS 250/月/台 × 48 = 12,000",
    ]);
    expect(dvReport?.slice(0, 15)).toEqual([
      "Additional Fee",
      2,
      "DV",
      "费用汇总附加费用",
      "Report Fee",
      "Report Fee",
      "",
      "13 份报告",
      "",
      "按报告份数",
      "委外费用",
      "",
      1950,
      1950,
      "苏勃 150/份 × 13 份 = 1,950",
    ]);
    expect(pvComputer?.[12]).toBe(12000);
    expect(pvReport?.[12]).toBe(2100);

    expect(specialRows.some((row) => row[2] === "DV" && row[4] === "Computer Fee" && row[9] === 12000)).toBe(true);
    expect(specialRows.some((row) => row[2] === "DV" && row[4] === "Report Fee" && row[9] === 1950)).toBe(true);
    expect(specialRows.some((row) => row[2] === "PV" && row[4] === "Computer Fee" && row[9] === 12000)).toBe(true);
    expect(specialRows.some((row) => row[2] === "PV" && row[4] === "Report Fee" && row[9] === 2100)).toBe(true);
  });
});
