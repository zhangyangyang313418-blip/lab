import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const workbookPath = resolve(
  process.argv[2] ?? "outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx",
);

const summaryStartRow = 38;
const summaryEndRow = 59;
const columns = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

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
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
      .map((textMatch) => unescapeXml(textMatch[1]))
      .join(""),
  );
}

function cellValue(cellXml, sharedStrings) {
  const type = (cellXml.match(/\st="([^"]+)"/) || [])[1];
  const value = (cellXml.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
  if (value == null) return "";
  if (type === "s") return sharedStrings[Number(value)] ?? "";
  return Number.isFinite(Number(value)) ? Number(value) : value;
}

function readDetailRows(sheetXml, sharedStrings) {
  const detailRows = [];
  for (const rowMatch of sheetXml.matchAll(/<row r="(\d+)"[\s\S]*?<\/row>/g)) {
    const rowNumber = Number(rowMatch[1]);
    const cells = {};
    for (const cellMatch of rowMatch[0].matchAll(/<c r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)) {
      cells[cellMatch[1]] = cellValue(cellMatch[0], sharedStrings);
    }

    if ((cells.C === "DV" || cells.C === "PV") && typeof cells.J === "number") {
      detailRows.push({
        rowNumber,
        phase: cells.C,
        group: cells.D,
        item: cells.F,
        fee: cells.J,
        lab: cells.K,
      });
    }
  }
  return detailRows;
}

function labKey(labText) {
  const text = String(labText ?? "");
  if (text.includes("SGS")) return "SGS";
  if (text.includes("华测")) return "华测";
  if (text.includes("苏勃")) return "苏勃";
  if (text.includes("国测")) return "指定国测";
  if (text.includes("固定规则")) return "固定规则";
  return text.trim() || "未标注";
}

function summarize(detailRows) {
  const summaries = new Map();
  const rowsForSpecialProjectSummary = detailRows.filter(
    (row) =>
      row.group !== "费用汇总附加费用" &&
      row.item !== "Computer Fee" &&
      row.item !== "Report Fee",
  );

  for (const row of rowsForSpecialProjectSummary) {
    const lab = labKey(row.lab);
    if (!summaries.has(lab)) {
      summaries.set(lab, {
        lab,
        dvItems: [],
        pvItems: [],
        dvFee: 0,
        pvFee: 0,
      });
    }
    const summary = summaries.get(lab);
    const itemText = `${row.group} - ${row.item}`;
    if (row.phase === "DV") {
      summary.dvItems.push(itemText);
      summary.dvFee += row.fee;
    } else {
      summary.pvItems.push(itemText);
      summary.pvFee += row.fee;
    }
  }

  const preferredOrder = ["指定国测", "固定规则", "SGS", "华测", "苏勃", "未标注"];
  return [...summaries.values()].sort((left, right) => {
    const leftIndex = preferredOrder.indexOf(left.lab);
    const rightIndex = preferredOrder.indexOf(right.lab);
    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? 999 : leftIndex) - (rightIndex === -1 ? 999 : rightIndex);
    }
    return left.lab.localeCompare(right.lab, "zh-Hans-CN");
  });
}

function inlineStringCell(ref, style, value) {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function numberCell(ref, style, value) {
  return `<c r="${ref}" s="${style}"><v>${Number(value || 0)}</v></c>`;
}

function blankCell(ref, style) {
  return `<c r="${ref}" s="${style}"/>`;
}

function rowXml(rowNumber, cells, height = "", defaultStyle = 16) {
  const cellMap = new Map(cells.map((cell) => [cell.ref.replace(/\d+$/, ""), cell.xml]));
  const body = columns.map((column) => cellMap.get(column) ?? blankCell(`${column}${rowNumber}`, defaultStyle)).join("");
  const heightAttr = height ? ` ht="${height}" customHeight="1"` : "";
  return `<row r="${rowNumber}"${heightAttr} spans="1:13">${body}</row>`;
}

function buildSummaryRows(summaries) {
  const titleRow = summaryStartRow;
  const noteRow = summaryStartRow + 1;
  const headerRow = summaryStartRow + 2;
  const firstDataRow = summaryStartRow + 3;

  const rows = [
    rowXml(
      titleRow,
      [{ ref: `A${titleRow}`, xml: inlineStringCell(`A${titleRow}`, 6, "特殊项目费用汇总") }],
      "23.2",
      6,
    ),
    rowXml(
      noteRow,
      [
        {
          ref: `A${noteRow}`,
          xml: inlineStringCell(
            `A${noteRow}`,
            8,
            "按实验室/参考口径汇总；费用来自本页“当前规则费用”列，电脑及报告费用不计入特殊项目费用。",
          ),
        },
      ],
      "26",
      8,
    ),
    rowXml(
      headerRow,
      [
        { ref: `A${headerRow}`, xml: inlineStringCell(`A${headerRow}`, 14, "实验室/参考口径") },
        { ref: `C${headerRow}`, xml: inlineStringCell(`C${headerRow}`, 14, "DV 需要测试的项目") },
        { ref: `G${headerRow}`, xml: inlineStringCell(`G${headerRow}`, 15, "DV 费用") },
        { ref: `H${headerRow}`, xml: inlineStringCell(`H${headerRow}`, 14, "PV 需要测试的项目") },
        { ref: `L${headerRow}`, xml: inlineStringCell(`L${headerRow}`, 15, "PV 费用") },
        { ref: `M${headerRow}`, xml: inlineStringCell(`M${headerRow}`, 15, "合计费用") },
      ],
      "28",
      14,
    ),
  ];

  summaries.forEach((summary, index) => {
    const rowNumber = firstDataRow + index;
    rows.push(
      rowXml(
        rowNumber,
        [
          { ref: `A${rowNumber}`, xml: inlineStringCell(`A${rowNumber}`, 16, summary.lab) },
          {
            ref: `C${rowNumber}`,
            xml: inlineStringCell(`C${rowNumber}`, 16, summary.dvItems.join("\n")),
          },
          {
            ref: `G${rowNumber}`,
            xml: numberCell(`G${rowNumber}`, 17, summary.dvFee),
          },
          {
            ref: `H${rowNumber}`,
            xml: inlineStringCell(`H${rowNumber}`, 16, summary.pvItems.join("\n")),
          },
          {
            ref: `L${rowNumber}`,
            xml: numberCell(`L${rowNumber}`, 17, summary.pvFee),
          },
          {
            ref: `M${rowNumber}`,
            xml: numberCell(`M${rowNumber}`, 17, summary.dvFee + summary.pvFee),
          },
        ],
        "78",
        16,
      ),
    );
  });

  const totalRowNumber = firstDataRow + summaries.length;
  rows.push(
    rowXml(
      totalRowNumber,
      [
        { ref: `A${totalRowNumber}`, xml: inlineStringCell(`A${totalRowNumber}`, 9, "合计") },
        {
          ref: `G${totalRowNumber}`,
          xml: numberCell(`G${totalRowNumber}`, 17, summaries.reduce((sum, item) => sum + item.dvFee, 0)),
        },
        { ref: `H${totalRowNumber}`, xml: inlineStringCell(`H${totalRowNumber}`, 10, "特殊项目费用合计") },
        {
          ref: `L${totalRowNumber}`,
          xml: numberCell(`L${totalRowNumber}`, 17, summaries.reduce((sum, item) => sum + item.pvFee, 0)),
        },
        {
          ref: `M${totalRowNumber}`,
          xml: numberCell(
            `M${totalRowNumber}`,
            17,
            summaries.reduce((sum, item) => sum + item.dvFee + item.pvFee, 0),
          ),
        },
      ],
      "32",
      10,
    ),
  );

  return { rows, totalRowNumber };
}

function removeExistingSummaryRows(sheetXml) {
  let xml = sheetXml;
  for (let rowNumber = summaryStartRow; rowNumber <= summaryEndRow; rowNumber += 1) {
    xml = xml.replace(new RegExp(`<row r="${rowNumber}"[\\s\\S]*?<\\/row>`, "g"), "");
  }
  return xml;
}

function replaceDimension(sheetXml, totalRowNumber) {
  const nextRef = `A1:M${Math.max(totalRowNumber, 50)}`;
  if (/<dimension ref="[^"]+"\/>/.test(sheetXml)) {
    return sheetXml.replace(/<dimension ref="[^"]+"\/>/, `<dimension ref="${nextRef}"/>`);
  }
  return sheetXml.replace("<sheetViews>", `<dimension ref="${nextRef}"/><sheetViews>`);
}

function addOrUpdateMerges(sheetXml, summaryCount) {
  const titleRow = summaryStartRow;
  const noteRow = summaryStartRow + 1;
  const headerRow = summaryStartRow + 2;
  const firstDataRow = summaryStartRow + 3;
  const totalRow = firstDataRow + summaryCount;
  const summaryMerges = [
    `A${titleRow}:M${titleRow}`,
    `A${noteRow}:M${noteRow}`,
    `A${headerRow}:B${headerRow}`,
    `C${headerRow}:F${headerRow}`,
    `H${headerRow}:K${headerRow}`,
    ...Array.from({ length: summaryCount }, (_, index) => firstDataRow + index).flatMap((row) => [
      `A${row}:B${row}`,
      `C${row}:F${row}`,
      `H${row}:K${row}`,
    ]),
    `A${totalRow}:F${totalRow}`,
    `H${totalRow}:K${totalRow}`,
  ];

  const mergeCellRegex = /<mergeCell ref="([^"]+)"\/>/g;
  const existing = [];
  const mergeBlock = sheetXml.match(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/);
  if (mergeBlock) {
    for (const match of mergeBlock[0].matchAll(mergeCellRegex)) {
      const rowNumber = Number((match[1].match(/^[A-Z]+(\d+):/) || [])[1]);
      if (
        !(rowNumber >= summaryStartRow && rowNumber <= summaryEndRow) &&
        !summaryMerges.includes(match[1])
      ) {
        existing.push(match[1]);
      }
    }
  }

  const allMerges = [...existing, ...summaryMerges];
  const mergeXml = `<mergeCells count="${allMerges.length}">${allMerges
    .map((ref) => `<mergeCell ref="${ref}"/>`)
    .join("")}</mergeCells>`;

  if (mergeBlock) return sheetXml.replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, mergeXml);
  return sheetXml.replace("</sheetData>", `</sheetData>${mergeXml}`);
}

function updateSheetXml(sheetXml, sharedStrings) {
  const detailRows = readDetailRows(sheetXml, sharedStrings);
  const summaries = summarize(detailRows);
  if (summaries.length > 4) {
    throw new Error(`Summary area supports up to 4 rows; got ${summaries.length}`);
  }

  const { rows, totalRowNumber } = buildSummaryRows(summaries);
  let xml = removeExistingSummaryRows(sheetXml);
  xml = replaceDimension(xml, totalRowNumber);
  xml = xml.replace("</sheetData>", `${rows.join("")}</sheetData>`);
  xml = addOrUpdateMerges(xml, summaries.length);
  return xml;
}

const tempDir = mkdtempSync(join(tmpdir(), "special-fee-summary-"));
try {
  if (!existsSync(workbookPath)) throw new Error(`Workbook does not exist: ${workbookPath}`);
  copyFileSync(workbookPath, join(tempDir, "workbook.xlsx"));
  execFileSync("unzip", ["-qq", "workbook.xlsx", "-d", "xlsx"], { cwd: tempDir });

  const sharedStrings = parseSharedStrings(readFileSync(join(tempDir, "xlsx/xl/sharedStrings.xml"), "utf8"));
  const sheetPath = join(tempDir, "xlsx/xl/worksheets/sheet6.xml");
  writeFileSync(sheetPath, updateSheetXml(readFileSync(sheetPath, "utf8"), sharedStrings));

  rmSync(join(tempDir, "workbook.xlsx"));
  execFileSync("zip", ["-qr", "../workbook.xlsx", "."], { cwd: join(tempDir, "xlsx") });
  copyFileSync(join(tempDir, "workbook.xlsx"), workbookPath);
  console.log(workbookPath);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
