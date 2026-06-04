import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const sourceXlsPath = path.join(rootDir, "资料", "JLR实验室定点及报价说明.xls");
const outputDir = path.join(rootDir, "outputs", "mla-fee-detail-export");
const outputPath = path.join(outputDir, "一般环境费用数据源_本版可用.xlsx");

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

function runExtraction() {
  const python = process.env.PYTHON_BIN ?? "/usr/bin/python3";
  const code = String.raw`
from pathlib import Path
import importlib.util
import json
import math
import re
import sys
import unicodedata

root = Path(sys.argv[1])
source = Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("xls_biff_dump", root / "scripts" / "xls_biff_dump.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sheets = dict(module.parse_workbook(module.workbook_stream(source)))

def clean(value):
    if value is None:
        return ""
    if isinstance(value, float):
        if math.isnan(value):
            return ""
        if abs(value - round(value)) < 1e-9:
            return int(round(value))
    text = str(value)
    text = "".join(ch for ch in text if ch == "\n" or unicodedata.category(ch)[0] != "C")
    text = re.sub(r"\n{3,}", "\n\n", text)
    if len(text) > 1200:
        text = text[:1200] + "..."
    return text

def row_values(rows, row_index, max_col):
    return [clean(rows.get(row_index, {}).get(col, "")) for col in range(max_col)]

price_rows = []
price_sheet = sheets["一般环境测试项目单价及能力"]
current_item = ""
current_no = ""
current_standard = ""
current_params = ""
for row_index in sorted(price_sheet):
    row = price_sheet[row_index]
    item = clean(row.get(1, "")).strip()
    if item:
        current_item = item
        current_no = clean(row.get(0, ""))
        current_params = clean(row.get(2, ""))
        current_standard = clean(row.get(3, ""))
    unit = clean(row.get(8, "")).strip()
    prices = [clean(row.get(col, "")) for col in range(9, 13)]
    if current_item and unit and any(price != "" for price in prices):
        if row_index < 2:
            continue
        price_rows.append({
            "sourceRow": row_index + 1,
            "no": current_no,
            "testItem": current_item,
            "chargeUnit": unit,
            "parameterSummary": current_params,
            "standard": current_standard,
            "capabilitySGS": clean(row.get(4, "")),
            "capabilityHuace": clean(row.get(5, "")),
            "capabilitySubo": clean(row.get(6, "")),
            "capabilityXince": clean(row.get(7, "")),
            "priceSGS": prices[0],
            "priceHuace": prices[1],
            "priceSubo": prices[2],
            "priceXince": prices[3],
            "average": clean(row.get(13, "")),
            "median": clean(row.get(14, "")),
            "relativeDiff": clean(row.get(15, "")),
            "deviationLevel": clean(row.get(17, "")),
            "deviationRange": clean(row.get(18, "")),
            "suggestion": clean(row.get(19, "")),
        })

coefficient_rows = []
coef_sheet = sheets["一般环境测试系数计算表"]
for row_index in sorted(coef_sheet):
    values = row_values(coef_sheet, row_index, 20)
    if any(value != "" for value in values):
        coefficient_rows.append([row_index + 1] + values)

calculation_rows = []
calc_sheet = sheets["一般环境测试实验室计算表"]
for row_index in sorted(calc_sheet):
    values = row_values(calc_sheet, row_index, 42)
    if any(value != "" for value in values):
        calculation_rows.append([row_index + 1] + values)

print(json.dumps({
    "priceRows": price_rows,
    "coefficientRows": coefficient_rows,
    "calculationRows": calculation_rows,
}, ensure_ascii=False))
`;
  const result = spawnSync(python, ["-c", code, rootDir, sourceXlsPath], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to extract source XLS.");
  }
  return JSON.parse(result.stdout);
}

function applyHeaderStyle(sheet, range) {
  sheet.getRange(range).format = {
    fill: { type: "solid", color: "#1F4E78" },
    font: { name: "Microsoft YaHei", size: 10, color: "#FFFFFF", bold: true },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
}

function applyBodyStyle(sheet, range) {
  sheet.getRange(range).format = {
    font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#E2E8F0" },
  };
}

function writeOverview(workbook, counts) {
  const sheet = workbook.worksheets.getOrAdd("使用说明", {
    renameFirstIfOnlyNewSpreadsheet: true,
  });
  sheet.showGridLines = false;
  sheet.getRange("A1:D1").values = [["本版可用费用数据源说明", "", "", ""]];
  sheet.getRange("A3:D11").values = [
    ["本版范围", "只纳入一般环境测试相关数据。材料测试项目、EMC测试项目本版不考虑。", "", ""],
    ["一般环境单价源", "来自“一般环境测试项目单价及能力”，可用于更新实验室能力、计费单位、SGS/华测/苏劢/信测单价、中位值。", "", ""],
    ["一般环境系数源", "来自“一般环境测试系数计算表”，保留原始布局，用于后续映射 Group/车型下的小时、数量、批次。", "", ""],
    ["一般环境计算校验", "来自“一般环境测试实验室计算表”，保留原始布局，用于校验系统计算总价，不作为首选基础单价源。", "", ""],
    ["特殊测试项目", "本版保留空白占位，后续单独确认招标/供应商口径后再填。", "", ""],
    ["已排除", "材料测试项目、EMC测试项目、2026年度费用、Sheet1、评分规则等均未导入本版数据源。", "", ""],
    ["单价源行数", counts.priceRows, "", ""],
    ["系数源行数", counts.coefficientRows, "", ""],
    ["计算校验行数", counts.calculationRows, "", ""],
  ];
  sheet.getRange("A1:D1").format = {
    fill: { type: "solid", color: "#1F4E78" },
    font: { name: "Microsoft YaHei", size: 14, color: "#FFFFFF", bold: true },
    verticalAlignment: "center",
  };
  applyBodyStyle(sheet, "A3:D11");
  sheet.getRange("A:A").format.columnWidthPx = 150;
  sheet.getRange("B:B").format.columnWidthPx = 760;
  sheet.getRange("C:D").format.columnWidthPx = 40;
}

function writePriceSource(workbook, priceRows) {
  const sheet = workbook.worksheets.add("一般环境单价源");
  const headers = [
    "sourceRow_源表行",
    "NO",
    "测试项目",
    "收费单位",
    "测试参数及范围",
    "引用标准",
    "SGS能力",
    "华测能力",
    "苏劢能力",
    "信测能力",
    "SGS单价",
    "华测单价",
    "苏劢单价",
    "信测单价",
    "均值",
    "中位值",
    "相对差异率",
    "偏离程度",
    "差异范围",
    "建议",
  ];
  const rows = priceRows.map((row) => [
    row.sourceRow,
    row.no,
    row.testItem,
    row.chargeUnit,
    row.parameterSummary,
    row.standard,
    row.capabilitySGS,
    row.capabilityHuace,
    row.capabilitySubo,
    row.capabilityXince,
    row.priceSGS,
    row.priceHuace,
    row.priceSubo,
    row.priceXince,
    row.average,
    row.median,
    row.relativeDiff,
    row.deviationLevel,
    row.deviationRange,
    row.suggestion,
  ]);
  const lastCol = colName(headers.length - 1);
  const lastRow = rows.length + 1;
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(3);
  sheet.getRange(`A1:${lastCol}1`).values = [headers];
  sheet.getRange(`A2:${lastCol}${lastRow}`).values = rows;
  applyHeaderStyle(sheet, `A1:${lastCol}1`);
  applyBodyStyle(sheet, `A2:${lastCol}${lastRow}`);
  sheet.getRange(`K2:P${lastRow}`).format.numberFormat = "#,##0.00";
  sheet.getRange(`Q2:Q${lastRow}`).format.numberFormat = "0.00%";
  [
    115, 55, 310, 150, 430, 260, 75, 75, 75, 75,
    90, 90, 90, 90, 85, 85, 95, 95, 95, 260,
  ].forEach((width, index) => {
    sheet.getRange(`${colName(index)}:${colName(index)}`).format.columnWidthPx = width;
  });
  sheet.tables.add(`A1:${lastCol}${lastRow}`, true, "GeneralEnvironmentPriceSourceTable");
}

function writeRawSheet(workbook, name, headers, rows, widths) {
  const sheet = workbook.worksheets.add(name);
  const lastCol = colName(headers.length - 1);
  const lastRow = rows.length + 1;
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(`A1:${lastCol}1`).values = [headers];
  sheet.getRange(`A2:${lastCol}${lastRow}`).values = rows;
  applyHeaderStyle(sheet, `A1:${lastCol}1`);
  applyBodyStyle(sheet, `A2:${lastCol}${lastRow}`);
  widths.forEach((width, index) => {
    sheet.getRange(`${colName(index)}:${colName(index)}`).format.columnWidthPx = width;
  });
}

function writeSpecialPlaceholder(workbook) {
  const sheet = workbook.worksheets.add("特殊测试项目_空白");
  const headers = [
    "sourceRow_源表行",
    "测试项目",
    "费用归属",
    "供应商/实验室",
    "计费方式",
    "计费基数",
    "单价",
    "总价",
    "状态",
    "备注",
  ];
  sheet.showGridLines = false;
  sheet.getRange("A1:J1").values = [headers];
  sheet.getRange("A2:J6").values = Array.from({ length: 5 }, () => Array(headers.length).fill(""));
  applyHeaderStyle(sheet, "A1:J1");
  applyBodyStyle(sheet, "A2:J6");
  sheet.getRange("C2:C6").dataValidation = {
    rule: { type: "list", values: ["内部费用", "委外费用", "待确认"] },
  };
  sheet.getRange("I2:I6").dataValidation = {
    rule: { type: "list", values: ["待确认", "已确认", "不适用"] },
  };
  [115, 260, 100, 160, 120, 95, 95, 95, 95, 360].forEach((width, index) => {
    sheet.getRange(`${colName(index)}:${colName(index)}`).format.columnWidthPx = width;
  });
}

const data = runExtraction();
const workbook = Workbook.create();

writeOverview(workbook, {
  priceRows: data.priceRows.length,
  coefficientRows: data.coefficientRows.length,
  calculationRows: data.calculationRows.length,
});
writePriceSource(workbook, data.priceRows);
writeRawSheet(
  workbook,
  "一般环境系数源_原始布局",
  ["sourceRow_源表行", ...Array.from({ length: 20 }, (_, index) => `原表列${colName(index)}`)],
  data.coefficientRows,
  [115, ...Array.from({ length: 20 }, () => 95)],
);
writeRawSheet(
  workbook,
  "一般环境计算校验_原始布局",
  ["sourceRow_源表行", ...Array.from({ length: 42 }, (_, index) => `原表列${colName(index)}`)],
  data.calculationRows,
  [115, ...Array.from({ length: 42 }, () => 90)],
);
writeSpecialPlaceholder(workbook);

const overview = await workbook.inspect({
  kind: "table",
  range: "使用说明!A1:D11",
  include: "values",
  tableMaxRows: 12,
  tableMaxCols: 4,
});
console.log(overview.ndjson);

const priceInspect = await workbook.inspect({
  kind: "table",
  range: "一般环境单价源!A1:T8",
  include: "values",
  tableMaxRows: 8,
  tableMaxCols: 20,
});
console.log(priceInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "使用说明", range: "A1:D11", scale: 1 });
await workbook.render({ sheetName: "一般环境单价源", range: "A1:T12", scale: 1 });
await workbook.render({ sheetName: "特殊测试项目_空白", range: "A1:J6", scale: 1 });

await fs.mkdir(outputDir, { recursive: true });
const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
console.log(outputPath);
