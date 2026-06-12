import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createSeedAppState } from "../src/store/appState";
import { buildMlaEnvironmentFeeWorkbook, type MlaFeeWorkbook } from "../src/services/mlaEnvironmentFeeExport";

type CellValue = string | number | boolean | null | undefined;

interface TemplateCell {
  xml: string;
  dataStart: number;
  dataEnd: number;
  value: string;
}

interface TemplateRow {
  xml: string;
  attrs: string;
  cells: TemplateCell[];
}

interface RowLookup {
  exact: Map<string, CellValue[]>;
  stable: Map<string, CellValue[][]>;
}

const outputDir = "outputs/mla-fee-export-template";
const templatePath = `${outputDir}/MLA测试项目及费用预估_test-flow组别顺序模板.xls.bak3`;
const outputPath = `${outputDir}/MLA测试项目及费用预估_test-flow组别顺序模板.xls`;

const xmlEscapes: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "\"": "&quot;",
  "'": "&apos;",
};

const xmlUnescapes: Record<string, string> = {
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": "\"",
  "&apos;": "'",
  "&amp;": "&",
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (item) => xmlEscapes[item] ?? item);
}

function unescapeXml(value: string): string {
  return value.replace(/&(lt|gt|quot|apos|amp);/g, (item) => xmlUnescapes[item] ?? item);
}

function formatText(value: CellValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function dataType(value: CellValue): "Number" | "Boolean" | "String" {
  if (typeof value === "number" && Number.isFinite(value)) {
    return "Number";
  }

  if (typeof value === "boolean") {
    return "Boolean";
  }

  return "String";
}

const forecastColumnNameToIndex: Record<string, number> = {
  "组别顺序": 0,
  "组内顺序": 1,
  Phase: 2,
  Group: 3,
  "测试编号": 4,
  "测试项目": 5,
  "样品范围": 6,
  "计费基数": 7,
  "测试时间": 8,
  "计费方式": 9,
  "费用归属": 10,
  "内部费用": 11,
  "委外费用": 12,
  "费用合计": 13,
  "备注": 14,
};

const labColumnNameToIndex: Record<string, number> = {
  "组别顺序": 0,
  "组内顺序": 1,
  Phase: 2,
  Group: 3,
  "测试编号": 4,
  "测试项目": 5,
  "样品范围": 6,
  "计费基数": 7,
  "测试时间": 8,
  "计费方式": 9,
  "实验室": 10,
  "委外费用": 11,
  "备注": 12,
};

const comparisonColumnNameToIndex: Record<string, number> = {
  "组别顺序": 0,
  "组内顺序": 1,
  Phase: 2,
  Group: 3,
  SGS: 4,
  "华测": 5,
  "苏勃": 6,
  "最低实验室": 7,
  "最高实验室": 8,
  "差额": 9,
};

const specialColumnNameToIndex: Record<string, number> = {
  "组别顺序": 0,
  "组内顺序": 1,
  Phase: 2,
  Group: 3,
  "测试编号": 4,
  "测试项目": 5,
  "样品范围": 6,
  "计费基数": 7,
  "测试时间": 8,
  "当前规则费用": 9,
  "实验室/参考口径": 10,
  "备注": 11,
};

function columnIndexesForSheet(sheetName: string): Record<string, number> {
  if (sheetName === "费用预估") {
    return forecastColumnNameToIndex;
  }

  if (sheetName === "费用对比") {
    return comparisonColumnNameToIndex;
  }

  if (sheetName === "特殊项目费用") {
    return specialColumnNameToIndex;
  }

  return labColumnNameToIndex;
}

function cellValue(row: CellValue[], columnName: string, columnIndexes: Record<string, number>): CellValue {
  return row[columnIndexes[columnName] ?? -1] ?? "";
}

function findWorksheet(xml: string, sheetName: string): RegExpExecArray {
  const pattern = new RegExp(
    `<(?:\\w+:)?Worksheet\\b[^>]*(?:ss:Name|Name)="${sheetName}"[\\s\\S]*?</(?:\\w+:)?Worksheet>`,
  );
  const match = pattern.exec(xml);
  if (!match) {
    throw new Error(`Worksheet not found: ${sheetName}`);
  }

  return match;
}

function findTable(worksheetXml: string, sheetName: string): RegExpExecArray {
  const match = /<(?:\w+:)?Table\b[^>]*>[\s\S]*?<\/(?:\w+:)?Table>/.exec(worksheetXml);
  if (!match) {
    throw new Error(`Table not found: ${sheetName}`);
  }

  return match;
}

function parseCells(rowXml: string): TemplateCell[] {
  const cellPattern = /<(?:\w+:)?Cell\b[^>]*>[\s\S]*?<\/(?:\w+:)?Cell>/g;

  return [...rowXml.matchAll(cellPattern)].map((match) => {
    const cellXml = match[0];
    const dataPattern = /(<(?:\w+:)?Data\b[^>]*>)([\s\S]*?)(<\/(?:\w+:)?Data>)/;
    const dataMatch = dataPattern.exec(cellXml);

    if (!dataMatch || dataMatch.index === undefined) {
      return {
        xml: cellXml,
        dataStart: -1,
        dataEnd: -1,
        value: "",
      };
    }

    const dataStart = dataMatch.index + dataMatch[1].length;
    const dataEnd = dataStart + dataMatch[2].length;

    return {
      xml: cellXml,
      dataStart,
      dataEnd,
      value: unescapeXml(dataMatch[2]),
    };
  });
}

function parseRows(tableXml: string): TemplateRow[] {
  const rowPattern = /<(?:\w+:)?Row\b([^>]*)>[\s\S]*?<\/(?:\w+:)?Row>/g;

  return [...tableXml.matchAll(rowPattern)].map((match) => ({
    xml: match[0],
    attrs: match[1] ?? "",
    cells: parseCells(match[0]),
  }));
}

function replaceDataType(cellXml: string, value: CellValue): string {
  const type = dataType(value);
  return cellXml.replace(/(<(?:\w+:)?Data\b[^>]*(?:ss:Type|Type)=")[^"]+("[^>]*>)/, `$1${type}$2`);
}

function updateCellXml(cell: TemplateCell, value: CellValue): string {
  const formatted = formatText(value);

  if (cell.dataStart < 0 || cell.dataEnd < 0) {
    return cell.xml;
  }

  const withType = replaceDataType(cell.xml, value);
  const shift = withType.length - cell.xml.length;
  const dataStart = cell.dataStart + shift;
  const dataEnd = cell.dataEnd + shift;

  return `${withType.slice(0, dataStart)}${escapeXml(formatted)}${withType.slice(dataEnd)}`;
}

function updateRowXml(row: TemplateRow, values: CellValue[]): string {
  let cellIndex = 0;
  const nextXml = row.xml.replace(/<(?:\w+:)?Cell\b[^>]*>[\s\S]*?<\/(?:\w+:)?Cell>/g, () => {
    const cell = row.cells[cellIndex];
    const value = values[cellIndex] ?? "";
    cellIndex += 1;
    return cell ? updateCellXml(cell, value) : "";
  });

  return nextXml;
}

function rowText(row: TemplateRow): string[] {
  return row.cells.map((cell) => cell.value);
}

function isHeaderRow(row: TemplateRow): boolean {
  return rowText(row).includes("样品范围");
}

function isPhaseRow(row: TemplateRow): boolean {
  return rowText(row)[0]?.startsWith("Phase: ") ?? false;
}

function isPhaseSummaryRow(row: TemplateRow): boolean {
  return /组别顺序$/.test(rowText(row)[0] ?? "");
}

function isGroupTitleRow(row: TemplateRow): boolean {
  return row.cells.length === 1 && /Group .+：/.test(rowText(row)[0] ?? "");
}

function isDataRow(row: TemplateRow): boolean {
  const text = rowText(row);
  return /^Group /.test(text[0] ?? "") && (text[2] === "DV" || text[2] === "PV");
}

function valueByHeader(headers: string[], values: CellValue[], header: string): string {
  const index = headers.indexOf(header);
  return index >= 0 ? formatText(values[index]) : "";
}

function rowKeyFromValues(values: CellValue[], headers: string[]): string {
  return [
    valueByHeader(headers, values, "组别顺序"),
    valueByHeader(headers, values, "组内顺序"),
    valueByHeader(headers, values, "Phase"),
    valueByHeader(headers, values, "测试编号") || valueByHeader(headers, values, "Group"),
    valueByHeader(headers, values, "测试项目"),
  ].join("|");
}

function rowKeyFromTemplate(row: TemplateRow, headers: string[]): string {
  return rowKeyFromValues(rowText(row), headers);
}

function stableRowKeyFromValues(values: CellValue[], headers: string[]): string {
  return [
    valueByHeader(headers, values, "组别顺序"),
    valueByHeader(headers, values, "Phase"),
    valueByHeader(headers, values, "测试编号") || valueByHeader(headers, values, "Group"),
    valueByHeader(headers, values, "测试项目"),
  ].join("|");
}

function stableRowKeyFromTemplate(row: TemplateRow, headers: string[]): string {
  return stableRowKeyFromValues(rowText(row), headers);
}

function addStableRow(rowsByStableKey: Map<string, CellValue[][]>, key: string, row: CellValue[]) {
  const rows = rowsByStableKey.get(key) ?? [];
  rows.push(row);
  rowsByStableKey.set(key, rows);
}

function projectDataRow(sourceRow: CellValue[], headers: string[], columnIndexes: Record<string, number>): CellValue[] {
  return headers.map((header) => {
    if (header === "Group" && headers.indexOf("测试编号") === -1) {
      return cellValue(sourceRow, "Group", columnIndexes);
    }

    if (header === "测试编号") {
      return cellValue(sourceRow, "测试编号", columnIndexes);
    }

    return cellValue(sourceRow, header, columnIndexes);
  });
}

function buildRowsByKey(workbook: MlaFeeWorkbook, sheetName: string, headers: string[]): RowLookup {
  const sheet = workbook.sheets.find((item) => item.name === sheetName);
  if (!sheet) {
    throw new Error(`Workbook sheet not found: ${sheetName}`);
  }

  const rowsByKey = new Map<string, CellValue[]>();
  const rowsByStableKey = new Map<string, CellValue[][]>();
  const columnIndexes = columnIndexesForSheet(sheetName);

  for (const row of sheet.rows) {
    if (row[2] !== "DV" && row[2] !== "PV") {
      continue;
    }

    const projected = projectDataRow(row, headers, columnIndexes);
    rowsByKey.set(rowKeyFromValues(projected, headers), projected);
    addStableRow(rowsByStableKey, stableRowKeyFromValues(projected, headers), projected);
  }

  return { exact: rowsByKey, stable: rowsByStableKey };
}

function buildContextRows(workbook: MlaFeeWorkbook, sheetName: string): Map<string, CellValue[]> {
  const sheet = workbook.sheets.find((item) => item.name === sheetName);
  if (!sheet) {
    throw new Error(`Workbook sheet not found: ${sheetName}`);
  }

  const rows = new Map<string, CellValue[]>();
  for (const row of sheet.rows) {
    const firstCell = formatText(row[0]);
    if (firstCell.startsWith("Phase: ") || firstCell.endsWith("组别顺序") || /Group .+：/.test(firstCell)) {
      rows.set(firstCell, row);
    }
  }

  return rows;
}

function projectContextRow(sourceRow: CellValue[], length: number): CellValue[] {
  return [...sourceRow.slice(0, length), ...Array.from({ length: Math.max(length - sourceRow.length, 0) }, () => "")];
}

function updateSheetTable(tableXml: string, workbook: MlaFeeWorkbook, sheetName: string): string {
  const rows = parseRows(tableXml);
  let headers: string[] = [];
  let rowData: RowLookup = { exact: new Map(), stable: new Map() };
  let stableRowUsage = new Map<string, number>();
  const contextRows = buildContextRows(workbook, sheetName);

  const updatedRows = rows.map((row) => {
    if (isHeaderRow(row)) {
      headers = rowText(row);
      rowData = buildRowsByKey(workbook, sheetName, headers);
      stableRowUsage = new Map();
      return row.xml;
    }

    if (isPhaseRow(row) || isPhaseSummaryRow(row) || isGroupTitleRow(row)) {
      const key = rowText(row)[0] ?? "";
      const replacement = contextRows.get(key);
      return replacement ? updateRowXml(row, projectContextRow(replacement, row.cells.length)) : row.xml;
    }

    if (headers.length > 0 && isDataRow(row)) {
      const stableKey = stableRowKeyFromTemplate(row, headers);
      const exactReplacement = rowData.exact.get(rowKeyFromTemplate(row, headers));

      if (exactReplacement) {
        const stableRows = rowData.stable.get(stableKey) ?? [];
        const exactIndex = stableRows.findIndex((candidate) => candidate === exactReplacement);
        const usedIndex = stableRowUsage.get(stableKey) ?? 0;
        stableRowUsage.set(stableKey, Math.max(usedIndex + 1, exactIndex + 1));
        return updateRowXml(row, exactReplacement);
      }

      const usedIndex = stableRowUsage.get(stableKey) ?? 0;
      const replacement = rowData.stable.get(stableKey)?.[usedIndex];
      if (replacement) {
        stableRowUsage.set(stableKey, usedIndex + 1);
      }
      return replacement ? updateRowXml(row, replacement) : row.xml;
    }

    return row.xml;
  });

  return tableXml.replace(/<(?:\w+:)?Row\b[^>]*>[\s\S]*?<\/(?:\w+:)?Row>/g, () => updatedRows.shift() ?? "");
}

function updateWorkbookXml(templateXml: string, workbook: MlaFeeWorkbook): string {
  let nextXml = templateXml;

  for (const sheet of workbook.sheets) {
    const worksheetMatch = findWorksheet(nextXml, sheet.name);
    const worksheetXml = worksheetMatch[0];
    const tableMatch = findTable(worksheetXml, sheet.name);
    const tableXml = tableMatch[0];
    const updatedTableXml = updateSheetTable(tableXml, workbook, sheet.name);
    const updatedWorksheetXml = worksheetXml.slice(0, tableMatch.index)
      + updatedTableXml
      + worksheetXml.slice((tableMatch.index ?? 0) + tableXml.length);

    nextXml = nextXml.slice(0, worksheetMatch.index)
      + updatedWorksheetXml
      + nextXml.slice((worksheetMatch.index ?? 0) + worksheetXml.length);
  }

  return nextXml;
}

const state = createSeedAppState();
const workbook = buildMlaEnvironmentFeeWorkbook(state.environmentPlan, state.projectSetup);
const templateXml = await readFile(templatePath, "utf8");
const outputXml = updateWorkbookXml(templateXml, workbook);

await mkdir(outputDir, { recursive: true });
await writeFile(outputPath, outputXml, "utf8");

console.log(outputPath);
