import type { PlatformCode } from "../../types/project";
import type { EditableTestItem } from "../../types/testing";
import type { EnvironmentPlanGroup, EnvironmentPlanPhase, EnvironmentPlanRow, EnvironmentPlanSheet } from "../../types/environmentPlan";
import { applyEnvironmentFeeDetailsToPhase } from "../../services/environmentFeeDetail";

function createRow(id: string, label: string, testHours: string, sampleRange?: string): EnvironmentPlanRow {
  return {
    id,
    label,
    testHours,
    ...(sampleRange ? { sampleRange } : {}),
  };
}

function createNamedRow(id: string, code: string, name: string, testHours: string, sampleRange?: string): EnvironmentPlanRow {
  return createRow(id, `${code} ${name}`.trim(), testHours, sampleRange);
}

function withQuantityOverride(row: EnvironmentPlanRow, quantity: string): EnvironmentPlanRow {
  return {
    ...row,
    feeBasisOverrides: {
      ...(row.feeBasisOverrides ?? {}),
      quantity,
    },
  };
}

function getSampleRangeQuantity(sampleRange: string | undefined): number | null {
  const match = sampleRange?.match(/^(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }

  return Number(match[2]) - Number(match[1]) + 1;
}

function createL6InternalRow(id: string, testHours: string, sampleRange?: string): EnvironmentPlanRow {
  const quantity = getSampleRangeQuantity(sampleRange);
  const durationDays = quantity === 12 ? "7" : quantity === 6 ? "3" : testHours;

  return createRow(id, "L6-photo&xray", durationDays, sampleRange);
}

function createL6ExternalRow(id: string, testHours: string, sampleRange?: string): EnvironmentPlanRow {
  return createRow(id, "L6-SEM&SECTION", testHours, sampleRange);
}

function formatCurrency(value: number): string {
  return value > 0 ? String(Math.round(value)) : "";
}

function toDaysString(hours: number): string {
  return hours > 0 ? String(Math.ceil(hours / 24)) : "";
}

function hoursToDays(hours: string): string {
  const value = Number(hours);
  return Number.isFinite(value) && value > 0 ? toDaysString(value) : "";
}

function calculateDays(item: EditableTestItem | undefined): string {
  if (!item) {
    return "";
  }

  const hours = item.durationUnit === "day" ? item.durationValue * 24 : item.durationValue;
  return toDaysString(hours);
}

function deriveGroupRows(items: EditableTestItem[], overrides: Array<{
  id: string;
  label: string;
  match?: (item: EditableTestItem) => boolean;
  hours?: string;
}>): EnvironmentPlanRow[] {
  return overrides.map((override) => {
    const matched = override.match ? items.find(override.match) : undefined;
    return createRow(
      override.id,
      override.label,
      override.hours ? hoursToDays(override.hours) : calculateDays(matched),
    );
  });
}

function findGroupItems(items: EditableTestItem[], groupName: string): EditableTestItem[] {
  return items.filter((item) => item.templateGroup === groupName);
}

function maxSampleQty(items: EditableTestItem[]): string {
  const max = items.reduce((value, item) => Math.max(value, item.sampleQty), 0);
  return max > 0 ? String(max) : "";
}

function sumItemCost(items: EditableTestItem[]): number {
  return items.reduce((total, item) => total + item.cost, 0);
}

function longestGroupHours(items: EditableTestItem[]): number {
  return items.reduce((max, item) => {
    const hours = item.durationUnit === "day" ? item.durationValue * 24 : item.durationValue;
    return Math.max(max, hours);
  }, 0);
}

function createGroup(
  id: string,
  title: string,
  items: EditableTestItem[],
  rows: EnvironmentPlanRow[],
  overrides?: {
    totalSamplePrefix?: string;
    totalSampleQty?: string;
    totalDurationDays?: string;
    totalCost?: string;
  },
): EnvironmentPlanGroup {
  return {
    id,
    title,
    totalSampleLabel: "Total样机数量",
    ...(overrides?.totalSamplePrefix ? { totalSamplePrefix: overrides.totalSamplePrefix } : {}),
    totalSampleQty: overrides?.totalSampleQty ?? maxSampleQty(items),
    totalDurationLabel: "组测试时间(天)",
    totalDurationDays: overrides?.totalDurationDays ?? toDaysString(longestGroupHours(items)),
    totalCostLabel: "组费用",
    totalCost: overrides?.totalCost ?? formatCurrency(sumItemCost(items)),
    rows,
  };
}

function createPhase(title: string, projectCode: string, groups: EnvironmentPlanGroup[]): EnvironmentPlanPhase {
  const totalSampleQty = groups.reduce((sum, group) => sum + Number(group.totalSampleQty || 0), 0);
  const groupA = groups.find((group) => group.title === "Group A");
  const totalCost = groups.reduce((sum, group) => sum + Number(group.totalCost || 0), 0);
  const baselineDurationDays = 10;
  const groupALongestDuration = Number(groupA?.totalDurationDays || 0);
  const longestDurationDays = Number.isFinite(groupALongestDuration) && groupALongestDuration > 0
    ? String(groupALongestDuration + baselineDurationDays)
    : groupA?.totalDurationDays ?? "";

  return applyEnvironmentFeeDetailsToPhase(applyBaselineOpticalSampleRange({
    id: title.toLowerCase(),
    title,
    summary: {
      projectLabel: "项目",
      projectCode,
      phaseLabel: "阶段",
      phaseValue: title,
      totalSampleLabel: "样本总数量",
      totalSampleQty: String(totalSampleQty),
      longestDurationLabel: "最长测试时间(天)",
      longestDurationDays,
      totalCostLabel: "总费用",
      totalCost: formatCurrency(totalCost),
      computerFee: "",
      computerFeeCoefficient: "48",
      reportFee: "",
      reportFeeCount: "",
    },
    groups,
  }));
}

function isBaselineScopeRow(row: EnvironmentPlanRow) {
  return row.id.includes("optical") || row.id.includes("l1l4");
}

function isPcbaOnlyGroup(group: EnvironmentPlanGroup) {
  return group.totalSamplePrefix === "PCBA" || group.title === "Group D-3" || group.title === "Group D-4";
}

function applyBaselineOpticalSampleRange(phase: EnvironmentPlanPhase): EnvironmentPlanPhase {
  return {
    ...phase,
    groups: phase.groups.map((group) => {
      let reachedSequenceRows = false;
      const groupSampleCount = Number(group.totalSampleQty || 0);
      const groupSampleRange = groupSampleCount > 0 ? `1-${groupSampleCount}` : "";

      return {
        ...group,
        rows: group.rows.map((row) => {
          if (!isBaselineScopeRow(row)) {
            reachedSequenceRows = true;
            return row;
          }

          if (reachedSequenceRows || row.sampleRange || isPcbaOnlyGroup(group)) {
            return row;
          }

          return {
            ...row,
            sampleRange: groupSampleRange,
          };
        }),
      };
    }),
  };
}

function withRowsWhenItemsExist(items: EditableTestItem[], rows: EnvironmentPlanRow[]): EnvironmentPlanRow[] {
  return items.length > 0 ? rows : [];
}

function removeEmptyGroups(groups: EnvironmentPlanGroup[]): EnvironmentPlanGroup[] {
  return groups.filter((group) => group.rows.length > 0);
}

function usesOnlyRhdTemplate(environmentItems: EditableTestItem[]): boolean {
  return environmentItems.length > 0 && environmentItems.every((item) => item.tags.includes("RHD"));
}

function createMlaPlan(environmentItems: EditableTestItem[], projectCode: string): EnvironmentPlanSheet {
  const groupAItems = findGroupItems(environmentItems, "Group A Sequence Tests");
  const groupBItems = findGroupItems(environmentItems, "Group B Sequence Tests");
  const groupCItems = findGroupItems(environmentItems, "Group C Sequence Tests");
  const groupD1Items = findGroupItems(environmentItems, "D-1 Corrosive Gases");
  const groupD2Items = findGroupItems(environmentItems, "D-2 Solar Radiation");
  const groupD3Items = findGroupItems(environmentItems, "D-3 PCBA");
  const groupD4Items = findGroupItems(environmentItems, "D-4 Dewing Test");
  const groupD5Items = findGroupItems(environmentItems, "D-5 Life Test-1");
  const groupD6Items = findGroupItems(environmentItems, "D-6 Life Test-2-1");
  const groupD7Items = findGroupItems(environmentItems, "D-7 Life Test-2-2");
  const groupD8Items = findGroupItems(environmentItems, "D-8");
  const groupD9Items = findGroupItems(environmentItems, "D-9");
  const groupFOtherItems = findGroupItems(environmentItems, "Group F Other Tests");
  const restrictedSubstanceItem = groupFOtherItems.find((item) => item.code === "F1");
  const operatingNoiseItem = groupFOtherItems.find((item) => item.code === "F2");

  const commonGroups: EnvironmentPlanGroup[] = [
    createGroup("mla-group-a", "Group A", groupAItems, [
      createRow("a-optical", "Optical Test", "7"),
      createRow("a-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createRow("a-particle", "Particle Exposure", "5", "1-12"),
      createNamedRow("a-k1", "K1", "Low Temperature Exposure", "2", "1-12"),
      createNamedRow("a-k2", "K2", "High Temperature Exposure", "2", "1-12"),
      createNamedRow("a-k3", "K3", "Low Temperature Operation", "2", "1-12"),
      createNamedRow("a-k4", "K4", "High Temperature Operation", "5", "1-12"),
      createNamedRow("a-k5", "K5", "Temperature Step Test", "2", "1-12"),
      createNamedRow("a-k6", "K6", "Power Thermal Cycle", "11", "1-12"),
      createNamedRow("a-k7", "K7", "Thermal Shock in Air", "6", "1-12"),
      createNamedRow("a-k15", "K15", "Vibration", "7", "1-12"),
      createNamedRow("a-k16-1", "K16.1", "Mechanical Shock Package Drop", "2", "1-14"),
      createNamedRow("a-k16-4", "K16.4", "Mechanical Shock Low", "2", "1-12"),
      createNamedRow("a-k17", "K17", "Audible Noise", "10", "1-12"),
      createNamedRow("a-k9", "K9", "Temperature/Humidity Cycle", "12", "1-12"),
      createNamedRow("a-k10", "K10", "Water/Fluid Ingress Test", "3", "1-12"),
      createNamedRow("a-k13", "K13", "Dust Ingress", "5", "1-12"),
      createNamedRow("a-k14", "K14", "Dust Blowing Test", "5", "1-12"),
      createRow("a-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-14"),
      createRow("a-post-optical", "Optical Test", "2", "1-14"),
      createL6InternalRow("a-post-l6", "7", "1-14"),
    ], { totalDurationDays: "101" }),
    createGroup("mla-group-b", "Group B", groupBItems, withRowsWhenItemsExist(groupBItems, [
      createRow("b-optical", "Optical Test", "7"),
      createRow("b-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("b-k22", "K22", "Chemical Resistance", "5"),
      createNamedRow("b-k18", "K18", "Connector and lead/lock strength", "7"),
      createRow("b-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createRow("b-post-optical", "Optical Test", "2"),
      createL6InternalRow("b-post-l6", "7"),
    ]), { totalDurationDays: "21" }),
    createGroup("mla-group-c", "Group C", groupCItems, [
      createRow("c-optical", "Optical Test", "7"),
      createRow("c-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("c-k7", "K7", "Thermal Shock in Air", "14"),
      createRow("c-particle", "Particle Exposure", "2", "27-32"),
      createNamedRow("c-k15", "K15", "Vibartion", "4"),
      createNamedRow("c-k13", "K13", "Dust Ingress", "2"),
      createNamedRow("c-k14", "K14", "Dust Blowing Test", "3"),
      createNamedRow("c-k26", "K26", "Mechanical Wear-Out", "23"),
      createRow("c-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createRow("c-post-optical", "Optical Test", "1"),
      createL6InternalRow("c-post-l6", "3"),
    ], { totalDurationDays: "56" }),
    createGroup("mla-group-d1", "Group D-1", groupD1Items, withRowsWhenItemsExist(groupD1Items, [
      createRow("d1-optical", "Optical Test", "7"),
      createRow("d1-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d1-k21", "K21", "Corrosive Gases", "16"),
      createRow("d1-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createRow("d1-post-optical", "Optical Test", "1"),
      createL6InternalRow("d1-post-l6", "3"),
    ]), { totalDurationDays: "22" }),
    createGroup("mla-group-d2", "Group D-2", groupD2Items, withRowsWhenItemsExist(groupD2Items, [
      createRow("d2-optical", "Optical Test", "7"),
      createRow("d2-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d2-k20", "K20", "Solar Radiation", "32"),
      createRow("d2-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createRow("d2-post-optical", "Optical Test", "1"),
      createL6InternalRow("d2-post-l6", "3"),
    ]), { totalDurationDays: "38" }),
    createGroup("mla-group-d3", "Group D-3", groupD3Items, [
      createRow("d3-optical", "Optical Test", "7"),
      createRow("d3-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d3-k23", "K23", "Thermal Shock Endurance", "46"),
      createRow("d3-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createL6InternalRow("d3-post-l6-internal", "3"),
      createL6ExternalRow("d3-post-l6-external", "20"),
    ], { totalSamplePrefix: "PCBA", totalSampleQty: "8", totalDurationDays: "68" }),
    createGroup("mla-group-d4", "Group D-4", groupD4Items, [
      createRow("d4-optical", "Optical Test", "7"),
      createRow("d4-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d4-k8", "K8", "Dewing Test", "2"),
      createRow("d4-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createL6InternalRow("d4-post-l6", "3"),
    ], { totalSamplePrefix: "PCBA", totalDurationDays: "7" }),
    createGroup("mla-group-d5", "Group D-5", groupD5Items, withRowsWhenItemsExist(groupD5Items, [
      createRow("d5-optical", "Optical Test", "7"),
      createRow("d5-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d5-k24", "K24", "High Temperature Endurance", "42"),
      createRow("d5-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createRow("d5-post-optical", "Optical Test", "1"),
      createL6InternalRow("d5-post-l6", "3"),
    ]), { totalDurationDays: "48" }),
    createGroup("mla-group-d6", "Group D-6", groupD6Items, withRowsWhenItemsExist(groupD6Items, [
      createRow("d6-optical", "Optical Test", "7"),
      createRow("d6-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d6-k27", "K27", "85/85 High Temperature -High Humidity Endurance", "42"),
      createRow("d6-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createL6InternalRow("d6-post-l6", "3"),
    ]), { totalDurationDays: "47" }),
    createGroup("mla-group-d7", "Group D-7", groupD7Items, withRowsWhenItemsExist(groupD7Items, [
      createRow("d7-optical", "Optical Test", "7"),
      createRow("d7-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d7-k27", "K27", "60/95 High Temperature -High Humidity Endurance", "46"),
      createRow("d7-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createRow("d7-post-optical", "Optical Test", "1"),
      createL6InternalRow("d7-post-l6", "3"),
    ]), { totalDurationDays: "52" }),
    createGroup("mla-group-d8", "Group D-8", groupD8Items, withRowsWhenItemsExist(groupD8Items, [
      withQuantityOverride(createRow("d8-optical", "Optical Test", "7", "1-15"), "15"),
      withQuantityOverride(createRow("d8-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-15"), "15"),
      createNamedRow("d8-cold", "K28", "HALT Cold", "8h"),
      createNamedRow("d8-hot", "K28", "HALT Hot", "8h"),
      createNamedRow("d8-tst", "K28", "HALT Thermal Shock", "8h"),
      createNamedRow("d8-vibration", "K28", "HALT Vibration", "8h"),
      createNamedRow("d8-mix", "K28", "HALT TST & Vibration", "8h"),
      withQuantityOverride(createRow("d8-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-15"), "9"),
      withQuantityOverride(createRow("d8-post-optical", "Optical Test", "3", "1-15"), "9"),
      withQuantityOverride(createL6InternalRow("d8-post-l6", "3", "1-15"), "9"),
    ]), { totalSampleQty: "15", totalDurationDays: "14" }),
    createGroup("mla-group-d9", "Group D-9", groupD9Items, [
      createRow("d9-optical", "Optical Test", "7"),
      createRow("d9-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("d9-k52", "K52.351", "Condensing humidity", "7"),
      createRow("d9-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2"),
      createRow("d9-post-optical", "Optical Test", "1"),
      createL6InternalRow("d9-post-l6", "3"),
    ], { totalDurationDays: "13" }),
    createGroup(
      "mla-group-e1",
      "Group E-1",
      restrictedSubstanceItem ? [restrictedSubstanceItem] : [],
      withRowsWhenItemsExist(
        restrictedSubstanceItem ? [restrictedSubstanceItem] : [],
        [createRow("e1-item", "E-1 Restricted Substance Management", "40")],
      ),
      {
        totalSampleQty: "1",
        totalDurationDays: "40",
        totalCost: formatCurrency(restrictedSubstanceItem?.cost ?? 500),
      },
    ),
    createGroup(
      "mla-group-e2",
      "Group E-2",
      operatingNoiseItem ? [operatingNoiseItem] : [],
      [createRow("e2-item", "E-2 Operating Noise & Transient Noise", "20")],
      {
        totalSampleQty: "25",
        totalDurationDays: "20",
        totalCost: formatCurrency(operatingNoiseItem?.cost ?? 800),
      },
    ),
  ];

  return {
    platform: "MLA",
    phases: [
      createPhase("DV", projectCode, removeEmptyGroups(commonGroups.filter((group) => group.title !== "Group D-8"))),
      createPhase("PV", projectCode, removeEmptyGroups(commonGroups)),
    ],
  };
}

function createMlaRhdPlan(environmentItems: EditableTestItem[], projectCode: string): EnvironmentPlanSheet {
  const groupAItems = findGroupItems(environmentItems, "Group A Sequence Tests");
  const groupCItems = findGroupItems(environmentItems, "Group C Sequence Tests");
  const groupD3Items = findGroupItems(environmentItems, "D-3 PCBA");
  const groupD4Items = findGroupItems(environmentItems, "D-4 Dewing Test");
  const groupD9Items = findGroupItems(environmentItems, "D-9");
  const groupFOtherItems = findGroupItems(environmentItems, "Group F Other Tests");
  const operatingNoiseItem = groupFOtherItems.find((item) => item.code === "F2");

  const commonGroups: EnvironmentPlanGroup[] = [
    createGroup("mla-rhd-group-a", "Group A", groupAItems, [
      createRow("a-optical", "Optical Test", "7"),
      createRow("a-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createRow("a-particle", "Particle Exposure", "5", "1-12"),
      createNamedRow("a-k1", "K1", "Low Temperature Exposure", "2", "1-12"),
      createNamedRow("a-k2", "K2", "High Temperature Exposure", "2", "1-12"),
      createNamedRow("a-k3", "K3", "Low Temperature Operation", "2", "1-12"),
      createNamedRow("a-k4", "K4", "High Temperature Operation", "5", "1-12"),
      createNamedRow("a-k5", "K5", "Temperature Step Test", "2", "1-12"),
      createNamedRow("a-k6", "K6", "Power Thermal Cycle", "11", "1-12"),
      createNamedRow("a-k7", "K7", "Thermal Shock in Air", "6", "1-12"),
      createRow("a-mid-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-12"),
      createNamedRow("a-k15", "K15", "Vibration", "7", "1-12"),
      createNamedRow("a-k16-1", "K16.1", "Mechanical Shock Package Drop", "2", "1-14"),
      createNamedRow("a-k16-4", "K16.4", "Mechanical Shock Low", "2", "1-12"),
      createNamedRow("a-k17", "K17", "Audible Noise", "10", "1-12"),
      createNamedRow("a-k9", "K9", "Temperature/Humidity Cycle", "12", "1-12"),
      createNamedRow("a-k10", "K10", "Water/Fluid Ingress Test", "3", "1-12"),
      createNamedRow("a-k13", "K13", "Dust Ingress", "5", "1-12"),
      createNamedRow("a-k14", "K14", "Dust Blowing Test", "5", "1-12"),
      createRow("a-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-14"),
      createRow("a-post-optical", "Optical Test", "2", "1-14"),
      createL6InternalRow("a-post-l6", "7", "1-14"),
    ], { totalSampleQty: "14", totalDurationDays: "101" }),
    createGroup("mla-rhd-group-c", "Group C", groupCItems, [
      createNamedRow("c-k7", "K7", "Thermal Shock in Air", "14", "15-20"),
      createRow("c-particle", "Particle Exposure", "2", "15-20"),
      createNamedRow("c-k15", "K15", "Vibration", "4", "15-20"),
      createNamedRow("c-k13", "K13", "Dust Ingress", "2", "15-20"),
      createNamedRow("c-k14", "K14", "Dust Blowing Test", "3", "15-20"),
      createNamedRow("c-k26", "K26", "Mechanical Wear-Out", "23", "15-20"),
      createRow("c-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "15-20"),
      createRow("c-post-optical", "Optical Test", "1", "15-20"),
      createL6InternalRow("c-post-l6", "3", "15-20"),
    ], { totalSampleQty: "6", totalDurationDays: "56" }),
    createGroup("mla-rhd-group-d3", "Group D-3", groupD3Items, [
      createNamedRow("d3-k23", "K23", "Thermal Shock Endurance", "46", "21-28"),
      createRow("d3-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "21-28"),
      createL6InternalRow("d3-post-l6-internal", "20", "21-28"),
      createL6ExternalRow("d3-post-l6-external", "20", "21-28"),
    ], { totalSamplePrefix: "PCBA", totalSampleQty: "8", totalDurationDays: "68" }),
    createGroup("mla-rhd-group-d4", "Group D-4", groupD4Items, [
      createNamedRow("d4-k8", "K8", "Dewing Test", "2", "29-34"),
      createRow("d4-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "29-34"),
      createL6InternalRow("d4-post-l6", "3", "29-34"),
    ], { totalSamplePrefix: "PCBA", totalSampleQty: "6", totalDurationDays: "7" }),
    createGroup("mla-rhd-group-d9", "Group D-9", groupD9Items, [
      createNamedRow("d9-k52", "K52.351", "Condensing humidity", "7", "35-40"),
      createRow("d9-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "35-40"),
      createRow("d9-post-optical", "Optical Test", "1", "35-40"),
      createL6InternalRow("d9-post-l6", "3", "35-40"),
    ], { totalSampleQty: "6", totalDurationDays: "13" }),
    createGroup(
      "mla-rhd-group-e2",
      "Group E-2",
      operatingNoiseItem ? [operatingNoiseItem] : [],
      withRowsWhenItemsExist(
        operatingNoiseItem ? [operatingNoiseItem] : [],
        [createRow("e2-item", "E-2 Operating Noise & Transient Noise", "20", "41-65")],
      ),
      { totalSampleQty: "25", totalDurationDays: "20", totalCost: formatCurrency(operatingNoiseItem?.cost ?? 800) },
    ),
  ];

  const groups = removeEmptyGroups(commonGroups);

  return {
    platform: "MLA",
    phases: [
      createPhase("DV", projectCode, groups),
      createPhase("PV", projectCode, groups),
    ],
  };
}

function createEmaPlan(environmentItems: EditableTestItem[], projectCode: string): EnvironmentPlanSheet {
  const commonGroups: EnvironmentPlanGroup[] = [
    createGroup("ema-group-a", "Group A", environmentItems, [
      createRow("ea-optical", "Optical Test", "7"),
      createRow("ea-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ea-k1", "K1", "Low Temperature Exposure", "2", "1-12"),
      createNamedRow("ea-k2", "K2", "High Temperature Exposure", "2", "1-12"),
      createNamedRow("ea-k3", "K3", "Low Temperature Operation", "2", "1-12"),
      createNamedRow("ea-k4", "K4", "High Temperature Operation", "5", "1-12"),
      createNamedRow("ea-k5", "K5", "Temperature Step Test", "2", "1-12"),
      createNamedRow("ea-k6", "K6", "Powered Thermal Cycle", "11", "1-12"),
      createNamedRow("ea-k7", "K7", "Thermal Shock in Air", "14", "1-12"),
      createRow("ea-mid-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-12"),
      createNamedRow("ea-k15", "K15", "Vibration", "7", "1-12"),
      createNamedRow("ea-k16-1", "K16.1", "Mechanical Shock-Package Drop", "2", "1-14"),
      createNamedRow("ea-k16-4", "K16.4", "Mechanical Shock-Low", "2", "1-12"),
      createNamedRow("ea-k17", "K17", "Audible Noise", "10", "1-12"),
      createNamedRow("ea-k9", "K9", "Humidity Temperature Cycle", "12", "1-12"),
      createNamedRow("ea-k10", "K10", "Water/Fluid Ingress Tests", "3", "1-12"),
      createNamedRow("ea-k13", "K13", "Dust Ingress", "5", "1-12"),
      createRow("ea-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-12"),
      createRow("ea-post-optical", "Optical Test", "2", "1-12"),
      createL6InternalRow("ea-post-l6", "7", "1-12"),
    ], { totalSampleQty: "14", totalDurationDays: "94", totalCost: "" }),
    createGroup("ema-group-b", "Group B", environmentItems, [
      createRow("eb-optical", "Optical Test", "7"),
      createRow("eb-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("eb-k22", "K22", "Chemical Resistance", "5", "15-26"),
      createNamedRow("eb-k18", "K18", "Connector and lead/lock strength", "7", "15-26"),
      createRow("eb-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "15-26"),
      createRow("eb-post-optical", "Optical Test", "2", "15-26"),
      createL6InternalRow("eb-post-l6", "4", "15-26"),
    ], { totalSampleQty: "12", totalDurationDays: "21", totalCost: "" }),
    createGroup("ema-group-c", "Group C", environmentItems, [
      createRow("ec-optical", "Optical Test", "7"),
      createRow("ec-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ec-k7", "K7", "Thermal Shock in Air", "14", "27-32"),
      createNamedRow("ec-k15", "K15", "Vibration", "4", "27-32"),
      createNamedRow("ec-k13", "K13", "Dust Ingress", "2", "27-32"),
      createNamedRow("ec-k26", "K26", "Mechanical Wear-Out", "23", "27-32"),
      createRow("ec-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "27-32"),
      createRow("ec-post-optical", "Optical Test", "1", "27-32"),
      createL6InternalRow("ec-post-l6", "3", "27-32"),
    ], { totalSampleQty: "6", totalDurationDays: "49", totalCost: "" }),
    createGroup("ema-group-d1", "Group D-1", environmentItems, [
      createRow("ed1-optical", "Optical Test", "7"),
      createRow("ed1-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed1-k21", "K21", "Corrosive Gases", "42", "33-38"),
      createRow("ed1-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "33-38"),
      createRow("ed1-post-optical", "Optical Test", "1", "33-38"),
      createL6InternalRow("ed1-post-l6", "3", "33-38"),
    ], { totalSampleQty: "6", totalDurationDays: "48", totalCost: "" }),
    createGroup("ema-group-d2", "Group D-2", environmentItems, [
      createRow("ed2-optical", "Optical Test", "7"),
      createRow("ed2-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed2-k20", "K20", "Solar Radiation", "2", "39-44"),
      createRow("ed2-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "39-44"),
      createRow("ed2-post-optical", "Optical Test", "1", "39-44"),
      createL6InternalRow("ed2-post-l6", "3", "39-44"),
    ], { totalSampleQty: "6", totalDurationDays: "8", totalCost: "" }),
    createGroup("ema-group-d3", "Group D-3", environmentItems, [
      createRow("ed3-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed3-k23", "K23", "Thermal Shock Endurance", "46", "45-52"),
      createRow("ed3-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "45-52"),
      createL6InternalRow("ed3-post-l6-internal", "3", "45-52"),
      createL6ExternalRow("ed3-post-l6-external", "20", "45-52"),
    ], { totalSamplePrefix: "PCBA", totalSampleQty: "8", totalDurationDays: "68", totalCost: "" }),
    createGroup("ema-group-d4", "Group D-4", environmentItems, [
      createRow("ed4-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed4-k8", "K8", "Dewing Test", "2", "53-58"),
      createRow("ed4-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "53-58"),
      createL6InternalRow("ed4-post-l6", "3", "53-58"),
    ], { totalSamplePrefix: "PCBA", totalSampleQty: "6", totalDurationDays: "7", totalCost: "" }),
    createGroup("ema-group-d5", "Group D-5", environmentItems, [
      createRow("ed5-optical", "Optical Test", "7"),
      createRow("ed5-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed5-k24", "K24", "High Temperature Endurance", "42", "59-64"),
      createRow("ed5-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "59-64"),
      createRow("ed5-post-optical", "Optical Test", "1", "59-64"),
      createL6InternalRow("ed5-post-l6", "3", "59-64"),
    ], { totalSampleQty: "6", totalDurationDays: "48", totalCost: "" }),
    createGroup("ema-group-d6", "Group D-6", environmentItems, [
      createRow("ed6-optical", "Optical Test", "7"),
      createRow("ed6-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed6-k27", "K27", "85/85 High Temperature -High Humidity Endurance", "42", "65-70"),
      createRow("ed6-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "65-70"),
      createL6InternalRow("ed6-post-l6", "3", "65-70"),
    ], { totalSampleQty: "6", totalDurationDays: "47", totalCost: "" }),
    createGroup("ema-group-d7", "Group D-7", environmentItems, [
      createRow("ed7-optical", "Optical Test", "7"),
      createRow("ed7-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed7-k27", "K27", "60/95 High Temperature -High Humidity Endurance", "46", "71-76"),
      createRow("ed7-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "71-76"),
      createRow("ed7-post-optical", "Optical Test", "1", "71-76"),
      createL6InternalRow("ed7-post-l6", "3", "71-76"),
    ], { totalSampleQty: "6", totalDurationDays: "52", totalCost: "" }),
    createGroup("ema-group-d8", "Group D-8", environmentItems, [
      createRow("ed8-optical", "Optical Test", "7"),
      createRow("ed8-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ed8-cold", "K28", "HALT Cold", "8h"),
      createNamedRow("ed8-hot", "K28", "HALT Hot", "8h"),
      createNamedRow("ed8-tst", "K28", "HALT Thermal Shock", "8h"),
      createNamedRow("ed8-vibration", "K28", "HALT Vibration", "8h"),
      createNamedRow("ed8-mix", "K28", "HALT TST & Vibration", "8h"),
      createRow("ed8-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createRow("ed8-post-optical", "Optical Test", "3"),
      createL6InternalRow("ed8-post-l6", "3"),
    ], { totalSampleQty: "15", totalDurationDays: "14", totalCost: "" }),
    createGroup(
      "ema-group-e1",
      "Group E-1",
      environmentItems,
      [createRow("ee1-item", "E-1 Restricted Substance Management", "40", "Based on actual tests")],
      { totalSampleQty: "1", totalDurationDays: "40", totalCost: "" },
    ),
    createGroup(
      "ema-group-e2",
      "Group E-2",
      environmentItems,
      [createRow("ee2-item", "E-2 Noise test", "10", "83-107")],
      { totalSampleQty: "25", totalDurationDays: "10", totalCost: "" },
    ),
  ];

  return {
    platform: "EMA",
    phases: [
      createPhase("DV", projectCode, commonGroups.filter((group) => group.title !== "Group D-8")),
      createPhase("PV", projectCode, commonGroups),
    ],
  };
}

function createEmaRhdPlan(environmentItems: EditableTestItem[], projectCode: string): EnvironmentPlanSheet {
  const commonGroups: EnvironmentPlanGroup[] = [
    createGroup("ema-rhd-group-a", "Group A", environmentItems, [
      createRow("ea-optical", "Optical Test", "7"),
      createRow("ea-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3"),
      createNamedRow("ea-k1", "K1", "Low Temperature Exposure", "2", "1-12"),
      createNamedRow("ea-k2", "K2", "High Temperature Exposure", "2", "1-12"),
      createNamedRow("ea-k3", "K3", "Low Temperature Operation", "2", "1-12"),
      createNamedRow("ea-k4", "K4", "High Temperature Operation", "5", "1-12"),
      createNamedRow("ea-k5", "K5", "Temperature Step Test", "2", "1-12"),
      createNamedRow("ea-k6", "K6", "Powered Thermal Cycle", "11", "1-12"),
      createNamedRow("ea-k7", "K7", "Thermal Shock in Air", "14", "1-12"),
      createRow("ea-mid-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-12"),
      createNamedRow("ea-k15", "K15", "Vibration", "7", "1-12"),
      createNamedRow("ea-k16-1", "K16.1", "Mechanical Shock-Package Drop", "2", "1-14"),
      createNamedRow("ea-k16-4", "K16.4", "Mechanical Shock-Low", "2", "1-12"),
      createNamedRow("ea-k17", "K17", "Audible Noise", "10", "1-12"),
      createNamedRow("ea-k9", "K9", "Humidity Temperature Cycle", "12", "1-12"),
      createNamedRow("ea-k10", "K10", "Water/Fluid Ingress Tests", "3", "1-12"),
      createNamedRow("ea-k13", "K13", "Dust Ingress", "5", "1-12"),
      createRow("ea-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "3", "1-12"),
      createRow("ea-post-optical", "Optical Test", "2", "1-12"),
      createL6InternalRow("ea-post-l6", "7", "1-12"),
    ], { totalSampleQty: "14", totalDurationDays: "94", totalCost: "" }),
    createGroup("ema-rhd-group-c", "Group C", environmentItems, [
      createNamedRow("ec-k7", "K7", "Thermal Shock in Air", "14", "15-20"),
      createNamedRow("ec-k15", "K15", "Vibration", "4", "15-20"),
      createNamedRow("ec-k13", "K13", "Dust Ingress", "2", "15-20"),
      createNamedRow("ec-k26", "K26", "Mechanical Wear-Out", "23", "15-20"),
      createRow("ec-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "15-20"),
      createRow("ec-post-optical", "Optical Test", "1", "15-20"),
      createL6InternalRow("ec-post-l6", "3", "15-20"),
    ], { totalSampleQty: "6", totalDurationDays: "49", totalCost: "" }),
    createGroup("ema-rhd-group-d4", "Group D-4", environmentItems, [
      createNamedRow("ed4-k8", "K8", "Dewing Test", "2", "21-26"),
      createRow("ed4-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "21-26"),
      createL6InternalRow("ed4-post-l6", "3", "21-26"),
    ], { totalSamplePrefix: "PCBA", totalSampleQty: "6", totalDurationDays: "7", totalCost: "" }),
    createGroup("ema-rhd-group-d6", "Group D-6", environmentItems, [
      createNamedRow("ed6-k27", "K27", "85/85 High Temperature -High Humidity Endurance", "42", "33-38"),
      createRow("ed6-post-l1l4", "L1&L4 Performance Evaluation & Functional Evaluation", "2", "33-38"),
      createL6InternalRow("ed6-post-l6", "3", "33-38"),
    ], { totalSampleQty: "6", totalDurationDays: "47", totalCost: "" }),
    createGroup(
      "ema-rhd-group-f2",
      "Group E-2",
      environmentItems,
      [createRow("ef2-item", "Operating Noise & Transient Noise", "10", "39-63")],
      { totalSampleQty: "25", totalDurationDays: "10", totalCost: "" },
    ),
  ];

  return {
    platform: "EMA",
    phases: [
      createPhase("DV", projectCode, commonGroups),
      createPhase("PV", projectCode, commonGroups),
    ],
  };
}

export function createSeedEnvironmentPlan(
  platform: PlatformCode,
  projectCode: string,
  environmentItems: EditableTestItem[],
): EnvironmentPlanSheet {
  if (platform === "MLA") {
    if (usesOnlyRhdTemplate(environmentItems)) {
      return createMlaRhdPlan(environmentItems, projectCode);
    }

    return createMlaPlan(environmentItems, projectCode);
  }

  if (usesOnlyRhdTemplate(environmentItems)) {
    return createEmaRhdPlan(environmentItems, projectCode);
  }

  return createEmaPlan(environmentItems, projectCode);
}
