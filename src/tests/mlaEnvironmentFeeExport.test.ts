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
      expect(rows.some((row) => row[1] === "附加费用" && row[3] === "Computer Fee")).toBe(true);
      expect(rows.some((row) => row[1] === "附加费用" && row[3] === "Report Fee")).toBe(true);
    }

    const sgsK1 = bodyRows(workbook, "SGS").find((row) => row[0] === "PV" && row[1] === "Group A" && row[3] === "K1 Low Temperature Exposure");
    const ctiK1 = bodyRows(workbook, "华测").find((row) => row[0] === "PV" && row[1] === "Group A" && row[3] === "K1 Low Temperature Exposure");
    const suboK1 = bodyRows(workbook, "苏勃").find((row) => row[0] === "PV" && row[1] === "Group A" && row[3] === "K1 Low Temperature Exposure");

    expect(sgsK1?.[9]).toBe(720);
    expect(ctiK1?.[9]).toBe(600);
    expect(suboK1?.[9]).toBe(960);

    expect(bodyRows(workbook, "SGS").find((row) => row[0] === "DV" && row[3] === "Computer Fee")?.[9]).toBe(12000);
    expect(bodyRows(workbook, "华测").find((row) => row[0] === "DV" && row[3] === "Computer Fee")?.[9]).toBe(21600);
    expect(bodyRows(workbook, "苏勃").find((row) => row[0] === "DV" && row[3] === "Computer Fee")?.[9]).toBe(7200);
    expect(bodyRows(workbook, "SGS").find((row) => row[0] === "DV" && row[3] === "Report Fee")?.[9]).toBe(0);
    expect(bodyRows(workbook, "华测").find((row) => row[0] === "DV" && row[3] === "Report Fee")?.[9]).toBe(0);
    expect(bodyRows(workbook, "苏勃").find((row) => row[0] === "DV" && row[3] === "Report Fee")?.[9]).toBe(1950);
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

    const additionalFees = comparison.find((row) => row[0] === "DV" && row[1] === "附加费用");
    expect(additionalFees?.slice(2, 8)).toEqual([12000, 21600, 9150, "苏勃", "华测", 12450]);
  });

  it("includes special project and additional fees in the forecast total sheet", () => {
    const workbook = buildMlaEnvironmentFeeWorkbook(createSeedAppState().environmentPlan);
    const forecastRows = bodyRows(workbook, "费用预估");
    const specialRows = bodyRows(workbook, "特殊项目费用");
    const sgsRows = bodyRows(workbook, "SGS");
    const comparisonRows = bodyRows(workbook, "费用对比");

    const pvGroupAK14 = forecastRows.find((row) => row[0] === "PV" && row[1] === "Group A" && row[3] === "K14 Dust Blowing Test");
    expect(pvGroupAK14?.slice(4, 12)).toEqual([
      "1-12",
      "4 批",
      "120 h",
      "按批次",
      "委外费用",
      "",
      12000,
      12000,
    ]);

    const pvGroupE1 = forecastRows.find((row) => row[0] === "PV" && row[1] === "Group E-1" && String(row[3]).includes("Restricted Substance"));
    expect(pvGroupE1?.slice(8, 12)).toEqual(["委外费用", "", 20000, 20000]);

    const pvGroupE2 = forecastRows.find((row) => row[0] === "PV" && row[1] === "Group E-2" && String(row[3]).includes("Operating Noise"));
    expect(pvGroupE2?.slice(8, 12)).toEqual(["委外费用", "", 42500, 42500]);

    const dvComputerFee = forecastRows.find((row) => row[0] === "DV" && row[1] === "附加费用" && row[3] === "Computer Fee");
    expect(dvComputerFee?.slice(4, 13)).toEqual([
      "",
      "48 月/台",
      "",
      "按电脑费用系数",
      "委外费用",
      "",
      12000,
      12000,
      "Computer Fee: SGS 250/月/台 × 48 = 12000；华测 450/月/台 × 48 = 21600；苏勃 150/月/台 × 48 = 7200；当前按 SGS 计入",
    ]);

    const dvReportFee = forecastRows.find((row) => row[0] === "DV" && row[1] === "附加费用" && row[3] === "Report Fee");
    expect(dvReportFee?.slice(4, 13)).toEqual([
      "",
      "13 份",
      "",
      "按报告份数",
      "委外费用",
      "",
      1950,
      1950,
      "Report Fee: SGS 0/份 × 13 = 0；华测 0/份 × 13 = 0；苏勃 150/份 × 13 = 1950；当前按苏勃计入",
    ]);

    expect(sgsRows.some((row) => String(row[3]).includes("K14"))).toBe(false);
    expect(sgsRows.some((row) => row[1] === "附加费用" && row[3] === "Computer Fee")).toBe(true);
    expect(sgsRows.some((row) => row[1] === "附加费用" && row[3] === "Report Fee")).toBe(true);
    expect(comparisonRows.some((row) => row[0] === "DV" && row[1] === "附加费用")).toBe(true);

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
