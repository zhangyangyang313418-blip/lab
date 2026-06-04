import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";
import { createSeedAppState } from "../src/store/appState";
import { createEnvironmentFeeDetailSections, getEnvironmentSpecialFeeBreakdown } from "../src/services/environmentFeeDetail";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "outputs", "mla-fee-detail-export");
const outputPath = path.join(outputDir, "MLA费用计算明细_可回填.xlsx");
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

function money(value) {
  return typeof value === "number" ? value : "";
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

function parseNumber(value) {
  if (value === null || value === undefined || value === "" || value === "N/A") {
    return null;
  }
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
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

function buildModel() {
  const state = createSeedAppState();
  const detailRows = [];
  const calcRows = [];

  for (const phase of state.environmentPlan.phases) {
    const groupMap = new Map(phase.groups.map((group) => [group.id, group]));
    const outlineRows = new Map(
      phase.groups.flatMap((group) => group.rows.map((row) => [`${group.id}:${row.id}`, { group, row }])),
    );

    for (const section of createEnvironmentFeeDetailSections(phase)) {
      for (const row of section.rows) {
        const outline = outlineRows.get(`${section.groupId}:${row.outlineRowId}`);
        const specialBreakdown = outline ? getEnvironmentSpecialFeeBreakdown(phase, outline.group, outline.row) : null;
        const rowKey = `${phase.id}|${section.groupId}|${row.outlineRowId}`;
        const formulaDriven = isFormulaDrivenRow(row, specialBreakdown);
        const specialComponents = specialBreakdown?.lines.flatMap((line) => {
          const components = parseComponentFormula(line.formula);

          return components
            ? components.map((component) => ({
                lab: line.label,
                ...component,
              }))
            : [];
        }) ?? [];
        const directComponents = formulaDriven
          ? labNames.flatMap((labName) => {
              const lab = getLab(row, labName);
              const unitPrice = parseNumber(lab.unitPrice);
              const basis = parseNumber(getBaseValue(row));

              return unitPrice !== null && basis !== null
                ? [{
                    lab: labName,
                    label: "基础计费",
                    basis,
                    unitPrice,
                  }]
                : [];
            })
          : [];
        const hasCalculationRows = specialComponents.length > 0 || directComponents.length > 0;

        detailRows.push({
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
          notes: row.notes ?? "",
          currentFee: row.estimatedItemFee,
          ownership: "待确认",
          baseValue: getBaseValue(row),
          testHours: row.testHours,
          quantity: row.quantity,
          batchCount: row.batchCount,
          medianUnitPrice: row.medianUnitPrice,
          formulaDriven: formulaDriven ? "是" : "否",
          specialDriven: hasCalculationRows ? "是" : "否",
          labs: labNames.map((labName) => getLab(row, labName)),
        });

        for (const component of directComponents) {
          calcRows.push({
            rowKey,
            phaseId: phase.id,
            groupId: section.groupId,
            outlineRowId: row.outlineRowId,
            testName: row.testName,
            lab: component.lab,
            component: component.label,
            basis: component.basis,
            unitPrice: component.unitPrice,
          });
        }

        if (specialComponents.length > 0) {
          for (const component of specialComponents) {
            calcRows.push({
              rowKey,
              phaseId: phase.id,
              groupId: section.groupId,
              outlineRowId: row.outlineRowId,
              testName: row.testName,
              lab: component.lab,
              component: component.label,
              basis: component.basis,
              unitPrice: component.unitPrice,
            });
          }
        }

        if (!specialBreakdown && !formulaDriven) {
          for (const labName of labNames) {
            const lab = getLab(row, labName);
            const itemFee = parseNumber(lab.itemFee);
            if (itemFee !== null) {
              calcRows.push({
                rowKey,
                phaseId: phase.id,
                groupId: section.groupId,
                outlineRowId: row.outlineRowId,
                testName: row.testName,
                lab: labName,
                component: "固定/特殊费用",
                basis: 1,
                unitPrice: itemFee,
              });
            }
          }
        }
      }
    }

    for (const group of groupMap.values()) {
      void group;
    }
  }

  return { detailRows, calcRows };
}

function applyDetailStyle(sheet, rowCount, colCount) {
  const lastCol = colName(colCount - 1);
  const lastRow = rowCount + 1;

  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.freezePanes.freezeColumns(6);
  sheet.getRange(`A1:${lastCol}1`).format = {
    fill: { type: "solid", color: "#1F4E78" },
    font: { name: "Microsoft YaHei", size: 10, color: "#FFFFFF", bold: true },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
  sheet.getRange(`A2:${lastCol}${lastRow}`).format = {
    font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
  sheet.getRange(`K2:O${lastRow}`).format = {
    fill: { type: "solid", color: "#FFF7ED" },
    font: { name: "Microsoft YaHei", size: 10, color: "#7C2D12", bold: true },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#FED7AA" },
  };
  sheet.getRange(`P2:S${lastRow}`).format = {
    fill: { type: "solid", color: "#F8FAFC" },
    font: { name: "Microsoft YaHei", size: 10, color: "#334155" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#E2E8F0" },
  };

  ["K", "M", "N", "O", "T", "V", "X", "Z"].forEach((col) => {
    sheet.getRange(`${col}2:${col}${lastRow}`).format.numberFormat = "¥#,##0";
  });
  ["P", "Q", "R", "S", "U", "W", "Y", "AA"].forEach((col) => {
    sheet.getRange(`${col}2:${col}${lastRow}`).format.numberFormat = "#,##0";
  });

  const widths = [
    110, 78, 80, 120, 92, 150, 78, 340, 92, 95, 120, 120, 130, 130, 130, 95, 85, 85, 95,
    105, 85, 105, 85, 105, 85, 105, 85, 90, 90, 360,
  ];
  widths.forEach((width, index) => {
    sheet.getRange(`${colName(index)}:${colName(index)}`).format.columnWidthPx = width;
  });
  sheet.getRange("1:1").format.rowHeightPx = 42;
}

function writeDetailSheet(workbook, detailRows, calcRowCount) {
  const sheet = workbook.worksheets.getOrAdd("费用明细", {
    renameFirstIfOnlyNewSpreadsheet: true,
  });
  const headers = [
    "rowKey_勿改",
    "phaseId_勿改",
    "阶段",
    "groupId_勿改",
    "Group",
    "outlineRowId_勿改",
    "测试编号",
    "测试项目",
    "计费方式",
    "状态",
    "当前计算费用",
    "费用归属_可选",
    "建议费用_自动",
    "手动覆盖费用_可修改",
    "导回费用_自动",
    "计费基数_可修改",
    "测试时间h",
    "数量",
    "批次",
    "SGS费用_自动",
    "SGS单价_可修改",
    "华测费用_自动",
    "华测单价_可修改",
    "苏劢费用_自动",
    "苏劢单价_可修改",
    "信测费用_自动",
    "信测单价_可修改",
    "公式直算",
    "明细汇总",
    "规则备注",
  ];
  const rows = detailRows.map((row) => [
    row.rowKey,
    row.phaseId,
    row.phaseTitle,
    row.groupId,
    row.groupTitle,
    row.outlineRowId,
    row.testCode,
    row.testName,
    row.chargeBasis,
    row.status,
    money(row.currentFee),
    row.ownership,
    "",
    "",
    "",
    row.baseValue,
    row.testHours ?? "",
    row.quantity ?? "",
    row.batchCount ?? "",
    "",
    row.labs[0].unitPrice === "N/A" ? "N/A" : row.labs[0].unitPrice || "",
    "",
    row.labs[1].unitPrice === "N/A" ? "N/A" : row.labs[1].unitPrice || "",
    "",
    row.labs[2].unitPrice === "N/A" ? "N/A" : row.labs[2].unitPrice || "",
    "",
    row.labs[3].unitPrice === "N/A" ? "N/A" : row.labs[3].unitPrice || "",
    row.formulaDriven,
    row.specialDriven,
    row.notes,
  ]);

  sheet.getRange(`A1:${colName(headers.length - 1)}1`).values = [headers];
  sheet.getRange(`A2:${colName(headers.length - 1)}${rows.length + 1}`).values = rows;

  for (let index = 0; index < detailRows.length; index += 1) {
    const excelRow = index + 2;
    const calcLastRow = Math.max(calcRowCount + 1, 2);
    const formulas = [
      `=IF(AC${excelRow}="是",IF(COUNTIFS('实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"SGS")=0,"",SUMIFS('实验室计算明细'!$J$2:$J$${calcLastRow},'实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"SGS")),IF(AB${excelRow}="是",IF(U${excelRow}="N/A","N/A",P${excelRow}*U${excelRow}),""))`,
      `=IF(AC${excelRow}="是",IF(COUNTIFS('实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"华测")=0,"",SUMIFS('实验室计算明细'!$J$2:$J$${calcLastRow},'实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"华测")),IF(AB${excelRow}="是",IF(W${excelRow}="N/A","N/A",P${excelRow}*W${excelRow}),""))`,
      `=IF(AC${excelRow}="是",IF(COUNTIFS('实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"苏劢")=0,"",SUMIFS('实验室计算明细'!$J$2:$J$${calcLastRow},'实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"苏劢")),IF(AB${excelRow}="是",IF(Y${excelRow}="N/A","N/A",P${excelRow}*Y${excelRow}),""))`,
      `=IF(AC${excelRow}="是",IF(COUNTIFS('实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"信测")=0,"",SUMIFS('实验室计算明细'!$J$2:$J$${calcLastRow},'实验室计算明细'!$A$2:$A$${calcLastRow},$A${excelRow},'实验室计算明细'!$F$2:$F$${calcLastRow},"信测")),IF(AB${excelRow}="是",IF(AA${excelRow}="N/A","N/A",P${excelRow}*AA${excelRow}),""))`,
      `=IFERROR(MEDIAN(T${excelRow},V${excelRow},X${excelRow},Z${excelRow}),K${excelRow})`,
      `=IF(N${excelRow}<>"",N${excelRow},M${excelRow})`,
    ];
    sheet.getRange(`T${excelRow}`).formulas = [[formulas[0]]];
    sheet.getRange(`V${excelRow}`).formulas = [[formulas[1]]];
    sheet.getRange(`X${excelRow}`).formulas = [[formulas[2]]];
    sheet.getRange(`Z${excelRow}`).formulas = [[formulas[3]]];
    sheet.getRange(`M${excelRow}`).formulas = [[formulas[4]]];
    sheet.getRange(`O${excelRow}`).formulas = [[formulas[5]]];
  }

  sheet.getRange(`L2:L${rows.length + 1}`).dataValidation = {
    rule: { type: "list", values: ["内部费用", "委外费用", "待确认"] },
  };
  applyDetailStyle(sheet, rows.length, headers.length);
  sheet.tables.add(`A1:${colName(headers.length - 1)}${rows.length + 1}`, true, "MlaFeeDetailTable");
}

function writeCalcSheet(workbook, calcRows) {
  const sheet = workbook.worksheets.add("实验室计算明细");
  const headers = [
    "rowKey_勿改",
    "phaseId_勿改",
    "groupId_勿改",
    "outlineRowId_勿改",
    "测试项目",
    "实验室",
    "组成项",
    "基数_可修改",
    "单价_可修改",
    "金额_自动",
  ];
  const rows = calcRows.map((row) => [
    row.rowKey,
    row.phaseId,
    row.groupId,
    row.outlineRowId,
    row.testName,
    row.lab,
    row.component,
    row.basis,
    row.unitPrice,
    "",
  ]);
  sheet.getRange("A1:J1").values = [headers];
  sheet.getRange(`A2:J${rows.length + 1}`).values = rows;
  for (let index = 0; index < rows.length; index += 1) {
    const excelRow = index + 2;
    sheet.getRange(`J${excelRow}`).formulas = [[`=H${excelRow}*I${excelRow}`]];
  }
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(`A1:J1`).format = {
    fill: { type: "solid", color: "#1F4E78" },
    font: { name: "Microsoft YaHei", size: 10, color: "#FFFFFF", bold: true },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
  sheet.getRange(`A2:J${rows.length + 1}`).format = {
    font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
  sheet.getRange(`H2:J${rows.length + 1}`).format = {
    fill: { type: "solid", color: "#FFF7ED" },
    font: { name: "Microsoft YaHei", size: 10, color: "#7C2D12", bold: true },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#FED7AA" },
  };
  sheet.getRange(`I2:J${rows.length + 1}`).format.numberFormat = "¥#,##0";
  [120, 80, 120, 150, 340, 85, 180, 95, 95, 110].forEach((width, index) => {
    sheet.getRange(`${colName(index)}:${colName(index)}`).format.columnWidthPx = width;
  });
  sheet.tables.add(`A1:J${rows.length + 1}`, true, "MlaFeeCalcDetailTable");
}

function writeInstructionsSheet(workbook, detailCount, calcCount) {
  const sheet = workbook.worksheets.add("导回说明");
  sheet.showGridLines = false;
  sheet.getRange("A1:D1").values = [["MLA 费用计算明细导回说明", "", "", ""]];
  sheet.getRange("A3:D13").values = [
    ["用途", "这是可计算工作簿。修改单价、基数或实验室计算明细后，自动费用会联动更新。", "", ""],
    ["稳定匹配键", "rowKey_勿改 / phaseId_勿改 / groupId_勿改 / outlineRowId_勿改 不要改，否则无法稳定导回。", "", ""],
    ["费用归属", "费用明细!费用归属_可选 已设置下拉：内部费用 / 委外费用 / 待确认。后续导回时我会按这列区分内部和委外。", "", ""],
    ["普通项目", "普通直算项目也已展开到“实验室计算明细”。在明细页修改 基数_可修改 或 单价_可修改 后，费用明细会自动汇总更新。", "", ""],
    ["组合/特殊项目", "组合项目同样在“实验室计算明细”修改 基数_可修改 或 单价_可修改，费用明细中的对应实验室费用和建议费用会自动汇总更新。", "", ""],
    ["最终费用", "手动覆盖费用_可修改 为空时，导回费用_自动 默认等于 建议费用_自动；若你手动填写覆盖费用，会优先按覆盖值导回。", "", ""],
    ["不可直接公式化项目", "少数 N/A 或待确认项目仍需手动填写最终费用或补充实验室计算明细。", "", ""],
    ["当前费用明细行数", detailCount, "", ""],
    ["当前实验室明细行数", calcCount, "", ""],
    ["生成时间", new Date().toISOString().replace("T", " ").slice(0, 19), "", ""],
    ["文件路径", outputPath, "", ""],
  ];
  sheet.getRange("A1:D1").format = {
    fill: { type: "solid", color: "#1F4E78" },
    font: { name: "Microsoft YaHei", size: 14, color: "#FFFFFF", bold: true },
    verticalAlignment: "center",
  };
  sheet.getRange("A3:D13").format = {
    font: { name: "Microsoft YaHei", size: 11, color: "#1F2937" },
    wrapText: true,
    verticalAlignment: "top",
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
  sheet.getRange("A:A").format.columnWidthPx = 150;
  sheet.getRange("B:B").format.columnWidthPx = 760;
  sheet.getRange("C:D").format.columnWidthPx = 40;
}

function writeCalculationGuideSheet(workbook, calcCount) {
  const sheet = workbook.worksheets.add("计算说明");
  sheet.showGridLines = false;
  sheet.getRange("A1:E1").values = [["费用计算公式说明", "", "", "", ""]];
  sheet.getRange("A3:E15").values = [
    ["区域", "适用项目", "修改位置", "当前公式/逻辑", "修改建议"],
    ["普通直算项目", "公式直算=是，例如 K1/K2/L1&L4/L6 等", "实验室计算明细：基数_可修改、单价_可修改", "金额_自动 = 基数_可修改 × 单价_可修改；费用明细按 rowKey+实验室 SUMIFS 汇总", "普通项目也在明细页改，不需要回到费用明细逐列改单价。"],
    ["普通项目建议费用", "同上", "费用明细：建议费用_自动", "建议费用 = 四个实验室费用有效数字的 MEDIAN；没有有效数字时回退当前计算费用", "若不想按中值，直接在手动覆盖费用_可修改填写最终金额。"],
    ["组合/特殊项目", "明细汇总=是，例如 Particle、K18、K22、K26", "实验室计算明细：基数_可修改、单价_可修改", "金额_自动 = 基数_可修改 × 单价_可修改；费用明细按 rowKey+实验室 SUMIFS 汇总", "修改组合项时优先改实验室计算明细；新增组成项时复制同 rowKey/实验室 后改组成项。"],
    ["组合/特殊项目建议费用", "明细汇总=是", "费用明细：建议费用_自动", "建议费用 = SGS/华测/苏劢/信测四个自动费用有效数字的 MEDIAN", "若某实验室无能力，保持该实验室无明细或空白，不要填 0，避免拉低中值。"],
    ["手动覆盖", "所有项目", "费用明细：手动覆盖费用_可修改", "导回费用_自动 = IF(手动覆盖费用不为空, 手动覆盖费用, 建议费用_自动)", "需要强制指定最终价格时填这里；空着则自动按建议费用。"],
    ["费用归属", "所有项目", "费用明细：费用归属_可选", "下拉：内部费用 / 委外费用 / 待确认", "后续我会按这列区分内部和委外费用。"],
    ["N/A / 空白", "无报价或无能力实验室", "费用明细或实验室计算明细", "N/A 表示无报价/无能力；空白表示不参与自动计算", "不要用 0 表示无报价，0 会作为有效费用参与中值。"],
    ["rowKey", "所有项目", "费用明细、实验室计算明细", "rowKey = phaseId|groupId|outlineRowId，用于跨表汇总和导回匹配", "不要改；新增明细行时必须复制对应项目的 rowKey。"],
    ["新增组成项", "组合/特殊项目", "实验室计算明细", "同一个 rowKey + 实验室 可有多行，费用明细会自动按 SUMIFS 合计", "例如给 K22 新增固定处理费：复制 K22 对应实验室一行，组成项写固定处理费，基数填 1，单价填费用。"],
    ["普通转组合", "原先公式直算但需要拆分的项目", "实验室计算明细 + 费用明细", "需要把费用明细里的 明细汇总 改为 是、公式直算 改为 否，并补充实验室计算明细", "如果你不确定，先只在手动覆盖费用填最终值，交回后我来改结构。"],
    ["导回优先级", "所有项目", "费用明细", "导回优先读取 导回费用_自动；如果有手动覆盖，则导回费用已经等于覆盖金额", "导回时也会保留费用归属。"],
    ["实验室计算明细行数", calcCount, "", "", ""],
  ];
  sheet.getRange("A1:E1").format = {
    fill: { type: "solid", color: "#1F4E78" },
    font: { name: "Microsoft YaHei", size: 14, color: "#FFFFFF", bold: true },
    verticalAlignment: "center",
  };
  sheet.getRange("A3:E3").format = {
    fill: { type: "solid", color: "#D9EAF7" },
    font: { name: "Microsoft YaHei", size: 11, color: "#17324D", bold: true },
    horizontalAlignment: "center",
    verticalAlignment: "center",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#B7C6D6" },
  };
  sheet.getRange("A4:E15").format = {
    font: { name: "Microsoft YaHei", size: 10, color: "#1F2937" },
    verticalAlignment: "top",
    wrapText: true,
    borders: { preset: "all", style: "thin", color: "#D9E2EC" },
  };
  [140, 230, 270, 420, 360].forEach((width, index) => {
    sheet.getRange(`${colName(index)}:${colName(index)}`).format.columnWidthPx = width;
  });
  sheet.freezePanes.freezeRows(3);
}

const { detailRows, calcRows } = buildModel();
if (detailRows.length === 0) {
  throw new Error("No fee detail rows were generated.");
}

const workbook = Workbook.create();
writeCalcSheet(workbook, calcRows);
writeDetailSheet(workbook, detailRows, calcRows.length);
writeInstructionsSheet(workbook, detailRows.length, calcRows.length);
writeCalculationGuideSheet(workbook, calcRows.length);

await fs.mkdir(outputDir, { recursive: true });

const inspect = await workbook.inspect({
  kind: "table",
  range: "费用明细!A1:AD8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 30,
});
console.log(inspect.ndjson);

const calcInspect = await workbook.inspect({
  kind: "table",
  range: "实验室计算明细!A1:J8",
  include: "values,formulas",
  tableMaxRows: 8,
  tableMaxCols: 10,
});
console.log(calcInspect.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "费用明细", range: "A1:AC12", scale: 1 });
await workbook.render({ sheetName: "实验室计算明细", range: "A1:J16", scale: 1 });
await workbook.render({ sheetName: "导回说明", range: "A1:D13", scale: 1 });
await workbook.render({ sheetName: "计算说明", range: "A1:E15", scale: 1 });

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);
console.log(outputPath);
