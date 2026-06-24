import type { PlatformCode } from "../types/project";

export const requiredTemplateMarkers = [
  "_PT_META_OEM",
  "_PT_META_PLATFORM",
  "_PT_META_PROJECT_CODE",
  "_PT_META_STEERING",
  "_PT_META_PROJECT_TYPE",
  "_PT_META_EXPORT_SCOPE",
  "_PT_META_FULL_REUSE",
  "_PT_META_ENV_TEMPLATE",
  "_PT_SAMPLE_DYNAMIC_START",
  "_PT_SAMPLE_DYNAMIC_END",
  "_PT_SAMPLE_PROTO_SUMMARY",
  "_PT_SAMPLE_PROTO_DETAIL_GROUP",
  "_PT_SAMPLE_PROTO_DETAIL_HEADER",
  "_PT_SAMPLE_PROTO_DETAIL_DATA",
  "_PT_SAMPLE_PROTO_DETAIL_TOTAL",
  "_PT_FORECAST_DYNAMIC_START",
  "_PT_FORECAST_DYNAMIC_END",
  "_PT_FORECAST_PROTO_PHASE",
  "_PT_FORECAST_PROTO_GROUP",
  "_PT_FORECAST_PROTO_HEADER",
  "_PT_FORECAST_PROTO_DATA",
  "_PT_FORECAST_PROTO_LAST_DATA",
  "_PT_FORECAST_PROTO_TOTAL",
  "_PT_FORECAST_PROTO_ADDITIONAL",
  "_PT_SGS_DYNAMIC_START",
  "_PT_SGS_DYNAMIC_END",
  "_PT_SGS_PROTO_PHASE",
  "_PT_SGS_PROTO_GROUP",
  "_PT_SGS_PROTO_HEADER",
  "_PT_SGS_PROTO_DATA",
  "_PT_SGS_PROTO_TOTAL",
  "_PT_CTI_DYNAMIC_START",
  "_PT_CTI_DYNAMIC_END",
  "_PT_CTI_PROTO_PHASE",
  "_PT_CTI_PROTO_GROUP",
  "_PT_CTI_PROTO_HEADER",
  "_PT_CTI_PROTO_DATA",
  "_PT_CTI_PROTO_TOTAL",
  "_PT_SUBO_DYNAMIC_START",
  "_PT_SUBO_DYNAMIC_END",
  "_PT_SUBO_PROTO_PHASE",
  "_PT_SUBO_PROTO_GROUP",
  "_PT_SUBO_PROTO_HEADER",
  "_PT_SUBO_PROTO_DATA",
  "_PT_SUBO_PROTO_TOTAL",
  "_PT_COMPARE_DYNAMIC_START",
  "_PT_COMPARE_DYNAMIC_END",
  "_PT_COMPARE_PROTO_PHASE",
  "_PT_COMPARE_PROTO_HEADER",
  "_PT_COMPARE_PROTO_DATA",
  "_PT_COMPARE_HELPER_RANGE",
  "_PT_SPECIAL_DYNAMIC_START",
  "_PT_SPECIAL_DYNAMIC_END",
  "_PT_SPECIAL_PROTO_PHASE",
  "_PT_SPECIAL_PROTO_DATA",
  "_PT_SPECIAL_PROTO_TOTAL",
  "_PT_VALIDATION_DYNAMIC_START",
  "_PT_VALIDATION_DYNAMIC_END",
  "_PT_VALIDATION_PROTO_HEADER",
  "_PT_VALIDATION_PROTO_DATA",
] as const;

export type TemplateMarkerName = typeof requiredTemplateMarkers[number];

export interface ResolvedTemplateMarker {
  sheetName: string;
  ref: string;
}

export type ResolvedTemplateMarkers = Record<TemplateMarkerName, ResolvedTemplateMarker>;

export interface FeeTemplateDefinition {
  family: PlatformCode;
  url: string;
  filename: string;
  mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  requiredSheets: readonly string[];
  requiredParts: readonly string[];
}

const requiredSheets = [
  "样品及辅助设备需求",
  "费用预估",
  "SGS",
  "华测",
  "苏勃",
  "费用对比",
  "特殊项目费用",
  "费用规则校验",
] as const;

const requiredParts = [
  "[Content_Types].xml",
  "xl/workbook.xml",
  "xl/_rels/workbook.xml.rels",
  "xl/styles.xml",
  "xl/charts/chart1.xml",
  "xl/drawings/drawing1.xml",
  "xl/drawings/_rels/drawing1.xml.rels",
] as const;

const templates: Record<PlatformCode, FeeTemplateDefinition> = {
  MLA: {
    family: "MLA",
    url: "/templates/MLA费用导出模板.xlsx",
    filename: "MLA测试项目及费用预估.xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    requiredSheets,
    requiredParts,
  },
  EMA: {
    family: "EMA",
    url: "/templates/EMA费用导出模板.xlsx",
    filename: "EMA测试项目及费用预估.xlsx",
    mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    requiredSheets,
    requiredParts,
  },
};

export function selectFeeTemplate(platform: PlatformCode): FeeTemplateDefinition {
  return templates[platform];
}

function decodeXml(value: string): string {
  return value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function parseDefinedNameReference(value: string): ResolvedTemplateMarker {
  const decoded = decodeXml(value.trim());
  const match = decoded.match(/^'(.*)'!(.+)$/);
  if (!match) {
    throw new Error(`Invalid template marker reference: ${decoded}`);
  }
  return {
    sheetName: match[1]!.replace(/''/g, "'"),
    ref: match[2]!,
  };
}

export function resolveTemplateMarkers(workbookXml: string): ResolvedTemplateMarkers {
  const found = new Map<string, ResolvedTemplateMarker[]>();

  for (const match of workbookXml.matchAll(/<definedName\b([^>]*)>([\s\S]*?)<\/definedName>/g)) {
    const attrs = match[1] ?? "";
    const reference = match[2] ?? "";
    const name = attrs.match(/\bname="([^"]+)"/)?.[1];
    if (!name?.startsWith("_PT_")) {
      continue;
    }
    const values = found.get(name) ?? [];
    values.push(parseDefinedNameReference(reference));
    found.set(name, values);
  }

  for (const marker of requiredTemplateMarkers) {
    const values = found.get(marker) ?? [];
    if (values.length === 0) {
      throw new Error(`Missing template marker: ${marker}`);
    }
    if (values.length > 1) {
      throw new Error(`Duplicate template marker: ${marker}`);
    }
  }

  return Object.fromEntries(
    requiredTemplateMarkers.map((marker) => [marker, found.get(marker)![0]]),
  ) as ResolvedTemplateMarkers;
}
