import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const workbookPath = resolve(
  process.argv[2] ?? "outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx",
);

const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];
const summaryRows = new Set([2, 3, 4, 5]);
const orderRows = new Set([8, 23, 38, 45]);
const sectionRows = new Set([9, 10, 13, 16, 19, 24, 25, 28, 31, 34, 39, 40, 46, 47]);
const headerRows = new Set([11, 14, 17, 20, 26, 29, 32, 35, 41, 48]);
const dataRows = new Set([12, 15, 18, 21, 27, 30, 33, 36, 42, 43, 49, 50]);
const spacerRows = new Set([6, 7, 22, 37, 44]);

function styleForCell(rowNumber, column) {
  if (rowNumber === 1) return 44;
  if (summaryRows.has(rowNumber)) {
    if (column === "A" || column === "C") return 46;
    if (column === "B" || column === "D") return 47;
    return 48;
  }
  if (orderRows.has(rowNumber)) return column === "A" ? 74 : 75;
  if (sectionRows.has(rowNumber)) return column === "M" ? 77 : column === "A" ? 58 : 76;
  if (headerRows.has(rowNumber)) return column === "J" ? 78 : 60;
  if (dataRows.has(rowNumber)) {
    if (column === "J") return 63;
    if (column === "L") return 79;
    return 62;
  }
  if (spacerRows.has(rowNumber)) return 48;
  return 62;
}

function rowHeight(rowNumber) {
  if (rowNumber === 1) return ' ht="23.2" customHeight="1"';
  if (summaryRows.has(rowNumber)) return "";
  if (orderRows.has(rowNumber)) return ' ht="24" customHeight="1"';
  if (sectionRows.has(rowNumber)) return ' ht="26" customHeight="1"';
  if (headerRows.has(rowNumber)) return ' ht="28" customHeight="1"';
  if (dataRows.has(rowNumber)) return ' ht="60" customHeight="1"';
  if (rowNumber === 44) return ' ht="0" customHeight="1" hidden="1"';
  if (spacerRows.has(rowNumber)) return ' ht="8" customHeight="1"';
  return "";
}

function setStyle(cellXml, style) {
  if (/\ss="\d+"/.test(cellXml)) return cellXml.replace(/\ss="\d+"/, ` s="${style}"`);
  return cellXml.replace(/<c r="[^"]+"/, (match) => `${match} s="${style}"`);
}

function updateRowXml(rowXml, rowNumber) {
  const cells = new Map();
  rowXml.replace(/<c r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g, (cellXml, column) => {
    cells.set(column, cellXml);
    return cellXml;
  });

  const styledCells = columns.map((column) => {
    const style = styleForCell(rowNumber, column);
    const existing = cells.get(column);
    return existing ? setStyle(existing, style) : `<c r="${column}${rowNumber}" s="${style}"/>`;
  });

  const rowAttrs = `r="${rowNumber}"${rowHeight(rowNumber)} spans="1:13"`;
  return `<row ${rowAttrs}>${styledCells.join("")}</row>`;
}

function updateRows(sheetXml) {
  let xml = sheetXml;
  for (let rowNumber = 1; rowNumber <= 50; rowNumber += 1) {
    const rowRegex = new RegExp(`<row r="${rowNumber}"[\\s\\S]*?<\\/row>`);
    const match = xml.match(rowRegex);
    const rowXml = match ? match[0] : `<row r="${rowNumber}" spans="1:13"/>`;
    const nextRowXml = updateRowXml(rowXml, rowNumber);
    if (match) {
      xml = xml.replace(rowRegex, nextRowXml);
    } else {
      const sheetDataClose = xml.indexOf("</sheetData>");
      xml = `${xml.slice(0, sheetDataClose)}${nextRowXml}${xml.slice(sheetDataClose)}`;
    }
  }
  return xml;
}

function replaceCols(sheetXml) {
  const colsXml = `<cols>
<col min="1" max="1" width="14" style="42" customWidth="1"/>
<col min="2" max="2" width="10" style="42" customWidth="1"/>
<col min="3" max="3" width="8" style="42" customWidth="1"/>
<col min="4" max="4" width="25.1428571428571" style="42" customWidth="1"/>
<col min="5" max="5" width="13" style="42" customWidth="1"/>
<col min="6" max="6" width="42.2589285714286" style="42" customWidth="1"/>
<col min="7" max="7" width="12" style="42" customWidth="1"/>
<col min="8" max="8" width="14" style="42" customWidth="1"/>
<col min="9" max="9" width="12" style="42" customWidth="1"/>
<col min="10" max="10" width="14" style="42" customWidth="1"/>
<col min="11" max="11" width="22" style="42" customWidth="1"/>
<col min="12" max="12" width="56" style="42" customWidth="1"/>
<col min="13" max="13" width="80" style="42" customWidth="1"/>
</cols>`;
  if (/<cols>[\s\S]*?<\/cols>/.test(sheetXml)) return sheetXml.replace(/<cols>[\s\S]*?<\/cols>/, colsXml);
  return sheetXml.replace("</sheetFormatPr>", `</sheetFormatPr>${colsXml}`);
}

function replaceMerges(sheetXml) {
  const merges = [
    "A1:M1",
    "B8:M8",
    "A9:M9",
    "A10:M10",
    "A13:M13",
    "A16:M16",
    "A19:M19",
    "B23:M23",
    "A24:M24",
    "A25:M25",
    "A28:M28",
    "A31:M31",
    "A34:M34",
    "B38:M38",
    "A39:M39",
    "A40:M40",
    "B45:M45",
    "A46:M46",
    "A47:M47",
  ];
  const mergeXml = `<mergeCells count="${merges.length}">${merges
    .map((ref) => `<mergeCell ref="${ref}"/>`)
    .join("")}</mergeCells>`;
  if (/<mergeCells[\s\S]*?<\/mergeCells>/.test(sheetXml)) {
    return sheetXml.replace(/<mergeCells[\s\S]*?<\/mergeCells>/, mergeXml);
  }
  return sheetXml.replace("</sheetData>", `</sheetData>${mergeXml}`);
}

function updateSheetXml(sheetXml) {
  let xml = sheetXml;
  xml = xml.replace(/<dimension ref="[^"]+"\/>/, '<dimension ref="A1:M50"/>');
  xml = xml.replace(/<sheetView\b(?![^>]*showGridLines=)/, '<sheetView showGridLines="0"');
  xml = replaceCols(xml);
  xml = updateRows(xml);
  xml = replaceMerges(xml);
  return xml;
}

const tempDir = mkdtempSync(join(tmpdir(), "special-fee-format-"));
try {
  if (!existsSync(workbookPath)) throw new Error(`Workbook does not exist: ${workbookPath}`);
  copyFileSync(workbookPath, join(tempDir, "workbook.xlsx"));
  execFileSync("unzip", ["-qq", "workbook.xlsx", "-d", "xlsx"], { cwd: tempDir });

  const sheetPath = join(tempDir, "xlsx/xl/worksheets/sheet6.xml");
  writeFileSync(sheetPath, updateSheetXml(readFileSync(sheetPath, "utf8")));

  rmSync(join(tempDir, "workbook.xlsx"));
  execFileSync("zip", ["-qr", "../workbook.xlsx", "."], { cwd: join(tempDir, "xlsx") });
  copyFileSync(join(tempDir, "workbook.xlsx"), workbookPath);
  console.log(workbookPath);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
