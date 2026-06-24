import { execFileSync } from "node:child_process";
import { copyFile, mkdir, realpath, stat } from "node:fs/promises";
import { dirname } from "node:path";

const outputDir = "outputs/mla-fee-export-template";
const templatePath = "outputs/workbook-edits/final/MLA费用导出模板_流程导出基准.xlsx";
const outputPath = `${outputDir}/MLA费用导出模板.xlsx`;

const expectedSheetOrder = [
  "样品及辅助设备需求",
  "费用预估",
  "SGS",
  "华测",
  "苏勃",
  "费用对比",
  "特殊项目费用",
  "费用规则校验",
];

interface SheetInfo {
  name: string;
  relId: string;
  state: string;
  entry: string;
}

function readZipEntry(workbookPath: string, entryName: string): string {
  return execFileSync("unzip", ["-p", workbookPath, entryName], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function listZipEntries(workbookPath: string): string[] {
  return execFileSync("unzip", ["-Z1", workbookPath], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .filter(Boolean);
}

function readOptionalZipEntry(workbookPath: string, entryName: string): string {
  try {
    return readZipEntry(workbookPath, entryName);
  } catch {
    return "";
  }
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function xmlAttr(tag: string, attrName: string): string {
  const match = tag.match(new RegExp(`${attrName}="([^"]*)"`));
  return match?.[1] ?? "";
}

function assertContains(content: string, expected: string, label: string): void {
  if (!content.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`);
  }
}

function workbookSheets(workbookPath: string): SheetInfo[] {
  const workbookXml = readZipEntry(workbookPath, "xl/workbook.xml");
  const relsXml = readZipEntry(workbookPath, "xl/_rels/workbook.xml.rels");
  const relTargets = new Map(
    [...relsXml.matchAll(/<Relationship\b[^>]*>/g)].map((match) => [
      xmlAttr(match[0], "Id"),
      xmlAttr(match[0], "Target"),
    ]),
  );

  return [...workbookXml.matchAll(/<sheet\b[^>]*>/g)].map((match) => {
    const tag = match[0];
    const relId = xmlAttr(tag, "r:id");
    const target = relTargets.get(relId);
    if (!target) {
      throw new Error(`Missing worksheet relationship for ${xmlAttr(tag, "name")}`);
    }

    return {
      name: xmlAttr(tag, "name"),
      relId,
      state: xmlAttr(tag, "state"),
      entry: `xl/${target.replace(/^\/?xl\//, "")}`,
    };
  });
}

async function copyTemplate(): Promise<void> {
  await stat(templatePath);
  await mkdir(dirname(outputPath), { recursive: true });

  const [sourceRealPath, outputRealPath] = await Promise.all([
    realpath(templatePath),
    realpath(outputPath).catch(() => ""),
  ]);

  if (sourceRealPath !== outputRealPath) {
    await copyFile(templatePath, outputPath);
  }
}

function validateWorkbook(workbookPath: string): void {
  const entries = listZipEntries(workbookPath);
  const sheets = workbookSheets(workbookPath);
  const sheetNames = sheets.map((sheet) => sheet.name);

  if (JSON.stringify(sheetNames) !== JSON.stringify(expectedSheetOrder)) {
    throw new Error(`Unexpected sheet order: ${sheetNames.join(" / ")}`);
  }

  const validationSheet = sheets.find((sheet) => sheet.name === "费用规则校验");
  if (validationSheet?.state !== "hidden") {
    throw new Error("费用规则校验 sheet should stay hidden in the flow export template");
  }

  const worksheetXml = sheets.map((sheet) => readZipEntry(workbookPath, sheet.entry)).join("\n");
  const searchableXml = decodeXmlEntities(
    `${readZipEntry(workbookPath, "xl/workbook.xml")}\n${readOptionalZipEntry(workbookPath, "xl/sharedStrings.xml")}\n${worksheetXml}`,
  );

  for (const requiredText of [
    "MLA DV样品及辅助设备需求汇总",
    "MLA PV样品及辅助设备需求汇总",
    "费用计算公式",
    "费用汇总",
    "Computer Fee",
    "Report Fee",
    "测试费用合计",
    "实验室报价 vs 预估",
    "整包报价 vs 预估",
    "测试项目一致性检查",
  ]) {
    assertContains(searchableXml, requiredText, "workbook text");
  }

  for (const errorText of ["#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A"]) {
    if (searchableXml.includes(errorText)) {
      throw new Error(`Workbook contains formula error text: ${errorText}`);
    }
  }

  const demandSheet = sheets.find((sheet) => sheet.name === "样品及辅助设备需求");
  if (!demandSheet) {
    throw new Error("Missing 样品及辅助设备需求 sheet");
  }
  const demandSheetXml = readZipEntry(workbookPath, demandSheet.entry);
  assertContains(demandSheetXml, 'dimension ref="A1:AS159"', "sample demand used range");
  assertContains(demandSheetXml, "<mergeCells", "sample demand merged layout");
  assertContains(demandSheetXml, "customWidth", "sample demand column widths");

  const feeComparisonSheet = sheets.find((sheet) => sheet.name === "费用对比");
  if (!feeComparisonSheet) {
    throw new Error("Missing 费用对比 sheet");
  }
  const feeComparisonXml = readZipEntry(workbookPath, feeComparisonSheet.entry);
  assertContains(feeComparisonXml, "<drawing r:id=", "费用对比 chart drawing");
  if (!entries.includes("xl/charts/chart1.xml")) {
    throw new Error("Missing native Excel chart part xl/charts/chart1.xml");
  }
  const chartXml = readZipEntry(workbookPath, "xl/charts/chart1.xml");
  assertContains(chartXml, "<c:barChart>", "费用对比 bar chart");
  assertContains(chartXml, "<c:v>预估费用</c:v>", "费用对比 chart estimated fee label");
  assertContains(chartXml, "<c:v>SGS</c:v>", "费用对比 chart SGS label");
  assertContains(chartXml, "<c:v>华测</c:v>", "费用对比 chart 华测 label");
  assertContains(chartXml, "<c:v>苏勃</c:v>", "费用对比 chart 苏勃 label");

  for (const sheet of sheets) {
    if (readZipEntry(workbookPath, sheet.entry).includes("<sheetProtection")) {
      throw new Error(`Unexpected protection in worksheet ${sheet.name}`);
    }
  }
}

await copyTemplate();
validateWorkbook(outputPath);

console.log(outputPath);
