import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const outputPath = "outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx";

function zipLiteral(entryName: string): string {
  return entryName.replace(/([\[\]])/g, "\\$1");
}

function zipEntry(entryName: string): string {
  return execFileSync("unzip", ["-p", outputPath, zipLiteral(entryName)], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function zipEntries(): string[] {
  return execFileSync("unzip", ["-Z1", outputPath], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
    .split(/\r?\n/)
    .filter(Boolean);
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

function workbookText(): string {
  return decodeXmlEntities(
    zipEntries()
      .filter((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry) || /^xl\/charts\/chart\d+\.xml$/.test(entry) || entry === "xl/workbook.xml" || entry === "xl/sharedStrings.xml")
      .map(zipEntry)
      .join("\n"),
  );
}

function sheetNames(): string[] {
  const workbookXml = zipEntry("xl/workbook.xml");
  return [...workbookXml.matchAll(/<sheet[^>]+name="([^"]+)"/g)].map((match) => match[1]!);
}

describe("MLA environment fee template export", () => {
  it("exports the complete xlsx fee workbook without dropping formula tools", () => {
    execFileSync("node_modules/.bin/vite-node", ["scripts/export_mla_environment_fee_template.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(readFileSync(outputPath).subarray(0, 2).toString("utf8")).toBe("PK");
    expect(sheetNames()).toEqual(["费用预估", "SGS", "华测", "苏勃", "费用对比", "特殊项目费用", "费用规则校验"]);

    const text = workbookText();
    const feeEstimateSheetXml = zipEntry("xl/worksheets/sheet1.xml");
    const specialProjectSheetXml = zipEntry("xl/worksheets/sheet6.xml");

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
      expect(text).toContain(requiredText);
    }
    expect(text).not.toContain("预估费用剔除项");

    const feeComparisonSheetXml = zipEntry("xl/worksheets/sheet5.xml");
    const sobolSheetXml = zipEntry("xl/worksheets/sheet4.xml");
    const feeComparisonSheetRels = zipEntry("xl/worksheets/_rels/sheet5.xml.rels");
    const feeComparisonDrawingXml = zipEntry("xl/drawings/drawing1.xml");
    const feeComparisonDrawingRels = zipEntry("xl/drawings/_rels/drawing1.xml.rels");
    const chartXml = zipEntry("xl/charts/chart1.xml");
    const entries = zipEntries();

    expect(feeComparisonSheetXml).toContain("<drawing r:id=");
    expect(feeComparisonSheetRels).toContain("officeDocument/2006/relationships/drawing");
    expect(feeComparisonDrawingXml).toContain("<xdr:graphicFrame");
    expect(feeComparisonDrawingXml).toContain("<c:chart r:id=\"rId1\"/>");
    expect(feeComparisonDrawingXml).not.toContain("<xdr:pic>");
    expect(feeComparisonDrawingRels).toContain("officeDocument/2006/relationships/chart");
    expect(feeComparisonDrawingRels).toContain("../charts/chart1.xml");
    expect(entries).toContain("xl/charts/chart1.xml");
    expect(entries).not.toContain("xl/media/fee-comparison-chart.png");
    expect(chartXml).toContain("<c:barChart>");
    expect(chartXml).toContain("<c:barDir val=\"col\"/>");
    expect(chartXml).toContain('<c:grouping val="stacked"/>');
    expect(chartXml).toContain("<c:plotVisOnly val=\"0\"/>");
    expect(chartXml).toContain("'费用对比'!$S$2:$T$15");
    expect(chartXml).toContain("'费用对比'!$U$2:$U$15");
    expect(chartXml).toContain("'费用对比'!$V$2:$V$15");
    expect(chartXml).toContain("'费用对比'!$W$2:$W$15");
    expect(chartXml).toContain("'费用对比'!$X$2:$X$15");
    expect(chartXml).toContain("<c:multiLvlStrRef>");
    expect(chartXml).toContain("<c:multiLvlStrCache>");
    expect(chartXml).toContain('<c:ptCount val="14"/>');
    expect((chartXml.match(/<c:ser>/g) ?? []).length).toBe(4);
    expect(chartXml).toContain("<c:legend>");
    expect(chartXml).toContain('<c:legendPos val="t"/>');
    expect(chartXml).toContain('<a:srgbClr val="F6F7FB"/>');
    expect(chartXml).toContain("<c:v>预估费用</c:v>");
    expect(chartXml).toContain("<c:v>苏勃</c:v>");
    expect(chartXml).toContain("<c:v>SGS</c:v>");
    expect(chartXml).toContain("<c:v>华测</c:v>");
    expect(feeComparisonSheetXml).toContain('<col min="19" max="24" width="12" style="1" hidden="1" customWidth="1"/>');
    expect(feeComparisonSheetXml).toContain('<c r="S1" s="6" t="inlineStr"><is><t>图表阶段</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="T1" s="6" t="inlineStr"><is><t>图表柱项</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="U1" s="6" t="inlineStr"><is><t>苏勃</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="V1" s="6" t="inlineStr"><is><t>预估费用</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="W1" s="6" t="inlineStr"><is><t>SGS</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="X1" s="6" t="inlineStr"><is><t>华测</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="S2" s="6" t="inlineStr"><is><t>DV</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="T2" s="6" t="inlineStr"><is><t>苏勃</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="U2" s="6"><f>J3/10000</f><v>61.0535</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="T3" s="6" t="inlineStr"><is><t>预估费用</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="V3" s="6"><f>G3/10000</f><v>63.5228</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="S6" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="T6" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="X6" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="S7" s="6" t="inlineStr"><is><t>PV</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="T7" s="6" t="inlineStr"><is><t>预估费用</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="V7" s="6"><f>G4/10000</f><v>67.2028</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="T8" s="6" t="inlineStr"><is><t>苏勃</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="U8" s="6"><f>J4/10000</f><v>68.6135</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="S11" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="T11" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="X11" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="S12" s="6" t="inlineStr"><is><t>DV+PV</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="T12" s="6" t="inlineStr"><is><t>苏勃</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="U12" s="6"><f>J5/10000</f><v>129.667</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="T13" s="6" t="inlineStr"><is><t>预估费用</t></is></c>');
    expect(feeComparisonSheetXml).toContain('<c r="V13" s="6"><f>G5/10000</f><v>130.7256</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="W14" s="6"><f>H5/10000</f><v>140.0508</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="X15" s="6"><f>I5/10000</f><v>185.1984</v></c>');
    expect(feeComparisonSheetXml).toContain('<c r="S16" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="X17" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="K2" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="K3" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="K4" s="6"/>');
    expect(feeComparisonSheetXml).toContain('<c r="K5" s="6"/>');
    expect(sobolSheetXml).toMatch(/<c r="A132" s="57"[^>]*>/);
    expect(sobolSheetXml).toMatch(/<c r="A138" s="51"[^>]*>/);
    expect(sobolSheetXml).not.toContain('<c r="A132" s="85"');
    expect(sobolSheetXml).not.toContain('<c r="A138" s="85"');

    for (const requiredFormula of [
      "SUM(R12:R27)",
      "SUM(S12:S25)",
      "SUM(T12:T25)",
      "SUM(U12:U27)",
      "SUM(V12:V25)",
      "SUM(W12:W25)",
    ]) {
      expect(feeEstimateSheetXml).toContain(`<f>${requiredFormula}</f>`);
    }

    for (const sheetNumber of [1, 2, 3, 4, 5, 6, 7]) {
      expect(zipEntry(`xl/worksheets/sheet${sheetNumber}.xml`)).not.toContain("<sheetProtection");
    }

    expect(text).toContain('SUMIFS($L$1:$L$');
    expect(text).toContain("SUMIFS($E$11:$E$37,$C$11:$C$37,F3)");
    expect(text).toContain("SUMIFS($E$11:$E$37,$C$11:$C$37,F4)");
    expect(feeEstimateSheetXml).toContain("<v>12000</v>");
    expect(feeEstimateSheetXml).toContain("<v>1950</v>");
    expect(feeEstimateSheetXml).toContain("<v>2100</v>");
    expect(specialProjectSheetXml).toContain("<v>12000</v>");
    expect(specialProjectSheetXml).toContain("<v>1950</v>");
    expect(specialProjectSheetXml).toContain("<v>2100</v>");
  });
});
