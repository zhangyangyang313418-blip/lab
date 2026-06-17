import { execFileSync } from "node:child_process";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";

const outputDir = "outputs/mla-fee-export-template";
const templatePath = "outputs/workbook-edits/final/MLA测试项目及费用预估_费用预估模板已同步后续页面_格式锁定.xlsx";
const outputPath = `${outputDir}/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx`;

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

function assertContains(content: string, expected: string, label: string): void {
  if (!content.includes(expected)) {
    throw new Error(`Missing ${label}: ${expected}`);
  }
}

function validateWorkbook(workbookPath: string): void {
  const workbookXml = readZipEntry(workbookPath, "xl/workbook.xml");
  const entries = listZipEntries(workbookPath);
  const worksheetXml = entries
    .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry))
    .map((entry) => readZipEntry(workbookPath, entry))
    .join("\n");
  const searchableXml = decodeXmlEntities(`${workbookXml}\n${readOptionalZipEntry(workbookPath, "xl/sharedStrings.xml")}\n${worksheetXml}`);
  const feeEstimateSheetXml = readZipEntry(workbookPath, "xl/worksheets/sheet1.xml");

  for (const sheetName of ["费用预估", "SGS", "华测", "苏勃", "费用对比", "特殊项目费用", "费用规则校验"]) {
    assertContains(workbookXml, `name="${sheetName}"`, "worksheet");
  }

  for (const requiredText of [
    "费用计算公式",
    "费用汇总",
    "DV附加费用",
    "PV附加费用",
    "Computer Fee",
    "Report Fee",
    "Computer fee",
    "Report fee",
    "测试费用合计",
    "整包报价 vs 预估费用 | 按预估费用居中排序",
    "SGS 250/月/台 × 48 = 12,000",
    "苏勃 150/份 × 13 份 = 1,950",
    "苏勃 150/份 × 14 份 = 2,100",
    "整包报价 vs 预估",
    "测试项目一致性检查",
  ]) {
    assertContains(searchableXml, requiredText, "workbook text");
  }
  if (searchableXml.includes("预估费用剔除项")) {
    throw new Error("费用对比 sheet should use the lab quote chart instead of the removed exclusion table");
  }

  for (const requiredFormula of ["SUM(R12:R27)", "SUM(S12:S25)", "SUM(T12:T25)", "SUM(U12:U27)", "SUM(V12:V25)", "SUM(W12:W25)"]) {
    assertContains(feeEstimateSheetXml, `<f>${requiredFormula}</f>`, "费用预估 formula");
  }

  for (const sheetNumber of [1, 2, 3, 4, 5, 6, 7]) {
    if (readZipEntry(workbookPath, `xl/worksheets/sheet${sheetNumber}.xml`).includes("<sheetProtection")) {
      throw new Error(`Unexpected protection in worksheet ${sheetNumber}`);
    }
  }

  assertContains(worksheetXml, 'SUMIFS($L$1:$L$', "lab summary formula bounded fee range");
  assertContains(worksheetXml, 'SUMIFS($E$11:$E$37,$C$11:$C$37,F3)', "费用对比 DV SGS formula");
  assertContains(worksheetXml, 'SUMIFS($E$11:$E$37,$C$11:$C$37,F4)', "费用对比 PV SGS formula");

  const feeComparisonSheetXml = readZipEntry(workbookPath, "xl/worksheets/sheet5.xml");
  const feeComparisonSheetRels = readZipEntry(workbookPath, "xl/worksheets/_rels/sheet5.xml.rels");
  const feeComparisonDrawingXml = readZipEntry(workbookPath, "xl/drawings/drawing1.xml");
  const feeComparisonDrawingRels = readZipEntry(workbookPath, "xl/drawings/_rels/drawing1.xml.rels");
  const chartXml = readZipEntry(workbookPath, "xl/charts/chart1.xml");

  assertContains(feeComparisonSheetXml, "<drawing r:id=", "费用对比 chart drawing");
  assertContains(feeComparisonSheetRels, "officeDocument/2006/relationships/drawing", "费用对比 drawing relationship");
  assertContains(feeComparisonDrawingXml, "<xdr:graphicFrame", "费用对比 native chart frame");
  assertContains(feeComparisonDrawingXml, '<c:chart r:id="rId1"/>', "费用对比 native chart relationship id");
  if (feeComparisonDrawingXml.includes("<xdr:pic>")) {
    throw new Error("费用对比 chart should be a native Excel chart generated from workbook data, not an embedded image");
  }
  assertContains(feeComparisonDrawingRels, "officeDocument/2006/relationships/chart", "费用对比 chart relationship");
  assertContains(feeComparisonDrawingRels, "../charts/chart1.xml", "费用对比 chart target");
  assertContains(chartXml, "<c:barChart>", "费用对比 bar chart");
  assertContains(chartXml, '<c:barDir val="col"/>', "费用对比 column chart direction");
  assertContains(chartXml, '<c:grouping val="stacked"/>', "费用对比 stacked chart grouping");
  assertContains(chartXml, '<c:plotVisOnly val="0"/>', "费用对比 chart plots hidden helper columns");
  assertContains(chartXml, "'费用对比'!$S$2:$T$15", "费用对比 multi-level chart categories");
  assertContains(chartXml, "'费用对比'!$U$2:$U$15", "费用对比 苏勃 value series");
  assertContains(chartXml, "'费用对比'!$V$2:$V$15", "费用对比 预估费用 value series");
  assertContains(chartXml, "'费用对比'!$W$2:$W$15", "费用对比 SGS value series");
  assertContains(chartXml, "'费用对比'!$X$2:$X$15", "费用对比 华测 value series");
  assertContains(chartXml, "<c:multiLvlStrRef>", "费用对比 multi-level category reference");
  assertContains(chartXml, "<c:multiLvlStrCache>", "费用对比 multi-level category cache");
  assertContains(chartXml, '<c:ptCount val="14"/>', "费用对比 chart includes two group spacer points");
  if ((chartXml.match(/<c:ser>/g) ?? []).length !== 4) {
    throw new Error("费用对比图表应保留 4 个图例系列");
  }
  assertContains(chartXml, "<c:legend>", "费用对比 chart legend");
  assertContains(chartXml, '<c:legendPos val="t"/>', "费用对比 chart top legend");
  assertContains(chartXml, '<a:srgbClr val="F6F7FB"/>', "费用对比 chart plot area fill");
  assertContains(chartXml, "<c:v>预估费用</c:v>", "费用对比 chart estimated fee label");
  assertContains(chartXml, "<c:v>苏勃</c:v>", "费用对比 chart 苏勃 label");
  assertContains(chartXml, "<c:v>SGS</c:v>", "费用对比 chart SGS label");
  assertContains(chartXml, "<c:v>华测</c:v>", "费用对比 chart 华测 label");
  assertContains(feeComparisonSheetXml, '<col min="19" max="24" width="12" style="1" hidden="1" customWidth="1"/>', "费用对比 hidden chart data columns");
  assertContains(feeComparisonSheetXml, '<c r="S1" s="6" t="inlineStr"><is><t>图表阶段</t></is></c>', "费用对比 chart phase helper header");
  assertContains(feeComparisonSheetXml, '<c r="T1" s="6" t="inlineStr"><is><t>图表柱项</t></is></c>', "费用对比 chart item helper header");
  assertContains(feeComparisonSheetXml, '<c r="U1" s="6" t="inlineStr"><is><t>苏勃</t></is></c>', "费用对比 苏勃 helper header");
  assertContains(feeComparisonSheetXml, '<c r="V1" s="6" t="inlineStr"><is><t>预估费用</t></is></c>', "费用对比 预估费用 helper header");
  assertContains(feeComparisonSheetXml, '<c r="W1" s="6" t="inlineStr"><is><t>SGS</t></is></c>', "费用对比 SGS helper header");
  assertContains(feeComparisonSheetXml, '<c r="X1" s="6" t="inlineStr"><is><t>华测</t></is></c>', "费用对比 华测 helper header");
  assertContains(feeComparisonSheetXml, '<c r="S2" s="6" t="inlineStr"><is><t>DV</t></is></c>', "费用对比 DV category");
  assertContains(feeComparisonSheetXml, '<c r="T2" s="6" t="inlineStr"><is><t>苏勃</t></is></c>', "费用对比 DV low quote first");
  assertContains(feeComparisonSheetXml, '<c r="U2" s="6"><f>J3/10000</f><v>61.0535</v></c>', "费用对比 DV low quote formula");
  assertContains(feeComparisonSheetXml, '<c r="T3" s="6" t="inlineStr"><is><t>预估费用</t></is></c>', "费用对比 DV estimated fee item");
  assertContains(feeComparisonSheetXml, '<c r="V3" s="6"><f>G3/10000</f><v>63.5228</v></c>', "费用对比 DV estimated fee formula");
  assertContains(feeComparisonSheetXml, '<c r="S6" s="6"/>', "费用对比 DV/PV group spacer phase");
  assertContains(feeComparisonSheetXml, '<c r="T6" s="6"/>', "费用对比 DV/PV group spacer label");
  assertContains(feeComparisonSheetXml, '<c r="X6" s="6"/>', "费用对比 DV/PV group spacer value");
  assertContains(feeComparisonSheetXml, '<c r="S7" s="6" t="inlineStr"><is><t>PV</t></is></c>', "费用对比 PV category");
  assertContains(feeComparisonSheetXml, '<c r="T7" s="6" t="inlineStr"><is><t>预估费用</t></is></c>', "费用对比 PV estimated fee starts actual cluster");
  assertContains(feeComparisonSheetXml, '<c r="V7" s="6"><f>G4/10000</f><v>67.2028</v></c>', "费用对比 PV estimated fee formula");
  assertContains(feeComparisonSheetXml, '<c r="T8" s="6" t="inlineStr"><is><t>苏勃</t></is></c>', "费用对比 PV first high quote");
  assertContains(feeComparisonSheetXml, '<c r="U8" s="6"><f>J4/10000</f><v>68.6135</v></c>', "费用对比 PV first high quote formula");
  assertContains(feeComparisonSheetXml, '<c r="S11" s="6"/>', "费用对比 PV/DV+PV group spacer phase");
  assertContains(feeComparisonSheetXml, '<c r="T11" s="6"/>', "费用对比 PV/DV+PV group spacer label");
  assertContains(feeComparisonSheetXml, '<c r="X11" s="6"/>', "费用对比 PV/DV+PV group spacer value");
  assertContains(feeComparisonSheetXml, '<c r="S12" s="6" t="inlineStr"><is><t>DV+PV</t></is></c>', "费用对比 DV+PV category");
  assertContains(feeComparisonSheetXml, '<c r="T12" s="6" t="inlineStr"><is><t>苏勃</t></is></c>', "费用对比 DV+PV low quote first");
  assertContains(feeComparisonSheetXml, '<c r="U12" s="6"><f>J5/10000</f><v>129.667</v></c>', "费用对比 DV+PV low quote formula");
  assertContains(feeComparisonSheetXml, '<c r="T13" s="6" t="inlineStr"><is><t>预估费用</t></is></c>', "费用对比 DV+PV estimated fee item");
  assertContains(feeComparisonSheetXml, '<c r="V13" s="6"><f>G5/10000</f><v>130.7256</v></c>', "费用对比 DV+PV estimated fee formula");
  assertContains(feeComparisonSheetXml, '<c r="W14" s="6"><f>H5/10000</f><v>140.0508</v></c>', "费用对比 DV+PV SGS formula");
  assertContains(feeComparisonSheetXml, '<c r="X15" s="6"><f>I5/10000</f><v>185.1984</v></c>', "费用对比 DV+PV 华测 formula");
  assertContains(feeComparisonSheetXml, '<c r="S16" s="6"/>', "费用对比 clears old chart helper rows");
  assertContains(feeComparisonSheetXml, '<c r="X17" s="6"/>', "费用对比 clears old chart helper columns");
  assertContains(feeComparisonSheetXml, '<c r="K2" s="6"/>', "费用对比 top min quote header removed");
  assertContains(feeComparisonSheetXml, '<c r="K3" s="6"/>', "费用对比 top DV min quote removed");
  assertContains(feeComparisonSheetXml, '<c r="K4" s="6"/>', "费用对比 top PV min quote removed");
  assertContains(feeComparisonSheetXml, '<c r="K5" s="6"/>', "费用对比 top total min quote removed");
}

await stat(templatePath);
await mkdir(dirname(outputPath), { recursive: true });
await copyFile(templatePath, outputPath);
validateWorkbook(outputPath);

console.log(outputPath);
