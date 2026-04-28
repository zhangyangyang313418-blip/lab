import { summarizeResults } from "./calculationEngine";
import type { ProjectSetup } from "../types/project";
import type { EditableTestItem, TestDomain } from "../types/testing";
import { formatSteeringSides } from "../utils/projectLabels";

export interface ExportState {
  projectSetup: ProjectSetup;
  domainItems: Record<TestDomain, EditableTestItem[]>;
}

interface WorksheetData {
  name: string;
  headers: string[];
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

interface ExportFile {
  filename: string;
  blob: Blob;
}

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

function cellXml(value: string | number | boolean | null | undefined): string {
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

function worksheetXml(sheet: WorksheetData): string {
  const rowsXml = [
    `<Row>${sheet.headers.map((header) => cellXml(header)).join("")}</Row>`,
    ...sheet.rows.map((row) => `<Row>${row.map((cell) => cellXml(cell)).join("")}</Row>`),
  ].join("");

  return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${rowsXml}</Table></Worksheet>`;
}

function workbookXml(sheets: WorksheetData[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" ` +
    `xmlns:o="urn:schemas-microsoft-com:office:office" ` +
    `xmlns:x="urn:schemas-microsoft-com:office:excel" ` +
    `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">` +
    sheets.map(worksheetXml).join("") +
    `</Workbook>`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(item: EditableTestItem): string {
  return `${item.durationValue} ${item.durationUnit === "day" ? "天" : "小时"}`;
}

function buildDomainSheet(title: string, items: EditableTestItem[]): WorksheetData {
  return {
    name: title,
    headers: [
      "代码",
      "中文名称",
      "英文名称",
      "类别",
      "标准",
      "流程",
      "要求",
      "样本数",
      "时长",
      "单价",
      "计费方式",
      "费用",
      "启用",
      "来源",
      "备注",
      "标签",
      "原因",
    ],
    rows: items.map((item) => [
      item.code,
      item.nameZh,
      item.nameEn,
      item.category,
      item.standard,
      item.procedure,
      item.requirement,
      item.sampleQty,
      formatDuration(item),
      item.unitPrice,
      item.pricingUnit,
      item.cost,
      item.enabled ? "是" : "否",
      item.source,
      formatText(item.notes),
      formatText(item.tags),
      formatText(item.reasons),
    ]),
  };
}

function buildSummarySheet(state: ExportState): WorksheetData {
  const allItems = [
    ...state.domainItems.environment,
    ...state.domainItems.material,
    ...state.domainItems.emc,
  ];
  const summary = summarizeResults(allItems);
  const environmentTotal = summarizeResults(state.domainItems.environment).totalCost;
  const materialTotal = summarizeResults(state.domainItems.material).totalCost;
  const emcTotal = summarizeResults(state.domainItems.emc).totalCost;

  return {
    name: "总汇总",
    headers: ["项目", "值"],
    rows: [
      ["项目编号", state.projectSetup.projectCode],
      ["OEM", state.projectSetup.oem],
      ["平台", state.projectSetup.platform],
      ["驾驶方向", formatSteeringSides(state.projectSetup.steeringSides)],
      ["方案确认", state.projectSetup.confirmed ? "已确认" : "待确认"],
      ["启用项数", summary.enabledItemCount],
      ["样本总数", summary.totalSampleQty],
      ["总时长(小时)", summary.totalDurationHours],
      ["总费用", summary.totalCost],
      ["环境费用", environmentTotal],
      ["材料费用", materialTotal],
      ["EMC费用", emcTotal],
      ["描述", state.projectSetup.description],
      ["选中变更", formatText(state.projectSetup.selectedChangeIds)],
    ],
  };
}

function buildWorkbookFile(filename: string, sheets: WorksheetData[]): ExportFile {
  return {
    filename,
    blob: new Blob([workbookXml(sheets)], { type: "application/vnd.ms-excel;charset=utf-8" }),
  };
}

function downloadFile(file: ExportFile): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = file.filename;
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function exportResultsWorkbook(state: ExportState): void {
  const environmentItems = state.domainItems.environment;
  const materialItems = state.domainItems.material;
  const emcItems = state.domainItems.emc;

  const files = [
    buildWorkbookFile("环境费用.xls", [buildDomainSheet("环境费用", environmentItems)]),
    buildWorkbookFile("材料费用.xls", [buildDomainSheet("材料费用", materialItems)]),
    buildWorkbookFile("EMC费用.xls", [buildDomainSheet("EMC费用", emcItems)]),
    buildWorkbookFile("总汇总.xls", [
      buildDomainSheet("环境费用", environmentItems),
      buildDomainSheet("材料费用", materialItems),
      buildDomainSheet("EMC费用", emcItems),
      buildSummarySheet(state),
    ]),
  ];

  files.forEach(downloadFile);
}
