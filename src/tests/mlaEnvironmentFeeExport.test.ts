import { describe, expect, it } from "vitest";
import { createSeedAppState } from "../store/appState";
import { buildMlaEnvironmentFeeWorkbook } from "../services/mlaEnvironmentFeeExport";

function sheetRows(workbook: ReturnType<typeof buildMlaEnvironmentFeeWorkbook>, name: string) {
  const sheet = workbook.sheets.find((item) => item.name === name);
  expect(sheet).toBeDefined();
  return sheet!.rows;
}

function bodyRows(workbook: ReturnType<typeof buildMlaEnvironmentFeeWorkbook>, name: string) {
  return sheetRows(workbook, name).slice(1);
}

describe("MLA environment fee workbook export", () => {
  it("builds the forecast sheet from DV and PV flow order with median fees split by ownership", () => {
    const workbook = buildMlaEnvironmentFeeWorkbook(createSeedAppState().environmentPlan);
    const forecast = bodyRows(workbook, "费用预估");

    expect(workbook.filename).toBe("MLA测试项目及费用预估.xls");
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["费用预估", "SGS", "华测", "苏勃", "费用对比", "特殊项目费用"]);
    expect(forecast[0]).toEqual([
      "DV",
      "Group A",
      "Optical",
      "Optical Test",
      "1-94",
      "94 个样品",
      "168 h",
      "按样品数量",
      "内部费用",
      21990,
      "",
      21990,
      "Optical Test: baseline 汇总，51 点位样品按组各取 1 台，其余按 19 点位计费",
    ]);
    expect(forecast[1]?.slice(0, 4)).toEqual(["DV", "Group A", "L1&L4", "L1&L4 Performance Evaluation & Functional Evaluation"]);

    const internalL6 = forecast.find((row) => row[0] === "PV" && row[1] === "Group D-3" && row[3] === "L6-photo&xray");
    expect(internalL6).toBeDefined();
    expect(internalL6?.[8]).toBe("内部费用");
    expect(internalL6?.[9]).toBe(3200);
    expect(internalL6?.[10]).toBe("");
    expect(internalL6?.[11]).toBe(3200);

    const externalL6 = forecast.find((row) => row[0] === "PV" && row[1] === "Group D-3" && row[3] === "L6-SEM&SECTION");
    expect(externalL6).toBeDefined();
    expect(externalL6?.[8]).toBe("委外费用");
    expect(externalL6?.[9]).toBe("");
    expect(externalL6?.[10]).toBe(21450);
    expect(externalL6?.[11]).toBe(21450);
  });

  it("keeps lab sheets to outsourced non-special rows and prices them by each lab", () => {
    const workbook = buildMlaEnvironmentFeeWorkbook(createSeedAppState().environmentPlan);

    for (const labName of ["SGS", "华测", "苏勃"]) {
      const rows = bodyRows(workbook, labName);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.some((row) => row[3] === "Optical Test")).toBe(false);
      expect(rows.some((row) => row[3] === "L6-photo&xray")).toBe(false);
      expect(rows.some((row) => String(row[3]).includes("K14"))).toBe(false);
      expect(rows.some((row) => String(row[3]).includes("Restricted Substance"))).toBe(false);
      expect(rows.some((row) => String(row[3]).includes("Operating Noise"))).toBe(false);
    }

    const sgsK1 = bodyRows(workbook, "SGS").find((row) => row[0] === "PV" && row[1] === "Group A" && row[3] === "K1 Low Temperature Exposure");
    const ctiK1 = bodyRows(workbook, "华测").find((row) => row[0] === "PV" && row[1] === "Group A" && row[3] === "K1 Low Temperature Exposure");
    const suboK1 = bodyRows(workbook, "苏勃").find((row) => row[0] === "PV" && row[1] === "Group A" && row[3] === "K1 Low Temperature Exposure");

    expect(sgsK1?.[9]).toBe(720);
    expect(ctiK1?.[9]).toBe(600);
    expect(suboK1?.[9]).toBe(960);
  });

  it("summarizes outsourced lab fees by phase and group in the comparison sheet", () => {
    const workbook = buildMlaEnvironmentFeeWorkbook(createSeedAppState().environmentPlan);
    const comparison = bodyRows(workbook, "费用对比");
    const groupA = comparison.find((row) => row[0] === "PV" && row[1] === "Group A");

    expect(groupA).toBeDefined();
    expect(groupA?.[2]).toBeGreaterThan(0);
    expect(groupA?.[3]).toBeGreaterThan(0);
    expect(groupA?.[4]).toBeGreaterThan(0);
    expect(["SGS", "华测", "苏勃"]).toContain(groupA?.[5]);
    expect(["SGS", "华测", "苏勃"]).toContain(groupA?.[6]);
    expect(groupA?.[7]).toBe(Math.max(Number(groupA?.[2]), Number(groupA?.[3]), Number(groupA?.[4])) - Math.min(Number(groupA?.[2]), Number(groupA?.[3]), Number(groupA?.[4])));
  });

  it("exports K14, E-1, and E-2 only in the special project sheet", () => {
    const workbook = buildMlaEnvironmentFeeWorkbook(createSeedAppState().environmentPlan);
    const specialRows = bodyRows(workbook, "特殊项目费用");

    expect(specialRows.length).toBeGreaterThan(0);
    expect(specialRows.every((row) =>
      String(row[3]).includes("K14")
      || String(row[3]).includes("Restricted Substance")
      || String(row[3]).includes("Operating Noise")
      || String(row[3]).includes("Transient Noise"),
    )).toBe(true);
    expect(specialRows.some((row) => row[0] === "PV" && row[1] === "Group A" && String(row[3]).includes("K14"))).toBe(true);
    expect(specialRows.some((row) => row[0] === "PV" && row[1] === "Group E-1" && String(row[3]).includes("Restricted Substance"))).toBe(true);
    expect(specialRows.some((row) => row[0] === "PV" && row[1] === "Group E-2" && String(row[3]).includes("Operating Noise"))).toBe(true);
  });
});
