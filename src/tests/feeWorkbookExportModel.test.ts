import { describe, expect, it } from "vitest";
import {
  buildFeeWorkbookExportRecords,
  feeWorkbookSheetSchemas,
} from "../services/feeWorkbookExportModel";
import type { EnvironmentPlanSheet } from "../types/environmentPlan";

function planWithRows(rows: EnvironmentPlanSheet["phases"][number]["groups"][number]["rows"]): EnvironmentPlanSheet {
  return {
    platform: "MLA",
    phases: [{
      id: "dv",
      title: "DV",
      summary: {
        projectLabel: "项目",
        projectCode: "L463",
        phaseLabel: "阶段",
        phaseValue: "DV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "12",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "10",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [{
        id: "mla-group-a",
        title: "Group A",
        totalSampleLabel: "Total样机数量",
        totalSampleQty: "12",
        totalDurationLabel: "组测试时间(天)",
        totalDurationDays: "10",
        totalCostLabel: "组费用",
        totalCost: "",
        rows,
      }],
    }],
  };
}

describe("fee workbook export model", () => {
  it("keeps unknown manual rows pending without inventing an amount", () => {
    const records = buildFeeWorkbookExportRecords(planWithRows([{
      id: "manual-dv-Group A-a-k1",
      label: "新测试项",
      testHours: "1",
    }]));

    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      phaseKey: "dv",
      groupKey: "mla-group-a",
      rowKey: "manual-dv-Group A-a-k1",
      sourceKey: "dv/mla-group-a/manual-dv-Group A-a-k1",
      ruleKey: null,
      rowKind: "outline",
      ordinal: 1,
      fields: {
        status: "待确认",
        estimatedFee: null,
      },
    });
  });

  it("does not merge rows that have the same label", () => {
    const records = buildFeeWorkbookExportRecords(planWithRows([
      { id: "manual-row-1", label: "同名测试", testHours: "1" },
      { id: "manual-row-2", label: "同名测试", testHours: "2" },
    ]));

    expect(records.map((record) => record.sourceKey)).toEqual([
      "dv/mla-group-a/manual-row-1",
      "dv/mla-group-a/manual-row-2",
    ]);
    expect(new Set(records.map((record) => record.sourceKey)).size).toBe(2);
  });

  it("keeps business keys stable when display labels are renamed", () => {
    const original = buildFeeWorkbookExportRecords(planWithRows([
      { id: "a-k1", label: "K1 Low Temperature Exposure", testHours: "2", fee: "720" },
    ]))[0]!;
    const renamed = buildFeeWorkbookExportRecords(planWithRows([
      { id: "a-k1", label: "用户改名后的低温测试", testHours: "2", fee: "720" },
    ]))[0]!;

    expect(renamed.sourceKey).toBe(original.sourceKey);
    expect(renamed.ruleKey).toBe(original.ruleKey);
    expect(renamed.fields.testName).not.toBe(original.fields.testName);
  });

  it("changes only ordinal when outline rows are reordered", () => {
    const firstPlan = planWithRows([
      { id: "a-k1", label: "K1 Low Temperature Exposure", testHours: "2" },
      { id: "a-k2", label: "K2 High Temperature Exposure", testHours: "2" },
    ]);
    const reorderedPlan = planWithRows([
      { id: "a-k2", label: "K2 High Temperature Exposure", testHours: "2" },
      { id: "a-k1", label: "K1 Low Temperature Exposure", testHours: "2" },
    ]);
    const before = new Map(buildFeeWorkbookExportRecords(firstPlan).map((record) => [record.sourceKey, record]));
    const after = new Map(buildFeeWorkbookExportRecords(reorderedPlan).map((record) => [record.sourceKey, record]));

    expect(after.get("dv/mla-group-a/a-k1")?.ruleKey).toBe(before.get("dv/mla-group-a/a-k1")?.ruleKey);
    expect(after.get("dv/mla-group-a/a-k1")?.ordinal).toBe(2);
    expect(after.get("dv/mla-group-a/a-k2")?.ordinal).toBe(1);
  });

  it("assigns a stable rule key to known seed rows", () => {
    const [record] = buildFeeWorkbookExportRecords(planWithRows([
      { id: "a-k15", label: "K15 Vibration", testHours: "7" },
    ]));

    expect(record?.ruleKey).toBe("seed:a-k15");
  });

  it("declares named business columns for every workbook region", () => {
    expect(feeWorkbookSheetSchemas.forecast.businessColumns).toEqual([
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P",
    ]);
    expect(feeWorkbookSheetSchemas.sgs.businessColumns).toEqual([
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N",
    ]);
    expect(feeWorkbookSheetSchemas.comparison.businessColumns).toEqual([
      "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
    ]);
    expect(feeWorkbookSheetSchemas.special.businessColumns.at(-1)).toBe("M");
    expect(feeWorkbookSheetSchemas.validation.businessColumns.at(-1)).toBe("M");
    expect(feeWorkbookSheetSchemas.sampleDemandDv.businessColumns).toEqual(
      expect.arrayContaining(["A", "V"]),
    );
    expect(feeWorkbookSheetSchemas.sampleDemandPv.businessColumns).toEqual(
      expect.arrayContaining(["X", "AS"]),
    );

    expect(feeWorkbookSheetSchemas.forecast.businessColumns).not.toEqual(
      expect.arrayContaining(["Q", "R", "S", "T", "U", "V", "W"]),
    );
    expect(feeWorkbookSheetSchemas.sgs.businessColumns).not.toEqual(
      expect.arrayContaining(["P", "Q", "R"]),
    );

    for (const schema of Object.values(feeWorkbookSheetSchemas)) {
      expect(Object.keys(schema.columnsByField).length).toBe(schema.businessColumns.length);
      expect(new Set(Object.values(schema.columnsByField))).toEqual(new Set(schema.businessColumns));
    }
  });
});
