import { createEnvironmentFeeDetailSections, getEnvironmentAdditionalFeeSummary } from "./environmentFeeDetail";
import type { EnvironmentPlanGroup, EnvironmentPlanPhase, EnvironmentPlanRow, EnvironmentPlanSheet } from "../types/environmentPlan";
import type { EnvironmentFeeChargeBasis, EnvironmentFeeDetailRow, EnvironmentFeeLabName } from "../types/environmentFeeDetail";

type CellValue = string | number | boolean | null | undefined;

export interface MlaFeeWorksheet {
  name: string;
  rows: CellValue[][];
}

export interface MlaFeeWorkbook {
  filename: string;
  sheets: MlaFeeWorksheet[];
}

interface ExportRow {
  phaseTitle: string;
  groupTitle: string;
  testCode: string;
  testName: string;
  sampleRange: string;
  basisText: string;
  testTimeText: string;
  chargeBasisText: string;
  ownership: "内部费用" | "委外费用";
  estimatedItemFee: number | null;
  notes: string;
  labs: EnvironmentFeeDetailRow["labs"];
  special: boolean;
  excludedFromLabSheets?: boolean;
}

const filename = "MLA测试项目及费用预估.xls";
const labSheetNames = ["SGS", "华测", "苏勃"] as const;
const labNameBySheet: Record<(typeof labSheetNames)[number], EnvironmentFeeLabName> = {
  SGS: "SGS",
  华测: "华测",
  苏勃: "苏劢",
};

const forecastHeaders = [
  "Phase",
  "Group",
  "测试编号",
  "测试项目",
  "样品范围",
  "计费基数",
  "测试时间",
  "计费方式",
  "费用归属",
  "内部费用",
  "委外费用",
  "费用合计",
  "备注",
];

const labHeaders = [
  "Phase",
  "Group",
  "测试编号",
  "测试项目",
  "样品范围",
  "计费基数",
  "测试时间",
  "计费方式",
  "实验室",
  "委外费用",
  "备注",
];

const comparisonHeaders = ["Phase", "Group", "SGS", "华测", "苏勃", "最低实验室", "最高实验室", "差额"];
const specialHeaders = [
  "Phase",
  "Group",
  "测试编号",
  "测试项目",
  "样品范围",
  "计费基数",
  "测试时间",
  "当前规则费用",
  "实验室/参考口径",
  "备注",
];

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join("；");
  }

  return String(value);
}

function cellXml(value: CellValue): string {
  if (value === null || value === undefined || value === "") {
    return "<Cell><Data ss:Type=\"String\"></Data></Cell>";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  if (typeof value === "boolean") {
    return `<Cell><Data ss:Type="Boolean">${value ? 1 : 0}</Data></Cell>`;
  }

  return `<Cell><Data ss:Type="String">${escapeXml(formatText(value))}</Data></Cell>`;
}

function worksheetXml(sheet: MlaFeeWorksheet): string {
  const rowsXml = sheet.rows
    .map((row) => `<Row>${row.map((cell) => cellXml(cell)).join("")}</Row>`)
    .join("");

  return `<Worksheet ss:Name="${escapeXml(sheet.name)}"><Table>${rowsXml}</Table></Worksheet>`;
}

function workbookXml(sheets: MlaFeeWorksheet[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
    + `<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" `
    + `xmlns:o="urn:schemas-microsoft-com:office:office" `
    + `xmlns:x="urn:schemas-microsoft-com:office:excel" `
    + `xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">`
    + sheets.map(worksheetXml).join("")
    + `</Workbook>`;
}

function chargeBasisText(chargeBasis: EnvironmentFeeChargeBasis): string {
  if (chargeBasis === "hour") {
    return "按小时";
  }

  if (chargeBasis === "quantity") {
    return "按样品数量";
  }

  if (chargeBasis === "batch") {
    return "按批次";
  }

  return "待确认";
}

function basisText(row: EnvironmentFeeDetailRow): string {
  if (row.chargeBasis === "hour" && row.testHours !== null) {
    return `${row.testHours} h`;
  }

  if (row.chargeBasis === "quantity" && row.quantity !== null) {
    return `${row.quantity} 个样品`;
  }

  if (row.chargeBasis === "batch" && row.batchCount !== null) {
    return `${row.batchCount} 批`;
  }

  return "";
}

function testTimeText(row: EnvironmentFeeDetailRow): string {
  return row.testHours === null ? "" : `${row.testHours} h`;
}

function isInternalFee(testName: string): boolean {
  return /^Optical Test$/i.test(testName) || /^L6-photo&xray$/i.test(testName);
}

function isSpecialProject(row: EnvironmentFeeDetailRow): boolean {
  return /\bK14\b|Restricted Substance|Operating Noise|Transient Noise/i.test(`${row.testCode} ${row.testName}`);
}

function formatLabName(lab: "SGS" | "华测" | "苏劢"): string {
  return lab === "苏劢" ? "苏勃" : lab;
}

function selectedLabNote(lab: "SGS" | "华测" | "苏劢"): string {
  const label = formatLabName(lab);
  return label === "SGS" ? "当前按 SGS 计入" : `当前按${label}计入`;
}

function buildAdditionalFeeRows(phase: EnvironmentPlanPhase): ExportRow[] {
  const additionalFees = getEnvironmentAdditionalFeeSummary(phase);
  const computerNotes = [
    "Computer Fee:",
    ...additionalFees.computerLabQuotes.map((quote) =>
      `${formatLabName(quote.lab)} ${quote.unitPrice}/月/台 × ${additionalFees.computerCoefficient} = ${quote.fee}`,
    ),
    selectedLabNote(additionalFees.computerSelectedLab),
  ].join("；").replace("Fee:；", "Fee: ");
  const reportNotes = [
    "Report Fee:",
    ...additionalFees.reportLabQuotes.map((quote) =>
      `${formatLabName(quote.lab)} ${quote.unitPrice}/份 × ${additionalFees.reportCount} = ${quote.fee}`,
    ),
    selectedLabNote(additionalFees.reportSelectedLab),
  ].join("；").replace("Fee:；", "Fee: ");

  return [
    {
      phaseTitle: phase.title,
      groupTitle: "附加费用",
      testCode: "Computer Fee",
      testName: "Computer Fee",
      sampleRange: "",
      basisText: `${additionalFees.computerCoefficient} 月/台`,
      testTimeText: "",
      chargeBasisText: "按电脑费用系数",
      ownership: "委外费用",
      estimatedItemFee: additionalFees.computerFee,
      notes: computerNotes,
      labs: additionalFees.computerLabQuotes.map((quote) => ({
        lab: quote.lab,
        unitPrice: quote.unitPrice,
        itemFee: quote.fee,
      })),
      special: false,
    },
    {
      phaseTitle: phase.title,
      groupTitle: "附加费用",
      testCode: "Report Fee",
      testName: "Report Fee",
      sampleRange: "",
      basisText: `${additionalFees.reportCount} 份`,
      testTimeText: "",
      chargeBasisText: "按报告份数",
      ownership: "委外费用",
      estimatedItemFee: additionalFees.reportFee,
      notes: reportNotes,
      labs: additionalFees.reportLabQuotes.map((quote) => ({
        lab: quote.lab,
        unitPrice: quote.unitPrice,
        itemFee: quote.fee,
      })),
      special: false,
    },
  ];
}

function getOutlineById(phase: EnvironmentPlanPhase): Map<string, { group: EnvironmentPlanGroup; row: EnvironmentPlanRow }> {
  return new Map(
    phase.groups.flatMap((group) =>
      group.rows.map((row) => [`${group.id}:${row.id}`, { group, row }] as const),
    ),
  );
}

function buildExportRows(plan: EnvironmentPlanSheet): ExportRow[] {
  return plan.phases.flatMap((phase) => {
    const outlineById = getOutlineById(phase);

    const detailRows = createEnvironmentFeeDetailSections(phase).flatMap((section) =>
      section.rows.map((detailRow) => {
        const outline = outlineById.get(`${section.groupId}:${detailRow.outlineRowId}`);
        const ownership: ExportRow["ownership"] = isInternalFee(detailRow.testName) ? "内部费用" : "委外费用";

        return {
          phaseTitle: phase.title,
          groupTitle: section.groupTitle,
          testCode: detailRow.testCode,
          testName: detailRow.testName,
          sampleRange: outline?.row.sampleRange ?? "",
          basisText: basisText(detailRow),
          testTimeText: testTimeText(detailRow),
          chargeBasisText: chargeBasisText(detailRow.chargeBasis),
          ownership,
          estimatedItemFee: detailRow.estimatedItemFee,
          notes: detailRow.notes ?? "",
          labs: detailRow.labs,
          special: isSpecialProject(detailRow),
          excludedFromLabSheets: isSpecialProject(detailRow),
        };
      }),
    );

    return [...detailRows, ...buildAdditionalFeeRows(phase)];
  });
}

function forecastSheet(rows: ExportRow[]): MlaFeeWorksheet {
  return {
    name: "费用预估",
    rows: [
      forecastHeaders,
      ...rows
        .map((row) => [
          row.phaseTitle,
          row.groupTitle,
          row.testCode,
          row.testName,
          row.sampleRange,
          row.basisText,
          row.testTimeText,
          row.chargeBasisText,
          row.ownership,
          row.ownership === "内部费用" ? row.estimatedItemFee ?? "" : "",
          row.ownership === "委外费用" ? row.estimatedItemFee ?? "" : "",
          row.estimatedItemFee ?? "",
          row.notes,
        ]),
    ],
  };
}

function labFee(row: ExportRow, lab: EnvironmentFeeLabName): number | "" {
  const quote = row.labs.find((item) => item.lab === lab);
  return typeof quote?.itemFee === "number" ? quote.itemFee : "";
}

function labSheet(rows: ExportRow[], sheetName: (typeof labSheetNames)[number]): MlaFeeWorksheet {
  const lab = labNameBySheet[sheetName];

  return {
    name: sheetName,
    rows: [
      labHeaders,
      ...rows
        .filter((row) => row.ownership === "委外费用" && !row.excludedFromLabSheets)
        .map((row) => [
          row.phaseTitle,
          row.groupTitle,
          row.testCode,
          row.testName,
          row.sampleRange,
          row.basisText,
          row.testTimeText,
          row.chargeBasisText,
          sheetName,
          labFee(row, lab),
          row.notes,
        ]),
    ],
  };
}

function comparisonSheet(rows: ExportRow[]): MlaFeeWorksheet {
  const totals = new Map<string, { phaseTitle: string; groupTitle: string; SGS: number; 华测: number; 苏勃: number }>();

  for (const row of rows) {
    if (row.ownership !== "委外费用" || row.excludedFromLabSheets) {
      continue;
    }

    const key = `${row.phaseTitle}|${row.groupTitle}`;
    const current = totals.get(key) ?? { phaseTitle: row.phaseTitle, groupTitle: row.groupTitle, SGS: 0, 华测: 0, 苏勃: 0 };
    current.SGS += Number(labFee(row, "SGS") || 0);
    current.华测 += Number(labFee(row, "华测") || 0);
    current.苏勃 += Number(labFee(row, "苏劢") || 0);
    totals.set(key, current);
  }

  return {
    name: "费用对比",
    rows: [
      comparisonHeaders,
      ...[...totals.values()].map((row) => {
        const labTotals = [
          { lab: "SGS", value: row.SGS },
          { lab: "华测", value: row.华测 },
          { lab: "苏勃", value: row.苏勃 },
        ];
        const sorted = [...labTotals].sort((left, right) => left.value - right.value);
        const min = sorted[0]!;
        const max = sorted[sorted.length - 1]!;

        return [row.phaseTitle, row.groupTitle, row.SGS, row.华测, row.苏勃, min.lab, max.lab, max.value - min.value];
      }),
    ],
  };
}

function specialReference(row: ExportRow): string {
  if (/\bK14\b/i.test(`${row.testCode} ${row.testName}`)) {
    return "指定国测";
  }

  if (/Operating Noise|Transient Noise/i.test(row.testName)) {
    return "SGS 参考价";
  }

  return "固定规则";
}

function specialSheet(rows: ExportRow[]): MlaFeeWorksheet {
  return {
    name: "特殊项目费用",
    rows: [
      specialHeaders,
      ...rows
        .filter((row) => row.special)
        .map((row) => [
          row.phaseTitle,
          row.groupTitle,
          row.testCode,
          row.testName,
          row.sampleRange,
          row.basisText,
          row.testTimeText,
          row.estimatedItemFee ?? "",
          specialReference(row),
          row.notes,
        ]),
    ],
  };
}

export function buildMlaEnvironmentFeeWorkbook(plan: EnvironmentPlanSheet): MlaFeeWorkbook {
  const rows = buildExportRows(plan);

  return {
    filename,
    sheets: [
      forecastSheet(rows),
      ...labSheetNames.map((sheetName) => labSheet(rows, sheetName)),
      comparisonSheet(rows),
      specialSheet(rows),
    ],
  };
}

function workbookBlob(workbook: MlaFeeWorkbook): Blob {
  return new Blob([workbookXml(workbook.sheets)], { type: "application/vnd.ms-excel;charset=utf-8" });
}

export function downloadMlaEnvironmentFeeWorkbook(plan: EnvironmentPlanSheet): void {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  const workbook = buildMlaEnvironmentFeeWorkbook(plan);
  const url = URL.createObjectURL(workbookBlob(workbook));
  const link = document.createElement("a");

  link.href = url;
  link.download = workbook.filename;
  link.rel = "noopener";
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
