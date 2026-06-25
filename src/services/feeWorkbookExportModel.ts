import type { EnvironmentPlanRow, EnvironmentPlanSheet } from "../types/environmentPlan";

export type WorkbookCellValue = string | number | boolean | null;
export type WorkbookExportRowKind = "outline" | "additional-fee" | "summary";
export type WorkbookSheetRowRole = "metadata" | "header" | "group" | "data" | "total" | "helper";

export interface WorkbookExportFields {
  platform: EnvironmentPlanSheet["platform"];
  phaseTitle: string;
  groupTitle: string;
  testName: string;
  testHours: string;
  sampleRange: string | null;
  estimatedFee: number | null;
  status: "已识别" | "待确认";
}

export interface WorkbookExportRecord {
  phaseKey: string | null;
  groupKey: string | null;
  rowKey: string | null;
  sourceKey: string | null;
  ruleKey: string | null;
  rowKind: WorkbookExportRowKind;
  ordinal: number;
  fields: WorkbookExportFields;
}

export interface WorkbookSheetRow {
  sourceKey: string | null;
  role: WorkbookSheetRowRole;
  cellsByField: Record<string, WorkbookCellValue>;
}

export interface WorkbookSheetSchema {
  sheetName: string;
  columnsByField: Readonly<Record<string, string>>;
  businessColumns: readonly string[];
}

const knownSeedRowIdPattern = /^(?:a|b|c|d[1-9]|e1|e2|ea|eb|ec|ed[1-9]|ee1|ee2|ef2)-(?:optical|l1l4|particle|mid-l1l4|post-l1l4|post-optical|post-l6(?:-(?:internal|external))?|k\d+(?:-\d+)?|cold|hot|mix|tst|vibration|item)$/i;

function resolveRuleKey(row: EnvironmentPlanRow): string | null {
  if (row.id.startsWith("manual-") || !knownSeedRowIdPattern.test(row.id)) {
    return null;
  }

  return `seed:${row.id.toLowerCase()}`;
}

function parseOptionalAmount(value: string | undefined): number | null {
  const normalized = value?.trim().replace(/[,\s￥¥]/g, "");
  if (!normalized) {
    return null;
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
}

export function buildFeeWorkbookExportRecords(plan: EnvironmentPlanSheet): WorkbookExportRecord[] {
  let ordinal = 0;

  return plan.phases.flatMap((phase) =>
    phase.groups.flatMap((group) =>
      group.rows.map((row) => {
        ordinal += 1;
        const sourceKey = `${phase.id}/${group.id}/${row.id}`;
        const ruleKey = resolveRuleKey(row);

        return {
          phaseKey: phase.id,
          groupKey: group.id,
          rowKey: row.id,
          sourceKey,
          ruleKey,
          rowKind: "outline",
          ordinal,
          fields: {
            platform: plan.platform,
            phaseTitle: phase.title,
            groupTitle: group.title,
            testName: row.label,
            testHours: row.testHours,
            sampleRange: row.sampleRange?.trim() || null,
            estimatedFee: parseOptionalAmount(row.fee),
            status: ruleKey === null ? "待确认" : "已识别",
          },
        } satisfies WorkbookExportRecord;
      }),
    ),
  );
}

const sampleDemandFields = [
  "groupOrder",
  "rowOrder",
  "testCode",
  "testName",
  "sampleRange",
  "hudSamples",
  "pcbaSamples",
  "vibrationFixture",
  "dustWaterFixture",
  "projectionBoard",
  "videoPowerCable",
  "serialCable",
  "hudPower2m",
  "hudPower3m",
  "fpdLink2m",
  "fpdLink3m",
  "hub",
  "usbExtension",
  "sensor",
  "sensorBoard",
  "sensorCable",
  "specialRequirements",
] as const;

function schema(
  sheetName: string,
  fields: readonly string[],
  columns: readonly string[],
): WorkbookSheetSchema {
  return {
    sheetName,
    columnsByField: Object.fromEntries(fields.map((field, index) => [field, columns[index]!])),
    businessColumns: columns,
  };
}

const forecastFields = [
  "groupOrder",
  "rowOrder",
  "phase",
  "group",
  "testCode",
  "testName",
  "sampleRange",
  "billingBasis",
  "testTime",
  "billingMethod",
  "feeOwnership",
  "internalFee",
  "externalFee",
  "totalFee",
  "calculationFormula",
  "notes",
] as const;

const labFields = [
  "groupOrder",
  "rowOrder",
  "phase",
  "group",
  "testCode",
  "testName",
  "sampleRange",
  "billingBasis",
  "testTime",
  "billingMethod",
  "laboratory",
  "externalFee",
  "calculationFormula",
  "notes",
] as const;

export const feeWorkbookSheetSchemas = {
  sampleDemandDv: schema(
    "样品及辅助设备需求",
    sampleDemandFields,
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V"],
  ),
  sampleDemandPv: schema(
    "样品及辅助设备需求",
    sampleDemandFields,
    ["X", "Y", "Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG", "AH", "AI", "AJ", "AK", "AL", "AM", "AN", "AO", "AP", "AQ", "AR", "AS"],
  ),
  forecast: schema(
    "费用预估",
    forecastFields,
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P"],
  ),
  sgs: schema(
    "SGS",
    labFields,
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"],
  ),
  cti: schema(
    "华测",
    labFields,
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"],
  ),
  subo: schema(
    "苏勃",
    labFields,
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N"],
  ),
  comparison: schema(
    "费用对比",
    ["groupOrder", "rowOrder", "phase", "group", "sgsFee", "ctiFee", "suboFee", "lowestLab", "highestLab", "difference"],
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
  ),
  special: schema(
    "特殊项目费用",
    ["groupOrder", "rowOrder", "phase", "group", "testCode", "testName", "sampleRange", "billingBasis", "testTime", "currentRuleFee", "referenceBasis", "calculationFormula", "notes"],
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"],
  ),
  validation: schema(
    "费用规则校验",
    ["laboratory", "excelRow", "phase", "group", "testCode", "testName", "sampleRange", "billingBasis", "currentFee", "ruleFee", "difference", "validationResult", "ruleDescription"],
    ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"],
  ),
} as const satisfies Record<string, WorkbookSheetSchema>;
