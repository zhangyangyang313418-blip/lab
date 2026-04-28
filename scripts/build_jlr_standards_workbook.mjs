import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "outputs", "jlr-standards");
const inputPath = path.join(outputDir, "jlr_standards_extracted.json");
const outputPath = path.join(outputDir, "JLR标准名称版本号整理.xlsx");

const payload = JSON.parse(await fs.readFile(inputPath, "utf8"));
const standards = payload.standards;

function colName(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function applyTableStyle(sheet, startRow, headers, rowCount, widths) {
  const endCol = colName(headers.length - 1);
  const headerRange = sheet.getRange(`A${startRow}:${endCol}${startRow}`);
  headerRange.format = {
    fill: { type: "solid", color: "#1F4E78" },
    font: { name: "Microsoft YaHei", size: 11, color: "#FFFFFF", bold: true },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
  };

  const dataEndRow = startRow + rowCount;
  const usedRange = sheet.getRange(`A${startRow}:${endCol}${dataEndRow}`);
  usedRange.format = {
    font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
  headerRange.format.font = { name: "Microsoft YaHei", size: 11, color: "#FFFFFF", bold: true };
  headerRange.format.horizontalAlignment = "center";

  widths.forEach((width, index) => {
    const col = colName(index);
    sheet.getRange(`${col}:${col}`).format.columnWidthPx = width;
  });
}

function writeSummarySheet(workbook) {
  const sheet = workbook.worksheets.getOrAdd("JLR标准整理", {
    renameFirstIfOnlyNewSpreadsheet: true,
  });
  const headers = ["序号", "类别", "标准编号", "标准名称（中文）", "Standard Name (English)", "版本号", "日期"];
  const rows = standards.map((row, index) => [
    index + 1,
    row.category,
    row.standard_code,
    row.title_zh,
    row.title_en ?? row.title,
    row.version,
    row.date,
  ]);

  sheet.getRange("A1:G1").values = [["JLR 标准名称与版本号整理", "", "", "", "", "", ""]];
  sheet.getRange("A2:G2").values = [[
    `标准数：${payload.unique_count}`,
    "",
    `源文件读取：${payload.source_count}`,
    "",
    "说明：中文标题为对照译名；英文标题优先读取标准正文。",
    "",
    "",
  ]];
  sheet.getRange("A4:G4").values = [headers];
  sheet.getRange(`A5:G${4 + rows.length}`).values = rows;

  sheet.getRange("A1:G1").format = {
    fill: { type: "solid", color: "#EAF2F8" },
    font: { name: "Microsoft YaHei", size: 14, color: "#1F4E78", bold: true },
    verticalAlignment: "center",
  };
  sheet.getRange("A2:G2").format = {
    font: { name: "Microsoft YaHei", size: 10, color: "#475569" },
    wrapText: true,
    verticalAlignment: "top",
  };
  sheet.getRange("A1:G2").format.rowHeightPx = 34;
  sheet.freezePanes.freezeRows(4);
  applyTableStyle(sheet, 4, headers, rows.length, [58, 150, 150, 340, 460, 110, 140]);
  return sheet;
}

const workbook = Workbook.create();
writeSummarySheet(workbook);

await fs.mkdir(outputDir, { recursive: true });

const summaryInspect = await workbook.inspect({
  kind: "table",
  range: "JLR标准整理!A1:G12",
  include: "values",
  tableMaxRows: 12,
  tableMaxCols: 7,
});
console.log(summaryInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "JLR标准整理", range: "A1:G20", scale: 1 });

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
console.log(outputPath);
