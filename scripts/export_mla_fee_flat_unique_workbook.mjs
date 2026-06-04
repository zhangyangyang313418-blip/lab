import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createSeedAppState } from "../src/store/appState";
import { createEnvironmentFeeDetailSections, getEnvironmentSpecialFeeBreakdown } from "../src/services/environmentFeeDetail";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "outputs", "mla-fee-detail-export");
const outputPath = process.env.MLA_FEE_OUTPUT_PATH
  ? path.resolve(process.env.MLA_FEE_OUTPUT_PATH)
  : path.join(outputDir, "JLR-MLA 费用规则V.0 版本.xlsx");
const labNames = ["SGS", "华测", "苏劢"];
const labDisplayNames = { SGS: "SGS", 华测: "华测", 苏劢: "苏勃" };
const chamberPriceRules = {
  K1: {
    large: { SGS: 30, 华测: 25, 苏劢: 40 },
    small: { SGS: 23, 华测: 18, 苏劢: 30 },
  },
  K2: {
    large: { SGS: 30, 华测: 25, 苏劢: 40 },
    small: { SGS: 23, 华测: 18, 苏劢: 30 },
  },
  K3: {
    large: { SGS: 30, 华测: 25, 苏劢: 40 },
    small: { SGS: 23, 华测: 18, 苏劢: 30 },
  },
  K4: {
    large: { SGS: 30, 华测: 25, 苏劢: 40 },
    small: { SGS: 23, 华测: 18, 苏劢: 30 },
  },
  K6: {
    large: { SGS: 30, 华测: 25, 苏劢: 40 },
    small: { SGS: 23, 华测: 18, 苏劢: 30 },
  },
  K9: {
    large: { SGS: 30, 华测: 25, 苏劢: 40 },
    small: { SGS: 23, 华测: 18, 苏劢: 30 },
  },
};

function colName(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return null;
  }
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getBaseValue(row) {
  if (row.chargeBasis === "hour") return row.testHours ?? "";
  if (row.chargeBasis === "quantity") return row.quantity ?? "";
  if (row.chargeBasis === "batch") return row.batchCount ?? "";
  return "";
}

function chargeUnit(chargeBasis) {
  if (chargeBasis === "hour") return "按小时计费/h";
  if (chargeBasis === "quantity") return "按样品数量计费/个";
  if (chargeBasis === "batch") return "按批次计费/批次";
  return "待确认";
}

function normalizeRuleKey(row) {
  if (row.testCode) return row.testCode.replace(/\s+/g, "");
  const code = row.testName.match(/\b(?:K|L)\s*\d+(?:\.\d+)?\b/i)?.[0];
  return (code ?? row.testName).replace(/\s+/g, " ").trim();
}

function rowPriority(row) {
  if (row.status === "priced") return 0;
  if (row.status === "规则待确认") return 1;
  return 2;
}

function getLab(row, labName) {
  return row.labs.find((lab) => lab.lab === labName) ?? { unitPrice: "", itemFee: null };
}

function specialFormulaSummary(specialBreakdown) {
  if (!specialBreakdown) return "";
  return specialBreakdown.lines
    .filter((line) => labNames.includes(line.label))
    .map((line) => `${labDisplayNames[line.label] ?? line.label}: ${line.formula} = ${line.total}`)
    .join("；");
}

function getChamberPrices(ruleKey) {
  return chamberPriceRules[ruleKey] ?? null;
}

function removeExcludedLabText(text) {
  return String(text ?? "")
    .replace(/；?信测:[^；<]*/g, "")
    .replace(/；?信测无微应力测试能力/g, "");
}

function isL6Rule(row) {
  return /^L6$/i.test(row.ruleKey);
}

function createL6SplitRows(row) {
  const common = {
    ...row,
    testCode: "",
    chargeBasis: "quantity",
    unit: "按组合报价计费/组",
    defaultBase: 1,
    baseValues: new Set(["1"]),
    baseNote: "",
    special: "是",
    sourceCount: row.sourceCount,
    priority: row.priority,
  };

  const blankLabs = Object.fromEntries(
    labNames.map((labName) => [labName, { unitPrice: "", itemFee: "" }]),
  );

  return [
    {
      ...common,
      ruleKey: "L6-photo&xray",
      testCode: "L6-photo&xray",
      testName: "L6 Internal Inspection - Photography & X-Ray",
      ownership: "内部费用",
      labs: blankLabs,
      specialNote: "内部组合报价：Photography + X-Ray。按组合报价填写单价/费用；如按样品数量计费，可将默认基数改为样品数量。",
      notes: "L6 内部检查组合项，替代原 L6 总行的一部分；不要再重复填写原 L6 总行。",
    },
    {
      ...common,
      ruleKey: "L6-SEM&SECTION",
      testCode: "L6-SEM&SECTION",
      testName: "L6 Internal Inspection - SEM & Sectioning",
      ownership: "委外费用",
      labs: blankLabs,
      specialNote: "委外组合报价：SEM + Sectioning。按供应商组合报价填写单价/费用；如按点位计费，可将收费单位/默认基数备注写明。",
      notes: "L6 委外检查组合项，替代原 L6 总行的一部分；不要再重复填写原 L6 总行。",
    },
  ];
}

function normalizeL6ExportRow(row) {
  if (row.ruleKey === "L6-photo&xray") {
    return {
      ...row,
      ownership: "内部费用",
      unit: "按样品数量计费/个",
      labs: {
        SGS: { unitPrice: 400, itemFee: "" },
        华测: { unitPrice: "N/A", itemFee: "N/A" },
        苏劢: { unitPrice: "N/A", itemFee: "N/A" },
      },
      notes: row.notes || "L6-photo&xray 固定单价 400/个样品；不按实验室报价中值计算",
    };
  }

  if (row.ruleKey === "L6-SEM&SECTION") {
    return {
      ...row,
      ownership: "委外费用",
      unit: "按点位计费/点位",
      baseNote: row.baseNote || "3 样品 × 11 点位 = 33 点位",
    };
  }

  return row;
}

function normalizeK28ExportRow(row) {
  if (row.ruleKey !== "K28") {
    return row;
  }

  const haltSubtests = "子项：HALT Cold / HALT Hot / HALT Thermal Shock / HALT Vibration / HALT TST & Vibration；每项 8h";

  return {
    ...row,
    testName: "HALT",
    baseNote: row.baseNote || haltSubtests,
    notes: row.notes
      ? `${row.notes}；${haltSubtests}`
      : `HALT 测试项目按五个子项计费；${haltSubtests}`,
  };
}

function buildUniqueRows() {
  const state = createSeedAppState();
  const rowsByKey = new Map();

  for (const phase of state.environmentPlan.phases) {
    const outlineRows = new Map(
      phase.groups.flatMap((group) => group.rows.map((row) => [`${group.id}:${row.id}`, { group, row }])),
    );

    for (const section of createEnvironmentFeeDetailSections(phase)) {
      for (const row of section.rows) {
        const outline = outlineRows.get(`${section.groupId}:${row.outlineRowId}`);
        const specialBreakdown = outline ? getEnvironmentSpecialFeeBreakdown(phase, outline.group, outline.row) : null;
        const ruleKey = normalizeRuleKey(row);
        const existing = rowsByKey.get(ruleKey);
        const base = getBaseValue(row);
        const candidate = {
          ruleKey,
          testCode: row.testCode,
          testName: row.testName,
          chargeBasis: row.chargeBasis,
          unit: chargeUnit(row.chargeBasis),
          ownership: "待确认",
          defaultBase: base,
          baseValues: new Set(base === "" ? [] : [String(base)]),
          special: specialBreakdown ? "是" : "否",
          chamberPrices: getChamberPrices(ruleKey),
          specialNote: specialFormulaSummary(specialBreakdown),
          status: row.status === "priced" ? "" : row.status,
          notes: removeExcludedLabText(row.notes ?? ""),
          labs: Object.fromEntries(
            labNames.map((labName) => {
              const lab = getLab(row, labName);
              return [labName, {
                unitPrice: lab.unitPrice ?? "",
                itemFee: lab.itemFee ?? "",
              }];
            }),
          ),
          sourceCount: 1,
          priority: rowPriority(row),
        };

        if (!existing) {
          rowsByKey.set(ruleKey, candidate);
          continue;
        }

        if (base !== "") {
          existing.baseValues.add(String(base));
        }
        existing.sourceCount += 1;
        if (candidate.special === "是") {
          existing.special = "是";
          existing.specialNote = existing.specialNote || candidate.specialNote;
        }
        if (candidate.notes && !existing.notes.includes(candidate.notes)) {
          existing.notes = existing.notes ? `${existing.notes}；${candidate.notes}` : candidate.notes;
        }
        if (candidate.priority < existing.priority) {
          const mergedBaseValues = existing.baseValues;
          const sourceCount = existing.sourceCount;
          rowsByKey.set(ruleKey, {
            ...candidate,
            baseValues: mergedBaseValues,
            sourceCount,
          });
        }
      }
    }
  }

  const splitRows = [...rowsByKey.values()].flatMap((row) => (isL6Rule(row) ? createL6SplitRows(row) : [row]));

  return splitRows
    .sort((a, b) => {
      const aCode = a.testCode || a.ruleKey;
      const bCode = b.testCode || b.ruleKey;
      return aCode.localeCompare(bCode, "zh-Hans-CN", { numeric: true });
    })
    .map((row) => {
      const normalized = normalizeK28ExportRow(normalizeL6ExportRow(row));
      return {
        ...normalized,
        baseNote: normalized.baseNote || (row.baseValues.size > 1 ? `不同使用场景出现过这些基数：${[...row.baseValues].join(" / ")}` : ""),
      };
    });
}

const headers = [
  "ruleKey_勿改",
  "测试编号",
  "测试项目",
  "费用归属_可选",
  "收费单位",
  "计费方式",
  "样品数量_可修改",
  "环境箱判定_自动",
  "默认基数_可修改",
  "基数备注",
  "特殊计算",
  "大箱SGS单价_可修改",
  "大箱华测单价_可修改",
  "大箱苏勃单价_可修改",
  "小箱SGS单价_可修改",
  "小箱华测单价_可修改",
  "小箱苏勃单价_可修改",
  "SGS单价_自动",
  "SGS费用_自动",
  "华测单价_自动",
  "华测费用_自动",
  "苏勃单价_自动",
  "苏勃费用_自动",
  "建议费用_自动",
  "手动覆盖费用_可修改",
  "导回费用_自动",
  "计算差异说明",
  "规则备注",
  "原明细出现次数",
];

const versionHeaders = [
  "版本",
  "更新日期",
  "更新类型",
  "更新内容",
  "影响范围",
  "维护备注",
];

const versionRows = [
  [
    "V.0",
    "2026-06-04",
    "初版导出",
    "按当前系统规则导出 JLR-MLA 费用规则单页去重版；包含 K28 HALT 五项 8h、E-2 SGS 参考价、K13 最新单价、L6 命名与费用规则；交付前修正 L6 已命名规则重复拆分问题，并保留 L6 内部/委外归属；K28 测试项目名称统一为 HALT，子项写入备注。",
    "费用规则去重表",
    "后续如修改单价或规则，请在本页追加 V.1 / V.2 记录，并保留历史版本。",
  ],
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stringCell(ref, value, style = 1) {
  const text = value === null || value === undefined ? "" : String(value);
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
}

function numberCell(ref, value, style = 1) {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function formulaCell(ref, formula, style = 1) {
  return `<c r="${ref}" s="${style}"><f>${escapeXml(formula)}</f></c>`;
}

function cellXml(ref, value, style = 1) {
  return typeof value === "number" && Number.isFinite(value)
    ? numberCell(ref, value, style)
    : stringCell(ref, value, style);
}

function styleForColumn(index) {
  const col = colName(index);
  if (["D", "G", "I", "L", "M", "N", "O", "P", "Q", "Y"].includes(col)) return 2;
  if (["R", "S", "T", "U", "V", "W", "X"].includes(col)) return 3;
  if (["Z"].includes(col)) return 4;
  return 1;
}

function buildSheetValues(rows) {
  return rows.map((row) => [
    row.ruleKey,
    row.testCode,
    row.testName,
    row.ownership,
    row.unit,
    row.chargeBasis,
    row.chamberPrices ? 12 : "",
    "",
    row.defaultBase,
    row.baseNote,
    row.special,
    row.chamberPrices?.large.SGS ?? "",
    row.chamberPrices?.large.华测 ?? "",
    row.chamberPrices?.large.苏劢 ?? "",
    row.chamberPrices?.small.SGS ?? "",
    row.chamberPrices?.small.华测 ?? "",
    row.chamberPrices?.small.苏劢 ?? "",
    row.labs.SGS.unitPrice,
    row.special === "是" ? row.labs.SGS.itemFee : "",
    row.labs.华测.unitPrice,
    row.special === "是" ? row.labs.华测.itemFee : "",
    row.labs.苏劢.unitPrice,
    row.special === "是" ? row.labs.苏劢.itemFee : "",
    "",
    "",
    "",
    row.special === "是"
      ? row.specialNote || "该项目存在特殊/组合计算，费用列按当前系统结果预填；如需改公式，可在备注写明后交回我处理。"
      : row.chamberPrices
        ? "环境箱项目：样品数量 ≤ 6 自动按小环境箱，否则按大环境箱；请修改大箱/小箱单价列，后面的实验室单价会自动带出。"
        : "普通项目按 默认基数 × 实验室单价 自动计算。",
    row.notes,
    row.sourceCount,
  ]);
}

function writeZip(sourceDir, targetPath) {
  const python = process.env.PYTHON_BIN ?? "/usr/bin/python3";
  const code = `
from pathlib import Path
import sys, zipfile
source = Path(sys.argv[1])
target = Path(sys.argv[2])
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
    for path in source.rglob("*"):
        if path.is_file():
            z.write(path, path.relative_to(source).as_posix())
`;
  const result = spawnSync(python, ["-c", code, sourceDir, targetPath], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "Failed to write xlsx zip.");
  }
}

async function writeRawXlsx(rows) {
  const values = buildSheetValues(rows);
  const lastRow = values.length + 1;
  const lastCol = colName(headers.length - 1);
  const tmpDir = path.join(outputDir, ".flat-unique-xlsx-tmp");
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(path.join(tmpDir, "_rels"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, "xl", "_rels"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, "xl", "worksheets"), { recursive: true });

  const widths = [15, 12, 42, 13, 18, 12, 14, 14, 14, 34, 11, 12, 12, 12, 12, 12, 12, 14, 14, 14, 14, 14, 16, 14, 60, 50, 13];
  const colsXml = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rowsXml = [
    `<row r="1" ht="33" customHeight="1">${headers.map((header, index) => stringCell(`${colName(index)}1`, header, 5)).join("")}</row>`,
    ...values.map((row, rowIndex) => {
      const excelRow = rowIndex + 2;
      const cells = row.map((value, colIndex) => {
        const col = colName(colIndex);
        const ref = `${col}${excelRow}`;
        const style = styleForColumn(colIndex);
        const specialFormula = `K${excelRow}="是"`;
        if (col === "H") {
          return formulaCell(ref, `IF(G${excelRow}="","",IF(G${excelRow}<=6,"小环境箱","大环境箱"))`, 2);
        }
        if (col === "R") {
          return value !== "" && value !== "N/A"
            ? formulaCell(ref, `IF($L${excelRow}<>"",IF($H${excelRow}="小环境箱",$O${excelRow},$L${excelRow}),${JSON.stringify(value)})`, 2)
            : cellXml(ref, value, style);
        }
        if (col === "T") {
          return value !== "" && value !== "N/A"
            ? formulaCell(ref, `IF($M${excelRow}<>"",IF($H${excelRow}="小环境箱",$P${excelRow},$M${excelRow}),${JSON.stringify(value)})`, 2)
            : cellXml(ref, value, style);
        }
        if (col === "V") {
          return value !== "" && value !== "N/A"
            ? formulaCell(ref, `IF($N${excelRow}<>"",IF($H${excelRow}="小环境箱",$Q${excelRow},$N${excelRow}),${JSON.stringify(value)})`, 2)
            : cellXml(ref, value, style);
        }
        if (col === "S") {
          return value !== "" && value !== "N/A"
            ? cellXml(ref, value, 3)
            : formulaCell(ref, `IF(${specialFormula},"",IF(OR(I${excelRow}="",R${excelRow}="",R${excelRow}="N/A"),"",I${excelRow}*R${excelRow}))`, 3);
        }
        if (col === "U") {
          return value !== "" && value !== "N/A"
            ? cellXml(ref, value, 3)
            : formulaCell(ref, `IF(${specialFormula},"",IF(OR(I${excelRow}="",T${excelRow}="",T${excelRow}="N/A"),"",I${excelRow}*T${excelRow}))`, 3);
        }
        if (col === "W") {
          return value !== "" && value !== "N/A"
            ? cellXml(ref, value, 3)
            : formulaCell(ref, `IF(${specialFormula},"",IF(OR(I${excelRow}="",V${excelRow}="",V${excelRow}="N/A"),"",I${excelRow}*V${excelRow}))`, 3);
        }
        if (col === "X") {
          return formulaCell(ref, `IFERROR(MEDIAN(S${excelRow},U${excelRow},W${excelRow}),"")`, 3);
        }
        if (col === "Z") {
          return formulaCell(ref, `IF(Y${excelRow}<>"",Y${excelRow},X${excelRow})`, 4);
        }
        return cellXml(ref, value, style);
      });
      return `<row r="${excelRow}">${cells.join("")}</row>`;
    }),
  ].join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="3" ySplit="1" topLeftCell="D2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="D2" sqref="D2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
  <autoFilter ref="A1:${lastCol}${lastRow}"/>
  <dataValidations count="1">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="D2:D${lastRow}"><formula1>"内部费用,委外费用,内外部都可,待确认"</formula1></dataValidation>
  </dataValidations>
</worksheet>`;

  const versionWidths = [12, 14, 18, 72, 22, 60];
  const versionColsXml = versionWidths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const versionRowsXml = [
    `<row r="1" ht="28" customHeight="1">${versionHeaders.map((header, index) => stringCell(`${colName(index)}1`, header, 5)).join("")}</row>`,
    ...versionRows.map((row, rowIndex) => {
      const excelRow = rowIndex + 2;
      return `<row r="${excelRow}" ht="58" customHeight="1">${row.map((value, colIndex) => cellXml(`${colName(colIndex)}${excelRow}`, value, 1)).join("")}</row>`;
    }),
  ].join("");
  const versionLastCol = colName(versionHeaders.length - 1);
  const versionLastRow = versionRows.length + 1;
  const versionSheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${versionColsXml}</cols>
  <sheetData>${versionRowsXml}</sheetData>
  <autoFilter ref="A1:${versionLastCol}${versionLastRow}"/>
</worksheet>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="3"><font><sz val="10"/><name val="Microsoft YaHei"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Microsoft YaHei"/></font><font><b/><sz val="10"/><color rgb="FF7C2D12"/><name val="Microsoft YaHei"/></font></fonts>
  <fills count="6"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1F4E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFFFF7ED"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEFF6FF"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0FDF4"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border/><border><left style="thin"><color rgb="FFD9E2EC"/></left><right style="thin"><color rgb="FFD9E2EC"/></right><top style="thin"><color rgb="FFD9E2EC"/></top><bottom style="thin"><color rgb="FFD9E2EC"/></bottom></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="6">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  await fs.writeFile(path.join(tmpDir, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  await fs.writeFile(path.join(tmpDir, "_rels", ".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  await fs.writeFile(path.join(tmpDir, "xl", "workbook.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><calcPr calcMode="auto"/><sheets><sheet name="费用规则去重表" sheetId="1" r:id="rId1"/><sheet name="版本记录" sheetId="2" r:id="rId2"/></sheets></workbook>`);
  await fs.writeFile(path.join(tmpDir, "xl", "_rels", "workbook.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  await fs.writeFile(path.join(tmpDir, "xl", "worksheets", "sheet1.xml"), sheetXml);
  await fs.writeFile(path.join(tmpDir, "xl", "worksheets", "sheet2.xml"), versionSheetXml);
  await fs.writeFile(path.join(tmpDir, "xl", "styles.xml"), stylesXml);

  await fs.rm(outputPath, { force: true });
  writeZip(tmpDir, outputPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

const rows = buildUniqueRows();
if (rows.length === 0) {
  throw new Error("No unique fee rows were generated.");
}

await fs.mkdir(outputDir, { recursive: true });
await writeRawXlsx(rows);
console.log(`rows=${rows.length}`);
console.log(outputPath);
