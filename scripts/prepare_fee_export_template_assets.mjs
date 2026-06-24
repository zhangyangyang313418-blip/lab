import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

const root = resolve(".");
const templates = [
  {
    platform: "MLA",
    source: "outputs/mla-fee-export-template/MLA费用导出模板.xlsx",
    asset: "public/templates/MLA费用导出模板.xlsx",
  },
  {
    platform: "EMA",
    source: "outputs/ema-fee-export-template/EMA费用导出模板.xlsx",
    asset: "public/templates/EMA费用导出模板.xlsx",
  },
];

const sheetOrder = [
  "样品及辅助设备需求",
  "费用预估",
  "SGS",
  "华测",
  "苏勃",
  "费用对比",
  "特殊项目费用",
  "费用规则校验",
];

function xmlAttr(tag, name) {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
}

function workbookSheets(entries) {
  const workbookXml = strFromU8(entries["xl/workbook.xml"]);
  const relsXml = strFromU8(entries["xl/_rels/workbook.xml.rels"]);
  const relTargets = new Map(
    [...relsXml.matchAll(/<Relationship\b[^>]*>/g)].map((match) => [
      xmlAttr(match[0], "Id"),
      xmlAttr(match[0], "Target"),
    ]),
  );

  return [...workbookXml.matchAll(/<sheet\b[^>]*>/g)].map((match, index) => {
    const tag = match[0];
    const relId = xmlAttr(tag, "r:id");
    const target = relTargets.get(relId);
    if (!target) {
      throw new Error(`Missing worksheet relationship: ${xmlAttr(tag, "name")}`);
    }
    return {
      index,
      name: xmlAttr(tag, "name"),
      entry: `xl/${target.replace(/^\/?xl\//, "")}`,
    };
  });
}

function sheetDimension(entries, entry) {
  const xml = strFromU8(entries[entry]);
  const ref = xml.match(/<dimension\b[^>]*ref="([^"]+)"/)?.[1];
  if (!ref) {
    throw new Error(`Missing worksheet dimension: ${entry}`);
  }
  return ref;
}

function dimensionEnd(ref) {
  return ref.includes(":") ? ref.split(":")[1] : ref;
}

function quoteSheet(name) {
  return `'${name.replace(/'/g, "''")}'`;
}

function marker(name, sheet, ref) {
  return `<definedName name="${name}" hidden="1">${quoteSheet(sheet)}!${ref}</definedName>`;
}

function markerDefinitions(entries) {
  const sheets = workbookSheets(entries);
  const names = sheets.map((sheet) => sheet.name);
  if (JSON.stringify(names) !== JSON.stringify(sheetOrder)) {
    throw new Error(`Unexpected template sheet order: ${names.join(" / ")}`);
  }

  const byName = new Map(sheets.map((sheet) => [sheet.name, sheet]));
  const end = (name) => dimensionEnd(sheetDimension(entries, byName.get(name).entry));

  return [
    marker("_PT_META_OEM", "费用预估", "$B$2"),
    marker("_PT_META_PLATFORM", "费用预估", "$D$2"),
    marker("_PT_META_PROJECT_CODE", "费用预估", "$B$3"),
    marker("_PT_META_STEERING", "费用预估", "$D$3"),
    marker("_PT_META_PROJECT_TYPE", "费用预估", "$B$4"),
    marker("_PT_META_EXPORT_SCOPE", "费用预估", "$D$4"),
    marker("_PT_META_FULL_REUSE", "费用预估", "$B$5"),
    marker("_PT_META_ENV_TEMPLATE", "费用预估", "$D$5"),

    marker("_PT_SAMPLE_DYNAMIC_START", "样品及辅助设备需求", "$A$6"),
    marker("_PT_SAMPLE_DYNAMIC_END", "样品及辅助设备需求", `$${end("样品及辅助设备需求").match(/[A-Z]+/)[0]}$${end("样品及辅助设备需求").match(/\d+/)[0]}`),
    marker("_PT_SAMPLE_PROTO_SUMMARY", "样品及辅助设备需求", "$A$6:$AS$6"),
    marker("_PT_SAMPLE_PROTO_DETAIL_GROUP", "样品及辅助设备需求", "$A$24:$V$24"),
    marker("_PT_SAMPLE_PROTO_DETAIL_HEADER", "样品及辅助设备需求", "$A$25:$V$25"),
    marker("_PT_SAMPLE_PROTO_DETAIL_DATA", "样品及辅助设备需求", "$A$26:$V$26"),
    marker("_PT_SAMPLE_PROTO_DETAIL_TOTAL", "样品及辅助设备需求", "$A$48:$V$48"),

    marker("_PT_FORECAST_DYNAMIC_START", "费用预估", "$A$10"),
    marker("_PT_FORECAST_DYNAMIC_END", "费用预估", `$W$${end("费用预估").match(/\d+/)[0]}`),
    marker("_PT_FORECAST_PROTO_PHASE", "费用预估", "$A$10:$W$10"),
    marker("_PT_FORECAST_PROTO_GROUP", "费用预估", "$A$11:$W$11"),
    marker("_PT_FORECAST_PROTO_HEADER", "费用预估", "$A$12:$W$12"),
    marker("_PT_FORECAST_PROTO_DATA", "费用预估", "$A$13:$W$13"),
    marker("_PT_FORECAST_PROTO_LAST_DATA", "费用预估", "$A$30:$W$30"),
    marker("_PT_FORECAST_PROTO_TOTAL", "费用预估", "$A$34:$W$34"),
    marker("_PT_FORECAST_PROTO_ADDITIONAL", "费用预估", "$A$135:$W$135"),

    marker("_PT_SGS_DYNAMIC_START", "SGS", "$A$6"),
    marker("_PT_SGS_DYNAMIC_END", "SGS", `$R$${end("SGS").match(/\d+/)[0]}`),
    marker("_PT_SGS_PROTO_DATA", "SGS", "$A$9:$R$9"),
    marker("_PT_CTI_DYNAMIC_START", "华测", "$A$6"),
    marker("_PT_CTI_DYNAMIC_END", "华测", `$R$${end("华测").match(/\d+/)[0]}`),
    marker("_PT_CTI_PROTO_DATA", "华测", "$A$9:$R$9"),
    marker("_PT_SUBO_DYNAMIC_START", "苏勃", "$A$6"),
    marker("_PT_SUBO_DYNAMIC_END", "苏勃", `$R$${end("苏勃").match(/\d+/)[0]}`),
    marker("_PT_SUBO_PROTO_DATA", "苏勃", "$A$9:$R$9"),

    marker("_PT_COMPARE_HELPER_RANGE", "费用对比", "$S$1:$X$15"),

    marker("_PT_SPECIAL_DYNAMIC_START", "特殊项目费用", "$A$9"),
    marker("_PT_SPECIAL_DYNAMIC_END", "特殊项目费用", "$M$37"),
    marker("_PT_SPECIAL_PROTO_PHASE", "特殊项目费用", "$A$9:$M$9"),
    marker("_PT_SPECIAL_PROTO_DATA", "特殊项目费用", "$A$12:$M$12"),
    marker("_PT_SPECIAL_PROTO_TOTAL", "特殊项目费用", "$A$38:$M$38"),

    marker("_PT_VALIDATION_DYNAMIC_START", "费用规则校验", "$A$1"),
    marker("_PT_VALIDATION_DYNAMIC_END", "费用规则校验", `$M$${end("费用规则校验").match(/\d+/)[0]}`),
    marker("_PT_VALIDATION_PROTO_HEADER", "费用规则校验", "$A$1:$M$1"),
    marker("_PT_VALIDATION_PROTO_DATA", "费用规则校验", "$A$2:$M$2"),
  ];
}

function withMarkers(workbookXml, definitions) {
  const cleaned = workbookXml.replace(/<definedNames>[\s\S]*?<\/definedNames>/, "");
  const block = `<definedNames>${definitions.join("")}</definedNames>`;
  if (!cleaned.includes("</workbook>")) {
    throw new Error("Invalid workbook XML: missing </workbook>");
  }
  return cleaned.replace("</workbook>", `${block}</workbook>`);
}

function ensureValidationHidden(workbookXml) {
  return workbookXml.replace(
    /(<sheet\b[^>]*name="费用规则校验"[^>]*)(\/>)/,
    (match, start, end) => (
      /\bstate=/.test(start) ? match : `${start} state="hidden"${end}`
    ),
  );
}

function macroParts(entries) {
  return Object.keys(entries).filter((path) => /vbaProject\.bin|activeX|customUI|signature/i.test(path));
}

async function prepare({ platform, source, asset }) {
  const sourcePath = resolve(root, source);
  const assetPath = resolve(root, asset);
  const bytes = new Uint8Array(await readFile(sourcePath));
  const entries = unzipSync(bytes);
  const beforeMacros = Object.fromEntries(macroParts(entries).map((path) => [path, entries[path]]));

  let workbookXml = strFromU8(entries["xl/workbook.xml"]);
  workbookXml = ensureValidationHidden(workbookXml);
  workbookXml = withMarkers(workbookXml, markerDefinitions(entries));
  entries["xl/workbook.xml"] = strToU8(workbookXml);

  for (const [path, macroBytes] of Object.entries(beforeMacros)) {
    if (!entries[path] || Buffer.compare(Buffer.from(entries[path]), Buffer.from(macroBytes)) !== 0) {
      throw new Error(`${platform} macro part changed while preparing template: ${path}`);
    }
  }

  const output = zipSync(entries);
  await writeFile(sourcePath, output);
  await mkdir(dirname(assetPath), { recursive: true });
  await writeFile(assetPath, output);
  console.log(`${platform}: ${source} -> ${asset}`);
}

for (const template of templates) {
  await prepare(template);
}
