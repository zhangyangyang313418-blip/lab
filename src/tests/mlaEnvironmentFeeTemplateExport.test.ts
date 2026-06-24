import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const outputPath = "outputs/mla-fee-export-template/MLA费用导出模板.xlsx";

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

function zipEntry(entryName: string): string {
  return execFileSync("unzip", ["-p", outputPath, entryName], {
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

function xmlAttr(tag: string, attrName: string): string {
  const match = tag.match(new RegExp(`${attrName}="([^"]*)"`));
  return match?.[1] ?? "";
}

function sheetInfos(): SheetInfo[] {
  const workbookXml = zipEntry("xl/workbook.xml");
  const relsXml = zipEntry("xl/_rels/workbook.xml.rels");
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

function sheetXmlByName(name: string): string {
  const sheet = sheetInfos().find((item) => item.name === name);
  if (!sheet) {
    throw new Error(`Missing sheet: ${name}`);
  }

  return zipEntry(sheet.entry);
}

function workbookText(): string {
  const worksheets = sheetInfos().map((sheet) => zipEntry(sheet.entry));
  return decodeXmlEntities(
    [zipEntry("xl/workbook.xml"), zipEntry("xl/sharedStrings.xml"), ...worksheets, zipEntry("xl/charts/chart1.xml")].join("\n"),
  );
}

describe("MLA environment fee template export", () => {
  it("saves the current WPS-maintained xlsx template as the flow export workbook", () => {
    execFileSync("node_modules/.bin/vite-node", ["scripts/export_mla_environment_fee_template.ts"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
    });

    expect(readFileSync(outputPath).subarray(0, 2).toString("utf8")).toBe("PK");

    const sheets = sheetInfos();
    expect(sheets.map((sheet) => sheet.name)).toEqual(expectedSheetOrder);
    expect(sheets.find((sheet) => sheet.name === "费用规则校验")?.state).toBe("hidden");

    const text = workbookText();
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
      expect(text).toContain(requiredText);
    }

    for (const formulaError of ["#REF!", "#DIV/0!", "#VALUE!", "#NAME?", "#N/A"]) {
      expect(text).not.toContain(formulaError);
    }

    const demandSheetXml = sheetXmlByName("样品及辅助设备需求");
    expect(demandSheetXml).toContain('dimension ref="A1:AS159"');
    expect(demandSheetXml).toContain("<mergeCells");
    expect(demandSheetXml).toContain("customWidth");

    const feeComparisonSheetXml = sheetXmlByName("费用对比");
    expect(feeComparisonSheetXml).toContain("<drawing r:id=");

    const entries = zipEntries();
    expect(entries).toContain("xl/charts/chart1.xml");
    expect(entries).toContain("xl/drawings/drawing1.xml");
    expect(entries).not.toContain("xl/media/fee-comparison-chart.png");

    const chartXml = zipEntry("xl/charts/chart1.xml");
    expect(chartXml).toContain("<c:barChart>");
    expect(chartXml).toContain("<c:v>预估费用</c:v>");
    expect(chartXml).toContain("<c:v>SGS</c:v>");
    expect(chartXml).toContain("<c:v>华测</c:v>");
    expect(chartXml).toContain("<c:v>苏勃</c:v>");

    for (const sheet of sheets) {
      expect(zipEntry(sheet.entry)).not.toContain("<sheetProtection");
    }
  });
});
