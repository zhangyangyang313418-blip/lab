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

interface DemandTotals {
  hudSamples: number;
  pcbaSamples: number;
  vibrationFixture: number;
  dustWaterFixture: number;
  projectionBoard: number;
  videoPowerCable: number;
  serialCable: number;
  hudPower2m: number;
  fpdLink2m: number;
  hudPower3m: number;
  fpdLink3m: number;
  hub: number;
  usbExtension: number;
  sensor: number;
  sensorBoard: number;
  sensorCable: number;
}

interface GroupDemandRow {
  phaseTitle: string;
  flowGroupTitle: string;
  displayGroupTitle: string;
  sampleType: "HUD" | "PCBA";
  sampleRange: string;
  sampleQuantity: number;
  testItemCount: number;
  totals: DemandTotals;
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
const sampleDemandHeaders = [
  "Phase",
  "需求层级",
  "组别顺序",
  "Group",
  "样品类型",
  "样品编号",
  "样品数量",
  "测试项目数",
  "HUD样机",
  "PCBA",
  "振动/冲击工装",
  "防尘防水工装",
  "投图板",
  "视频源板电源线",
  "视频源板与PC串口线",
  "HUD电源线2m",
  "FPD LINK线2m",
  "HUD电源线3m",
  "FPD LINK线3m",
  "HUB",
  "USB延长线",
  "Sensor",
  "Sensor小板",
  "Sensor线",
  "特殊要求",
];

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

function emptyDemandTotals(): DemandTotals {
  return {
    hudSamples: 0,
    pcbaSamples: 0,
    vibrationFixture: 0,
    dustWaterFixture: 0,
    projectionBoard: 0,
    videoPowerCable: 0,
    serialCable: 0,
    hudPower2m: 0,
    fpdLink2m: 0,
    hudPower3m: 0,
    fpdLink3m: 0,
    hub: 0,
    usbExtension: 0,
    sensor: 0,
    sensorBoard: 0,
    sensorCable: 0,
  };
}

function demandValue(value: number): number | "" {
  return value > 0 ? value : "";
}

function maxDemandTotals(left: DemandTotals, right: DemandTotals): DemandTotals {
  return {
    hudSamples: Math.max(left.hudSamples, right.hudSamples),
    pcbaSamples: Math.max(left.pcbaSamples, right.pcbaSamples),
    vibrationFixture: Math.max(left.vibrationFixture, right.vibrationFixture),
    dustWaterFixture: Math.max(left.dustWaterFixture, right.dustWaterFixture),
    projectionBoard: Math.max(left.projectionBoard, right.projectionBoard),
    videoPowerCable: Math.max(left.videoPowerCable, right.videoPowerCable),
    serialCable: Math.max(left.serialCable, right.serialCable),
    hudPower2m: Math.max(left.hudPower2m, right.hudPower2m),
    fpdLink2m: Math.max(left.fpdLink2m, right.fpdLink2m),
    hudPower3m: Math.max(left.hudPower3m, right.hudPower3m),
    fpdLink3m: Math.max(left.fpdLink3m, right.fpdLink3m),
    hub: Math.max(left.hub, right.hub),
    usbExtension: Math.max(left.usbExtension, right.usbExtension),
    sensor: Math.max(left.sensor, right.sensor),
    sensorBoard: Math.max(left.sensorBoard, right.sensorBoard),
    sensorCable: Math.max(left.sensorCable, right.sensorCable),
  };
}

function sumPhaseDemandTotals(groups: GroupDemandRow[]): DemandTotals {
  const totals = emptyDemandTotals();

  for (const group of groups) {
    totals.hudSamples += group.totals.hudSamples;
    totals.pcbaSamples += group.totals.pcbaSamples;
    totals.vibrationFixture = Math.max(totals.vibrationFixture, group.totals.vibrationFixture);
    totals.dustWaterFixture = Math.max(totals.dustWaterFixture, group.totals.dustWaterFixture);
    totals.projectionBoard += group.totals.projectionBoard;
    totals.videoPowerCable += group.totals.videoPowerCable;
    totals.serialCable += group.totals.serialCable;
    totals.hudPower2m += group.totals.hudPower2m;
    totals.fpdLink2m += group.totals.fpdLink2m;
    totals.hudPower3m = Math.max(totals.hudPower3m, group.totals.hudPower3m);
    totals.fpdLink3m = Math.max(totals.fpdLink3m, group.totals.fpdLink3m);
    totals.hub += group.totals.hub;
    totals.usbExtension += group.totals.usbExtension;
    totals.sensor += group.totals.sensor;
    totals.sensorBoard += group.totals.sensorBoard;
    totals.sensorCable += group.totals.sensorCable;
  }

  return totals;
}

function parseDemandQuantity(value: string | undefined): number | null {
  if (value?.trim().match(/^\d+$/)) {
    return Number(value);
  }

  const parsedRange = parseSampleIdentifierRange(value);
  if (parsedRange) {
    return parsedRange.end - parsedRange.start + 1;
  }

  const parsedNumber = Number(value);
  return Number.isFinite(parsedNumber) && parsedNumber > 0 ? parsedNumber : null;
}

function demandQuantity(row: EnvironmentPlanRow, group: EnvironmentPlanGroup): number {
  return parseDemandQuantity(row.feeBasisOverrides?.quantity)
    ?? parseDemandQuantity(row.sampleRange)
    ?? parseDemandQuantity(group.totalSampleQty)
    ?? 0;
}

function isPcbaDemandGroup(group: EnvironmentPlanGroup): boolean {
  return group.totalSamplePrefix === "PCBA" || /^Group D-[34]$/.test(group.title);
}

function regexEscape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasDemandCode(text: string, code: string): boolean {
  return new RegExp(`\\b${regexEscape(code)}\\b`, "i").test(text);
}

function hasAnyDemandCode(text: string, codes: string[]): boolean {
  return codes.some((code) => hasDemandCode(text, code));
}

function vibrationFixtureQuantity(quantity: number): number {
  if (quantity <= 0) {
    return 0;
  }

  return quantity < 6 ? 3 : 6;
}

function setProjectionDemand(totals: DemandTotals, quantity: number, harnessLength: "2m" | "3m" = "2m") {
  totals.projectionBoard = Math.max(totals.projectionBoard, quantity);
  totals.videoPowerCable = Math.max(totals.videoPowerCable, quantity);
  totals.serialCable = Math.max(totals.serialCable, quantity);

  if (harnessLength === "3m") {
    totals.hudPower3m = Math.max(totals.hudPower3m, quantity);
    totals.fpdLink3m = Math.max(totals.fpdLink3m, quantity);
    return;
  }

  totals.hudPower2m = Math.max(totals.hudPower2m, quantity);
  totals.fpdLink2m = Math.max(totals.fpdLink2m, quantity);
}

function itemDemandTotals(row: EnvironmentPlanRow, group: EnvironmentPlanGroup): { totals: DemandTotals; notes: string[] } {
  const quantity = demandQuantity(row, group);
  const text = `${row.id} ${row.label}`;
  const totals = emptyDemandTotals();
  const notes: string[] = [];

  if (/L1\s*&\s*L4|Performance Evaluation.*Functional Evaluation/i.test(text)) {
    setProjectionDemand(totals, quantity);
  }

  if (hasAnyDemandCode(text, ["K1", "K2", "K3", "K4", "K5", "K6", "K9"])) {
    setProjectionDemand(totals, quantity);
  }

  if (hasAnyDemandCode(text, ["K7", "K20", "K21", "K22", "K23"])) {
    setProjectionDemand(totals, quantity > 0 ? 1 : 0);
  }

  if (hasDemandCode(text, "K18")) {
    setProjectionDemand(totals, quantity > 0 ? 1 : 0);
    totals.hudPower2m = Math.max(totals.hudPower2m, quantity * 2);
    totals.fpdLink2m = Math.max(totals.fpdLink2m, quantity * 2);
    notes.push("K18 线束必须为全新的");
  }

  if (/Particle Exposure/i.test(text) || hasAnyDemandCode(text, ["K10", "K13", "K14"])) {
    const fixtureQuantity = Math.min(quantity, 3);
    totals.dustWaterFixture = Math.max(totals.dustWaterFixture, fixtureQuantity);
    setProjectionDemand(totals, fixtureQuantity);
  }

  if (hasAnyDemandCode(text, ["K15", "K16.4"])) {
    const fixtureQuantity = vibrationFixtureQuantity(quantity);
    totals.vibrationFixture = Math.max(totals.vibrationFixture, fixtureQuantity);
    setProjectionDemand(totals, fixtureQuantity, "3m");
  }

  if (hasDemandCode(text, "K17")) {
    totals.vibrationFixture = Math.max(totals.vibrationFixture, quantity > 0 ? 1 : 0);
    setProjectionDemand(totals, quantity > 0 ? 1 : 0);
  }

  if (hasDemandCode(text, "K28")) {
    totals.vibrationFixture = Math.max(totals.vibrationFixture, 3);
    setProjectionDemand(totals, 3, "3m");
  }

  if (hasAnyDemandCode(text, ["K3", "K4", "K5", "K9", "K24", "K26", "K27", "K52.351"])) {
    totals.hub = Math.max(totals.hub, quantity);
    totals.usbExtension = Math.max(totals.usbExtension, quantity * 3);
    totals.sensor = Math.max(totals.sensor, quantity * 3);
    totals.sensorBoard = Math.max(totals.sensorBoard, quantity * 3);
    totals.sensorCable = Math.max(totals.sensorCable, quantity * 3);
  }

  if (hasDemandCode(text, "K22")) {
    notes.push("额外提供 3 个带 cover lens 的 top housing");
  }

  if (/Restricted Substance/i.test(text)) {
    notes.push("样品可以为故障状态");
  }

  if (/Operating Noise|Transient Noise|Noise test/i.test(text)) {
    notes.push("样品无需满足光学性能");
  }

  return { totals, notes };
}

function demandRowCells(row: GroupDemandRow | { phaseTitle: string; level: string; displayName?: string; totals: DemandTotals; sampleQuantity?: number; testItemCount?: number; notes?: string }): CellValue[] {
  const isGroup = "flowGroupTitle" in row;
  const totals = row.totals;

  return [
    row.phaseTitle,
    isGroup ? "Group Max" : row.level,
    isGroup ? row.flowGroupTitle : "",
    isGroup ? row.displayGroupTitle : row.displayName ?? row.level,
    isGroup ? row.sampleType : "",
    isGroup ? row.sampleRange : "",
    isGroup ? row.sampleQuantity : row.sampleQuantity ?? "",
    isGroup ? row.testItemCount : row.testItemCount ?? "",
    demandValue(totals.hudSamples),
    demandValue(totals.pcbaSamples),
    demandValue(totals.vibrationFixture),
    demandValue(totals.dustWaterFixture),
    demandValue(totals.projectionBoard),
    demandValue(totals.videoPowerCable),
    demandValue(totals.serialCable),
    demandValue(totals.hudPower2m),
    demandValue(totals.fpdLink2m),
    demandValue(totals.hudPower3m),
    demandValue(totals.fpdLink3m),
    demandValue(totals.hub),
    demandValue(totals.usbExtension),
    demandValue(totals.sensor),
    demandValue(totals.sensorBoard),
    demandValue(totals.sensorCable),
    isGroup ? row.notes : row.notes ?? "",
  ];
}

function buildGroupDemandRows(phase: EnvironmentPlanPhase): GroupDemandRow[] {
  const sampleScopes = getGroupSampleIdentifierScopes(phase);

  return phase.groups.map((group) => {
    const sampleType = isPcbaDemandGroup(group) ? "PCBA" : "HUD";
    const sampleQuantity = parseDemandQuantity(group.totalSampleQty) ?? 0;
    const scope = sampleScopes.get(group.id);
    const notes = new Set<string>();
    let totals = emptyDemandTotals();

    for (const row of group.rows) {
      const itemDemand = itemDemandTotals(row, group);
      totals = maxDemandTotals(totals, itemDemand.totals);
      itemDemand.notes.forEach((note) => notes.add(note));
    }

    if (sampleType === "PCBA") {
      totals.pcbaSamples = sampleQuantity;
    } else {
      totals.hudSamples = sampleQuantity;
    }

    if (group.title === "Group D-3") {
      notes.add("额外提供与 PCBA 样品数相同的 PGU 模组/电机组件，并保留测试前 X-RAY 要求");
    }

    if (group.title === "Group D-4") {
      notes.add("额外提供与 PCBA 样品数相同的 PGU 模组/电机组件/开孔 bottom housing");
    }

    return {
      phaseTitle: phase.title,
      flowGroupTitle: group.title,
      displayGroupTitle: displayGroupTitle(group.title, group.rows[0]?.label),
      sampleType,
      sampleRange: scope?.range ?? "",
      sampleQuantity,
      testItemCount: group.rows.length,
      totals,
      notes: Array.from(notes).join("；"),
    };
  });
}

function sampleDemandSheet(plan: EnvironmentPlanSheet): MlaFeeWorksheet {
  const rows: CellValue[][] = [sampleDemandHeaders];

  for (const phase of plan.phases) {
    const groupRows = buildGroupDemandRows(phase);
    rows.push([]);
    rows.push(padRow(`Phase: ${phase.title}`, sampleDemandHeaders.length));

    for (const groupRow of groupRows) {
      rows.push(demandRowCells(groupRow));
    }

    const backupTotals = emptyDemandTotals();
    backupTotals.hudSamples = 3;
    rows.push(demandRowCells({
      phaseTitle: phase.title,
      level: "备样",
      displayName: "HUD 备样",
      totals: backupTotals,
      sampleQuantity: 3,
      notes: "DV/PV 各固定增加 3 台 HUD 备样；备样不增加辅助设备或耗材",
    }));

    const phaseTotals = sumPhaseDemandTotals(groupRows);
    phaseTotals.hudSamples += backupTotals.hudSamples;
    rows.push(demandRowCells({
      phaseTitle: phase.title,
      level: "Phase Total",
      displayName: "Phase Total",
      totals: phaseTotals,
      sampleQuantity: groupRows.reduce((sum, row) => sum + row.sampleQuantity, 0) + 3,
      testItemCount: groupRows.reduce((sum, row) => sum + row.testItemCount, 0),
      notes: "HUD/PCBA/耗材按 Group 合计；振动/冲击工装、防尘防水工装、3m 线束按 Phase 最大值准备",
    }));
  }

  return {
    name: "样品及辅助设备需求",
    rows,
  };
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
  return `${platform}测试项目及费用预估.xlsx`;
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
    sampleDemandSheet(plan),
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
