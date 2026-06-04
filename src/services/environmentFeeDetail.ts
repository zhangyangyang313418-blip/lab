import { mlaFeePricingRules } from "../data/seed/mlaFeePricing";
import { findMlaFeeBasisRule } from "../data/seed/mlaFeeBasis";
import type { EnvironmentPlanGroup, EnvironmentPlanPhase, EnvironmentPlanRow } from "../types/environmentPlan";
import type {
  EnvironmentFeeChargeBasis,
  EnvironmentFeeDetailRow,
  EnvironmentFeeDetailSection,
  EnvironmentFeeLabQuote,
  EnvironmentFeeLabName,
  EnvironmentFeeLabPriceValue,
  EnvironmentFeePricingRule,
  EnvironmentFeeStatus,
} from "../types/environmentFeeDetail";

const labNames: EnvironmentFeeLabName[] = ["SGS", "华测", "苏劢"];
const mlaOpticalGroupsWithOne51Point = new Set([
  "Group A",
  "Group B",
  "Group C",
  "Group D-1",
  "Group D-2",
  "Group D-5",
  "Group D-6",
  "Group D-7",
  "Group D-9",
]);
const mlaOptical19PointOnlyGroups = new Set(["Group D-8"]);

export interface EnvironmentFeeBreakdownLine {
  label: string;
  quantity?: number;
  unitPrice?: number;
  formula?: string;
  unitPriceSummary?: string;
  unitPriceSummaryLines?: string[];
  total: number;
}

export interface EnvironmentSpecialFeeBreakdown {
  chargeBasis: "optical-split" | "particle-lab-total" | "component-total";
  lines: EnvironmentFeeBreakdownLine[];
  total: number;
  medianUnitPrice?: number;
  labQuotes?: EnvironmentFeeLabQuote[];
  selectedLabel?: string;
  note?: string;
}

function formatFee(value: number | null): string {
  return value && value > 0 ? String(Math.round(value)) : "";
}

function parsePositiveNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseSampleCount(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const rangeMatch = value.match(/(\d+)\s*-\s*(\d+)/);
  if (rangeMatch) {
    const start = Number(rangeMatch[1]);
    const end = Number(rangeMatch[2]);

    return Number.isFinite(start) && Number.isFinite(end) && end >= start ? end - start + 1 : null;
  }

  const numberMatch = value.match(/\d+/);
  return numberMatch ? Number(numberMatch[0]) : null;
}

function extractTestCode(label: string): string {
  const codeMatch = label.match(/\b(K\d+(?:\.\d+)?|L1\s*&?\s*L4|L6(?:-[A-Za-z&]+)?|E-\d)\b/i);
  return codeMatch ? codeMatch[1]!.replace(/\s+/g, "") : label.split(/\s+/)[0] ?? label;
}

function findPricingRule(row: EnvironmentPlanRow): EnvironmentFeePricingRule | undefined {
  return mlaFeePricingRules.find((rule) => rule.matcher.test(row.label));
}

function isOpticalTestRow(row: EnvironmentPlanRow) {
  return /Optical Test/i.test(row.label);
}

function isMlaBaselineOpticalRow(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  return group.id === "mla-group-a" && row.id === "a-optical";
}

function isMlaBaselineL1L4Row(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  return group.id === "mla-group-a" && row.id === "a-l1l4";
}

function getPreTestSampleTotal(phase: EnvironmentPlanPhase) {
  return phase.groups
    .filter((group) => !group.title.startsWith("Group E-"))
    .reduce((sum, group) => sum + Number(group.totalSampleQty || 0), 0);
}

function countMla51PointOpticalSamples(phase: EnvironmentPlanPhase) {
  return phase.groups.reduce((count, group) => {
    if (!mlaOpticalGroupsWithOne51Point.has(group.title)) {
      return count;
    }

    return Number(group.totalSampleQty || 0) > 0 ? count + 1 : count;
  }, 0);
}

function hasParticleExposure(group: EnvironmentPlanGroup) {
  return group.rows.some((row) => /Particle Exposure/i.test(row.label));
}

function isMlaParticleExposureRow(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  return group.id.startsWith("mla-group-") && /Particle Exposure/i.test(row.label);
}

function shouldReduceParticleFees(phase: EnvironmentPlanPhase, group: EnvironmentPlanGroup) {
  return group.title === "Group C" && phase.groups.some((item) => item.title === "Group A" && hasParticleExposure(item));
}

function calculateParticleLabTotals(quantity: number, reduced: boolean) {
  const labs = [
    {
      lab: "SGS" as const,
      batchSize: 6,
      batchFee: 2500,
      dustFee: reduced ? 0 : 8000,
      cleaningFee: 0,
    },
    {
      lab: "华测" as const,
      batchSize: 3,
      batchFee: 1500,
      dustFee: reduced ? 0 : 6000,
      cleaningFee: reduced ? 0 : 12000,
    },
    {
      lab: "苏劢" as const,
      batchSize: 3,
      batchFee: 6500,
      dustFee: reduced ? 0 : 5000,
      cleaningFee: 0,
    },
  ].map((config) => {
    const batchCount = Math.ceil(quantity / config.batchSize);
    const total = batchCount * config.batchFee + config.dustFee + config.cleaningFee;
    const formulaParts = [`${batchCount} 批 × ${config.batchFee}`];

    if (config.dustFee > 0) {
      formulaParts.push(`粉尘费 ${config.dustFee}`);
    }

    if (config.cleaningFee > 0) {
      formulaParts.push(`清洁费 ${config.cleaningFee}`);
    }

    return {
      lab: config.lab,
      batchCount,
      total,
      formula: formulaParts.join(" + "),
    };
  });

  return labs;
}

function getParticleMedianTotal(labs: Array<{ lab: EnvironmentFeeLabName; total: number }>) {
  const totals = labs.map((lab) => lab.total).sort((left, right) => left - right);
  const medianTotal = totals[Math.floor(totals.length / 2)] ?? null;

  if (medianTotal === null) {
    return { medianTotal: null, medianLab: undefined as EnvironmentFeeLabName | undefined };
  }

  const medianLab = labs.find((lab) => lab.total === medianTotal)?.lab;
  return { medianTotal, medianLab };
}

function getParticleExposureBreakdown(
  phase: EnvironmentPlanPhase,
  group: EnvironmentPlanGroup,
  quantity: number | null,
): EnvironmentSpecialFeeBreakdown | null {
  if (quantity === null || quantity <= 0) {
    return null;
  }

  const reduced = shouldReduceParticleFees(phase, group);
  const labs = calculateParticleLabTotals(quantity, reduced);
  const { medianTotal, medianLab } = getParticleMedianTotal(labs);

  if (medianTotal === null) {
    return null;
  }

  return {
    chargeBasis: "particle-lab-total",
    lines: labs.map((lab) => ({
      label: lab.lab,
      formula: lab.formula,
      total: lab.total,
    })),
    total: medianTotal,
    labQuotes: labNames.map((lab) => {
      const line = labs.find((item) => item.lab === lab);

      return {
        lab,
        unitPrice: "",
        itemFee: line?.total ?? "N/A",
      };
    }),
    ...(medianLab ? { selectedLabel: medianLab } : {}),
    note: reduced ? "A 组已做，当前仅保留批次费" : "当前按实验室全额费用取中值",
  };
}

function createComponentFormula(
  rule: EnvironmentFeePricingRule,
  basisValue: number,
  unitPrice: number,
  fixedLabAddOnPrice?: number,
) {
  const componentLabel = rule.componentLabel ?? `${rule.componentMultiplier ?? 1} 项`;
  const quantityLabel = rule.quantityLabel
    ?? (rule.chargeBasis === "hour" ? "h" : rule.chargeBasis === "batch" ? "批" : "台样机");
  const quantityPart = quantityLabel ? `${basisValue} ${quantityLabel}` : "";
  const componentFormula = [componentLabel, quantityPart, String(unitPrice)].filter(Boolean).join(" × ");

  return fixedLabAddOnPrice === undefined
    ? componentFormula
    : `${componentFormula} + ${rule.fixedLabAddOn?.label ?? "固定加项"} ${fixedLabAddOnPrice}`;
}

function getComponentMedianLab(lines: EnvironmentFeeBreakdownLine[], medianTotal: number) {
  return lines.find((line) => line.total === medianTotal)?.label as EnvironmentFeeLabName | undefined;
}

function getCompositeComponentBasisValue(
  component: NonNullable<EnvironmentFeePricingRule["compositeLabComponents"]>[number],
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
) {
  if (component.fixedCount !== undefined) {
    return component.fixedCount;
  }

  return component.basis ? calculateBasisValue(component.basis, base) : null;
}

function getCompositeComponentFeeBreakdown(
  rule: EnvironmentFeePricingRule,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
): EnvironmentSpecialFeeBreakdown | null {
  const components = rule.compositeLabComponents;

  if (!components || components.length === 0) {
    return null;
  }

  const lines = labNames.flatMap((lab) => {
    const segmentFormulas: string[] = [];
    const segmentUnitPrices = new Map<string, number>();
    let total = 0;

    for (const component of components) {
      const basisValue = getCompositeComponentBasisValue(component, base);
      const unitPrice = component.prices[lab];

      if (basisValue === null || basisValue <= 0 || !isValidUnitPrice(unitPrice)) {
        return [];
      }

      segmentFormulas.push(`${basisValue} ${component.countLabel} × ${unitPrice}`);
      segmentUnitPrices.set(component.label, unitPrice);
      total += basisValue * unitPrice;
    }

    const roomUnitPrice = segmentUnitPrices.get("常温");
    const hotUnitPrice = segmentUnitPrices.get("高温");
    const coldUnitPrice = segmentUnitPrices.get("低温");

    return [{
      label: lab,
      formula: segmentFormulas.join(" + "),
      ...(roomUnitPrice !== undefined && hotUnitPrice !== undefined && coldUnitPrice !== undefined
        ? {
            unitPriceSummary: `常温 ${roomUnitPrice}；高温 ${hotUnitPrice}；低温 ${coldUnitPrice}`,
            unitPriceSummaryLines: [`常温 ${roomUnitPrice}`, `高温 ${hotUnitPrice}`, `低温 ${coldUnitPrice}`],
          }
        : {}),
      total: Math.round(total),
    }];
  });

  const medianTotal = calculateLabMedianUnitPrice(lines.map((line) => line.total));

  if (medianTotal === null) {
    return null;
  }

  const selectedLabel = getComponentMedianLab(lines, medianTotal);

  return {
    chargeBasis: "component-total",
    lines,
    total: medianTotal,
    labQuotes: labNames.map((lab) => {
      const line = lines.find((item) => item.label === lab);

      return {
        lab,
        unitPrice: rule.labs[lab],
        itemFee: line?.total ?? "N/A",
      };
    }),
    ...(selectedLabel ? { selectedLabel } : {}),
    ...(rule.notes ? { note: rule.notes } : {}),
  };
}

function getAdditiveComponentFeeBreakdown(
  rule: EnvironmentFeePricingRule,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
): EnvironmentSpecialFeeBreakdown | null {
  const component = rule.additiveComponent;

  if (!component) {
    return null;
  }

  const variableBasisValue = calculateBasisValue(component.variableBasis, base);

  if (variableBasisValue === null || variableBasisValue <= 0) {
    return null;
  }

  const lines = labNames.flatMap((lab) => {
    const variableUnitPrice = rule.labs[lab];
    const fixedUnitPrice = component.fixedUnitPrices?.[lab] ?? component.fixedUnitPrice;

    if (!isValidUnitPrice(variableUnitPrice) || !isValidUnitPrice(fixedUnitPrice)) {
      return [];
    }

    const fixedTotal = component.fixedCount * fixedUnitPrice;
    const variableTotal = variableBasisValue * variableUnitPrice;

    return [{
      label: lab,
      formula: `${component.fixedCount} ${component.fixedLabel} × ${fixedUnitPrice} + ${variableBasisValue} ${component.variableLabel} × ${variableUnitPrice}`,
      total: Math.round(fixedTotal + variableTotal),
    }];
  });
  const medianTotal = calculateLabMedianUnitPrice(lines.map((line) => line.total));

  if (medianTotal === null) {
    return null;
  }

  const selectedLabel = getComponentMedianLab(lines, medianTotal);

  return {
    chargeBasis: "component-total",
    lines,
    total: medianTotal,
    labQuotes: labNames.map((lab) => {
      const unitPrice = rule.labs[lab];
      const line = lines.find((item) => item.label === lab);

      return {
        lab,
        unitPrice,
        itemFee: line?.total ?? "N/A",
      };
    }),
    ...(selectedLabel ? { selectedLabel } : {}),
    ...(rule.notes ? { note: rule.notes } : {}),
  };
}

function isL6InternalInspectionRow(row: EnvironmentPlanRow) {
  return /L6-photo&xray|\bL6\b|Internal Inspection|SEM&SECTION/i.test(row.label);
}

function isL6ExternalInspectionRow(row: EnvironmentPlanRow) {
  return /L6-SEM&SECTION|外部/i.test(row.label);
}

function isL6InternalOnlyInspectionRow(row: EnvironmentPlanRow) {
  return /L6-photo&xray|内部/i.test(row.label) && !isL6ExternalInspectionRow(row);
}

function getComponentFeeBreakdown(
  rule: EnvironmentFeePricingRule | undefined,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
): EnvironmentSpecialFeeBreakdown | null {
  if (!rule) {
    return null;
  }

  const compositeBreakdown = getCompositeComponentFeeBreakdown(rule, base);

  if (compositeBreakdown) {
    return compositeBreakdown;
  }

  const additiveBreakdown = getAdditiveComponentFeeBreakdown(rule, base);

  if (additiveBreakdown) {
    return additiveBreakdown;
  }

  if (!rule.componentMultiplier) {
    return null;
  }

  const componentBasisValue = calculateBasisValue(rule.chargeBasis, base);

  if (componentBasisValue === null || componentBasisValue <= 0) {
    return null;
  }

  const medianUnitPrice = rule.fixedUnitPrice ?? calculateLabMedianUnitPrice(Object.values(rule.labs));

  if (medianUnitPrice === null) {
    return null;
  }

  const lines = labNames.flatMap((lab) => {
    const unitPrice = rule.labs[lab];
    const fixedLabAddOnPrice = rule.fixedLabAddOn?.prices[lab];

    if (!isValidUnitPrice(unitPrice) || (fixedLabAddOnPrice !== undefined && !isValidUnitPrice(fixedLabAddOnPrice))) {
      return [];
    }

    return [{
      label: lab,
      formula: fixedLabAddOnPrice === undefined
        ? createComponentFormula(rule, componentBasisValue, unitPrice, fixedLabAddOnPrice)
        : `四项单价 ${unitPrice}；微应力 ${fixedLabAddOnPrice}`,
      total: Math.round(rule.componentMultiplier! * componentBasisValue * unitPrice + (fixedLabAddOnPrice ?? 0)),
    }];
  });
  const total = calculateLabMedianUnitPrice(lines.map((line) => line.total));

  if (total === null) {
    return null;
  }

  const selectedLabel = getComponentMedianLab(lines, total);

  return {
    chargeBasis: "component-total",
    lines,
    total,
    medianUnitPrice,
    labQuotes: labNames.map((lab) => {
      const unitPrice = rule.labs[lab];
      const line = lines.find((item) => item.label === lab);

      return {
        lab,
        unitPrice,
        itemFee: line?.total ?? "N/A",
      };
    }),
    ...(selectedLabel ? { selectedLabel } : {}),
    ...(rule.notes ? { note: rule.notes } : {}),
  };
}

function getMlaOpticalBreakdown(
  phase: EnvironmentPlanPhase,
  group: EnvironmentPlanGroup,
  row: EnvironmentPlanRow,
  quantity: number | null,
): EnvironmentSpecialFeeBreakdown | null {
  if (quantity === null || quantity <= 0) {
    return null;
  }

  if (isMlaBaselineOpticalRow(group, row)) {
    const point51Count = Math.min(quantity, countMla51PointOpticalSamples(phase));
    const point19Count = Math.max(quantity - point51Count, 0);
    const lines = [
      { label: "51 点位样品", quantity: point51Count, unitPrice: 460, total: point51Count * 460 },
      { label: "19 点位样品", quantity: point19Count, unitPrice: 210, total: point19Count * 210 },
    ].filter((line) => line.quantity > 0);

    return {
      chargeBasis: "optical-split",
      lines,
      total: lines.reduce((sum, line) => sum + line.total, 0),
    };
  }

  if (mlaOptical19PointOnlyGroups.has(group.title)) {
    return {
      chargeBasis: "optical-split",
      lines: [{ label: "19 点位样品", quantity, unitPrice: 210, total: quantity * 210 }],
      total: quantity * 210,
    };
  }

  if (mlaOpticalGroupsWithOne51Point.has(group.title)) {
    const point51Count = 1;
    const point19Count = Math.max(quantity - point51Count, 0);
    const lines = [
      { label: "51 点位样品", quantity: point51Count, unitPrice: 460, total: point51Count * 460 },
      { label: "19 点位样品", quantity: point19Count, unitPrice: 210, total: point19Count * 210 },
    ].filter((line) => line.quantity > 0);

    return {
      chargeBasis: "optical-split",
      lines,
      total: lines.reduce((sum, line) => sum + line.total, 0),
    };
  }

  return null;
}

export function getEnvironmentSpecialFeeBreakdown(
  phase: EnvironmentPlanPhase,
  group: EnvironmentPlanGroup,
  row: EnvironmentPlanRow,
): EnvironmentSpecialFeeBreakdown | null {
  if (isMlaParticleExposureRow(group, row)) {
    return getParticleExposureBreakdown(phase, group, getQuantity(row, group, phase));
  }

  if (isMlaOpticalSpecialRow(group, row)) {
    return getMlaOpticalBreakdown(phase, group, row, getQuantity(row, group, phase));
  }

  const outlineBasis = {
    testHours: getDisplayedTestHours(row),
    quantity: getQuantity(row, group, phase),
    batchCount: getBatchCount(row),
  };
  const feeBasis = applyCoefficientBasis(group, row, outlineBasis);

  return getComponentFeeBreakdown(findPricingRule(row), feeBasis);
}

function isMlaOpticalSpecialRow(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  if (!group.id.startsWith("mla-group-") || !isOpticalTestRow(row)) {
    return false;
  }

  return isMlaBaselineOpticalRow(group, row)
    || mlaOpticalGroupsWithOne51Point.has(group.title)
    || group.title === "Group D-8";
}

function calculateMlaOpticalFee(phase: EnvironmentPlanPhase, group: EnvironmentPlanGroup, row: EnvironmentPlanRow, quantity: number | null) {
  return getMlaOpticalBreakdown(phase, group, row, quantity)?.total ?? null;
}

function isValidUnitPrice(value: number | string | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function calculateBasisValue(
  basis: EnvironmentFeeChargeBasis,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
): number | null {
  if (basis === "hour") {
    return base.testHours;
  }

  if (basis === "quantity") {
    return base.quantity;
  }

  if (basis === "batch") {
    return base.batchCount;
  }

  return null;
}

function getChamberAdjustedLabs(rule: EnvironmentFeePricingRule, quantity: number | null): EnvironmentFeePricingRule["labs"] {
  if (!rule.chamberPrices) {
    return rule.labs;
  }

  return quantity !== null && quantity <= 6 ? rule.chamberPrices.small : rule.chamberPrices.large;
}

export function calculateLabMedianUnitPrice(values: Array<number | string | undefined>): number | null {
  const validPrices = values.filter(isValidUnitPrice).sort((left, right) => left - right);

  if (validPrices.length === 0) {
    return null;
  }

  if (validPrices.length === 1) {
    return validPrices[0]!;
  }

  if (validPrices.length === 2) {
    return validPrices[0]!;
  }

  const middleIndex = Math.floor(validPrices.length / 2);
  return validPrices[middleIndex]!;
}

export function calculateFeeAmount(
  unitPrice: number | null,
  basis: EnvironmentFeeChargeBasis,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
): number | null {
  if (unitPrice === null || basis === "pending") {
    return null;
  }

  const basisValue = calculateBasisValue(basis, base);
  return basisValue === null ? null : Math.round(unitPrice * basisValue);
}

function getQuantity(row: EnvironmentPlanRow, group: EnvironmentPlanGroup, phase: EnvironmentPlanPhase): number | null {
  if (isMlaBaselineL1L4Row(group, row)) {
    const sampleTotal = getPreTestSampleTotal(phase);
    return sampleTotal > 0 ? sampleTotal : null;
  }

  if (row.id.includes("l1l4") && !row.sampleRange) {
    return parseSampleCount(phase.summary.totalSampleQty);
  }

  return parseSampleCount(row.sampleRange) ?? parseSampleCount(group.totalSampleQty) ?? parseSampleCount(phase.summary.totalSampleQty);
}

function getBatchCount(row: EnvironmentPlanRow): number | null {
  if (row.sampleRange && /\d+\s*-\s*\d+/.test(row.sampleRange)) {
    return null;
  }

  return parsePositiveNumber(row.sampleRange) ?? null;
}

function getDisplayedTestHours(row: EnvironmentPlanRow): number | null {
  const testHoursDays = parsePositiveNumber(row.testHours);
  return testHoursDays === null ? null : testHoursDays * 24;
}

function getK15VibrationFixtureHours(row: EnvironmentPlanRow, quantity: number | null): number | null {
  if (/\bK28\b|HALT/i.test(row.label) || !/\bK15\b|Vibartion|Vibration/i.test(row.label) || quantity === null || quantity <= 0) {
    return null;
  }

  return Math.ceil(quantity / 6) * 24;
}

function getThreeSampleFixtureBatches(row: EnvironmentPlanRow, quantity: number | null): number | null {
  if (!/\bK13\b|Dust Ingress|\bK14\b|Dust Blowing Test/i.test(row.label) || quantity === null || quantity <= 0) {
    return null;
  }

  return Math.ceil(quantity / 3);
}

function applyCoefficientBasis(
  group: EnvironmentPlanGroup,
  row: EnvironmentPlanRow,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
) {
  const basisRule = findMlaFeeBasisRule(group.title, row.label);
  const vibrationFixtureHours = getK15VibrationFixtureHours(row, base.quantity);
  const threeSampleFixtureBatches = getThreeSampleFixtureBatches(row, base.quantity);

  if (!basisRule) {
    return {
      ...base,
      testHours: vibrationFixtureHours ?? base.testHours,
      batchCount: threeSampleFixtureBatches ?? base.batchCount,
    };
  }

  return {
    testHours: vibrationFixtureHours ?? basisRule.basis.hour ?? base.testHours,
    quantity: basisRule.basis.quantity ?? base.quantity,
    batchCount: threeSampleFixtureBatches ?? basisRule.basis.batch ?? base.batchCount,
  };
}

function applyUserFeeBasisOverrides(
  row: EnvironmentPlanRow,
  basis: { testHours: number | null; quantity: number | null; batchCount: number | null },
) {
  const hour = parsePositiveNumber(row.feeBasisOverrides?.hour);
  const quantity = parsePositiveNumber(row.feeBasisOverrides?.quantity);
  const batch = parsePositiveNumber(row.feeBasisOverrides?.batch);

  return {
    testHours: hour ?? basis.testHours,
    quantity: quantity ?? basis.quantity,
    batchCount: batch ?? basis.batchCount,
  };
}

function getFeeStatus(rule: EnvironmentFeePricingRule | undefined, estimatedItemFee: number | null): EnvironmentFeeStatus {
  if (!rule) {
    return "待确认";
  }

  if (rule.chargeBasis === "pending") {
    return "规则待确认";
  }

  return estimatedItemFee === null ? "待确认" : "priced";
}

function createLabQuotes(
  labs: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>,
  basis: EnvironmentFeeChargeBasis,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
): EnvironmentFeeLabQuote[] {
  return labNames.map((lab) => {
    const unitPrice = labs[lab];
    const itemFee: EnvironmentFeeLabQuote["itemFee"] = isValidUnitPrice(unitPrice)
      ? calculateFeeAmount(unitPrice, basis, base)
      : "N/A";

    return {
      lab,
      unitPrice,
      itemFee,
    };
  });
}

function createRuleLabQuotes(
  rule: EnvironmentFeePricingRule | undefined,
  labs: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>,
  basis: EnvironmentFeeChargeBasis,
  base: { testHours: number | null; quantity: number | null; batchCount: number | null },
): EnvironmentFeeLabQuote[] {
  if (rule?.fixedUnitPrice !== undefined) {
    return [];
  }

  return createLabQuotes(labs, basis, base);
}

function createDetailRow(
  phase: EnvironmentPlanPhase,
  group: EnvironmentPlanGroup,
  row: EnvironmentPlanRow,
): EnvironmentFeeDetailRow {
  const outlineBasis = {
    testHours: getDisplayedTestHours(row),
    quantity: getQuantity(row, group, phase),
    batchCount: getBatchCount(row),
  };
  const shouldKeepConfirmedSpecialBasis = isMlaParticleExposureRow(group, row)
    || isMlaOpticalSpecialRow(group, row)
    || isMlaBaselineL1L4Row(group, row)
    || (isL6InternalInspectionRow(row) && isL6InternalOnlyInspectionRow(row));
  const feeBasis = applyUserFeeBasisOverrides(
    row,
    shouldKeepConfirmedSpecialBasis
      ? outlineBasis
      : applyCoefficientBasis(group, row, outlineBasis),
  );
  const { testHours, quantity, batchCount } = feeBasis;
  const particleBreakdown = isMlaParticleExposureRow(group, row) ? getParticleExposureBreakdown(phase, group, outlineBasis.quantity) : null;
  const specialOpticalFee = isMlaOpticalSpecialRow(group, row) ? calculateMlaOpticalFee(phase, group, row, outlineBasis.quantity) : null;
  const rule = findPricingRule(row);
  const componentBreakdown = getComponentFeeBreakdown(rule, { testHours, quantity, batchCount });

  if (particleBreakdown !== null) {
    const particleLabQuotes = particleBreakdown.lines.reduce<Record<EnvironmentFeeLabName, number | "N/A">>(
      (result, line) => {
        if (line.label === "SGS" || line.label === "华测" || line.label === "苏劢") {
          result[line.label] = line.total;
        }

        return result;
      },
      { SGS: "N/A", 华测: "N/A", 苏劢: "N/A", 信测: "N/A" },
    );

    return {
      groupId: group.id,
      groupTitle: group.title,
      outlineRowId: row.id,
      testCode: extractTestCode(row.label),
      testName: row.label,
      testHours,
      quantity,
      batchCount,
      chargeBasis: "batch",
      medianUnitPrice: null,
      estimatedItemFee: particleBreakdown.total,
      labs: createLabQuotes(
        { SGS: "", 华测: "", 苏劢: "", 信测: "" },
        "batch",
        { testHours, quantity, batchCount },
      ).map((lab) => ({
        ...lab,
        unitPrice: "",
        itemFee: typeof particleLabQuotes[lab.lab] === "number" ? particleLabQuotes[lab.lab] : "N/A",
      })),
      status: "priced",
      notes:
        particleBreakdown.note && particleBreakdown.selectedLabel
          ? `Particle Exposure: 中值实验室 ${particleBreakdown.selectedLabel}；${particleBreakdown.note}`
          : "Particle Exposure: 实验室总价中值",
    };
  }

  if (specialOpticalFee !== null) {
    const notes = isMlaBaselineOpticalRow(group, row)
      ? "Optical Test: baseline 汇总，51 点位样品按组各取 1 台，其余按 19 点位计费"
      : group.title === "Group D-8"
        ? "Optical Test: 全部按 19 点位计费"
        : "Optical Test: 1 台按 51 点位，其余按 19 点位计费";

    return {
      groupId: group.id,
      groupTitle: group.title,
      outlineRowId: row.id,
      testCode: extractTestCode(row.label),
      testName: row.label,
      testHours,
      quantity,
      batchCount,
      chargeBasis: "quantity",
      medianUnitPrice: null,
      estimatedItemFee: specialOpticalFee,
      labs: createLabQuotes({ SGS: "", 华测: "", 苏劢: "", 信测: "" }, "quantity", { testHours, quantity, batchCount }),
      status: "priced",
      notes,
    };
  }

  if (componentBreakdown !== null) {
    return {
      groupId: group.id,
      groupTitle: group.title,
      outlineRowId: row.id,
      testCode: extractTestCode(row.label),
      testName: row.label,
      testHours,
      quantity,
      batchCount,
      chargeBasis: rule?.chargeBasis ?? "quantity",
      medianUnitPrice: componentBreakdown.medianUnitPrice ?? null,
      estimatedItemFee: componentBreakdown.total,
      labs: componentBreakdown.labQuotes ?? [],
      status: "priced",
      ...(rule?.priceLabel ? { priceLabel: rule.priceLabel } : {}),
      ...(rule?.hideUnavailableLabQuotes ? { hideUnavailableLabQuotes: true } : {}),
      ...(componentBreakdown.note ? { notes: componentBreakdown.note } : {}),
    };
  }

  const chargeBasis = rule?.chargeBasis ?? "pending";
  const labs: EnvironmentFeePricingRule["labs"] = rule
    ? getChamberAdjustedLabs(rule, quantity)
    : { SGS: "", 华测: "", 苏劢: "", 信测: "" };
  const medianUnitPrice = chargeBasis === "pending"
    ? null
    : rule?.fixedUnitPrice ?? calculateLabMedianUnitPrice(Object.values(labs));
  const estimatedItemFee = calculateFeeAmount(medianUnitPrice, chargeBasis, { testHours, quantity, batchCount });

  return {
    groupId: group.id,
    groupTitle: group.title,
    outlineRowId: row.id,
    testCode: extractTestCode(row.label),
    testName: row.label,
    testHours,
    quantity,
    batchCount,
    chargeBasis,
    medianUnitPrice,
    estimatedItemFee,
    labs: createRuleLabQuotes(rule, labs, chargeBasis, { testHours, quantity, batchCount }),
    status: getFeeStatus(rule, estimatedItemFee),
    ...(rule?.priceLabel ? { priceLabel: rule.priceLabel } : {}),
    ...(rule?.hideUnavailableLabQuotes ? { hideUnavailableLabQuotes: true } : {}),
    ...(rule?.notes ? { notes: rule.notes } : {}),
  };
}

export function createEnvironmentFeeDetailSections(phase: EnvironmentPlanPhase): EnvironmentFeeDetailSection[] {
  return phase.groups.map((group) => {
    const rows = group.rows.map((row) => createDetailRow(phase, group, row));

    return {
      groupId: group.id,
      groupTitle: group.title,
      totalSampleQty: group.totalSampleQty,
      rows,
      totalEstimatedFee: rows.reduce((sum, row) => sum + (row.estimatedItemFee ?? 0), 0),
    };
  });
}

export function applyEnvironmentFeeDetailsToPhase(phase: EnvironmentPlanPhase): EnvironmentPlanPhase {
  const sections = createEnvironmentFeeDetailSections(phase);
  const feeByRowId = new Map(
    sections.flatMap((section) => section.rows.map((row) => [row.outlineRowId, formatFee(row.estimatedItemFee)])),
  );
  const totalByGroupId = new Map(sections.map((section) => [section.groupId, section.totalEstimatedFee]));
  const totalCost = sections.reduce((sum, section) => sum + section.totalEstimatedFee, 0);

  return {
    ...phase,
    summary: {
      ...phase.summary,
      totalCost: formatFee(totalCost),
    },
    groups: phase.groups.map((group) => ({
      ...group,
      totalCost: formatFee(totalByGroupId.get(group.id) ?? 0),
      rows: group.rows.map((row) => ({
        ...row,
        fee: feeByRowId.get(row.id) ?? row.fee ?? "",
      })),
    })),
  };
}
