import { describe, expect, it } from "vitest";
import {
  calculateFeeAmount,
  calculateLabMedianUnitPrice,
  createEnvironmentFeeDetailSections,
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

  it("uses updated MLA medians that include Xince quotes", () => {
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

    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k6")?.medianUnitPrice).toBe(45);
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k6")?.estimatedItemFee).toBe(10800);
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k17")?.medianUnitPrice).toBe(4000);
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k17")?.estimatedItemFee).toBe(144000);
  });

  it("uses approved component fee composition for K17, K18, and K22", () => {
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
      ],
    };

    const [groupA, groupB] = createEnvironmentFeeDetailSections(phase);
    const k17 = groupA?.rows.find((row) => row.outlineRowId === "a-k17");
    const k22 = groupB?.rows.find((row) => row.outlineRowId === "b-k22");
    const k18 = groupB?.rows.find((row) => row.outlineRowId === "b-k18");

    expect(k17?.estimatedItemFee).toBe(144000);
    expect(k17?.notes).toContain("3 个方向");
    expect(k17?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(144000);
    expect(k17?.labs.find((lab) => lab.lab === "信测")?.itemFee).toBe(144000);

    expect(k22?.testHours).toBe(72);
    expect(k22?.quantity).toBe(15);
    expect(k22?.estimatedItemFee).toBe(6300);
    expect(k22?.notes).toContain("15 种试剂");
    expect(k22?.notes).toContain("试剂数量 × 试剂单价 + 测试时间 × 时间单价");
    expect(k22?.labs.find((lab) => lab.lab === "SGS")?.unitPrice).toBe(20);
    expect(k22?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(5940);
    expect(k22?.labs.find((lab) => lab.lab === "华测")?.unitPrice).toBe(25);
    expect(k22?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(6300);
    expect(k22?.labs.find((lab) => lab.lab === "苏劢")?.unitPrice).toBe(30);
    expect(k22?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(6660);
    expect(k22?.labs.find((lab) => lab.lab === "信测")?.unitPrice).toBe(20);
    expect(k22?.labs.find((lab) => lab.lab === "信测")?.itemFee).toBe(5940);

    expect(k18?.estimatedItemFee).toBe(15600);
    expect(k18?.notes).toContain("K18.1-K18.4");
    expect(k18?.labs.find((lab) => lab.lab === "SGS")?.itemFee).toBe(15600);
    expect(k18?.labs.find((lab) => lab.lab === "华测")?.itemFee).toBe(9600);
    expect(k18?.labs.find((lab) => lab.lab === "苏劢")?.itemFee).toBe(6000);
    expect(k18?.labs.find((lab) => lab.lab === "信测")?.itemFee).toBe(24000);
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
    expect(k1?.estimatedItemFee).toBe(960);
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
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k1")?.estimatedItemFee).toBe(960);
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

  it("prices K14 through the designated Guoce quote", () => {
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
          rows: [{ id: "a-k14", label: "K14 Dust Blowing Test", testHours: "5", sampleRange: "1-12" }],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);
    const k14 = groupA?.rows[0];

    expect(k14?.status).toBe("priced");
    expect(k14?.medianUnitPrice).toBe(3000);
    expect(k14?.estimatedItemFee).toBe(36000);
    expect(k14?.notes).toContain("国测");
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

    expect(groupE1?.rows[0]?.estimatedItemFee).toBe(21500);
    expect(groupE1?.rows[0]?.notes).toContain("1500");
    expect(groupE2?.rows[0]?.estimatedItemFee).toBe(42500);
    expect(groupE2?.rows[0]?.medianUnitPrice).toBe(1700);
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

    expect(groupD8?.rows[0]?.estimatedItemFee).toBe(3150);
  });
});
