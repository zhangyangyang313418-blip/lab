import {
  createEnvironmentFeeDetailSections,
  getEnvironmentAdditionalFeeSummary,
  opticalPoint19UnitPrice,
  opticalPoint51UnitPrice,
} from "./environmentFeeDetail";
import type { EnvironmentPlanGroup, EnvironmentPlanPhase, EnvironmentPlanRow, EnvironmentPlanSheet } from "../types/environmentPlan";
import type { EnvironmentFeeChargeBasis, EnvironmentFeeDetailRow, EnvironmentFeeLabName } from "../types/environmentFeeDetail";
import type { PlatformCode, ProjectSetup } from "../types/project";
import { formatSteeringSides } from "../utils/projectLabels";

type CellValue = string | number | boolean | null | undefined;

export interface MlaFeeWorksheet {
  name: string;
  rows: CellValue[][];
}

export interface MlaFeeWorkbook {
  filename: string;
  sheets: MlaFeeWorksheet[];
}

interface ExportRow {
  groupOrder: number;
  flowGroupTitle: string;
  rowOrder: number;
  phaseTitle: string;
  groupTitle: string;
  displayGroupTitle: string;
  testCode: string;
  testName: string;
  sampleRange: string;
  basisText: string;
  testTimeText: string;
  chargeBasisText: string;
  ownership: "内部费用" | "委外费用";
  estimatedItemFee: number | null;
  formulaText: string;
  notes: string;
  labs: EnvironmentFeeDetailRow["labs"];
  special: boolean;
}

interface AdditionalFeeExportRow {
  rowOrder: number;
  phaseTitle: string;
  testCode: "Computer Fee" | "Report Fee";
  testName: "Computer Fee" | "Report Fee";
  basisText: string;
  chargeBasisText: string;
  estimatedItemFee: number;
  reference: string;
  formulaText: string;
  notes: string;
}

type ExportContext = Pick<ProjectSetup, "oem" | "platform" | "steeringSides" | "projectCode" | "projectType" | "isFullyReused" | "reuseEnvironmentTemplate">;

const labSheetNames = ["SGS", "华测", "苏勃"] as const;
const labNameBySheet: Record<(typeof labSheetNames)[number], EnvironmentFeeLabName> = {
  SGS: "SGS",
  华测: "华测",
  苏勃: "苏劢",
};

const forecastHeaders = [
  "组别顺序",
  "组内顺序",
  "Phase",
  "Group",
  "测试编号",
  "测试项目",
  "样品范围",
  "计费基数",
  "测试时间",
  "计费方式",
  "费用归属",
  "内部费用",
  "委外费用",
  "费用合计",
  "费用计算公式",
  "备注",
];

const labHeaders = [
  "组别顺序",
  "组内顺序",
  "Phase",
  "Group",
  "测试编号",
  "测试项目",
  "样品范围",
  "计费基数",
  "测试时间",
  "计费方式",
  "实验室",
  "委外费用",
  "费用计算公式",
  "备注",
];

const comparisonHeaders = ["组别顺序", "组内顺序", "Phase", "Group", "SGS", "华测", "苏勃", "最低实验室", "最高实验室", "差额"];
const specialHeaders = [
  "组别顺序",
  "组内顺序",
  "Phase",
  "Group",
  "测试编号",
  "测试项目",
  "样品范围",
  "计费基数",
  "测试时间",
  "当前规则费用",
  "实验室/参考口径",
  "费用计算公式",
  "备注",
];

const validationHeaders = ["实验室", "Excel行号", "Phase", "Group", "测试编号", "测试项目", "样品范围", "计费基数", "当前费用", "规则费用", "差异", "校验结果", "规则/公式说明"];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join("；");
  }

  return String(value);
}

function cellXml(value: CellValue): string {
  if (value === null || value === undefined || value === "") {
    return "<Cell><Data ss:Type=\"String\"></Data></Cell>";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  if (typeof value === "boolean") {
    return `<Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
  }

  return `<Cell><Data ss:Type="String">${escapeXml(formatText(value))}</Data></Cell>`;
}

function worksheetXml(sheet: MlaFeeWorksheet): string {
  const rowsXml = sheet.rows
    .map((row) => `<Row>${row.map((cell) => cellXml(cell)).join("")}</Row>`)
    .join("");

  return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${rowsXml}</Table></Worksheet>`;
}

function phaseScope(plan: EnvironmentPlanSheet): string {
  return plan.phases.map((phase) => phase.title).join(" + ");
}

function metadataRows(plan: EnvironmentPlanSheet, context: ExportContext): CellValue[][] {
  return [
    ["项目概要", "", "", ""],
    ["OEM", context.oem, "平台", context.platform],
    ["项目名称/编号", context.projectCode, "驾驶方向", formatSteeringSides(context.steeringSides)],
    ["项目类型", context.projectType === "new_project" ? "新增项目" : "变更项目", "导出范围", phaseScope(plan)],
    ["是否完全复用", context.isFullyReused ? "是" : "否", "环境模板", context.reuseEnvironmentTemplate ? "完全复用" : "不完全复用"],
    [],
  ];
}

function withMetadata(sheet: MlaFeeWorksheet, plan: EnvironmentPlanSheet, context: ExportContext): MlaFeeWorksheet {
  return {
    ...sheet,
    rows: [
      ...metadataRows(plan, context),
      [],
      ...sheet.rows,
    ],
  };
}

function workbookXml(sheets: MlaFeeWorksheet[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" `
    + `xmlns:o="urn:schemas-microsoft-com:office:office" `
    + `xmlns:x="urn:schemas-microsoft-com:office:excel" `
    + `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
    + sheets.map(worksheetXml).join("")
    + `</Workbook>`;
}

function isL6ExternalPointBasis(row: EnvironmentFeeDetailRow): boolean {
  return /L6-SEM&SECTION|SEM\s*&\s*SECTION/i.test(`${row.testCode} ${row.testName}`);
}

function chargeBasisText(row: EnvironmentFeeDetailRow): string {
  if (row.chargeBasis === "hour") {
    return "按小时";
  }

  if (row.chargeBasis === "quantity") {
    if (isL6ExternalPointBasis(row)) {
      return "按点位";
    }

    return "按样品数量";
  }

  if (row.chargeBasis === "batch") {
    return "按批次";
  }

  return "待确认";
}

function basisText(row: EnvironmentFeeDetailRow): string {
  if (row.chargeBasis === "hour" && row.testHours !== null) {
    return `${row.testHours} h`;
  }

  if (row.chargeBasis === "quantity" && row.quantity !== null) {
    if (isL6ExternalPointBasis(row)) {
      return `${row.quantity} 个点位`;
    }

    return `${row.quantity} 个样品`;
  }

  if (row.chargeBasis === "batch" && row.batchCount !== null) {
    return `${row.batchCount} 批`;
  }

  return "";
}

function testTimeText(row: EnvironmentFeeDetailRow): string {
  return row.testHours === null ? "" : `${row.testHours} h`;
}

function compactNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function feeFormulaText(row: EnvironmentFeeDetailRow): string {
  if (row.estimatedItemFee === null) {
    return row.notes ?? "";
  }

  if (/^Optical Test$/i.test(row.testName)) {
    const quantity = row.quantity ?? 0;
    if (quantity <= 0) {
      return row.notes ?? "";
    }

    if (row.estimatedItemFee === quantity * opticalPoint19UnitPrice) {
      return `${quantity}台×19点位(¥${opticalPoint19UnitPrice}) = ${formatWholeCurrency(row.estimatedItemFee)}`;
    }

    const remaining = Math.max(quantity - 1, 0);
    return `1台×51点位(¥${opticalPoint51UnitPrice}) + ${remaining}台×19点位(¥${opticalPoint19UnitPrice}) = ${formatWholeCurrency(opticalPoint51UnitPrice)} + ${formatWholeCurrency(remaining * opticalPoint19UnitPrice)} = ${formatWholeCurrency(row.estimatedItemFee)}`;
  }

  if (row.chargeBasis === "hour" && row.testHours !== null && row.medianUnitPrice !== null) {
    return `${compactNumber(row.testHours)}h × ${formatWholeCurrency(row.medianUnitPrice)}/h = ${formatWholeCurrency(row.estimatedItemFee)}`;
  }

  if (row.chargeBasis === "quantity" && row.quantity !== null && row.medianUnitPrice !== null) {
    const unitLabel = isL6ExternalPointBasis(row) ? "点位" : "个";
    return `${compactNumber(row.quantity)}${unitLabel} × ${formatWholeCurrency(row.medianUnitPrice)}/${unitLabel} = ${formatWholeCurrency(row.estimatedItemFee)}`;
  }

  if (row.chargeBasis === "batch" && row.batchCount !== null && row.medianUnitPrice !== null) {
    return `${compactNumber(row.batchCount)}批 × ${formatWholeCurrency(row.medianUnitPrice)}/批 = ${formatWholeCurrency(row.estimatedItemFee)}`;
  }

  return row.notes ?? "";
}

function isInternalFee(testName: string): boolean {
  return /^Optical Test$/i.test(testName) || /^L6-photo&xray$/i.test(testName);
}

function isSpecialProject(row: EnvironmentFeeDetailRow): boolean {
  return /\bK14\b|Restricted Substance|Operating Noise|Transient Noise/i.test(`${row.testCode} ${row.testName}`);
}

function displayGroupTitle(groupTitle: string, testName?: string): string {
  if (groupTitle === "Group A") {
    return "Group A Sequence Tests";
  }

  if (groupTitle === "Group B") {
    return "Group B Sequence Tests";
  }

  if (groupTitle === "Group C") {
    return "Group C Sequence Tests";
  }

  const dGroupNames: Record<string, string> = {
    "Group D-1": "Group D Parallel Tests / D-1 Corrosive Gases",
    "Group D-2": "Group D Parallel Tests / D-2 Solar Radiation",
    "Group D-3": "Group D Parallel Tests / D-3 PCBA",
    "Group D-4": "Group D Parallel Tests / D-4 Dewing Test",
    "Group D-5": "Group D Parallel Tests / D-5 Life Test-1",
    "Group D-6": "Group D Parallel Tests / D-6 Life Test-2-1",
    "Group D-7": "Group D Parallel Tests / D-7 Life Test-2-2",
    "Group D-8": "Group D Parallel Tests / D-8",
    "Group D-9": "Group D Parallel Tests / D-9",
  };

  if (dGroupNames[groupTitle]) {
    return dGroupNames[groupTitle];
  }

  if (groupTitle === "Group E-1" && /Restricted Substance/i.test(testName ?? "")) {
    return "Group F Other Tests / Restricted Substance";
  }

  if (groupTitle === "Group E-2" && /Operating Noise|Transient Noise|Noise test/i.test(testName ?? "")) {
    return "Group F Other Tests / Noise test";
  }

  return groupTitle;
}

function getOutlineById(phase: EnvironmentPlanPhase): Map<string, { group: EnvironmentPlanGroup; row: EnvironmentPlanRow }> {
  return new Map(
    phase.groups.flatMap((group) =>
      group.rows.map((row) => [`${group.id}:${row.id}`, { group, row }] as const),
    ),
  );
}

interface SampleIdentifierScope {
  start: number;
  end: number;
  quantity: number;
  range: string;
}

interface ParsedSampleRange {
  start: number;
  end: number;
}

function formatSampleIdentifierRange(start: number, end: number): string {
  return start === end ? String(start) : `${start}-${end}`;
}

function parseSampleIdentifierRange(sampleRange: string | undefined): ParsedSampleRange | null {
  const match = sampleRange?.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
  if (!match) {
    return null;
  }

  const start = Number(match[1]);
  const end = Number(match[2] ?? match[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end < start) {
    return null;
  }

  return { start, end };
}

function getGroupSampleIdentifierScopes(phase: EnvironmentPlanPhase): Map<string, SampleIdentifierScope> {
  const scopes = new Map<string, SampleIdentifierScope>();
  let nextSampleId = 1;

  for (const group of phase.groups) {
    const quantity = Number(group.totalSampleQty || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const start = nextSampleId;
    const end = nextSampleId + quantity - 1;
    scopes.set(group.id, {
      start,
      end,
      quantity,
      range: formatSampleIdentifierRange(start, end),
    });
    nextSampleId += quantity;
  }

  return scopes;
}

function normalizeSampleIdentifierRange(sampleRange: string | undefined, scope: SampleIdentifierScope | undefined): string {
  if (!scope) {
    return sampleRange ?? "";
  }

  const parsed = parseSampleIdentifierRange(sampleRange);
  if (!parsed) {
    return sampleRange || scope.range;
  }

  if (parsed.start >= scope.start && parsed.end <= scope.end) {
    return formatSampleIdentifierRange(parsed.start, parsed.end);
  }

  if (parsed.start >= 1 && parsed.end <= scope.quantity) {
    return formatSampleIdentifierRange(scope.start + parsed.start - 1, scope.start + parsed.end - 1);
  }

  return sampleRange ?? scope.range;
}

function buildExportRows(plan: EnvironmentPlanSheet): ExportRow[] {
  return plan.phases.flatMap((phase) => {
    const outlineById = getOutlineById(phase);
    const groupOrderById = new Map<string, number>(phase.groups.map((group, index) => [group.id, index + 1]));
    const sampleIdentifierScopeByGroupId = getGroupSampleIdentifierScopes(phase);
    const rowOrderByKey = new Map<string, number>(
      phase.groups.flatMap((group) => group.rows.map((row, index) => [`${group.id}:${row.id}`, index + 1])),
    );

    return createEnvironmentFeeDetailSections(phase).flatMap((section) =>
      section.rows.map((detailRow) => {
        const outline = outlineById.get(`${section.groupId}:${detailRow.outlineRowId}`);
        const ownership = isInternalFee(detailRow.testName) ? "内部费用" : "委外费用";
        const rowKey = `${section.groupId}:${detailRow.outlineRowId}`;

        const groupOrder = groupOrderById.get(section.groupId) ?? 0;
        const displayTitle = displayGroupTitle(section.groupTitle, detailRow.testName);

        return {
          groupOrder,
          flowGroupTitle: section.groupTitle,
          rowOrder: rowOrderByKey.get(rowKey) ?? 0,
          phaseTitle: phase.title,
          groupTitle: section.groupTitle,
          displayGroupTitle: displayTitle,
          testCode: detailRow.testCode,
          testName: detailRow.testName,
          sampleRange: normalizeSampleIdentifierRange(outline?.row.sampleRange, sampleIdentifierScopeByGroupId.get(section.groupId)),
          basisText: basisText(detailRow),
          testTimeText: testTimeText(detailRow),
          chargeBasisText: chargeBasisText(detailRow),
          ownership,
          estimatedItemFee: detailRow.estimatedItemFee,
          formulaText: feeFormulaText(detailRow),
          notes: detailRow.notes ?? "",
          labs: detailRow.labs,
          special: isSpecialProject(detailRow),
        };
      }),
    );
  });
}

function formatWholeCurrency(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function displayLabName(lab: string): string {
  return lab === "苏劢" ? "苏勃" : lab;
}

function buildAdditionalFeeRows(plan: EnvironmentPlanSheet): AdditionalFeeExportRow[] {
  return plan.phases.flatMap((phase) => {
    const additionalFees = getEnvironmentAdditionalFeeSummary(phase);
    const computerQuote = additionalFees.computerLabQuotes.find((quote) => quote.lab === additionalFees.computerSelectedLab);
    const reportQuote = additionalFees.reportLabQuotes.find((quote) => quote.lab === additionalFees.reportSelectedLab);
    const computerUnitPrice = computerQuote?.unitPrice ?? 0;
    const reportUnitPrice = reportQuote?.unitPrice ?? 0;

    return [
      {
        rowOrder: 1,
        phaseTitle: phase.title,
        testCode: "Computer Fee",
        testName: "Computer Fee",
        basisText: `${additionalFees.computerCoefficient} 月/台系数`,
        chargeBasisText: "按系数",
        estimatedItemFee: additionalFees.computerFee,
        reference: `${displayLabName(additionalFees.computerSelectedLab)} 参考价`,
        formulaText: `${displayLabName(additionalFees.computerSelectedLab)} ${computerUnitPrice}/月/台 × ${additionalFees.computerCoefficient} = ${formatWholeCurrency(additionalFees.computerFee)}`,
        notes: "Computer Fee 当前按 SGS 报价计入",
      },
      {
        rowOrder: 2,
        phaseTitle: phase.title,
        testCode: "Report Fee",
        testName: "Report Fee",
        basisText: `${additionalFees.reportCount} 份报告`,
        chargeBasisText: "按报告份数",
        estimatedItemFee: additionalFees.reportFee,
        reference: `${displayLabName(additionalFees.reportSelectedLab)} 计入口径`,
        formulaText: `${displayLabName(additionalFees.reportSelectedLab)} ${reportUnitPrice}/份 × ${additionalFees.reportCount} 份 = ${formatWholeCurrency(additionalFees.reportFee)}`,
        notes: "Report Fee 当前按苏勃报价计入",
      },
    ];
  });
}

function padRow(label: string, length: number): CellValue[] {
  return [label, ...Array.from({ length: Math.max(length - 1, 0) }, () => "")];
}

function phaseOrderSummary(phaseTitle: string, rows: ExportRow[], length: number): CellValue[] {
  const groupLabels = rows
    .filter((row, index, items) =>
      items.findIndex((item) => item.phaseTitle === row.phaseTitle && item.groupTitle === row.groupTitle) === index,
    )
    .map((row) => row.flowGroupTitle)
    .join(" -> ");

  return [`${phaseTitle} 组别顺序`, groupLabels, ...Array.from({ length: Math.max(length - 2, 0) }, () => "")];
}

function appendGroupedRows(
  rows: CellValue[][],
  sourceRows: ExportRow[],
  headers: string[],
  mapRow: (row: ExportRow) => CellValue[],
) {
  let currentPhase = "";
  let currentGroup = "";

  for (const row of sourceRows) {
    if (row.phaseTitle !== currentPhase) {
      if (rows.length > 0) {
        rows.push([]);
      }
      rows.push(phaseOrderSummary(row.phaseTitle, sourceRows.filter((item) => item.phaseTitle === row.phaseTitle), headers.length));
      rows.push(padRow(`Phase: ${row.phaseTitle}`, headers.length));
      currentPhase = row.phaseTitle;
      currentGroup = "";
    }

    if (row.groupTitle !== currentGroup) {
      rows.push(padRow(`${row.flowGroupTitle}：${row.phaseTitle} / ${row.displayGroupTitle}`, headers.length));
      rows.push(headers);
      currentGroup = row.groupTitle;
    }

    rows.push(mapRow(row));
  }
}

function forecastSheet(rows: ExportRow[]): MlaFeeWorksheet {
  const sheetRows: CellValue[][] = [];
  appendGroupedRows(
    sheetRows,
    rows.filter((row) => !row.special),
    forecastHeaders,
    (row) => [
      row.flowGroupTitle,
      row.rowOrder,
      row.phaseTitle,
      row.displayGroupTitle,
      row.testCode,
      row.testName,
      row.sampleRange,
      row.basisText,
      row.testTimeText,
      row.chargeBasisText,
      row.ownership,
      row.ownership === "内部费用" ? row.estimatedItemFee ?? "" : "",
      row.ownership === "委外费用" ? row.estimatedItemFee ?? "" : "",
      row.estimatedItemFee ?? "",
      row.formulaText,
      row.notes,
    ],
  );

  return {
    name: "费用预估",
    rows: sheetRows,
  };
}

function appendForecastAdditionalFeeRows(rows: CellValue[][], additionalRows: AdditionalFeeExportRow[]) {
  let currentPhase = "";
  for (const row of additionalRows) {
    if (row.phaseTitle !== currentPhase) {
      if (rows.length > 0) {
        rows.push([]);
      }
      rows.push([`${row.phaseTitle} 附加费用`, "Computer Fee -> Report Fee", ...Array.from({ length: Math.max(forecastHeaders.length - 2, 0) }, () => "")]);
      rows.push(padRow(`Phase: ${row.phaseTitle}`, forecastHeaders.length));
      rows.push(padRow(`${row.phaseTitle} / 费用汇总附加费用`, forecastHeaders.length));
      rows.push(forecastHeaders);
      currentPhase = row.phaseTitle;
    }

    rows.push([
      "Additional Fee",
      row.rowOrder,
      row.phaseTitle,
      "费用汇总附加费用",
      row.testCode,
      row.testName,
      "",
      row.basisText,
      "",
      row.chargeBasisText,
      "委外费用",
      "",
      row.estimatedItemFee,
      row.estimatedItemFee,
      row.formulaText,
      row.notes,
    ]);
  }
}

function forecastSheetWithAdditionalFees(rows: ExportRow[], additionalRows: AdditionalFeeExportRow[]): MlaFeeWorksheet {
  const sheet = forecastSheet(rows);
  appendForecastAdditionalFeeRows(sheet.rows, additionalRows);
  return sheet;
}

function labFee(row: ExportRow, lab: EnvironmentFeeLabName): number | "" {
  const quote = row.labs.find((item) => item.lab === lab);
  return typeof quote?.itemFee === "number" ? quote.itemFee : "";
}

function labSheet(rows: ExportRow[], sheetName: (typeof labSheetNames)[number]): MlaFeeWorksheet {
  const lab = labNameBySheet[sheetName];
  const sheetRows: CellValue[][] = [];
  appendGroupedRows(
    sheetRows,
    rows.filter((row) => row.ownership === "委外费用" && !row.special),
    labHeaders,
    (row) => [
      row.flowGroupTitle,
      row.rowOrder,
      row.phaseTitle,
      row.displayGroupTitle,
      row.testCode,
      row.testName,
      row.sampleRange,
      row.basisText,
      row.testTimeText,
      row.chargeBasisText,
      sheetName,
      labFee(row, lab),
      row.formulaText,
      row.notes,
    ],
  );

  return {
    name: sheetName,
    rows: sheetRows,
  };
}

function comparisonSheet(rows: ExportRow[]): MlaFeeWorksheet {
  const totals = new Map<string, { flowGroupTitle: string; phaseTitle: string; groupTitle: string; SGS: number; 华测: number; 苏勃: number }>();

  for (const row of rows) {
    if (row.ownership !== "委外费用" || row.special) {
      continue;
    }

    const key = `${row.phaseTitle}|${row.displayGroupTitle}`;
    const current = totals.get(key) ?? { flowGroupTitle: row.flowGroupTitle, phaseTitle: row.phaseTitle, groupTitle: row.displayGroupTitle, SGS: 0, 华测: 0, 苏勃: 0 };
    current.SGS += Number(labFee(row, "SGS") || 0);
    current.华测 += Number(labFee(row, "华测") || 0);
    current.苏勃 += Number(labFee(row, "苏劢") || 0);
    totals.set(key, current);
  }

  const sheetRows: CellValue[][] = [];
  let currentPhase = "";
  for (const row of totals.values()) {
    if (row.phaseTitle !== currentPhase) {
      if (sheetRows.length > 0) {
        sheetRows.push([]);
      }
      sheetRows.push(phaseOrderSummary(row.phaseTitle, rows.filter((item) => item.phaseTitle === row.phaseTitle && item.ownership === "委外费用" && !item.special), comparisonHeaders.length));
      sheetRows.push(padRow(`Phase: ${row.phaseTitle}`, comparisonHeaders.length));
      sheetRows.push(comparisonHeaders);
      currentPhase = row.phaseTitle;
    }
        const labTotals = [
          { lab: "SGS", value: row.SGS },
          { lab: "华测", value: row.华测 },
          { lab: "苏勃", value: row.苏勃 },
        ];
        const sorted = [...labTotals].sort((left, right) => left.value - right.value);
        const min = sorted[0]!;
        const max = sorted[sorted.length - 1]!;

    sheetRows.push([row.flowGroupTitle, "", row.phaseTitle, row.groupTitle, row.SGS, row.华测, row.苏勃, min.lab, max.lab, max.value - min.value]);
  }

  return {
    name: "费用对比",
    rows: sheetRows,
  };
}

function specialReference(row: ExportRow): string {
  if (/\bK14\b/i.test(`${row.testCode} ${row.testName}`)) {
    return "指定国测";
  }

  if (/Operating Noise|Transient Noise/i.test(row.testName)) {
    return "SGS 参考价";
  }

  return "固定规则";
}

function specialSheet(rows: ExportRow[], additionalRows: AdditionalFeeExportRow[]): MlaFeeWorksheet {
  const sheetRows: CellValue[][] = [];
  appendGroupedRows(
    sheetRows,
    rows.filter((row) => row.special),
    specialHeaders,
    (row) => [
      row.flowGroupTitle,
      row.rowOrder,
      row.phaseTitle,
      row.displayGroupTitle,
      row.testCode,
      row.testName,
      row.sampleRange,
      row.basisText,
      row.testTimeText,
      row.estimatedItemFee ?? "",
      specialReference(row),
      row.formulaText,
      row.notes,
    ],
  );
  appendSpecialAdditionalFeeRows(sheetRows, additionalRows);

  return {
    name: "特殊项目费用",
    rows: sheetRows,
  };
}

function appendSpecialAdditionalFeeRows(rows: CellValue[][], additionalRows: AdditionalFeeExportRow[]) {
  let currentPhase = "";
  for (const row of additionalRows) {
    if (row.phaseTitle !== currentPhase) {
      if (rows.length > 0) {
        rows.push([]);
      }
      rows.push([`${row.phaseTitle} 附加费用`, "Computer Fee -> Report Fee", ...Array.from({ length: Math.max(specialHeaders.length - 2, 0) }, () => "")]);
      rows.push(padRow(`Phase: ${row.phaseTitle}`, specialHeaders.length));
      rows.push(padRow(`${row.phaseTitle} / 费用汇总附加费用`, specialHeaders.length));
      rows.push(specialHeaders);
      currentPhase = row.phaseTitle;
    }

    rows.push([
      "Additional Fee",
      row.rowOrder,
      row.phaseTitle,
      "费用汇总附加费用",
      row.testCode,
      row.testName,
      "",
      row.basisText,
      "",
      row.estimatedItemFee,
      row.reference,
      row.formulaText,
      row.notes,
    ]);
  }
}

function validationSheet(rows: ExportRow[], additionalRows: AdditionalFeeExportRow[]): MlaFeeWorksheet {
  const sheetRows: CellValue[][] = [validationHeaders];

  for (const row of rows) {
    if (row.estimatedItemFee === null) {
      continue;
    }

    sheetRows.push([
      row.ownership === "内部费用" ? "内部" : "预估规则",
      "",
      row.phaseTitle,
      row.displayGroupTitle,
      row.testCode,
      row.testName,
      row.sampleRange,
      row.basisText,
      row.estimatedItemFee,
      row.estimatedItemFee,
      0,
      "一致",
      row.formulaText || row.notes,
    ]);
  }

  for (const row of additionalRows) {
    sheetRows.push([
      "附加费用",
      "",
      row.phaseTitle,
      "费用汇总附加费用",
      row.testCode,
      row.testName,
      "",
      row.basisText,
      row.estimatedItemFee,
      row.estimatedItemFee,
      0,
      "一致",
      row.formulaText,
    ]);
  }

  return {
    name: "费用规则校验",
    rows: sheetRows,
  };
}

function workbookFilename(platform: PlatformCode): string {
  return `${platform}测试项目及费用预估.xls`;
}

function normalizeExportContext(plan: EnvironmentPlanSheet, context?: ExportContext | PlatformCode): ExportContext {
  if (typeof context === "string") {
    return {
      oem: "JLR",
      platform: context,
      steeringSides: ["LHD"],
      projectCode: "",
      projectType: "new_project",
      isFullyReused: true,
      reuseEnvironmentTemplate: true,
    };
  }

  return context ?? {
    oem: "JLR",
    platform: plan.platform,
    steeringSides: ["LHD"],
    projectCode: "",
    projectType: "new_project",
    isFullyReused: true,
    reuseEnvironmentTemplate: true,
  };
}

export function buildMlaEnvironmentFeeWorkbook(plan: EnvironmentPlanSheet, context?: ExportContext | PlatformCode): MlaFeeWorkbook {
  const exportContext = normalizeExportContext(plan, context);
  const rows = buildExportRows(plan);
  const additionalFeeRows = buildAdditionalFeeRows(plan);
  const sheets = [
    forecastSheetWithAdditionalFees(rows, additionalFeeRows),
    ...labSheetNames.map((sheetName) => labSheet(rows, sheetName)),
    comparisonSheet(rows),
    specialSheet(rows, additionalFeeRows),
    validationSheet(rows, additionalFeeRows),
  ].map((sheet) => withMetadata(sheet, plan, exportContext));

  return {
    filename: workbookFilename(exportContext.platform),
    sheets,
  };
}

function workbookBlob(workbook: MlaFeeWorkbook): Blob {
  return new Blob([workbookXml(workbook.sheets)], { type: "application/vnd.ms-excel;charset=utf-8" });
}

export function downloadMlaEnvironmentFeeWorkbook(plan: EnvironmentPlanSheet, context?: ExportContext | PlatformCode): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const workbook = buildMlaEnvironmentFeeWorkbook(plan, context);
  const url = URL.createObjectURL(workbookBlob(workbook));
  const link = document.createElement("a");

  link.href = url;
  link.download = workbook.filename;
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
