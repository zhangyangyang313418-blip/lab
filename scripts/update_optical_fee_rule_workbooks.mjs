import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const workbookPaths = process.argv.slice(2).map((item) => resolve(item));
if (workbookPaths.length === 0) {
  workbookPaths.push(
    resolve("outputs/mla-fee-detail-export/JLR- MLA 费用规则.xlsx"),
    resolve("outputs/ema-fee-detail-export/JLR- EMA 费用规则.xlsx"),
  );
}

const opticalRuleNote = "Optical Test 特殊计算：51 点位 134/个，19 点位 50/个；普通组 1 台按 51 点位、其余按 19 点位，Group D-8 全部按 19 点位。";
const versionRow = [
  "V.2",
  "2026-06-17",
  "费用规则修正",
  "调整 Optical Test 特殊计费单价：19 点位由 210/个改为 50/个，51 点位由 460/个改为 134/个；AB列规则备注同步写明新单价和计算口径。",
  "费用规则去重表!AB:AB；/environment-outline Optical Test 费用计算",
  "对应系统本地草稿模板版本 ENVIRONMENT_PLAN_TEMPLATE_VERSION = 37。",
];

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function unescapeXml(value) {
  return String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => unescapeXml(textMatch[1]))
      .join(""),
  );
}

function getCellValue(cellXml, sharedStrings) {
  if (!cellXml) return "";
  const inline = [...cellXml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
    .map((match) => unescapeXml(match[1]))
    .join("");
  if (inline) return inline;
  const type = (cellXml.match(/\st="([^"]+)"/) || [])[1];
  const value = (cellXml.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
  if (value == null) return "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  return value;
}

function inlineStringCell(ref, style, value) {
  const styleAttr = style ? ` s="${style}"` : "";
  return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function getCellStyle(cellXml) {
  return (cellXml?.match(/\ss="(\d+)"/) || [])[1] ?? "";
}

function updateOrInsertCell(rowXml, ref, value, fallbackStyle = "") {
  const column = ref.replace(/\d+$/, "");
  const rowNumber = ref.replace(/^[A-Z]+/, "");
  const cellRegex = new RegExp(`<c r="${ref}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  const existing = rowXml.match(cellRegex)?.[0];
  const nextCell = inlineStringCell(ref, getCellStyle(existing) || fallbackStyle, value);
  if (existing) return rowXml.replace(cellRegex, nextCell);

  const cells = [...rowXml.matchAll(/<c r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)];
  const insertBefore = cells.find((match) => match[1].localeCompare(column, "en", { numeric: true }) > 0);
  if (insertBefore) return rowXml.replace(insertBefore[0], `${nextCell}${insertBefore[0]}`);
  return rowXml.replace("</row>", `${nextCell}</row>`);
}

function updateRuleSheet(sheetXml, sharedStrings) {
  let opticalRowNumber = null;
  let opticalRowXml = "";
  for (const match of sheetXml.matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)) {
    const rowNumber = Number(match[1]);
    const aCell = match[0].match(new RegExp(`<c r="A${rowNumber}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`))?.[0];
    if (getCellValue(aCell, sharedStrings) === "Optical") {
      opticalRowNumber = rowNumber;
      opticalRowXml = match[0];
      break;
    }
  }

  if (!opticalRowNumber) throw new Error("Could not find Optical row in 费用规则去重表");

  const updatedRow = updateOrInsertCell(opticalRowXml, `AB${opticalRowNumber}`, opticalRuleNote);
  return sheetXml.replace(opticalRowXml, updatedRow);
}

function rowCell(rowXml, column, rowNumber) {
  return rowXml.match(new RegExp(`<c r="${column}${rowNumber}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`))?.[0] ?? "";
}

function buildVersionRowXml(rowNumber, templateRowXml) {
  const columns = ["A", "B", "C", "D", "E", "F"];
  const cells = columns
    .map((column, index) => inlineStringCell(`${column}${rowNumber}`, getCellStyle(rowCell(templateRowXml, column, Number(templateRowXml.match(/<row r="(\d+)"/)?.[1] ?? rowNumber))) || "1", versionRow[index]))
    .join("");
  return `<row r="${rowNumber}" spans="1:6">${cells}</row>`;
}

function updateVersionSheet(sheetXml, sharedStrings) {
  const rows = [...sheetXml.matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)];
  let existingV2 = null;
  let lastNonEmptyRow = 1;
  let templateRowXml = rows.at(-1)?.[0] ?? '<row r="2" spans="1:6"></row>';

  for (const match of rows) {
    const rowNumber = Number(match[1]);
    const aCell = rowCell(match[0], "A", rowNumber);
    const value = getCellValue(aCell, sharedStrings);
    if (value) {
      lastNonEmptyRow = Math.max(lastNonEmptyRow, rowNumber);
      templateRowXml = match[0];
    }
    if (value === "V.2") existingV2 = { rowNumber, rowXml: match[0] };
  }

  if (existingV2) {
    return sheetXml.replace(existingV2.rowXml, buildVersionRowXml(existingV2.rowNumber, existingV2.rowXml));
  }

  const newRowNumber = lastNonEmptyRow + 1;
  const newRowXml = buildVersionRowXml(newRowNumber, templateRowXml);
  let xml = sheetXml.replace("</sheetData>", `${newRowXml}</sheetData>`);
  const dimension = xml.match(/<dimension ref="([^"]+)"\/>/)?.[1];
  if (dimension) {
    xml = xml.replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="A1:F${newRowNumber}"/>`);
  }
  return xml;
}

for (const workbookPath of workbookPaths) {
  if (!existsSync(workbookPath)) throw new Error(`Workbook does not exist: ${workbookPath}`);
  const tempDir = mkdtempSync(join(tmpdir(), "optical-fee-rule-"));
  try {
    copyFileSync(workbookPath, join(tempDir, "workbook.xlsx"));
    execFileSync("unzip", ["-qq", "workbook.xlsx", "-d", "xlsx"], { cwd: tempDir });

    const sharedStringsPath = join(tempDir, "xlsx/xl/sharedStrings.xml");
    const sharedStrings = parseSharedStrings(existsSync(sharedStringsPath) ? readFileSync(sharedStringsPath, "utf8") : "");

    const ruleSheetPath = join(tempDir, "xlsx/xl/worksheets/sheet1.xml");
    writeFileSync(ruleSheetPath, updateRuleSheet(readFileSync(ruleSheetPath, "utf8"), sharedStrings));

    const versionSheetPath = join(tempDir, "xlsx/xl/worksheets/sheet2.xml");
    writeFileSync(versionSheetPath, updateVersionSheet(readFileSync(versionSheetPath, "utf8"), sharedStrings));

    rmSync(join(tempDir, "workbook.xlsx"));
    execFileSync("zip", ["-qr", "../workbook.xlsx", "."], { cwd: join(tempDir, "xlsx") });
    copyFileSync(join(tempDir, "workbook.xlsx"), workbookPath);
    console.log(workbookPath);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
