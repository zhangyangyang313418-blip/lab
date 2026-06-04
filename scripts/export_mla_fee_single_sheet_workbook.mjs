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
const outputPath = path.join(outputDir, "MLA费用计算明细_单页可修改.xlsx");
const labNames = ["SGS", "华测", "苏劢", "信测"];

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

function getLab(row, labName) {
  return row.labs.find((lab) => lab.lab === labName) ?? { unitPrice: "", itemFee: null };
}

function getBaseValue(row) {
  if (row.chargeBasis === "hour") {
    return row.testHours ?? "";
  }
  if (row.chargeBasis === "quantity") {
    return row.quantity ?? "";
  }
  if (row.chargeBasis === "batch") {
    return row.batchCount ?? "";
  }
  return "";
}

function parseComponentFormula(formula) {
  if (!formula) {
    return null;
  }

  const parts = formula.split(/\s+\+\s+/);
  const components = parts.map((part) => {
    const multiplyMatch = part.match(/([\d.]+)\s*([^\d×+]+?)\s*×\s*([\d.]+)/);
    if (multiplyMatch) {
      return {
        label: multiplyMatch[2].trim(),
        basis: Number(multiplyMatch[1]),
        unitPrice: Number(multiplyMatch[3]),
      };
    }

    const fixedMatch = part.match(/(.+?)\s+([\d.]+)$/);
    if (fixedMatch) {
      return {
        label: fixedMatch[1].trim(),
        basis: 1,
        unitPrice: Number(fixedMatch[2]),
      };
    }

    return null;
  });

  return components.every(Boolean) ? components : null;
}

function isFormulaDrivenRow(row, specialBreakdown) {
  return row.status === "priced"
    && row.chargeBasis !== "pending"
    && !specialBreakdown
    && row.labs.some((lab) => typeof lab.unitPrice === "number");
}

function buildSingleSheetRows() {
  const state = createSeedAppState();
  const rows = [];

  for (const phase of state.environmentPlan.phases) {
    const outlineRows = new Map(
      phase.groups.flatMap((group) => group.rows.map((row) => [`${group.id}:${row.id}`, { group, row }])),
    );

    for (const section of createEnvironmentFeeDetailSections(phase)) {
      for (const row of section.rows) {
        const outline = outlineRows.get(`${section.groupId}:${row.outlineRowId}`);
        const specialBreakdown = outline ? getEnvironmentSpecialFeeBreakdown(phase, outline.group, outline.row) : null;
        const rowKey = `${phase.id}|${section.groupId}|${row.outlineRowId}`;
        const formulaDriven = isFormulaDrivenRow(row, specialBreakdown);
        const common = {
          rowKey,
          phaseId: phase.id,
          phaseTitle: phase.title,
          groupId: section.groupId,
          groupTitle: section.groupTitle,
          outlineRowId: row.outlineRowId,
          testCode: row.testCode,
          testName: row.testName,
          chargeBasis: row.chargeBasis,
          status: row.status === "priced" ? "" : row.status,
          ownership: "待确认",
          currentFee: row.estimatedItemFee ?? "",
          baseValue: getBaseValue(row),
          testHours: row.testHours ?? "",
          quantity: row.quantity ?? "",
          batchCount: row.batchCount ?? "",
          formulaDriven: formulaDriven ? "是" : "否",
          notes: row.notes ?? "",
        };

        const specialComponents = specialBreakdown?.lines.flatMap((line) => {
          const components = parseComponentFormula(line.formula);

          return components
            ? components.map((component) => ({
                lab: line.label,
                component: component.label,
                basis: component.basis,
                unitPrice: component.unitPrice,
              }))
            : [];
        }) ?? [];

        if (specialComponents.length > 0) {
          for (const component of specialComponents) {
            rows.push({
              ...common,
              detailType: "拆分明细",
              lab: component.lab,
              component: component.component,
              basis: component.basis,
              unitPrice: component.unitPrice,
            });
          }
          continue;
        }

        if (formulaDriven) {
          for (const labName of labNames) {
            const lab = getLab(row, labName);
            const unitPrice = parseNumber(lab.unitPrice);
            const basis = parseNumber(common.baseValue);
            if (unitPrice !== null && basis !== null) {
              rows.push({
                ...common,
                detailType: "基础计费",
                lab: labName,
                component: "基础计费",
                basis,
                unitPrice,
              });
            }
          }
          continue;
        }

        let hasFixedRows = false;
        for (const labName of labNames) {
          const lab = getLab(row, labName);
          const itemFee = parseNumber(lab.itemFee);
          if (itemFee !== null) {
            hasFixedRows = true;
            rows.push({
              ...common,
              detailType: "固定/特殊费用",
              lab: labName,
              component: "固定/特殊费用",
              basis: 1,
              unitPrice: itemFee,
            });
          }
        }

        if (!hasFixedRows) {
          rows.push({
            ...common,
            detailType: "待补充",
            lab: "",
            component: "待补充",
            basis: "",
            unitPrice: "",
          });
        }
      }
    }
  }

  return rows;
}

const headers = [
    "rowKey_勿改",
    "phaseId_勿改",
    "阶段",
    "groupId_勿改",
    "Group",
    "outlineRowId_勿改",
    "测试编号",
    "计费方式",
    "测试项目",
    "状态",
    "费用归属_可选",
    "实验室_可选",
    "组成项_可修改",
    "基数_可修改",
    "单价_可修改",
    "金额_自动",
    "当前系统费用",
    "手动覆盖费用_可修改",
    "SGS总额_自动",
    "华测总额_自动",
    "苏劢总额_自动",
    "信测总额_自动",
    "建议费用_自动",
    "导回费用_自动",
    "计算说明",
    "规则备注",
    "明细类型",
    "测试时间h",
    "数量",
    "批次",
  ];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function numberCell(ref, value, style = 1) {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
}

function stringCell(ref, value, style = 1) {
  const text = value === null || value === undefined ? "" : String(value);
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
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
  if (col === "K" || col === "L" || col === "M" || col === "N" || col === "O" || col === "R") {
    return 2;
  }
  if (col === "S" || col === "T" || col === "U" || col === "V" || col === "W") {
    return 3;
  }
  if (col === "X" || col === "Y") {
    return 4;
  }
  return 1;
}

function buildSheetValues(rows) {
  const values = rows.map((row) => [
    row.rowKey,
    row.phaseId,
    row.phaseTitle,
    row.groupId,
    row.groupTitle,
    row.outlineRowId,
    row.testCode,
    row.chargeBasis,
    row.testName,
    row.status,
    row.ownership,
    row.lab,
    row.component,
    row.basis,
    row.unitPrice,
    "",
    row.currentFee,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    row.notes,
    row.detailType,
    row.testHours,
    row.quantity,
    row.batchCount,
  ]);
  return values;
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
  const tmpDir = path.join(outputDir, ".single-sheet-xlsx-tmp");
  await fs.rm(tmpDir, { recursive: true, force: true });
  await fs.mkdir(path.join(tmpDir, "_rels"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, "xl", "_rels"), { recursive: true });
  await fs.mkdir(path.join(tmpDir, "xl", "worksheets"), { recursive: true });

  const widths = [14, 10, 10, 14, 11, 17, 10, 12, 38, 12, 12, 12, 16, 12, 12, 13, 13, 14, 13, 13, 13, 13, 13, 14, 32, 40, 12, 10, 10, 10];
  const colsXml = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join("");
  const rowsXml = [
    `<row r="1" ht="33" customHeight="1">${headers.map((header, index) => stringCell(`${colName(index)}1`, header, 5)).join("")}</row>`,
    ...values.map((row, rowIndex) => {
      const excelRow = rowIndex + 2;
      const keyRange = `$A$2:$A$${lastRow}`;
      const labRange = `$L$2:$L$${lastRow}`;
      const amountRange = `$P$2:$P$${lastRow}`;
      const cells = row.map((value, colIndex) => {
        const col = colName(colIndex);
        const ref = `${col}${excelRow}`;
        const style = styleForColumn(colIndex);
        if (col === "P") {
          return formulaCell(ref, `IF(OR(N${excelRow}="",O${excelRow}="",O${excelRow}="N/A"),"",N${excelRow}*O${excelRow})`, 2);
        }
        if (col === "S") {
          return formulaCell(ref, `IF(COUNTIFS(${keyRange},$A${excelRow},${labRange},"SGS")=0,"",SUMIFS(${amountRange},${keyRange},$A${excelRow},${labRange},"SGS"))`, 3);
        }
        if (col === "T") {
          return formulaCell(ref, `IF(COUNTIFS(${keyRange},$A${excelRow},${labRange},"华测")=0,"",SUMIFS(${amountRange},${keyRange},$A${excelRow},${labRange},"华测"))`, 3);
        }
        if (col === "U") {
          return formulaCell(ref, `IF(COUNTIFS(${keyRange},$A${excelRow},${labRange},"苏劢")=0,"",SUMIFS(${amountRange},${keyRange},$A${excelRow},${labRange},"苏劢"))`, 3);
        }
        if (col === "V") {
          return formulaCell(ref, `IF(COUNTIFS(${keyRange},$A${excelRow},${labRange},"信测")=0,"",SUMIFS(${amountRange},${keyRange},$A${excelRow},${labRange},"信测"))`, 3);
        }
        if (col === "W") {
          return formulaCell(ref, `IFERROR(MEDIAN(S${excelRow},T${excelRow},U${excelRow},V${excelRow}),Q${excelRow})`, 3);
        }
        if (col === "X") {
          return formulaCell(ref, `IF(R${excelRow}<>"",R${excelRow},W${excelRow})`, 4);
        }
        if (col === "Y") {
          return formulaCell(ref, `IF(OR(N${excelRow}="",O${excelRow}="",O${excelRow}="N/A"),"待补充",M${excelRow}&": "&N${excelRow}&" × "&O${excelRow}&" = "&P${excelRow})`, 4);
        }
        return cellXml(ref, value, style);
      });
      return `<row r="${excelRow}">${cells.join("")}</row>`;
    }),
  ].join("");

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="9" ySplit="1" topLeftCell="J2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight" activeCell="J2" sqref="J2"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="18"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowsXml}</sheetData>
  <autoFilter ref="A1:${lastCol}${lastRow}"/>
  <dataValidations count="2">
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="K2:K${lastRow}"><formula1>"内部费用,委外费用,待确认"</formula1></dataValidation>
    <dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="L2:L${lastRow}"><formula1>"SGS,华测,苏劢,信测"</formula1></dataValidation>
  </dataValidations>
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
    <xf numFmtId="4" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="4" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="4" fontId="0" fillId="5" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

  await fs.writeFile(path.join(tmpDir, "[Content_Types].xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`);
  await fs.writeFile(path.join(tmpDir, "_rels", ".rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
  await fs.writeFile(path.join(tmpDir, "xl", "workbook.xml"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><calcPr calcMode="auto"/><sheets><sheet name="费用计算一页表" sheetId="1" r:id="rId1"/></sheets></workbook>`);
  await fs.writeFile(path.join(tmpDir, "xl", "_rels", "workbook.xml.rels"), `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  await fs.writeFile(path.join(tmpDir, "xl", "worksheets", "sheet1.xml"), sheetXml);
  await fs.writeFile(path.join(tmpDir, "xl", "styles.xml"), stylesXml);

  await fs.rm(outputPath, { force: true });
  writeZip(tmpDir, outputPath);
  await fs.rm(tmpDir, { recursive: true, force: true });
}

const rows = buildSingleSheetRows();
if (rows.length === 0) {
  throw new Error("No single sheet fee rows were generated.");
}

await fs.mkdir(outputDir, { recursive: true });
await writeRawXlsx(rows);
console.log(`rows=${rows.length}`);
console.log(outputPath);
