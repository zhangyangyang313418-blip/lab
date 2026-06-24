import { describe, expect, it } from "vitest";
import {
  requiredTemplateMarkers,
  resolveTemplateMarkers,
  selectFeeTemplate,
} from "../services/feeWorkbookTemplateManifest";

describe("fee workbook template manifest", () => {
  it("selects the platform-specific formal browser template", () => {
    expect(selectFeeTemplate("MLA")).toMatchObject({
      family: "MLA",
      url: "/templates/MLA费用导出模板.xlsx",
      filename: "MLA测试项目及费用预估.xlsx",
    });
    expect(selectFeeTemplate("EMA")).toMatchObject({
      family: "EMA",
      url: "/templates/EMA费用导出模板.xlsx",
      filename: "EMA测试项目及费用预估.xlsx",
    });
  });

  it("resolves explicit markers without relying on rows, styles, or business labels", () => {
    const xml = `<workbook><definedNames>${requiredTemplateMarkers
      .map((name, index) => `<definedName name="${name}" hidden="1">'Sheet ${index}'!$A$1:$B$2</definedName>`)
      .join("")}</definedNames></workbook>`;

    const markers = resolveTemplateMarkers(xml);

    expect(Object.keys(markers)).toHaveLength(requiredTemplateMarkers.length);
    expect(markers._PT_META_OEM).toEqual({
      sheetName: "Sheet 0",
      ref: "$A$1:$B$2",
    });
  });

  it("rejects missing markers", () => {
    expect(() => resolveTemplateMarkers("<workbook><definedNames/></workbook>"))
      .toThrow(/missing template marker/i);
  });

  it("rejects duplicate markers", () => {
    const definitions = requiredTemplateMarkers
      .map((name) => `<definedName name="${name}">'Sheet'!$A$1</definedName>`)
      .join("");
    const xml = `<workbook><definedNames>${definitions}<definedName name="${requiredTemplateMarkers[0]}">'Sheet'!$B$2</definedName></definedNames></workbook>`;

    expect(() => resolveTemplateMarkers(xml)).toThrow(/duplicate template marker/i);
  });
});
