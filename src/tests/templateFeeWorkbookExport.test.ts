import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSeedAppState } from "../store/appState";
import { OoxmlPackage } from "../services/ooxmlPackage";
import { buildTemplateFeeWorkbook } from "../services/templateFeeWorkbookExport";

function templateFetcher(path: string): Promise<Uint8Array> {
  const localPath = path.startsWith("/") ? `public${path}` : path;
  return Promise.resolve(new Uint8Array(readFileSync(localPath)));
}

async function worksheetText(bytes: Uint8Array): Promise<string> {
  const workbook = await OoxmlPackage.load(bytes);
  return workbook.list()
    .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
    .map((path) => workbook.readText(path))
    .join("\n");
}

function cellValue(xml: string, ref: string): string | undefined {
  const cell = xml.match(new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`))?.[0];
  return cell?.match(/<v>([\s\S]*?)<\/v>/)?.[1];
}

function cellXml(xml: string, ref: string): string | undefined {
  return xml.match(new RegExp(`<c\\b[^>]*\\br="${ref}"[^>]*(?:\\/>|>[\\s\\S]*?<\\/c>)`))?.[0];
}

function firstChartNumericCacheValues(chartXml: string): string[] {
  const cache = chartXml.match(/<c:numCache>[\s\S]*?<c:ptCount val="14"\/>[\s\S]*?<\/c:numCache>/)?.[0] ?? "";
  return [...cache.matchAll(/<c:pt idx="\d+"><c:v>([\s\S]*?)<\/c:v><\/c:pt>/g)].map((match) => match[1] ?? "");
}

function worksheetXmlBySheetName(workbook: OoxmlPackage, sheetName: string): string {
  const workbookXml = workbook.readText("xl/workbook.xml");
  const relsXml = workbook.readText("xl/_rels/workbook.xml.rels");
  const sheetTag = workbookXml.match(new RegExp(`<sheet\\b[^>]*name="${sheetName}"[^>]*/>`))?.[0];
  const relId = sheetTag?.match(/r:id="([^"]+)"/)?.[1];
  const target = relId ? relsXml.match(new RegExp(`<Relationship\\b[^>]*Id="${relId}"[^>]*Target="([^"]+)"`))?.[1] : undefined;
  if (!target) {
    throw new Error(`Missing worksheet target for ${sheetName}`);
  }
  return workbook.readText(`xl/${target.replace(/^xl\//, "")}`);
}

function dynamicMergeRefs(xml: string, startRow: number): string[] {
  return [...xml.matchAll(/<mergeCell ref="([^"]+)"\/>/g)]
    .map((match) => match[1] ?? "")
    .filter((ref) => {
      const rows = [...ref.matchAll(/\$?[A-Z]{1,3}\$?(\d+)/g)].map((match) => Number(match[1]));
      return rows.some((row) => row >= startRow);
    });
}

function mismatchedCellRefs(xml: string): string[] {
  const mismatches: string[] = [];
  const rowTagPattern = /<row\b[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = rowTagPattern.exec(xml)) !== null) {
    const startTag = match[0];
    const row = Number(startTag.match(/\br="(\d+)"/)?.[1]);
    if (!Number.isFinite(row) || startTag.endsWith("/>")) {
      continue;
    }

    const closeIndex = xml.indexOf("</row>", rowTagPattern.lastIndex);
    if (closeIndex === -1) {
      mismatches.push(`row ${row} missing closing tag`);
      continue;
    }
    const body = xml.slice(rowTagPattern.lastIndex, closeIndex);
    mismatches.push(
      ...[...body.matchAll(/<c\b[^>]*\br="([A-Z]{1,3})(\d+)"/g)]
        .filter((cellMatch) => Number(cellMatch[2]) !== row)
        .map((cellMatch) => `${cellMatch[1]}${cellMatch[2]} in row ${row}`),
    );
    rowTagPattern.lastIndex = closeIndex + "</row>".length;
  }

  return mismatches;
}

function duplicateCellRefs(xml: string): string[] {
  const duplicates: string[] = [];
  for (const rowMatch of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = rowMatch[1] ?? "";
    const refs = [...(rowMatch[2] ?? "").matchAll(/<c\b[^>]*\br="([A-Z]{1,3}\d+)"/g)]
      .map((match) => match[1] ?? "");
    const seen = new Set<string>();
    for (const ref of refs) {
      if (seen.has(ref)) {
        duplicates.push(`${ref} duplicated in row ${row}`);
      }
      seen.add(ref);
    }
  }
  return duplicates;
}

function outOfOrderRows(xml: string): string[] {
  const rows = [...xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map((match) => Number(match[1]));
  return rows
    .filter((row, index) => index > 0 && row < rows[index - 1]!)
    .map((row, index) => `${row} after ${rows[index]!}`);
}

function worksheetIntegrityIssues(xml: string): string[] {
  return [
    ...mismatchedCellRefs(xml),
    ...duplicateCellRefs(xml),
    ...outOfOrderRows(xml),
  ];
}

describe("template fee workbook export", () => {
  it.each(["MLA", "EMA"] as const)("builds a real %s xlsx from its formal template", async (platform) => {
    const state = createSeedAppState();
    state.projectSetup.platform = platform;
    state.environmentPlan.platform = platform;

    const file = await buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      templateFetcher,
    );
    const workbook = await OoxmlPackage.load(file.bytes);

    expect(String.fromCharCode(...file.bytes.subarray(0, 2))).toBe("PK");
    expect(file.filename).toBe(`${platform}测试项目及费用预估.xlsx`);
    expect(file.mime).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(workbook.has("xl/styles.xml")).toBe(true);
    expect(workbook.has("xl/charts/chart1.xml")).toBe(true);
    expect(workbook.has("xl/drawings/drawing1.xml")).toBe(true);
    expect(workbook.readText("xl/workbook.xml").match(/<sheet\b[^>]*name="([^"]+)"/g)?.map((item) => item.match(/name="([^"]+)"/)?.[1])).toEqual([
      "样品及辅助设备需求",
      "费用预估",
      "SGS",
      "华测",
      "苏勃",
      "费用对比",
      "特殊项目费用",
      "费用规则校验",
    ]);
    expect(workbook.readText("xl/workbook.xml")).toMatch(/<sheet\b[^>]*name="费用规则校验"[^>]*state="hidden"/);
    expect(workbook.macroFingerprint().hasMacros).toBe(false);
    expect(() => workbook.assertNoFormulaErrors()).not.toThrow();
  });

  it("updates the comparison chart helper range and chart cache together", async () => {
    const state = createSeedAppState();
    const file = await buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      templateFetcher,
    );
    const workbook = await OoxmlPackage.load(file.bytes);
    const comparisonXml = workbook.readText("xl/worksheets/sheet6.xml");
    const helperValues = Array.from({ length: 14 }, (_, index) => cellValue(comparisonXml, `U${index + 2}`) ?? "");
    const chartValues = firstChartNumericCacheValues(workbook.readText("xl/charts/chart1.xml"));

    expect(helperValues).toHaveLength(14);
    expect(helperValues.every((value) => value !== "")).toBe(true);
    expect(chartValues).toEqual(helperValues);
  });

  it("writes added test items and added groups into the marked template regions", async () => {
    const state = createSeedAppState();
    const phase = state.environmentPlan.phases[0]!;
    const firstGroup = phase.groups[0]!;
    firstGroup.rows.push({
      ...firstGroup.rows[0]!,
      id: "CUSTOM-ADDED",
      label: "CUSTOM ADDED TEST",
    });
    phase.groups.push({
      ...structuredClone(firstGroup),
      id: "custom-group",
      title: "Group Z",
      rows: [{
        ...firstGroup.rows[0]!,
        id: "CUSTOM-Z",
        label: "CUSTOM GROUP Z TEST",
      }],
    });

    const file = await buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      templateFetcher,
    );
    const text = await worksheetText(file.bytes);

    expect(text).toContain("CUSTOM ADDED TEST");
    expect(text).toContain("CUSTOM GROUP Z TEST");
    expect(text).toContain("Group Z");
  });

  it("preserves the forecast sidecar summary cells when outline rows change", async () => {
    const state = createSeedAppState();
    const phase = state.environmentPlan.phases[0]!;
    const firstGroup = phase.groups[0]!;
    firstGroup.rows.splice(3, 0, {
      id: "manual-stable-unknown-test",
      label: "CUSTOM UNKNOWN TEST",
      testHours: "5",
      sampleRange: "1-4",
    });

    const file = await buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      templateFetcher,
    );
    const workbook = await OoxmlPackage.load(file.bytes);
    const forecastXml = worksheetXmlBySheetName(workbook, "费用预估");

    expect(forecastXml).toContain("CUSTOM UNKNOWN TEST");
    expect(cellXml(forecastXml, "Q10")).toMatch(/<v>170<\/v>/);
    expect(cellXml(forecastXml, "Q11")).toMatch(/<v>3<\/v>/);
    expect(cellXml(forecastXml, "R12")).toMatch(/<f>[^<]+<\/f>/);
    expect(cellXml(forecastXml, "W28")).toMatch(/<f>SUM\(W12:W25\)<\/f>/);
  });

  it("keeps modified, reordered, and duplicate outline rows as separate forecast records", async () => {
    const state = createSeedAppState();
    const phase = state.environmentPlan.phases[0]!;
    const firstGroup = phase.groups[0]!;
    const removed = firstGroup.rows.find((row) => row.id === "a-k1");
    expect(removed).toBeDefined();
    firstGroup.rows = firstGroup.rows.filter((row) => row.id !== "a-k1");
    firstGroup.rows[2] = {
      ...firstGroup.rows[2]!,
      label: "Total：CUSTOM 合计 -> TEST",
    };
    firstGroup.rows.splice(
      1,
      0,
      { id: "manual-duplicate-a", label: "DUPLICATE CUSTOM TEST", testHours: "1" },
      { id: "manual-duplicate-b", label: "DUPLICATE CUSTOM TEST", testHours: "2" },
    );
    phase.groups = [...phase.groups.slice(1), firstGroup];

    const file = await buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      templateFetcher,
    );
    const workbook = await OoxmlPackage.load(file.bytes);
    const forecastXml = worksheetXmlBySheetName(workbook, "费用预估");
    const validationXml = worksheetXmlBySheetName(workbook, "费用规则校验");

    expect(forecastXml.match(/K1 Low Temperature Exposure/g)).toHaveLength(1);
    expect(forecastXml).toContain("Total：CUSTOM 合计 -&gt; TEST");
    expect(forecastXml.match(/DUPLICATE CUSTOM TEST/g)).toHaveLength(2);
    expect(validationXml).toContain("Total：CUSTOM 合计 -&gt; TEST");
    expect(validationXml.match(/DUPLICATE CUSTOM TEST/g)).toHaveLength(2);
    expect(validationXml.match(/规则待确认/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("does not keep old template merges stretched across generated dynamic rows", async () => {
    const state = createSeedAppState();
    const file = await buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      templateFetcher,
    );
    const workbook = await OoxmlPackage.load(file.bytes);

    const sampleXml = worksheetXmlBySheetName(workbook, "样品及辅助设备需求");
    const forecastXml = worksheetXmlBySheetName(workbook, "费用预估");
    const sgsXml = worksheetXmlBySheetName(workbook, "SGS");

    expect(sampleXml).toContain("需求细则");
    expect(sampleXml).toContain("Group A Sequence Tests");
    expect(sampleXml).toContain("Max");
    expect(sampleXml).toContain("K18 Connector and lead/lock strength");
    expect(forecastXml).toContain("K1 Low Temperature Exposure");
    expect(sgsXml).toContain("Particle Exposure");

    const stretchedDynamicMerges = [
      ...dynamicMergeRefs(sampleXml, 6),
      ...dynamicMergeRefs(forecastXml, 10),
      ...dynamicMergeRefs(sgsXml, 6),
    ].filter((ref) => {
      const rows = [...ref.matchAll(/\$?[A-Z]{1,3}\$?(\d+)/g)].map((match) => Number(match[1]));
      return rows.length === 2 && rows[0] !== rows[1];
    });

    expect(stretchedDynamicMerges).toEqual([]);
  });

  it("keeps worksheet rows ordered and cell references inside their owning rows", async () => {
    const state = createSeedAppState();
    const file = await buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      templateFetcher,
    );
    const workbook = await OoxmlPackage.load(file.bytes);

    const issues = workbook.list()
      .filter((path) => /^xl\/worksheets\/sheet\d+\.xml$/.test(path))
      .flatMap((path) => worksheetIntegrityIssues(workbook.readText(path)).map((item) => `${path}: ${item}`));

    expect(issues).toEqual([]);
  });

  it("rejects missing templates and never returns a legacy xls fallback", async () => {
    const state = createSeedAppState();

    await expect(buildTemplateFeeWorkbook(
      state.environmentPlan,
      state.projectSetup,
      async () => {
        throw new Error("404");
      },
    )).rejects.toThrow(/MLA 费用模板加载失败/);
  });
});
