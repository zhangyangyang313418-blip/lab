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

function firstChartNumericCacheValues(chartXml: string): string[] {
  const cache = chartXml.match(/<c:numCache>[\s\S]*?<c:ptCount val="14"\/>[\s\S]*?<\/c:numCache>/)?.[0] ?? "";
  return [...cache.matchAll(/<c:pt idx="\d+"><c:v>([\s\S]*?)<\/c:v><\/c:pt>/g)].map((match) => match[1] ?? "");
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
