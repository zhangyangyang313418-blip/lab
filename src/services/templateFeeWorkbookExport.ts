import { buildMlaEnvironmentFeeWorkbook, type MlaFeeWorksheet } from "./mlaEnvironmentFeeExport";
import { OoxmlPackage } from "./ooxmlPackage";
import { replaceMarkedWorksheetRows } from "./ooxmlWorksheetTransform";
import {
  resolveTemplateMarkers,
  selectFeeTemplate,
  type FeeTemplateDefinition,
  type ResolvedTemplateMarker,
  type ResolvedTemplateMarkers,
  type TemplateMarkerName,
} from "./feeWorkbookTemplateManifest";
import type { EnvironmentPlanSheet } from "../types/environmentPlan";
import type { ProjectSetup } from "../types/project";
import { formatSteeringSides } from "../utils/projectLabels";

type TemplateCellValue = string | number | boolean | null | undefined;
type TemplateFetcher = (path: string) => Promise<Uint8Array | ArrayBuffer>;

export interface TemplateWorkbookFile {
  filename: string;
  mime: FeeTemplateDefinition["mime"];
  bytes: Uint8Array;
}

interface CellStyleTemplate {
  column: string;
  styleAttributes: string;
}

type PrototypeRole = "summary" | "phase" | "group" | "header" | "data" | "last-data" | "total" | "additional" | "blank";

interface PrototypeRowTemplate {
  row: number;
  xml: string;
}

interface SheetMarkerContract {
  start: TemplateMarkerName;
  end: TemplateMarkerName;
  prototypes: Partial<Record<PrototypeRole, TemplateMarkerName>>;
}

const sheetContracts: Record<string, SheetMarkerContract> = {
  样品及辅助设备需求: {
    start: "_PT_SAMPLE_DYNAMIC_START",
    end: "_PT_SAMPLE_DYNAMIC_END",
    prototypes: {
      summary: "_PT_SAMPLE_PROTO_SUMMARY",
      group: "_PT_SAMPLE_PROTO_DETAIL_GROUP",
      header: "_PT_SAMPLE_PROTO_DETAIL_HEADER",
      data: "_PT_SAMPLE_PROTO_DETAIL_DATA",
      total: "_PT_SAMPLE_PROTO_DETAIL_TOTAL",
    },
  },
  费用预估: {
    start: "_PT_FORECAST_DYNAMIC_START",
    end: "_PT_FORECAST_DYNAMIC_END",
    prototypes: {
      phase: "_PT_FORECAST_PROTO_PHASE",
      group: "_PT_FORECAST_PROTO_GROUP",
      header: "_PT_FORECAST_PROTO_HEADER",
      data: "_PT_FORECAST_PROTO_DATA",
      "last-data": "_PT_FORECAST_PROTO_LAST_DATA",
      total: "_PT_FORECAST_PROTO_TOTAL",
      additional: "_PT_FORECAST_PROTO_ADDITIONAL",
    },
  },
  SGS: {
    start: "_PT_SGS_DYNAMIC_START",
    end: "_PT_SGS_DYNAMIC_END",
    prototypes: {
      phase: "_PT_SGS_PROTO_PHASE",
      group: "_PT_SGS_PROTO_GROUP",
      header: "_PT_SGS_PROTO_HEADER",
      data: "_PT_SGS_PROTO_DATA",
      total: "_PT_SGS_PROTO_TOTAL",
    },
  },
  华测: {
    start: "_PT_CTI_DYNAMIC_START",
    end: "_PT_CTI_DYNAMIC_END",
    prototypes: {
      phase: "_PT_CTI_PROTO_PHASE",
      group: "_PT_CTI_PROTO_GROUP",
      header: "_PT_CTI_PROTO_HEADER",
      data: "_PT_CTI_PROTO_DATA",
      total: "_PT_CTI_PROTO_TOTAL",
    },
  },
  苏勃: {
    start: "_PT_SUBO_DYNAMIC_START",
    end: "_PT_SUBO_DYNAMIC_END",
    prototypes: {
      phase: "_PT_SUBO_PROTO_PHASE",
      group: "_PT_SUBO_PROTO_GROUP",
      header: "_PT_SUBO_PROTO_HEADER",
      data: "_PT_SUBO_PROTO_DATA",
      total: "_PT_SUBO_PROTO_TOTAL",
    },
  },
  费用对比: {
    start: "_PT_COMPARE_DYNAMIC_START",
    end: "_PT_COMPARE_DYNAMIC_END",
    prototypes: {
      phase: "_PT_COMPARE_PROTO_PHASE",
      header: "_PT_COMPARE_PROTO_HEADER",
      data: "_PT_COMPARE_PROTO_DATA",
    },
  },
  特殊项目费用: {
    start: "_PT_SPECIAL_DYNAMIC_START",
    end: "_PT_SPECIAL_DYNAMIC_END",
    prototypes: {
      phase: "_PT_SPECIAL_PROTO_PHASE",
      data: "_PT_SPECIAL_PROTO_DATA",
      total: "_PT_SPECIAL_PROTO_TOTAL",
    },
  },
  费用规则校验: {
    start: "_PT_VALIDATION_DYNAMIC_START",
    end: "_PT_VALIDATION_DYNAMIC_END",
    prototypes: {
      header: "_PT_VALIDATION_PROTO_HEADER",
      data: "_PT_VALIDATION_PROTO_DATA",
    },
  },
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function normalizeTemplateBytes(value: Uint8Array | ArrayBuffer): Uint8Array {
  return value instanceof Uint8Array ? value : new Uint8Array(value);
}

async function defaultFetchTemplate(path: string): Promise<Uint8Array> {
  if (typeof fetch !== "function") {
    throw new Error("当前运行环境不支持加载费用模板");
  }
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function markerRow(marker: ResolvedTemplateMarker): number {
  const match = marker.ref.match(/\$?[A-Z]{1,3}\$?(\d+)/);
  if (!match) {
    throw new Error(`Invalid template marker row reference: ${marker.ref}`);
  }
  return Number(match[1]);
}

function columnName(index: number): string {
  let value = index;
  let result = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function rowByNumber(worksheetXml: string, row: number): string {
  const match = worksheetXml.match(new RegExp(`<row\\b[^>]*\\br="${row}"[^>]*>[\\s\\S]*?<\\/row>`));
  if (!match) {
    throw new Error(`Template prototype row ${row} is missing`);
  }
  return match[0];
}

function parseCellStyles(rowXml: string): CellStyleTemplate[] {
  const styles: CellStyleTemplate[] = [];
  for (const match of rowXml.matchAll(/<c\b([^>]*)\/>|<c\b([^>]*)>[\s\S]*?<\/c>/g)) {
    const attrs = match[1] ?? match[2] ?? "";
    const ref = attrs.match(/\br="([A-Z]{1,3})\d+"/)?.[1];
    if (!ref) {
      continue;
    }
    const styleAttributes = [
      attrs.match(/\bs="[^"]*"/)?.[0],
      attrs.match(/\bcm="[^"]*"/)?.[0],
      attrs.match(/\bvm="[^"]*"/)?.[0],
      attrs.match(/\bph="[^"]*"/)?.[0],
    ].filter(Boolean).join(" ");
    styles.push({ column: ref, styleAttributes });
  }
  return styles;
}

function prototypeRows(
  worksheetXml: string,
  markers: ResolvedTemplateMarkers,
  contract: SheetMarkerContract,
): Record<PrototypeRole, PrototypeRowTemplate | undefined> {
  return Object.fromEntries(
    Object.entries(contract.prototypes).map(([role, markerName]) => {
      const row = markerRow(markers[markerName]);
      return [role, { row, xml: rowByNumber(worksheetXml, row) }];
    }),
  ) as Record<PrototypeRole, PrototypeRowTemplate | undefined>;
}

function prototypeMergeRefs(worksheetXml: string, prototypeRow: number, targetRow: number): string[] {
  return [...worksheetXml.matchAll(/<mergeCell ref="([^"]+)"\/>/g)]
    .map((match) => match[1] ?? "")
    .flatMap((ref) => {
      const match = ref.match(/^(\$?[A-Z]{1,3}\$?)(\d+):(\$?[A-Z]{1,3}\$?)(\d+)$/);
      if (!match) {
        return [];
      }
      const startRow = Number(match[2]);
      const endRow = Number(match[4]);
      if (startRow !== prototypeRow || endRow !== prototypeRow) {
        return [];
      }
      return [`${match[1]}${targetRow}:${match[3]}${targetRow}`];
    });
}

function firstText(row: TemplateCellValue[]): string {
  return String(row.find((cell) => cell !== null && cell !== undefined && cell !== "") ?? "");
}

function isHeaderRow(row: TemplateCellValue[]): boolean {
  const cells = row.map((cell) => String(cell ?? ""));
  return cells.includes("Phase") || cells.includes("测试编号") || cells.includes("测试项目") || cells.includes("实验室") || cells.includes("校验结果");
}

function rowRole(row: TemplateCellValue[], sheetName: string): PrototypeRole {
  if (row.every((cell) => cell === null || cell === undefined || cell === "")) {
    return "blank";
  }
  if (isHeaderRow(row)) {
    return "header";
  }

  const label = firstText(row);
  if (/^Phase:/i.test(label)) {
    return "phase";
  }
  if (/附加费用|Additional Fee/.test(label)) {
    return "additional";
  }
  if (/Phase Total|合计|Total/i.test(label) || row.includes("Phase Total")) {
    return "total";
  }
  if (sheetName === "样品及辅助设备需求" && (/组别顺序|->/.test(label))) {
    return "summary";
  }
  if (/：/.test(label) || (/->/.test(label) && row.slice(1).every((cell) => cell === "" || cell === null || cell === undefined))) {
    return "group";
  }
  return "data";
}

function cellXml(value: TemplateCellValue, column: string, row: number, styleAttributes = ""): string {
  const ref = `${column}${row}`;
  const style = styleAttributes ? ` ${styleAttributes}` : "";

  if (value === null || value === undefined || value === "") {
    return `<c r="${ref}"${style}/>`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}"${style} t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`;
}

function buildRowXml(
  row: TemplateCellValue[],
  rowNumber: number,
  prototypeXml: string | undefined,
): string {
  if (!prototypeXml && row.every((cell) => cell === null || cell === undefined || cell === "")) {
    return `<row r="${rowNumber}"/>`;
  }

  const openMatch = prototypeXml?.match(/^<row\b([^>]*)>/);
  const prototypeAttrs = openMatch?.[1] ?? "";
  const rowAttrs = prototypeAttrs
    .replace(/\br="\d+"/, `r="${rowNumber}"`)
    .replace(/\bspans="[^"]*"/, "");
  const styles = prototypeXml ? parseCellStyles(prototypeXml) : [];
  const columnCount = Math.max(row.length, styles.length);
  const cells = Array.from({ length: columnCount }, (_, index) => {
    const style = styles[index];
    const column = style?.column ?? columnName(index + 1);
    return cellXml(row[index], column, rowNumber, style?.styleAttributes ?? "");
  }).join("");
  return `<row${rowAttrs ? rowAttrs : ` r="${rowNumber}"`}>${cells}</row>`;
}

function sheetBodyRows(sheet: MlaFeeWorksheet): TemplateCellValue[][] {
  return sheet.rows.slice(7);
}

function relsFromWorkbookRels(workbookRelsXml: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const match of workbookRelsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const attrs = match[1] ?? "";
    const id = attrs.match(/\bId="([^"]+)"/)?.[1];
    const target = attrs.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) {
      result.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\.\//, "")}`);
    }
  }
  return result;
}

function sheetPartsFromWorkbook(workbookXml: string, workbookRelsXml: string): Map<string, string> {
  const relationships = relsFromWorkbookRels(workbookRelsXml);
  const result = new Map<string, string>();
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)) {
    const attrs = match[1] ?? "";
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    const relId = attrs.match(/\br:id="([^"]+)"/)?.[1];
    if (!name || !relId) {
      continue;
    }
    const target = relationships.get(relId);
    if (target) {
      result.set(decodeXml(name), target);
    }
  }
  return result;
}

function assertRequiredSheets(sheetParts: Map<string, string>, template: FeeTemplateDefinition): void {
  const missing = template.requiredSheets.filter((sheet) => !sheetParts.has(sheet));
  if (missing.length > 0) {
    throw new Error(`${template.family} 费用模板缺少 Sheet: ${missing.join(", ")}`);
  }
}

function updateMetadataCell(worksheetXml: string, marker: ResolvedTemplateMarker, value: TemplateCellValue): string {
  const cellRef = marker.ref.replace(/\$/g, "").split(":")[0]!;
  const row = Number(cellRef.match(/\d+/)?.[0]);
  const column = cellRef.match(/[A-Z]{1,3}/)?.[0];
  if (!row || !column) {
    throw new Error(`Invalid metadata marker reference: ${marker.ref}`);
  }

  const currentCell = worksheetXml.match(new RegExp(`<c\\b[^>]*\\br="${cellRef}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`))?.[0];
  const styleAttrs = currentCell ? [
    currentCell.match(/\bs="[^"]*"/)?.[0],
    currentCell.match(/\bcm="[^"]*"/)?.[0],
    currentCell.match(/\bvm="[^"]*"/)?.[0],
    currentCell.match(/\bph="[^"]*"/)?.[0],
  ].filter(Boolean).join(" ") : "";
  const nextCell = cellXml(value, column, row, styleAttrs);

  if (currentCell) {
    return worksheetXml.replace(currentCell, nextCell);
  }

  return worksheetXml.replace(
    new RegExp(`(<row\\b[^>]*\\br="${row}"[^>]*>)`),
    `$1${nextCell}`,
  );
}

function applyMetadata(
  packageFile: OoxmlPackage,
  sheetParts: Map<string, string>,
  markers: ResolvedTemplateMarkers,
  plan: EnvironmentPlanSheet,
  context: ProjectSetup,
): void {
  const part = sheetParts.get("费用预估");
  if (!part) {
    throw new Error("费用预估 worksheet part is missing");
  }

  const metadata: Partial<Record<TemplateMarkerName, TemplateCellValue>> = {
    _PT_META_OEM: context.oem,
    _PT_META_PLATFORM: context.platform,
    _PT_META_PROJECT_CODE: context.projectCode,
    _PT_META_STEERING: formatSteeringSides(context.steeringSides),
    _PT_META_PROJECT_TYPE: context.projectType === "new_project" ? "新增项目" : "变更项目",
    _PT_META_EXPORT_SCOPE: plan.phases.map((phase) => phase.title).join(" + "),
    _PT_META_FULL_REUSE: context.isFullyReused ? "是" : "否",
    _PT_META_ENV_TEMPLATE: context.reuseEnvironmentTemplate ? "完全复用" : "不完全复用",
  };
  let xml = packageFile.readText(part);
  for (const [markerName, value] of Object.entries(metadata) as [TemplateMarkerName, TemplateCellValue][]) {
    xml = updateMetadataCell(xml, markers[markerName], value);
  }
  packageFile.writeText(part, xml);
}

function rowsFor(model: { sheets: MlaFeeWorksheet[] }, sheetName: string): TemplateCellValue[][] {
  return model.sheets.find((sheet) => sheet.name === sheetName)?.rows.slice(7) ?? [];
}

function sumRowsByPhase(
  rows: TemplateCellValue[][],
  phaseColumn: number,
  valueColumn: number,
): Record<"DV" | "PV", number> {
  return rows.reduce<Record<"DV" | "PV", number>>((totals, row) => {
    const phase = row[phaseColumn];
    const value = row[valueColumn];
    if ((phase === "DV" || phase === "PV") && typeof value === "number" && Number.isFinite(value)) {
      totals[phase] += value;
    }
    return totals;
  }, { DV: 0, PV: 0 });
}

function chartNumber(value: number): string {
  return String(Math.round((value / 10000) * 10000) / 10000);
}

function comparisonChartValues(model: { sheets: MlaFeeWorksheet[] }): { labels: string[]; values: string[] } {
  const forecast = sumRowsByPhase(rowsFor(model, "费用预估"), 2, 13);
  const sgs = sumRowsByPhase(rowsFor(model, "SGS"), 2, 11);
  const cti = sumRowsByPhase(rowsFor(model, "华测"), 2, 11);
  const subo = sumRowsByPhase(rowsFor(model, "苏勃"), 2, 11);

  return {
    labels: [
      "苏勃\nDV",
      "预估费用\nDV",
      "SGS\nDV",
      "华测\nDV",
      "",
      "预估费用\nPV",
      "苏勃\nPV",
      "SGS\nPV",
      "华测\nPV",
      "",
      "苏勃\nDV+PV",
      "预估费用\nDV+PV",
      "SGS\nDV+PV",
      "华测\nDV+PV",
    ],
    values: [
      chartNumber(subo.DV),
      chartNumber(forecast.DV),
      chartNumber(sgs.DV),
      chartNumber(cti.DV),
      "0",
      chartNumber(forecast.PV),
      chartNumber(subo.PV),
      chartNumber(sgs.PV),
      chartNumber(cti.PV),
      "0",
      chartNumber(subo.DV + subo.PV),
      chartNumber(forecast.DV + forecast.PV),
      chartNumber(sgs.DV + sgs.PV),
      chartNumber(cti.DV + cti.PV),
    ],
  };
}

function styleAttributesFromCell(cellXmlText: string | undefined): string {
  if (!cellXmlText) {
    return "";
  }
  return [
    cellXmlText.match(/\bs="[^"]*"/)?.[0],
    cellXmlText.match(/\bcm="[^"]*"/)?.[0],
    cellXmlText.match(/\bvm="[^"]*"/)?.[0],
    cellXmlText.match(/\bph="[^"]*"/)?.[0],
  ].filter(Boolean).join(" ");
}

function upsertWorksheetCell(
  worksheetXml: string,
  ref: string,
  value: TemplateCellValue,
): string {
  const rowNumber = Number(ref.match(/\d+/)?.[0]);
  const column = ref.match(/[A-Z]{1,3}/)?.[0];
  if (!rowNumber || !column) {
    throw new Error(`Invalid worksheet cell reference: ${ref}`);
  }

  const existingCell = worksheetXml.match(new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`))?.[0];
  const nextCell = cellXml(value, column, rowNumber, styleAttributesFromCell(existingCell));
  if (existingCell) {
    return worksheetXml.replace(existingCell, nextCell);
  }

  const selfClosingRow = worksheetXml.match(new RegExp(`<row\\b([^>]*)\\br="${rowNumber}"([^>]*)\\/>`))?.[0];
  if (selfClosingRow) {
    const attrs = selfClosingRow.replace(/^<row\b/, "").replace(/\/>$/, "");
    return worksheetXml.replace(selfClosingRow, `<row${attrs}>${nextCell}</row>`);
  }

  const fullRow = worksheetXml.match(new RegExp(`<row\\b[^>]*\\br="${rowNumber}"[^>]*>[\\s\\S]*?<\\/row>`))?.[0];
  if (fullRow) {
    return worksheetXml.replace(fullRow, fullRow.replace("</row>", `${nextCell}</row>`));
  }

  return worksheetXml.replace("</sheetData>", `<row r="${rowNumber}">${nextCell}</row></sheetData>`);
}

function chartStringCache(labels: string[]): string {
  return `<c:strCache><c:ptCount val="${labels.length}"/>${
    labels.map((label, index) => `<c:pt idx="${index}"><c:v>${escapeXml(label).replace(/\n/g, "&#10;")}</c:v></c:pt>`).join("")
  }</c:strCache>`;
}

function chartNumberCache(values: string[]): string {
  return `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>${
    values.map((value, index) => `<c:pt idx="${index}"><c:v>${escapeXml(value)}</c:v></c:pt>`).join("")
  }</c:numCache>`;
}

function updateFirstChartNumberCache(chartXml: string, values: string[]): string {
  let replaced = false;
  return chartXml.replace(/<c:numCache>[\s\S]*?<c:ptCount val="14"\/>[\s\S]*?<\/c:numCache>/g, (match) => {
    if (replaced) {
      return match;
    }
    replaced = true;
    return chartNumberCache(values);
  });
}

function updateComparisonChart(
  packageFile: OoxmlPackage,
  sheetParts: Map<string, string>,
  model: { sheets: MlaFeeWorksheet[] },
): void {
  const comparisonPart = sheetParts.get("费用对比");
  if (!comparisonPart) {
    throw new Error("费用对比 worksheet part is missing");
  }
  const chartPart = "xl/charts/chart1.xml";
  if (!packageFile.has(chartPart)) {
    throw new Error("费用模板缺少 chart1.xml");
  }

  const { labels, values } = comparisonChartValues(model);
  let comparisonXml = packageFile.readText(comparisonPart);
  labels.forEach((label, index) => {
    const row = index + 2;
    comparisonXml = upsertWorksheetCell(comparisonXml, `T${row}`, label);
    comparisonXml = upsertWorksheetCell(comparisonXml, `U${row}`, Number(values[index]));
    comparisonXml = upsertWorksheetCell(comparisonXml, `V${row}`, "");
    comparisonXml = upsertWorksheetCell(comparisonXml, `W${row}`, "");
    comparisonXml = upsertWorksheetCell(comparisonXml, `X${row}`, "");
  });
  packageFile.writeText(comparisonPart, comparisonXml);

  let chartXml = packageFile.readText(chartPart);
  chartXml = chartXml.replace(
    /<c:strCache><c:ptCount val="14"\/>[\s\S]*?<\/c:strCache>/g,
    chartStringCache(labels),
  );
  chartXml = updateFirstChartNumberCache(chartXml, values);
  packageFile.writeText(chartPart, chartXml);
}

function replaceSheetRows(
  packageFile: OoxmlPackage,
  sheetParts: Map<string, string>,
  markers: ResolvedTemplateMarkers,
  sheet: MlaFeeWorksheet,
): void {
  const contract = sheetContracts[sheet.name];
  const part = sheetParts.get(sheet.name);
  if (!contract || !part) {
    return;
  }

  const startRow = markerRow(markers[contract.start]);
  const endRow = markerRow(markers[contract.end]);
  const worksheetXml = packageFile.readText(part);
  const prototypes = prototypeRows(worksheetXml, markers, contract);
  const rows = sheetBodyRows(sheet);
  const mergeCellRefs: string[] = [];
  const rowXml = rows.map((row, index) => {
    const role = rowRole(row, sheet.name);
    const prototype = role === "blank"
      ? undefined
      : prototypes[role] ?? prototypes.data ?? prototypes.header ?? prototypes.phase;
    const targetRow = startRow + index;
    if (prototype) {
      mergeCellRefs.push(...prototypeMergeRefs(worksheetXml, prototype.row, targetRow));
    }
    return buildRowXml(row, targetRow, prototype?.xml);
  });

  const result = replaceMarkedWorksheetRows({
    worksheetXml,
    startRow,
    endRow,
    rowXml,
    mergeCellRefs,
  });
  packageFile.writeText(part, result.worksheetXml);
}

function assertValidationSheetHidden(workbookXml: string): void {
  const validationSheet = workbookXml.match(/<sheet\b[^>]*\bname="费用规则校验"[^>]*\/>/)?.[0];
  if (!validationSheet || !/\bstate="hidden"/.test(validationSheet)) {
    throw new Error("费用规则校验 Sheet 必须保持隐藏");
  }
}

function assertChartAvailable(packageFile: OoxmlPackage): void {
  if (!packageFile.has("xl/charts/chart1.xml") || !packageFile.has("xl/drawings/drawing1.xml")) {
    throw new Error("费用模板缺少图表或绘图部件");
  }
}

export async function buildTemplateFeeWorkbook(
  plan: EnvironmentPlanSheet,
  context: ProjectSetup,
  fetchTemplate: TemplateFetcher = defaultFetchTemplate,
): Promise<TemplateWorkbookFile> {
  const template = selectFeeTemplate(context.platform);
  let templateBytes: Uint8Array;
  try {
    templateBytes = normalizeTemplateBytes(await fetchTemplate(template.url));
  } catch (error) {
    throw new Error(`${template.family} 费用模板加载失败：${error instanceof Error ? error.message : String(error)}`);
  }

  const packageFile = await OoxmlPackage.load(templateBytes);
  packageFile.assertRequiredParts(template.requiredParts);
  assertChartAvailable(packageFile);

  const macroFingerprint = packageFile.macroFingerprint();
  const workbookXml = packageFile.readText("xl/workbook.xml");
  const markers = resolveTemplateMarkers(workbookXml);
  const sheetParts = sheetPartsFromWorkbook(workbookXml, packageFile.readText("xl/_rels/workbook.xml.rels"));
  assertRequiredSheets(sheetParts, template);
  assertValidationSheetHidden(workbookXml);

  const model = buildMlaEnvironmentFeeWorkbook(plan, context);
  for (const sheet of model.sheets) {
    replaceSheetRows(packageFile, sheetParts, markers, sheet);
  }
  applyMetadata(packageFile, sheetParts, markers, plan, context);
  updateComparisonChart(packageFile, sheetParts, model);

  packageFile.assertNoFormulaErrors();
  packageFile.assertMacroFingerprint(macroFingerprint);

  return {
    filename: template.filename,
    mime: template.mime,
    bytes: packageFile.save(),
  };
}
