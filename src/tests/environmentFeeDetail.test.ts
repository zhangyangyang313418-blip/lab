import { describe, expect, it } from "vitest";
import {
  applyEnvironmentFeeDetailsToPhase,
  calculateFeeAmount,
  calculateLabMedianUnitPrice,
  createEnvironmentFeeDetailSections,
  getEnvironmentAdditionalFeeSummary,
} from "../services/environmentFeeDetail";
import type { EnvironmentPlanPhase } from "../types/environmentPlan";

describe("environment fee detail calculations", () => {
  it("ignores N/A prices and uses the middle value when three labs quote", () => {
    expect(calculateLabMedianUnitPrice([1750, 6500, 4333, "N/A"])).toBe(4333);
  });

  it("uses the lower valid price when two labs quote", () => {
    expect(calculateLabMedianUnitPrice([1200, "N/A", 900, ""])).toBe(900);
  });

  it("returns null when no lab has a valid numeric quote", () => {
    expect(calculateLabMedianUnitPrice(["N/A", "", undefined])).toBeNull();
  });

  it("calculates fees using hour, quantity, and batch bases", () => {
    expect(calculateFeeAmount(40, "hour", { testHours: 24, quantity: 12, batchCount: 2 })).toBe(960);
    expect(calculateFeeAmount(4333, "quantity", { testHours: 24, quantity: 12, batchCount: 2 })).toBe(51996);
    expect(calculateFeeAmount(5000, "batch", { testHours: 24, quantity: 12, batchCount: 2 })).toBe(10000);
  });

  it("adds computer and report fees to the calculated phase total", () => {
    const phase: EnvironmentPlanPhase = {
      id: "dv",
      title: "DV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "DV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "18",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
        computerFeeCoefficient: "50",
        reportFeeCount: "4",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "a-k1", label: "K1 Low Temperature Exposure", testHours: "2", sampleRange: "1-12" }],
        },
        {
          id: "mla-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "56",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "c-k13", label: "K13 Dust Ingress", testHours: "2", sampleRange: "13-18" }],
        },
      ],
    };

    const additionalFees = getEnvironmentAdditionalFeeSummary(phase);
    const applied = applyEnvironmentFeeDetailsToPhase(phase);

    expect(additionalFees.computerFee).toBe(12500);
    expect(additionalFees.computerLabQuotes.map((quote) => [quote.lab, quote.fee])).toEqual([
      ["SGS", 12500],
      ["华测", 22500],
      ["苏劢", 7500],
    ]);
    expect(additionalFees.reportFee).toBe(600);
    expect(additionalFees.reportLabQuotes.map((quote) => [quote.lab, quote.fee])).toEqual([
      ["SGS", 0],
      ["华测", 0],
      ["苏劢", 600],
    ]);
    expect(applied.groups.find((group) => group.id === "mla-group-a")?.totalCost).toBe("720");
    expect(applied.groups.find((group) => group.id === "mla-group-c")?.totalCost).toBe("3000");
    expect(applied.summary.computerFee).toBe("12500");
    expect(applied.summary.reportFee).toBe("600");
    expect(applied.summary.totalCost).toBe("16820");
  });

  it("uses the Excel-confirmed three-lab MLA medians without Xince quotes", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "12",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "14",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "14",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-k6", label: "K6 Power Thermal Cycle", testHours: "1", sampleRange: "1-12" },
            { id: "a-k17", label: "K17 Audible Noise", testHours: "1", sampleRange: "1-12" },
          ],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);

    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k6")?.medianUnitPrice).toBe(30);
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k6")?.estimatedItemFee).toBe(7200);
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k17")?.medianUnitPrice).toBe(10000);
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k17")?.estimatedItemFee).toBe(120000);
  });

  it("uses approved component fee composition for K17, K18, K22, and K26", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "26",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "a-k17", label: "K17 Audible Noise", testHours: "1", sampleRange: "1-12" }],
        },
        {
          id: "mla-group-b",
          title: "Group B",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "21",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "b-k22", label: "K22 Chemical Resistance", testHours: "5", sampleRange: "15-26" },
            { id: "b-k18", label: "K18 Connector and lead/lock strength", testHours: "7", sampleRange: "15-26" },
          ],
        },
        {
          id: "mla-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "56",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "c-k26", label: "K26 Mechanical Wear-Out", testHours: "23", sampleRange: "27-32" }],
        },
      ],
    };

    const [groupA, groupB, groupC] = createEnvironmentFeeDetailSections(phase);
    const k17 = groupA?.rows.find((row) => row.outlineRowId === "a-k17");
    const k22 = groupB?.rows.find((row) => row.outlineRowId === "b-k22");
    const k18 = groupB?.rows.find((row) => row.outlineRowId === "b-k18");
    const k26 = groupC?.rows.find((row) => row.outlineRowId === "c-k26");

    expect(k17?.estimatedItemFee).toBe(120000);
    expect(k17?.notes).toContain("三个方向");
    expect(k17?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(144000);
    expect(k17?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(120000);
    expect(k17?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(36000);
    expect(k17?.labs.find((lab) => lab.lab === "信测")).toBeUndefined();

    expect(k22?.testHours).toBe(72);
    expect(k22?.quantity).toBe(15);
    expect(k22?.estimatedItemFee).toBe(11190);
    expect(k22?.notes).toContain("15 种试剂");
    expect(k22?.notes).toContain("试剂数量 × 各实验室试剂单价 + 测试时间 × 时间单价");
    expect(k22?.labs.find((lab) => lab.lab === "SGS")?.unitPrice).toBe(20);
    expect(k22?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(11190);
    expect(k22?.labs.find((lab) => lab.lab === "华测")?.unitPrice).toBe(25);
    expect(k22?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(12300);
    expect(k22?.labs.find((lab) => lab.lab === "苏劢")?.unitPrice).toBe(30);
    expect(k22?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(6660);
    expect(k22?.labs.find((lab) => lab.lab === "信测")).toBeUndefined();

    expect(k18?.estimatedItemFee).toBe(19000);
    expect(k18?.notes).toBe("K18.1-K18.4 四项 × 12 台样机 × 单价 + K18.1 微应力费用");
    expect(k18?.notes).not.toContain("信测");
    expect(k18?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(19000);
    expect(k18?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(27500);
    expect(k18?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(9500);
    expect(k18?.labs.find((lab) => lab.lab === "信测")).toBeUndefined();

    expect(k26?.testHours).toBe(500);
    expect(k26?.estimatedItemFee).toBe(7158);
    expect(k26?.notes).toContain("334h 常温 + 83h 低温 + 83h 高温");
    expect(k26?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(7158);
    expect(k26?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(6488);
    expect(k26?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(11660);
    expect(k26?.labs.find((lab) => lab.lab === "信测")).toBeUndefined();
  });

  it("applies EMA-specific fee rules from the returned EMA workbook", () => {
    const phase: EnvironmentPlanPhase = {
      id: "dv",
      title: "DV",
      summary: {
        projectLabel: "项目",
        projectCode: "L481",
        phaseLabel: "阶段",
        phaseValue: "DV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "65",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "104",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "ema-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "94",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "ea-k17", label: "K17 Audible Noise", testHours: "10", sampleRange: "1-12" },
            { id: "ea-k7", label: "K7 Thermal Shock in Air", testHours: "14", sampleRange: "1-12" },
            { id: "ea-k14", label: "K14 Dust Blowing Test", testHours: "5", sampleRange: "1-12" },
          ],
        },
        {
          id: "ema-group-b",
          title: "Group B",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "21",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "eb-k22", label: "K22 Chemical Resistance", testHours: "5", sampleRange: "15-26" }],
        },
        {
          id: "ema-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "49",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "ec-k7", label: "K7 Thermal Shock in Air", testHours: "14", sampleRange: "27-32" },
            { id: "ec-k26", label: "K26 Mechanical Wear-Out", testHours: "23", sampleRange: "27-32" },
            { id: "ec-particle", label: "Particle Exposure", testHours: "2", sampleRange: "27-32" },
          ],
        },
        {
          id: "ema-group-d1",
          title: "Group D-1",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "48",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ed1-k21", label: "K21 Corrosive Gases", testHours: "42", sampleRange: "33-38" }],
        },
        {
          id: "ema-group-d2",
          title: "Group D-2",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "8",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ed2-k20", label: "K20 Solar Radiation", testHours: "2", sampleRange: "39-44" }],
        },
        {
          id: "ema-group-d9",
          title: "Group D-9",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "13",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ed9-k52", label: "K52.351 Condensing humidity", testHours: "7", sampleRange: "77-82" }],
        },
        {
          id: "ema-group-e2",
          title: "Group E-2",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "25",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "10",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ee2-item", label: "E-2 Noise test", testHours: "10", sampleRange: "83-107" }],
        },
      ],
    };

    const [groupA, groupB, groupC, groupD1, groupD2, groupD9, groupE2] = createEnvironmentFeeDetailSections(phase);
    const k7 = groupA?.rows.find((row) => row.outlineRowId === "ea-k7");
    const k14 = groupA?.rows.find((row) => row.outlineRowId === "ea-k14");
    const k17 = groupA?.rows.find((row) => row.outlineRowId === "ea-k17");
    const k22 = groupB?.rows.find((row) => row.outlineRowId === "eb-k22");
    const groupCK7 = groupC?.rows.find((row) => row.outlineRowId === "ec-k7");
    const particle = groupC?.rows.find((row) => row.outlineRowId === "ec-particle");
    const k21 = groupD1?.rows.find((row) => row.outlineRowId === "ed1-k21");
    const k20 = groupD2?.rows.find((row) => row.outlineRowId === "ed2-k20");
    const k52 = groupD9?.rows.find((row) => row.outlineRowId === "ed9-k52");

    expect(k7?.testHours).toBe(305);
    expect(k7?.estimatedItemFee).toBe(30500);
    expect(groupCK7?.testHours).toBe(305);
    expect(groupCK7?.estimatedItemFee).toBe(30500);
    expect(k17?.estimatedItemFee).toBe(39996);
    expect(k17?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(48000);
    expect(k17?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(39996);
    expect(k17?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(12000);
    expect(k22?.chargeBasis).toBe("quantity");
    expect(k22?.quantity).toBe(11);
    expect(k22?.estimatedItemFee).toBe(7150);
    expect(k22?.notes).toContain("EMA 条件 2");
    expect(k22?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(7150);
    expect(k22?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(7700);
    expect(k22?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(3300);
    expect(k20?.testHours).toBe(24);
    expect(k20?.estimatedItemFee).toBe(3480);
    expect(k21?.testHours).toBe(1000);
    expect(k21?.estimatedItemFee).toBe(120000);
    expect(k21?.labs.find((lab) => lab.lab === "SGS")?.unitPrice).toBe(100);
    expect(k21?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(100000);
    expect(k14?.status).toBe("未匹配大纲");
    expect(k14?.estimatedItemFee).toBeNull();
    expect(particle?.status).toBe("未匹配大纲");
    expect(particle?.estimatedItemFee).toBeNull();
    expect(k52?.status).toBe("未匹配大纲");
    expect(k52?.estimatedItemFee).toBeNull();
    expect(groupC?.rows.find((row) => row.outlineRowId === "ec-k26")?.estimatedItemFee).toBe(7158);
    expect(groupE2?.rows.find((row) => row.outlineRowId === "ee2-item")?.estimatedItemFee).toBe(42500);
  });

  it("applies shared optical and E-2 fee rules to EMA rows", () => {
    const phase: EnvironmentPlanPhase = {
      id: "dv-rhd",
      title: "DV",
      summary: {
        projectLabel: "项目",
        projectCode: "L481 RHD",
        phaseLabel: "阶段",
        phaseValue: "DV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "65",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "104",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "ema-rhd-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "94",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ea-optical", label: "Optical Test", testHours: "7", sampleRange: "1-12" }],
        },
        {
          id: "ema-rhd-group-f2",
          title: "Group E-2",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "25",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "10",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ef2-item", label: "Operating Noise & Transient Noise", testHours: "10", sampleRange: "39-63" }],
        },
      ],
    };

    const [groupA, groupE2] = createEnvironmentFeeDetailSections(phase);
    const optical = groupA?.rows.find((row) => row.outlineRowId === "ea-optical");
    const noise = groupE2?.rows.find((row) => row.outlineRowId === "ef2-item");

    expect(optical?.estimatedItemFee).toBe(684);
    expect(optical?.notes).toContain("Optical Test");
    expect(optical?.notes).toContain("1 台按 51 点位");
    expect(optical?.notes).not.toContain("baseline 汇总");
    expect(noise?.estimatedItemFee).toBe(42500);
    expect(noise?.medianUnitPrice).toBe(1700);
    expect(noise?.hideUnavailableLabQuotes).toBe(true);
    expect(noise?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(42500);
  });

  it("uses the L460-L coefficient-table hours instead of the displayed flow-chart days for K1 fees", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "12",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "a-k1", label: "K1 Low Temperature Exposure", testHours: "2", sampleRange: "1-12" }],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);
    const k1 = groupA?.rows[0];

    expect(k1?.testHours).toBe(24);
    expect(k1?.estimatedItemFee).toBe(720);
  });

  it("lets user-entered fee basis values override locked coefficient defaults without changing charge rules", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "12",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            {
              id: "a-k1",
              label: "K1 Low Temperature Exposure",
              testHours: "2",
              sampleRange: "1-12",
              feeBasisOverrides: { hour: "48" },
            },
            {
              id: "a-k13",
              label: "K13 Dust Ingress",
              testHours: "5",
              sampleRange: "1-12",
              feeBasisOverrides: { batch: "5" },
            },
          ],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);
    const k1 = groupA?.rows.find((row) => row.outlineRowId === "a-k1");
    const k13 = groupA?.rows.find((row) => row.outlineRowId === "a-k13");

    expect(k1?.chargeBasis).toBe("hour");
    expect(k1?.testHours).toBe(48);
    expect(k1?.medianUnitPrice).toBe(30);
    expect(k1?.estimatedItemFee).toBe(1440);

    expect(k13?.chargeBasis).toBe("batch");
    expect(k13?.batchCount).toBe(5);
    expect(k13?.medianUnitPrice).toBe(1500);
    expect(k13?.estimatedItemFee).toBe(7500);
  });

  it("uses small chamber prices when sample quantity is six or below", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "6",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "a-k1-small", label: "K1 Low Temperature Exposure", testHours: "2", sampleRange: "1-6" }],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);
    const k1 = groupA?.rows[0];

    expect(k1?.quantity).toBe(6);
    expect(k1?.medianUnitPrice).toBe(23);
    expect(k1?.estimatedItemFee).toBe(552);
  });

  it("calculates K15 vibration basis from sample quantity and 6-sample fixture capacity", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "18",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-k15-12", label: "K15 Vibration", testHours: "7", sampleRange: "1-12" },
            { id: "a-k15-6", label: "K15 Vibration", testHours: "7", sampleRange: "1-6" },
          ],
        },
        {
          id: "mla-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "56",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "c-k15", label: "K15 Vibartion", testHours: "4", sampleRange: "13-18" }],
        },
      ],
    };

    const sections = createEnvironmentFeeDetailSections(phase);
    const groupAK15For12Samples = sections.find((section) => section.groupTitle === "Group A")?.rows[0];
    const groupAK15For6Samples = sections.find((section) => section.groupTitle === "Group A")?.rows[1];
    const groupCK15 = sections.find((section) => section.groupTitle === "Group C")?.rows[0];

    expect(groupAK15For12Samples?.testHours).toBe(48);
    expect(groupAK15For12Samples?.estimatedItemFee).toBe(24000);
    expect(groupAK15For6Samples?.testHours).toBe(24);
    expect(groupAK15For6Samples?.estimatedItemFee).toBe(12000);
    expect(groupCK15?.testHours).toBe(24);
    expect(groupCK15?.estimatedItemFee).toBe(12000);
  });

  it("calculates K13 dust-ingress batches from sample quantity and 3-sample fixture capacity", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "18",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-k13-12", label: "K13 Dust Ingress", testHours: "5", sampleRange: "1-12" },
            { id: "a-k13-6", label: "K13 Dust Ingress", testHours: "5", sampleRange: "1-6" },
          ],
        },
        {
          id: "mla-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "56",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "c-k13", label: "K13 Dust Ingress", testHours: "2", sampleRange: "13-18" }],
        },
      ],
    };

    const sections = createEnvironmentFeeDetailSections(phase);
    const groupAK13For12Samples = sections.find((section) => section.groupTitle === "Group A")?.rows[0];
    const groupAK13For6Samples = sections.find((section) => section.groupTitle === "Group A")?.rows[1];
    const groupCK13 = sections.find((section) => section.groupTitle === "Group C")?.rows[0];

    expect(groupAK13For12Samples?.batchCount).toBe(4);
    expect(groupAK13For12Samples?.medianUnitPrice).toBe(1500);
    expect(groupAK13For12Samples?.estimatedItemFee).toBe(6000);
    expect(groupAK13For12Samples?.labs.find((lab) => lab.lab === "SGS")?.unitPrice).toBe(1500);
    expect(groupAK13For12Samples?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(6000);
    expect(groupAK13For12Samples?.labs.find((lab) => lab.lab === "华测")?.unitPrice).toBe(1500);
    expect(groupAK13For12Samples?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(6000);
    expect(groupAK13For12Samples?.labs.find((lab) => lab.lab === "苏劢")?.unitPrice).toBe(1800);
    expect(groupAK13For12Samples?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(7200);
    expect(groupAK13For12Samples?.labs.map((lab) => lab.lab)).toEqual(["SGS", "华测", "苏劢"]);
    expect(groupAK13For6Samples?.batchCount).toBe(2);
    expect(groupAK13For6Samples?.estimatedItemFee).toBe(3000);
    expect(groupCK13?.batchCount).toBe(2);
    expect(groupCK13?.estimatedItemFee).toBe(3000);
  });

  it("marks pending special rows as unpriced and keeps them out of fee totals", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "14",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-particle", label: "Particle Exposure", testHours: "5", sampleRange: "1-12" },
            { id: "a-k1", label: "K1 Low Temperature Exposure", testHours: "2", sampleRange: "1-12" },
          ],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);

    expect(groupA?.rows.find((row) => row.outlineRowId === "a-particle")?.status).toBe("priced");
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-particle")?.estimatedItemFee).toBe(24000);
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k1")?.estimatedItemFee).toBe(720);
  });

  it("uses particle-exposure lab total medians and reduces C group to batch-only when A exists in the same phase", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "20",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "a-particle", label: "Particle Exposure", testHours: "5", sampleRange: "1-12" }],
        },
        {
          id: "mla-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "56",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "c-particle", label: "Particle Exposure", testHours: "2", sampleRange: "27-32" }],
        },
      ],
    };

    const [groupA, groupC] = createEnvironmentFeeDetailSections(phase);

    expect(groupA?.rows[0]?.estimatedItemFee).toBe(24000);
    expect(groupA?.rows[0]?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(13000);
    expect(groupA?.rows[0]?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(24000);
    expect(groupA?.rows[0]?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(31000);

    expect(groupC?.rows[0]?.estimatedItemFee).toBe(3000);
    expect(groupC?.rows[0]?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(2500);
    expect(groupC?.rows[0]?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(3000);
    expect(groupC?.rows[0]?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(13000);
  });

  it("prices K14 through the designated Guoce batch quote and 3-sample fixture capacity", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "18",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "5",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "5",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-k14-12", label: "K14 Dust Blowing Test", testHours: "5", sampleRange: "1-12" },
            { id: "a-k14-6", label: "K14 Dust Blowing Test", testHours: "5", sampleRange: "1-6" },
          ],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);
    const k14For12Samples = groupA?.rows[0];
    const k14For6Samples = groupA?.rows[1];

    expect(k14For12Samples?.status).toBe("priced");
    expect(k14For12Samples?.chargeBasis).toBe("batch");
    expect(k14For12Samples?.batchCount).toBe(4);
    expect(k14For12Samples?.medianUnitPrice).toBe(3000);
    expect(k14For12Samples?.estimatedItemFee).toBe(12000);
    expect(k14For12Samples?.notes).toContain("国测");

    expect(k14For6Samples?.chargeBasis).toBe("batch");
    expect(k14For6Samples?.batchCount).toBe(2);
    expect(k14For6Samples?.medianUnitPrice).toBe(3000);
    expect(k14For6Samples?.estimatedItemFee).toBe(6000);
  });

  it("prices L6 internal and external inspection rows separately", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "8",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "20",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-d3",
          title: "Group D-3",
          totalSampleLabel: "Total样机数量",
          totalSamplePrefix: "PCBA",
          totalSampleQty: "8",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "68",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "d3-post-l6-internal", label: "L6-photo&xray", testHours: "20", sampleRange: "1-8" },
            { id: "d3-post-l6-external", label: "L6-SEM&SECTION", testHours: "20", sampleRange: "1-8" },
          ],
        },
      ],
    };

    const [groupD3] = createEnvironmentFeeDetailSections(phase);
    const l6Internal = groupD3?.rows[0];
    const l6External = groupD3?.rows[1];

    expect(l6Internal?.quantity).toBe(8);
    expect(l6Internal?.medianUnitPrice).toBe(400);
    expect(l6Internal?.estimatedItemFee).toBe(3200);
    expect(l6Internal?.testName).toBe("L6-photo&xray");
    expect(l6Internal?.labs).toEqual([]);
    expect(l6Internal?.notes).toContain("固定单价");

    expect(l6External?.quantity).toBe(33);
    expect(l6External?.testName).toBe("L6-SEM&SECTION");
    expect(l6External?.medianUnitPrice).toBe(650);
    expect(l6External?.estimatedItemFee).toBe(21450);
    expect(l6External?.notes).toContain("委外");
  });

  it("prices D-3 L1&L4 rows from the 8 PCBA sample group quantity", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "8",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "20",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-d3",
          title: "Group D-3",
          totalSampleLabel: "Total样机数量",
          totalSamplePrefix: "PCBA",
          totalSampleQty: "8",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "68",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "d3-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "3" },
            { id: "d3-post-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "2", sampleRange: "1-8" },
          ],
        },
      ],
    };

    const [groupD3] = createEnvironmentFeeDetailSections(phase);
    const l1l4Rows = groupD3?.rows.filter((row) => row.testName === "L1&L4 Performance Evaluation & Functional Evaluation") ?? [];

    expect(l1l4Rows).toHaveLength(2);
    for (const row of l1l4Rows) {
      expect(row.quantity).toBe(8);
      expect(row.chargeBasis).toBe("quantity");
      expect(row.medianUnitPrice).toBe(400);
      expect(row.estimatedItemFee).toBe(3200);
      expect(row.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(3200);
      expect(row.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(5600);
      expect(row.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(3200);
    }
  });

  it("prices E group restricted substance and operating noise using approved rules", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "26",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "40",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-e1",
          title: "Group E-1",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "1",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "40",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "e1-item", label: "E-1 Restricted Substance Management", testHours: "40" }],
        },
        {
          id: "mla-group-e2",
          title: "Group E-2",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "25",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "20",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "e2-item", label: "E-2 Operating Noise & Transient Noise", testHours: "20" }],
        },
      ],
    };

    const [groupE1, groupE2] = createEnvironmentFeeDetailSections(phase);

    expect(groupE1?.rows[0]?.estimatedItemFee).toBe(20000);
    expect(groupE1?.rows[0]?.notes).toContain("1500");
    expect(groupE2?.rows[0]?.estimatedItemFee).toBe(42500);
    expect(groupE2?.rows[0]?.medianUnitPrice).toBe(1700);
    expect(groupE2?.rows[0]?.priceLabel).toBe("参考单价");
    expect(groupE2?.rows[0]?.hideUnavailableLabQuotes).toBe(true);
  });

  it("prices the five K28 HALT subtests as 8h items with the approved HALT lab quotes", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "15",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "14",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-d8",
          title: "Group D-8",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "15",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "14",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "d8-cold", label: "K28 HALT Cold", testHours: "8h", sampleRange: "1-15" },
            { id: "d8-hot", label: "K28 HALT Hot", testHours: "8h", sampleRange: "1-15" },
            { id: "d8-tst", label: "K28 HALT Thermal Shock", testHours: "8h", sampleRange: "1-15" },
            { id: "d8-vibration", label: "K28 HALT Vibration", testHours: "8h", sampleRange: "1-15" },
            { id: "d8-mix", label: "K28 HALT TST & Vibration", testHours: "8h", sampleRange: "1-15" },
          ],
        },
      ],
    };

    const [groupD8] = createEnvironmentFeeDetailSections(phase);

    expect(groupD8?.rows).toHaveLength(5);
    for (const row of groupD8?.rows ?? []) {
      expect(row.chargeBasis).toBe("hour");
      expect(row.testHours).toBe(8);
      expect(row.medianUnitPrice).toBe(800);
      expect(row.estimatedItemFee).toBe(6400);
      expect(row.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(6400);
      expect(row.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(4800);
      expect(row.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(12000);
    }
  });

  it("applies the MLA D-8 optical rule as full 19-point pricing", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "15",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "14",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-d8",
          title: "Group D-8",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "15",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "14",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "d8-post-optical", label: "Optical Test", testHours: "3", sampleRange: "1-15" }],
        },
      ],
    };

    const [groupD8] = createEnvironmentFeeDetailSections(phase);

    expect(groupD8?.rows[0]?.estimatedItemFee).toBe(750);
  });

  it("uses D-8 row-level quantity overrides for confirmed pre and post evaluation samples", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "15",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "14",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-d8",
          title: "Group D-8",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "15",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "14",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "d8-optical", label: "Optical Test", testHours: "7", sampleRange: "1-15", feeBasisOverrides: { quantity: "15" } },
            { id: "d8-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "3", sampleRange: "1-15", feeBasisOverrides: { quantity: "15" } },
            { id: "d8-post-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "3", sampleRange: "1-15", feeBasisOverrides: { quantity: "9" } },
            { id: "d8-post-optical", label: "Optical Test", testHours: "3", sampleRange: "1-15", feeBasisOverrides: { quantity: "9" } },
            { id: "d8-post-l6", label: "L6-photo&xray", testHours: "3", sampleRange: "1-15", feeBasisOverrides: { quantity: "9" } },
          ],
        },
      ],
    };

    const [groupD8] = createEnvironmentFeeDetailSections(phase);
    const rowsById = new Map(groupD8?.rows.map((row) => [row.outlineRowId, row]));

    expect(rowsById.get("d8-optical")).toMatchObject({ quantity: 15, estimatedItemFee: 750 });
    expect(rowsById.get("d8-l1l4")).toMatchObject({ quantity: 15, estimatedItemFee: 6000 });
    expect(rowsById.get("d8-post-l1l4")).toMatchObject({ quantity: 9, estimatedItemFee: 3600 });
    expect(rowsById.get("d8-post-optical")).toMatchObject({ quantity: 9, estimatedItemFee: 450 });
    expect(rowsById.get("d8-post-l6")).toMatchObject({ quantity: 9, estimatedItemFee: 3600 });
  });

  it("applies locked MLA fee rules to RHD outline groups", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv-rhd",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-R",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "65",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-rhd-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-optical", label: "Optical Test", testHours: "7" },
            { id: "a-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "3" },
            { id: "a-particle", label: "Particle Exposure", testHours: "5", sampleRange: "1-12" },
            { id: "a-k6", label: "K6 Power Thermal Cycle", testHours: "11", sampleRange: "1-12" },
          ],
        },
        {
          id: "mla-rhd-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "56",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "c-particle", label: "Particle Exposure", testHours: "2", sampleRange: "15-20" },
            { id: "c-k26", label: "K26 Mechanical Wear-Out", testHours: "23", sampleRange: "15-20" },
          ],
        },
        {
          id: "mla-rhd-group-d3",
          title: "Group D-3",
          totalSampleLabel: "Total样机数量",
          totalSamplePrefix: "PCBA",
          totalSampleQty: "8",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "68",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "d3-post-l6-internal", label: "L6-photo&xray", testHours: "20", sampleRange: "21-28" },
            { id: "d3-post-l6-external", label: "L6-SEM&SECTION", testHours: "20", sampleRange: "21-28" },
          ],
        },
        {
          id: "mla-rhd-group-e2",
          title: "Group E-2",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "25",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "20",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "e2-item", label: "E-2 Operating Noise & Transient Noise", testHours: "20", sampleRange: "41-65" }],
        },
      ],
    };

    const [groupA, groupC, groupD3, groupE2] = createEnvironmentFeeDetailSections(phase);
    const optical = groupA?.rows.find((row) => row.outlineRowId === "a-optical");
    const l1l4 = groupA?.rows.find((row) => row.outlineRowId === "a-l1l4");
    const particleA = groupA?.rows.find((row) => row.outlineRowId === "a-particle");
    const k6 = groupA?.rows.find((row) => row.outlineRowId === "a-k6");
    const particleC = groupC?.rows.find((row) => row.outlineRowId === "c-particle");
    const k26 = groupC?.rows.find((row) => row.outlineRowId === "c-k26");
    const l6Internal = groupD3?.rows.find((row) => row.outlineRowId === "d3-post-l6-internal");
    const l6External = groupD3?.rows.find((row) => row.outlineRowId === "d3-post-l6-external");
    const noise = groupE2?.rows.find((row) => row.outlineRowId === "e2-item");

    expect(optical?.estimatedItemFee).toBe(784);
    expect(optical?.notes).not.toContain("baseline 汇总");
    expect(l1l4?.quantity).toBe(14);
    expect(l1l4?.estimatedItemFee).toBe(5600);
    expect(particleA?.status).toBe("priced");
    expect(particleA?.estimatedItemFee).toBe(24000);
    expect(k6?.testHours).toBe(240);
    expect(k6?.estimatedItemFee).toBe(7200);
    expect(particleC?.estimatedItemFee).toBe(3000);
    expect(k26?.estimatedItemFee).toBe(7158);
    expect(l6Internal?.estimatedItemFee).toBe(3200);
    expect(l6External?.quantity).toBe(33);
    expect(l6External?.estimatedItemFee).toBe(21450);
    expect(noise?.estimatedItemFee).toBe(42500);
    expect(noise?.hideUnavailableLabQuotes).toBe(true);
  });

  it("keeps baseline Optical and L1&L4 quantities scoped to their own group", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "20",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-optical", label: "Optical Test", testHours: "7" },
            { id: "a-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "3" },
            { id: "a-post-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "3", sampleRange: "1-14" },
          ],
        },
        {
          id: "mla-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "56",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "c-optical", label: "Optical Test", testHours: "7" },
            { id: "c-l1l4", label: "L1&L4 Performance Evaluation & Functional Evaluation", testHours: "3" },
          ],
        },
      ],
    };

    const [groupA, groupC] = createEnvironmentFeeDetailSections(phase);
    const groupAOptical = groupA?.rows.find((row) => row.outlineRowId === "a-optical");
    const groupAL1L4 = groupA?.rows.find((row) => row.outlineRowId === "a-l1l4");
    const groupAPostL1L4 = groupA?.rows.find((row) => row.outlineRowId === "a-post-l1l4");
    const groupCOptical = groupC?.rows.find((row) => row.outlineRowId === "c-optical");
    const groupCL1L4 = groupC?.rows.find((row) => row.outlineRowId === "c-l1l4");

    expect(groupAOptical?.quantity).toBe(14);
    expect(groupAOptical?.estimatedItemFee).toBe(784);
    expect(groupAL1L4?.quantity).toBe(14);
    expect(groupAL1L4?.estimatedItemFee).toBe(5600);
    expect(groupAPostL1L4?.quantity).toBe(14);
    expect(groupAPostL1L4?.estimatedItemFee).toBe(5600);
    expect(groupCOptical?.quantity).toBe(6);
    expect(groupCOptical?.estimatedItemFee).toBe(384);
    expect(groupCL1L4?.quantity).toBe(6);
    expect(groupCL1L4?.estimatedItemFee).toBe(2400);
  });
});
