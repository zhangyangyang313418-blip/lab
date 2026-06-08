import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { EnvironmentFeeDetailTable } from "../components/environment/EnvironmentFeeDetailTable";
import { createEnvironmentFeeDetailSections, getEnvironmentSpecialFeeBreakdown } from "../services/environmentFeeDetail";
import { downloadMlaEnvironmentFeeWorkbook } from "../services/mlaEnvironmentFeeExport";
import { AppLayout } from "../components/layout/AppLayout";
import { useAppState } from "../store/appState";
import type { EnvironmentFeeChargeBasis, EnvironmentFeeDetailRow, EnvironmentFeeLabQuote } from "../types/environmentFeeDetail";
import type { EnvironmentPlanGroup, EnvironmentPlanPhase, EnvironmentPlanRow } from "../types/environmentPlan";

function formatCurrency(value: string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatFee(value: string | undefined) {
  return value ? formatCurrency(value) : "Fee";
}

function formatCurrencyAmount(value: number, maximumFractionDigits = 2) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: maximumFractionDigits,
    maximumFractionDigits,
  }).format(value);
}

function formatLabPriceValue(value: EnvironmentFeeLabQuote["unitPrice"]) {
  if (value === "N/A" || value === "") {
    return value;
  }

  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLabItemFee(value: EnvironmentFeeLabQuote["itemFee"]) {
  if (value === "N/A") {
    return "N/A";
  }

  if (value === null) {
    return "待确认";
  }

  return formatCurrencyAmount(value, 0);
}

function formatLabName(lab: string) {
  return lab === "苏劢" ? "苏勃" : lab;
}

function sanitizeCurrencyInput(value: string) {
  const normalized = value.replace(/[^\d.]/g, "");
  const [integerPart = "", ...decimalParts] = normalized.split(".");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${decimalParts.join("")}`;
}

function getSampleRange(group: EnvironmentPlanGroup, row: EnvironmentPlanRow, fallbackRange?: string) {
  if (row.sampleRange) {
    return row.sampleRange;
  }

  if (fallbackRange) {
    return fallbackRange;
  }

  const qty = Number(group.totalSampleQty || 0);
  if (!qty) {
    return "样本 -";
  }

  return `1-${qty}`;
}

function getSequentialGroupSampleRange(groups: EnvironmentPlanGroup[], targetGroupId: string) {
  let start = 1;

  for (const group of groups) {
    const qty = Number(group.totalSampleQty || 0);
    const end = qty > 0 ? start + qty - 1 : start - 1;

    if (group.id === targetGroupId) {
      return qty > 0 ? `${start}-${end}` : "-";
    }

    start = end + 1;
  }

  return "-";
}

function getCombinedGroupSampleRange(groups: EnvironmentPlanGroup[], targetGroups: EnvironmentPlanGroup[]) {
  if (targetGroups.length === 0) {
    return "-";
  }

  const firstGroup = targetGroups[0];
  const lastGroup = targetGroups[targetGroups.length - 1];

  if (!firstGroup || !lastGroup) {
    return "-";
  }

  const firstRange = getSequentialGroupSampleRange(groups, firstGroup.id);
  const lastRange = getSequentialGroupSampleRange(groups, lastGroup.id);

  const start = firstRange.split("-")[0] ?? "-";
  const end = lastRange.split("-")[1] ?? lastRange.split("-")[0] ?? "-";

  return `${start}-${end}`;
}

function isBaselineRow(row: EnvironmentPlanRow) {
  return row.id.includes("optical") || row.id.includes("l1l4");
}

function isBaselineManualRow(row: EnvironmentPlanRow) {
  return row.id.startsWith("manual-baseline-");
}

function isPreTestRow(row: EnvironmentPlanRow) {
  return isBaselineRow(row) || isBaselineManualRow(row);
}

function getPreTestRows(rows: EnvironmentPlanRow[]) {
  const preTestRows: EnvironmentPlanRow[] = [];

  for (const row of rows) {
    if (!isPreTestRow(row)) {
      break;
    }

    preTestRows.push(row);
  }

  return preTestRows;
}

function getVisibleRows(rows: EnvironmentPlanRow[]) {
  let index = 0;

  while (index < rows.length && isPreTestRow(rows[index]!)) {
    index += 1;
  }

  return rows.slice(index);
}

function isNumericDuration(value: string) {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

function formatDurationSummary(value: string) {
  return isNumericDuration(value) ? `${value} d` : value;
}

function createManualRowId(phaseId: string, groupTitle: string, afterRowId: string, rows: EnvironmentPlanRow[]) {
  const baseId = `manual-${phaseId}-${groupTitle}-${afterRowId}`;
  const sameBaseCount = rows.filter((row) => row.id.startsWith(baseId)).length;

  return sameBaseCount === 0 ? baseId : `${baseId}-${sameBaseCount + 1}`;
}

function getPreTestSampleTotal(groups: EnvironmentPlanGroup[]) {
  return groups
    .filter((group) => !group.title.startsWith("Group E-"))
    .reduce((sum, group) => sum + Number(group.totalSampleQty || 0), 0);
}

function getPhaseBaselineSource(phase: EnvironmentPlanPhase) {
  const group = phase.groups.find((item) => getPreTestRows(item.rows).length > 0);
  const rows = group ? getPreTestRows(group.rows) : [];

  return { group, rows };
}

function createManualRow(
  phaseId: string,
  group: EnvironmentPlanGroup,
  row: EnvironmentPlanRow,
): EnvironmentPlanRow {
  return {
    id: createManualRowId(phaseId, group.title, row.id, group.rows),
    label: "新测试项",
    testHours: "1",
    sampleRange: row.sampleRange ?? "",
  };
}

function createBaselineManualRow(
  phaseId: string,
  group: EnvironmentPlanGroup,
  row: EnvironmentPlanRow,
): EnvironmentPlanRow {
  const baseId = `manual-baseline-${phaseId}-${group.title}-${row.id}`;
  const sameBaseCount = group.rows.filter((item) => item.id.startsWith(baseId)).length;

  return {
    id: sameBaseCount === 0 ? baseId : `${baseId}-${sameBaseCount + 1}`,
    label: "新测试项",
    testHours: "1",
    sampleRange: row.sampleRange ?? "",
  };
}

type EnvironmentGroupSection = "sequence" | "d" | "e";
type FeeRenderer = (
  group: EnvironmentPlanGroup,
  row: EnvironmentPlanRow,
  className: string,
) => {
  button: ReactNode;
  editor: ReactNode;
};

const chargeBasisLabels: Record<EnvironmentFeeChargeBasis, string> = {
  hour: "按 h",
  quantity: "按数量",
  batch: "按批次",
  pending: "待确认",
};

function getDetailBaseValue(row: EnvironmentFeeDetailRow | undefined, basis: EnvironmentFeeChargeBasis) {
  if (!row || basis === "pending") {
    return "";
  }

  const value = basis === "hour" ? row.testHours : basis === "quantity" ? row.quantity : row.batchCount;
  return value === null ? "" : String(value);
}

function getChargeBasisUnitLabel(basis: EnvironmentFeeChargeBasis) {
  if (basis === "hour") {
    return "h";
  }

  if (basis === "batch") {
    return "批";
  }

  if (basis === "quantity") {
    return "台样机";
  }

  return "";
}

function isL6ExternalSemSection(label: string) {
  return /L6-SEM&SECTION/i.test(label);
}

function getDisplayBaseLabel(row: EnvironmentFeeDetailRow, basis: EnvironmentFeeChargeBasis) {
  if (isL6ExternalSemSection(row.testName) && basis === "quantity") {
    return "3 样品 × 11 点位";
  }

  const baseValue = getDetailBaseValue(row, basis);
  const unitLabel = getChargeBasisUnitLabel(basis);

  return unitLabel ? `${baseValue} ${unitLabel}` : baseValue;
}

function getLabQuoteFormula(row: EnvironmentFeeDetailRow, lab: EnvironmentFeeLabQuote) {
  if (lab.itemFee === "N/A") {
    return "无报价 / 无能力";
  }

  if (lab.itemFee === null || lab.unitPrice === "" || lab.unitPrice === "N/A" || row.chargeBasis === "pending") {
    return "费用待确认";
  }

  const baseLabel = getDisplayBaseLabel(row, row.chargeBasis);

  return `${formatLabPriceValue(lab.unitPrice)} × ${baseLabel}`;
}

function getLabToneClass(lab: string) {
  if (lab === "SGS") {
    return "fee-calculation-editor__lab-total--sgs";
  }

  if (lab === "华测") {
    return "fee-calculation-editor__lab-total--cti";
  }

  if (lab === "苏劢" || lab === "苏勃") {
    return "fee-calculation-editor__lab-total--sumei";
  }

  if (lab === "信测") {
    return "fee-calculation-editor__lab-total--xince";
  }

  return "";
}

function LabQuoteBreakdown({
  label,
  lines,
  selectedLabel,
}: {
  label: string;
  lines: Array<{ lab: string; formula: string; formulaLines?: string[]; total: string }>;
  selectedLabel?: string | undefined;
}) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className="fee-calculation-editor__lab-breakdown" aria-label={`${label} 实验室报价明细`}>
      <div className="fee-calculation-editor__lab-title">实验室报价明细</div>
      {lines.map((line) => {
        const isSelected = selectedLabel === line.lab;
        const displayLab = formatLabName(line.lab);
        const labLabel = isSelected ? `${displayLab}（中值）` : displayLab;

        return (
          <div key={line.lab} className={`fee-calculation-editor__lab-card${isSelected ? " fee-calculation-editor__lab-card--selected" : ""}`}>
            <span className="fee-calculation-editor__lab-name">{labLabel}</span>
            <div className={`fee-calculation-editor__lab-formula${line.formulaLines ? " fee-calculation-editor__lab-formula--compact-lines" : ""}`}>
              {line.formulaLines
                ? line.formulaLines.map((formulaLine) => <span key={formulaLine}>{formulaLine}</span>)
                : line.formula}
            </div>
            <strong className={`fee-calculation-editor__lab-total ${getLabToneClass(line.lab)}`}>{line.total}</strong>
          </div>
        );
      })}
    </div>
  );
}

function DetailLabQuoteBreakdown({ row }: { row: EnvironmentFeeDetailRow | undefined }) {
  if (!row) {
    return null;
  }

  const visibleLabs = row.hideUnavailableLabQuotes
    ? row.labs.filter((lab) => typeof lab.itemFee === "number" && typeof lab.unitPrice === "number")
    : row.labs;
  const selectedLab = row.priceLabel
    ? undefined
    : visibleLabs.find((lab) => typeof lab.itemFee === "number" && lab.itemFee === row.estimatedItemFee)?.lab;
  const lines = visibleLabs.map((lab) => ({
    lab: lab.lab,
    formula: getLabQuoteFormula(row, lab),
    total: formatLabItemFee(lab.itemFee),
  }));

  return <LabQuoteBreakdown label={row.testName} lines={lines} selectedLabel={selectedLab} />;
}

function SpecialLabQuoteBreakdown({
  row,
  breakdown,
}: {
  row: EnvironmentPlanRow;
  breakdown: ReturnType<typeof getEnvironmentSpecialFeeBreakdown>;
}) {
  if (!breakdown || !("lines" in breakdown)) {
    return null;
  }

  const getSpecialLabFormula = (line: (typeof breakdown.lines)[number]) => {
    if (/Particle Exposure/i.test(row.label)) {
      return line.formula ?? `报价 ${formatCurrencyAmount(line.total, 0)}`;
    }

    if (/K26\b|Mechanical Wear-Out/i.test(row.label) && line.unitPriceSummary) {
      return line.unitPriceSummary;
    }

    if (line.formula?.includes("单价")) {
      return line.formula;
    }

    return `报价 ${formatCurrencyAmount(line.total, 0)}`;
  };

  const lines = breakdown.lines.map((line) => ({
    lab: line.label,
    formula: getSpecialLabFormula(line),
    ...(/K26\b|Mechanical Wear-Out/i.test(row.label) && line.unitPriceSummaryLines ? { formulaLines: line.unitPriceSummaryLines } : {}),
    total: formatCurrencyAmount(line.total, 0),
  }));

  return <LabQuoteBreakdown label={row.label} lines={lines} selectedLabel={breakdown.selectedLabel} />;
}

function MedianFeeSummary({
  label,
  total,
}: {
  label: string | undefined;
  total: number;
}) {
  return (
    <div className="fee-calculation-editor__median-summary">
      <span>{label ? `中值（${formatLabName(label)}）` : "中值"}</span>
      <strong>{formatCurrencyAmount(total, 0)}</strong>
    </div>
  );
}

function FeeCalculationEditor({
  row,
  detailRow,
  onBasisChange,
  onClose,
}: {
  row: EnvironmentPlanRow;
  detailRow?: EnvironmentFeeDetailRow | undefined;
  onBasisChange: (basis: Exclude<EnvironmentFeeChargeBasis, "pending">, value: string) => void;
  onClose: () => void;
}) {
  const chargeBasis = detailRow?.chargeBasis ?? "pending";
  const unitPrice = detailRow?.medianUnitPrice ?? null;
  const baseValue = getDetailBaseValue(detailRow, chargeBasis);
  const baseUnit = getChargeBasisUnitLabel(chargeBasis);
  const displayBaseLabel = detailRow ? getDisplayBaseLabel(detailRow, chargeBasis) : "";
  const shouldShowBaseBreakdown = Boolean(detailRow && displayBaseLabel && displayBaseLabel !== (baseUnit ? `${baseValue} ${baseUnit}` : baseValue));
  const basisOverrideKey = chargeBasis === "pending" ? null : chargeBasis;
  const basisInputValue = basisOverrideKey ? row.feeBasisOverrides?.[basisOverrideKey] ?? baseValue : baseValue;

  return (
    <div className="fee-calculation-editor">
      <div className="fee-calculation-editor__header">
        <h3>{row.label} 费用计算</h3>
        <button type="button" className="fee-calculation-editor__close" aria-label={`关闭 ${row.label} 费用计算`} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="fee-calculation-editor__summary" aria-label={`${row.label} 计费摘要`}>
        <div className="fee-calculation-editor__summary-item">
          <span>计费方式</span>
          <strong>{chargeBasisLabels[chargeBasis]}</strong>
        </div>
        <div className="fee-calculation-editor__summary-item">
          <span>{detailRow?.priceLabel ?? "中值单价"}</span>
          <strong>{unitPrice === null ? "" : formatLabPriceValue(unitPrice)}</strong>
        </div>
        <div className="fee-calculation-editor__summary-item">
          <span>计费基数</span>
          {basisOverrideKey ? (
            <>
              <input
                aria-label={`${row.label} 计费基数`}
                inputMode="decimal"
                value={basisInputValue}
                onChange={(event) => onBasisChange(basisOverrideKey, sanitizeCurrencyInput(event.target.value))}
              />
              {baseUnit ? <em>{baseUnit}</em> : null}
              {shouldShowBaseBreakdown ? <strong className="fee-calculation-editor__basis-breakdown">{displayBaseLabel}</strong> : null}
            </>
          ) : (
            <strong>{shouldShowBaseBreakdown ? displayBaseLabel : baseValue && baseUnit ? `${baseValue} ${baseUnit}` : baseValue}</strong>
          )}
        </div>
      </div>
      <DetailLabQuoteBreakdown row={detailRow} />
    </div>
  );
}

function OpticalFeeCalculationEditor({
  row,
  breakdown,
  onClose,
}: {
  row: EnvironmentPlanRow;
  breakdown: ReturnType<typeof getEnvironmentSpecialFeeBreakdown>;
  onClose: () => void;
}) {
  if (!breakdown) {
    return null;
  }

  return (
    <div className="fee-calculation-editor fee-calculation-editor--compact">
      <div className="fee-calculation-editor__header">
        <h3>{row.label} 费用计算</h3>
        <button type="button" className="fee-calculation-editor__close" aria-label={`关闭 ${row.label} 费用计算`} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="fee-calculation-editor__stack fee-calculation-editor__stack--horizontal">
        {breakdown.lines.map((line) => (
          <div key={line.label} className="fee-calculation-editor__split-line">
            <span className="fee-calculation-editor__split-item">{line.label}</span>
            <span className="fee-calculation-editor__split-value">{line.quantity}</span>
            <span className="fee-calculation-editor__split-meta">{`单价 ${line.unitPrice}`}</span>
            <strong>{`总价 ${formatCurrencyAmount(line.total, 0)}`}</strong>
          </div>
        ))}
        <div className="fee-calculation-editor__total">{`合计 ${formatCurrencyAmount(breakdown.total, 0)}`}</div>
      </div>
    </div>
  );
}

function ParticleFeeCalculationEditor({
  row,
  breakdown,
  onClose,
}: {
  row: EnvironmentPlanRow;
  breakdown: ReturnType<typeof getEnvironmentSpecialFeeBreakdown>;
  onClose: () => void;
}) {
  if (!breakdown || breakdown.chargeBasis !== "particle-lab-total") {
    return null;
  }

  const selectedLine = breakdown.selectedLabel
    ? breakdown.lines.find((line) => line.label === breakdown.selectedLabel)
    : breakdown.lines[0];

  if (!selectedLine) {
    return null;
  }

  return (
    <div className="fee-calculation-editor">
      <div className="fee-calculation-editor__header">
        <h3>{row.label} 费用计算</h3>
        <button type="button" className="fee-calculation-editor__close" aria-label={`关闭 ${row.label} 费用计算`} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="fee-calculation-editor__stack">
        <MedianFeeSummary label={breakdown.selectedLabel} total={selectedLine.total} />
        <SpecialLabQuoteBreakdown row={row} breakdown={breakdown} />
        {breakdown.note ? <div className="fee-calculation-editor__note">{breakdown.note}</div> : null}
      </div>
    </div>
  );
}

function ComponentFeeCalculationEditor({
  row,
  breakdown,
  onClose,
}: {
  row: EnvironmentPlanRow;
  breakdown: ReturnType<typeof getEnvironmentSpecialFeeBreakdown>;
  onClose: () => void;
}) {
  if (!breakdown || breakdown.chargeBasis !== "component-total") {
    return null;
  }

  const selectedLine = breakdown.selectedLabel
    ? breakdown.lines.find((line) => line.label === breakdown.selectedLabel)
    : breakdown.lines[0];

  if (!selectedLine) {
    return null;
  }

  return (
    <div className="fee-calculation-editor">
      <div className="fee-calculation-editor__header">
        <h3>{row.label} 费用计算</h3>
        <button type="button" className="fee-calculation-editor__close" aria-label={`关闭 ${row.label} 费用计算`} onClick={onClose}>
          ×
        </button>
      </div>
      <div className="fee-calculation-editor__stack">
        <MedianFeeSummary label={breakdown.selectedLabel} total={selectedLine.total} />
        <SpecialLabQuoteBreakdown row={row} breakdown={breakdown} />
        {breakdown.note ? <div className="fee-calculation-editor__note">{breakdown.note}</div> : null}
      </div>
    </div>
  );
}

function isSequenceGroup(group: EnvironmentPlanGroup) {
  return ["Group A", "Group B", "Group C"].includes(group.title) || group.id.startsWith("manual-sequence-");
}

function isDGroup(group: EnvironmentPlanGroup) {
  return group.title.startsWith("Group D-") || group.id.startsWith("manual-d-");
}

function isEGroup(group: EnvironmentPlanGroup) {
  return group.title.startsWith("Group E-") || group.id.startsWith("manual-e-");
}

function isPcbaOnlyGroup(group: EnvironmentPlanGroup) {
  return group.totalSamplePrefix === "PCBA" || group.title === "Group D-3" || group.title === "Group D-4";
}

function getManualGroupPrefix(section: EnvironmentGroupSection) {
  if (section === "d") {
    return "Group D-新增";
  }

  if (section === "e") {
    return "Group E-新增";
  }

  return "Group 新增";
}

function getBranchTrackStyle(targetCount: number): CSSProperties {
  const safeTargetCount = Math.max(targetCount, 1);

  return {
    gridColumn: `1 / ${safeTargetCount + 1}`,
    "--branch-edge": `${50 / safeTargetCount}%`,
  } as CSSProperties;
}

function getBranchNodeStyle(index: number, targetCount: number): CSSProperties {
  const safeTargetCount = Math.max(targetCount, 1);

  return {
    left: `${((index + 0.5) / safeTargetCount) * 100}%`,
  };
}

function createManualGroup(phase: EnvironmentPlanPhase, section: EnvironmentGroupSection): EnvironmentPlanGroup {
  const titlePrefix = getManualGroupPrefix(section);
  const nextIndex = phase.groups.filter((group) => group.title.startsWith(titlePrefix)).length + 1;
  const title = `${titlePrefix} ${nextIndex}`;
  const id = `manual-${section}-${phase.id}-${Date.now()}-${nextIndex}`;

  return {
    id,
    title,
    totalSampleLabel: "Total样机数量",
    totalSampleQty: "1",
    totalDurationLabel: "组测试时间(天)",
    totalDurationDays: "1",
    totalCostLabel: "组费用",
    totalCost: "",
    rows: [
      {
        id: "manual-group-row",
        label: "新测试项",
        testHours: "1",
      },
    ],
  };
}

function GroupEditActions({
  editable,
  phase,
  group,
  section,
}: {
  editable: boolean;
  phase: EnvironmentPlanPhase;
  group: EnvironmentPlanGroup;
  section: EnvironmentGroupSection;
}) {
  const { dispatch } = useAppState();
  const insertLabels =
    section === "sequence"
      ? { before: "左侧", after: "右侧" }
      : { before: "上方", after: "下方" };
  const target = `${phase.title} / ${group.title}`;

  if (!editable) {
    return null;
  }

  function handleInsert(position: "before" | "after") {
    dispatch({
      type: "addEnvironmentPlanGroup",
      phaseId: phase.id,
      ...(position === "before" ? { beforeGroupId: group.id } : { afterGroupId: group.id }),
      group: createManualGroup(phase, section),
    });
  }

  return (
    <div className={`group-edit-actions group-edit-actions--${section}`}>
      <button
        type="button"
        className="group-edit-button"
        aria-label={`在 ${target} ${insertLabels.before}插入组`}
        onClick={() => handleInsert("before")}
      >
        {insertLabels.before}插入组
      </button>
      <button
        type="button"
        className="group-edit-button"
        aria-label={`在 ${target} ${insertLabels.after}插入组`}
        onClick={() => handleInsert("after")}
      >
        {insertLabels.after}插入组
      </button>
      <button
        type="button"
        className="group-edit-button group-edit-button--danger"
        aria-label={`删除 ${target} 整组`}
        onClick={() =>
          dispatch({
            type: "removeEnvironmentPlanGroup",
            phaseId: phase.id,
            groupId: group.id,
          })}
      >
        删除整组
      </button>
    </div>
  );
}

function FlowEditActions({
  editable,
  phaseId,
  group,
  row,
  createInsertedRow,
  scopeLabel,
}: {
  editable: boolean;
  phaseId: string;
  group: EnvironmentPlanGroup;
  row: EnvironmentPlanRow;
  createInsertedRow?: () => EnvironmentPlanRow;
  scopeLabel?: string;
}) {
  const { dispatch } = useAppState();
  const actionTarget = `${phaseId.toUpperCase()} / ${scopeLabel ? `${scopeLabel} / ` : ""}${group.title} / ${row.label}`;

  if (!editable) {
    return null;
  }

  function handleInsert(position: "before" | "after") {
    dispatch({
      type: "addEnvironmentPlanRow",
      phaseId,
      groupId: group.id,
      ...(position === "before" ? { beforeRowId: row.id } : { afterRowId: row.id }),
      row: createInsertedRow ? createInsertedRow() : createManualRow(phaseId, group, row),
    });
  }

  return (
    <div className="flow-edit-actions">
      <button
        type="button"
        className="flow-edit-button"
        aria-label={`在 ${actionTarget} 前插入测试项`}
        onClick={() => handleInsert("before")}
      >
        向上插入
      </button>
      <button
        type="button"
        className="flow-edit-button"
        aria-label={`在 ${actionTarget} 后插入测试项`}
        onClick={() => handleInsert("after")}
      >
        向下插入
      </button>
      <button
        type="button"
        className="flow-edit-button flow-edit-button--danger"
        aria-label={`删除 ${actionTarget}`}
        onClick={() =>
          dispatch({
            type: "removeEnvironmentPlanRow",
            phaseId,
            groupId: group.id,
            rowId: row.id,
          })}
      >
        删除
      </button>
    </div>
  );
}

function GroupSampleInput({
  phase,
  group,
  className = "",
}: {
  phase: EnvironmentPlanPhase;
  group: EnvironmentPlanGroup;
  className?: string;
}) {
  const { dispatch } = useAppState();

  return (
    <label className={`group-sample-input ${className}`.trim()}>
      <span>Samples:</span>
      {group.totalSamplePrefix ? <span>{group.totalSamplePrefix}</span> : null}
      <input
        aria-label={`${phase.title} / ${group.title} 样本量`}
        className="flow-inline-input flow-inline-input--sample-qty"
        value={group.totalSampleQty}
        onChange={(event) =>
          dispatch({
            type: "updateEnvironmentPlanGroup",
            phaseId: phase.id,
            groupId: group.id,
            field: "totalSampleQty",
            value: event.target.value,
          })}
      />
    </label>
  );
}

function GroupTitleInput({
  phase,
  group,
  className = "",
}: {
  phase: EnvironmentPlanPhase;
  group: EnvironmentPlanGroup;
  className?: string;
}) {
  const { dispatch } = useAppState();

  return (
    <input
      aria-label={`${phase.title} / ${group.title} 组名称`}
      className={`flow-inline-input group-title-input ${className}`.trim()}
      value={group.title}
      onChange={(event) =>
        dispatch({
          type: "updateEnvironmentPlanGroup",
          phaseId: phase.id,
          groupId: group.id,
          field: "title",
          value: event.target.value,
        })}
    />
  );
}

function BaselineTestCard({
  editable,
  phase,
  group,
  row,
  defaultSample,
  renderFee,
}: {
  editable: boolean;
  phase: EnvironmentPlanPhase;
  group: EnvironmentPlanGroup | undefined;
  row: EnvironmentPlanRow | undefined;
  defaultSample: string;
  renderFee: FeeRenderer;
}) {
  const { dispatch } = useAppState();

  if (!group || !row) {
    return null;
  }

  const safeGroup = group;
  const safeRow = row;
  const kind = isBaselineManualRow(safeRow)
    ? safeRow.label
    : safeRow.id.includes("optical")
      ? "Optical Test"
      : safeRow.id.includes("l1l4")
        ? "L1&L4"
        : safeRow.label;
  const ariaPrefix = `${phase.title} Baseline ${kind}`;

  function update(field: "label" | "testHours" | "sampleRange", value: string) {
    dispatch({
      type: "updateEnvironmentPlanRow",
      phaseId: phase.id,
      groupId: safeGroup.id,
      rowId: safeRow.id,
      field,
      value,
    });
  }

  const fee = renderFee(safeGroup, safeRow, "fee-box");

  return (
    <div className="test">
      <div className="test-info">
        <div className="test-title">
          <AutoSizeTextarea
            className="flow-inline-textarea flow-inline-textarea--baseline"
            value={safeRow.label}
            rows={kind === "L1&L4" ? 2 : 1}
            ariaLabel={`${ariaPrefix} 名称`}
            readOnly={!editable}
            onChange={(value) => update("label", value)}
          />
        </div>
        <div className="test-metrics">
          <label className="test-metric">
            <span>Sample:</span>
            <span className="test-metric__sample-stack">
              <input
                aria-label={`${ariaPrefix} 样品`}
                className="flow-inline-input flow-inline-input--baseline-sample"
                readOnly
                value={defaultSample}
                onChange={() => undefined}
              />
              {safeRow.id.includes("optical") ? (
                <span className="test-metric__note">PCBA 样品无需进行光学测试</span>
              ) : null}
            </span>
          </label>
          <label className="test-metric">
            <span>Time:</span>
            <span>
              <input
                aria-label={`${ariaPrefix} 时间`}
                className="flow-inline-input flow-inline-input--center"
                readOnly={!editable}
                value={safeRow.testHours}
                onChange={(event) => update("testHours", event.target.value)}
              />
              d
            </span>
          </label>
        </div>
      </div>
      {fee.button}
      <FlowEditActions
        editable={editable}
        phaseId={phase.id}
        group={safeGroup}
        row={safeRow}
        scopeLabel="Baseline"
        createInsertedRow={() => createBaselineManualRow(phase.id, safeGroup, safeRow)}
      />
      {fee.editor}
    </div>
  );
}

function AutoSizeTextarea({
  value,
  className,
  ariaLabel,
  rows = 1,
  readOnly = false,
  onChange,
}: {
  value: string;
  className: string;
  ariaLabel: string;
  rows?: number;
  readOnly?: boolean;
  onChange: (value: string) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (!ref.current) {
      return;
    }

    ref.current.style.height = "0px";
    ref.current.style.height = `${ref.current.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      className={className}
      value={value}
      rows={rows}
      readOnly={readOnly}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

function SequenceItem({
  phaseId,
  group,
  row,
  defaultSampleRange,
  editable,
  renderFee,
}: {
  phaseId: string;
  group: EnvironmentPlanGroup;
  row: EnvironmentPlanRow;
  defaultSampleRange?: string;
  editable: boolean;
  renderFee: FeeRenderer;
}) {
  const { dispatch } = useAppState();
  const fee = renderFee(group, row, "flow-item__fee");

  return (
    <>
      <div className="flow-item">
        <AutoSizeTextarea
          className="flow-item__name"
          value={row.label}
          rows={1}
          ariaLabel={`${phaseId}-${group.title}-${row.id}-label`}
          onChange={(value) =>
            dispatch({
              type: "updateEnvironmentPlanRow",
              phaseId,
              groupId: group.id,
              rowId: row.id,
              field: "label",
              value,
            })}
        />
        <div className="flow-item__sample">{getSampleRange(group, row, defaultSampleRange)}</div>
        <div className="flow-item__time">
          <input
            aria-label={`${phaseId}-${group.title}-${row.id}-hours`}
            className="flow-inline-input flow-inline-input--center"
            value={row.testHours}
            onChange={(event) =>
              dispatch({
                type: "updateEnvironmentPlanRow",
                phaseId,
                groupId: group.id,
                rowId: row.id,
                field: "testHours",
                value: event.target.value,
              })}
          />
          <span>d</span>
        </div>
        {fee.button}
        <FlowEditActions editable={editable} phaseId={phaseId} group={group} row={row} />
      </div>
      {fee.editor}
    </>
  );
}

function DCard({
  phase,
  group,
  editable,
  renderFee,
}: {
  phase: EnvironmentPlanPhase;
  group: EnvironmentPlanGroup;
  editable: boolean;
  renderFee: FeeRenderer;
}) {
  const { dispatch } = useAppState();
  const [primaryRow, ...postRows] = getVisibleRows(group.rows);
  const primaryFee = primaryRow ? renderFee(group, primaryRow, "df") : null;

  return (
    <div className={`d-card ${group.title === "Group D-8" ? "halt" : ""}`}>
      <div className="d-card__top">
        <GroupTitleInput phase={phase} group={group} className="d-group-code" />
        <GroupSampleInput phase={phase} group={group} className="d-mini" />
      </div>
      <GroupEditActions editable={editable} phase={phase} group={group} section="d" />
      {primaryRow ? (
        <div className="d-main">
          <AutoSizeTextarea
            className="flow-inline-textarea"
            value={primaryRow.label}
            rows={1}
            ariaLabel={`${phase.id}-${group.title}-${primaryRow.id}-label`}
            onChange={(value) =>
              dispatch({
                type: "updateEnvironmentPlanRow",
                phaseId: phase.id,
                groupId: group.id,
                rowId: primaryRow.id,
                field: "label",
                value,
                })}
            />
          <div className="d-side d-side--wide">
            <div className="dv">
                <input
                  aria-label={`${phase.id}-${group.title}-${primaryRow.id}-hours`}
                  className="flow-inline-input flow-inline-input--center flow-inline-input--duration"
                  value={primaryRow.testHours}
                  onChange={(event) =>
                  dispatch({
                    type: "updateEnvironmentPlanRow",
                    phaseId: phase.id,
                    groupId: group.id,
                    rowId: primaryRow.id,
                    field: "testHours",
                    value: event.target.value,
                  })}
              />
              {isNumericDuration(primaryRow.testHours) ? <span>d</span> : null}
            </div>
              {primaryFee?.button}
          </div>
          <FlowEditActions editable={editable} phaseId={phase.id} group={group} row={primaryRow} />
          {primaryFee?.editor}
        </div>
      ) : null}
      <div className="d-post">
        {postRows.map((row) => {
          const fee = renderFee(group, row, "f");

          return (
            <div key={row.id} className="d-post-item">
              <AutoSizeTextarea
                className="flow-inline-textarea"
                value={row.label}
                rows={1}
                ariaLabel={`${phase.id}-${group.title}-${row.id}-label`}
                onChange={(value) =>
                  dispatch({
                    type: "updateEnvironmentPlanRow",
                    phaseId: phase.id,
                    groupId: group.id,
                    rowId: row.id,
                    field: "label",
                    value,
                  })}
              />
              <div className="d-side d-side--wide">
                <div className="v">
                  <input
                    aria-label={`${phase.id}-${group.title}-${row.id}-hours`}
                    className="flow-inline-input flow-inline-input--center flow-inline-input--duration"
                    value={row.testHours}
                    onChange={(event) =>
                      dispatch({
                        type: "updateEnvironmentPlanRow",
                        phaseId: phase.id,
                        groupId: group.id,
                        rowId: row.id,
                        field: "testHours",
                        value: event.target.value,
                      })}
                  />
                  {isNumericDuration(row.testHours) ? <span>d</span> : null}
                </div>
                {fee.button}
              </div>
              <FlowEditActions editable={editable} phaseId={phase.id} group={group} row={row} />
              {fee.editor}
            </div>
          );
        })}
      </div>
      <div className="subtotal">
        <span>Subtotal</span>
        <span>{formatDurationSummary(group.totalDurationDays || "-")}</span>
      </div>
      {group.title === "Group D-8" ? (
        <div className="d-note">HALT 为开放实验，以上为预估时间</div>
      ) : null}
      <div className="subgroup-fee">
        <span>Subgroup Total Fee</span>
        <span>{formatCurrency(group.totalCost)}</span>
      </div>
    </div>
  );
}

function OtherTestCard({
  phase,
  group,
  editable,
  renderFee,
}: {
  phase: EnvironmentPlanPhase;
  group: EnvironmentPlanGroup;
  editable: boolean;
  renderFee: FeeRenderer;
}) {
  const { dispatch } = useAppState();
  const [row] = group.rows;

  if (!row) {
    return null;
  }

  const fee = renderFee(group, row, "df");

  return (
    <div className="d-card d-card--other">
      <div className="d-card__top">
        <GroupTitleInput phase={phase} group={group} className="d-group-code" />
        <GroupSampleInput phase={phase} group={group} className="d-mini" />
      </div>
      <GroupEditActions editable={editable} phase={phase} group={group} section="e" />
      <div className="d-main">
        <AutoSizeTextarea
          className="flow-inline-textarea"
          value={row.label}
          rows={1}
          ariaLabel={`${phase.id}-${group.title}-${row.id}-label`}
          onChange={(value) =>
            dispatch({
              type: "updateEnvironmentPlanRow",
              phaseId: phase.id,
              groupId: group.id,
              rowId: row.id,
              field: "label",
              value,
            })}
        />
        <div className="d-side d-side--wide">
          <div className="dv">
            <input
              aria-label={`${phase.id}-${group.title}-${row.id}-hours`}
              className="flow-inline-input flow-inline-input--center flow-inline-input--duration"
              value={row.testHours}
              onChange={(event) =>
                dispatch({
                  type: "updateEnvironmentPlanRow",
                  phaseId: phase.id,
                  groupId: group.id,
                  rowId: row.id,
                  field: "testHours",
                  value: event.target.value,
                })}
            />
            {isNumericDuration(row.testHours) ? <span>d</span> : null}
          </div>
          {fee.button}
        </div>
        <FlowEditActions editable={editable} phaseId={phase.id} group={group} row={row} />
        {fee.editor}
      </div>
      <div className="subtotal">
        <span>Subtotal</span>
        <span>{formatDurationSummary(group.totalDurationDays || "-")}</span>
      </div>
      <div className="subgroup-fee">
        <span>Subgroup Total Fee</span>
        <span>{formatCurrency(group.totalCost)}</span>
      </div>
    </div>
  );
}

function PhaseSection({ phase, editable }: { phase: EnvironmentPlanPhase; editable: boolean }) {
  const { dispatch } = useAppState();
  const [expandedFeeKey, setExpandedFeeKey] = useState<string | null>(null);
  const sequenceGroups = phase.groups.filter(isSequenceGroup);
  const dGroups = phase.groups.filter(isDGroup);
  const eGroups = phase.groups.filter(isEGroup);
  const feeDetailsByRowId = useMemo(() => {
    return new Map(
      createEnvironmentFeeDetailSections(phase).flatMap((section) =>
        section.rows.map((row) => [`${section.groupId}:${row.outlineRowId}`, row]),
      ),
    );
  }, [phase]);
  const orderedMainGroups = [...sequenceGroups, ...dGroups, ...eGroups];
  const branchTargetCount = sequenceGroups.length + (dGroups.length > 0 ? 1 : 0);
  const preTestSampleTotal = getPreTestSampleTotal(phase.groups);
  const pcbaOnlySampleTotal = phase.groups
    .filter(isPcbaOnlyGroup)
    .reduce((sum, group) => sum + Number(group.totalSampleQty || 0), 0);
  const baselineSource = getPhaseBaselineSource(phase);
  const baselineSample = String(preTestSampleTotal || "-");
  const baselineOpticalSample = String(Math.max(preTestSampleTotal - pcbaOnlySampleTotal, 0) || "-");
  const renderFee: FeeRenderer = (group, row, className) => {
    const feeKey = `${group.id}:${row.id}`;
    const detailRow = feeDetailsByRowId.get(feeKey);
    const specialBreakdown = getEnvironmentSpecialFeeBreakdown(phase, group, row);
    const displayedFee = specialBreakdown
      ? formatCurrencyAmount(specialBreakdown.total)
      : detailRow?.estimatedItemFee === null || detailRow?.estimatedItemFee === undefined
        ? formatFee(row.fee)
        : formatCurrencyAmount(detailRow.estimatedItemFee);
    const ariaLabel = `${phase.title} / ${group.title} / ${row.label} 费用 ${displayedFee}`;

    function openFeeEditor() {
      setExpandedFeeKey(feeKey);
    }

    function updateFeeBasis(basis: Exclude<EnvironmentFeeChargeBasis, "pending">, value: string) {
      dispatch({
        type: "updateEnvironmentPlanRowFeeBasis",
        phaseId: phase.id,
        groupId: group.id,
        rowId: row.id,
        basis,
        value,
      });
    }

    return {
      button: (
        <button
          type="button"
          className={`${className} fee-display-button`}
          aria-label={ariaLabel}
          onDoubleClick={openFeeEditor}
        >
          {displayedFee}
        </button>
      ),
      editor:
        expandedFeeKey === feeKey ? (
          specialBreakdown ? (
            specialBreakdown.chargeBasis === "optical-split" ? (
              <OpticalFeeCalculationEditor row={row} breakdown={specialBreakdown} onClose={() => setExpandedFeeKey(null)} />
            ) : specialBreakdown.chargeBasis === "particle-lab-total" ? (
              <ParticleFeeCalculationEditor row={row} breakdown={specialBreakdown} onClose={() => setExpandedFeeKey(null)} />
            ) : (
              <ComponentFeeCalculationEditor row={row} breakdown={specialBreakdown} onClose={() => setExpandedFeeKey(null)} />
            )
          ) : (
            <FeeCalculationEditor
              row={row}
              detailRow={detailRow}
              onBasisChange={updateFeeBasis}
              onClose={() => setExpandedFeeKey(null)}
            />
          )
        ) : null,
    };
  };

  return (
    <section className="flow-phase">
      <h2 className="flow-phase__heading">{phase.title} 环境测试流程图</h2>
      <div className="flow-phase__canvas">
        <div className="flow-phase__grid">
          <div className="title">{phase.title} Environment Reliability Test Flow Chart</div>

          <div className="meta">
            <label className="card">
              <div className="label">Project</div>
              <input
                className="value flow-inline-input"
                value={phase.summary.projectCode}
                onChange={(event) =>
                  dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "projectCode", value: event.target.value })}
              />
            </label>
            <label className="card">
              <div className="label">Phase</div>
              <input
                className="value flow-inline-input flow-inline-input--center"
                value={phase.summary.phaseValue}
                onChange={(event) =>
                  dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "phaseValue", value: event.target.value })}
              />
            </label>
            <label className="card">
              <div className="label">Total Samples</div>
              <input
                className="value flow-inline-input flow-inline-input--metric"
                value={phase.summary.totalSampleQty}
                onChange={(event) =>
                  dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "totalSampleQty", value: event.target.value })}
              />
            </label>
            <label className="card">
              <div className="label">Longest Group Test Time</div>
              <div className="value flow-phase__longest">
                <span>Group A:</span>
                <input
                  className="flow-inline-input flow-inline-input--center"
                  value={phase.summary.longestDurationDays}
                  onChange={(event) =>
                    dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "longestDurationDays", value: event.target.value })}
                />
                <span>d</span>
              </div>
              <div className="flow-phase__hint">• 以上时间为测试时间，实际测试执行时，需考虑样品流转时间，会增加约 20d</div>
            </label>
            <label className="card">
              <div className="label">Total Test Cost</div>
              <input
                className="value flow-inline-input flow-inline-input--metric"
                value={formatCurrency(phase.summary.totalCost)}
                readOnly
              />
            </label>
          </div>

          <div className="banner">
            <div className="lane">
              <h2>Baseline / Pre-Test Gate</h2>
              <div className="stack">
                {baselineSource.rows.map((row) => (
                  <BaselineTestCard
                    key={row.id}
                    editable={editable}
                    phase={phase}
                    group={baselineSource.group}
                    row={row}
                    defaultSample={row.id.includes("optical") ? baselineOpticalSample : baselineSample}
                    renderFee={renderFee}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="branch-row">
            <div className="branch-track" style={getBranchTrackStyle(branchTargetCount)}>
              {Array.from({ length: branchTargetCount }, (_, index) => (
                <div
                  key={index}
                  className="branch-node"
                  style={getBranchNodeStyle(index, branchTargetCount)}
                />
              ))}
            </div>
            <div></div>
          </div>

          <div className="columns">
            {sequenceGroups.map((group) => {
              const defaultSampleRange = getSequentialGroupSampleRange(orderedMainGroups, group.id);

              return (
                <div key={group.id} className="group">
                <div className="head">
                  <GroupTitleInput phase={phase} group={group} />
                  <span>Sequence Tests</span>
                  <GroupSampleInput phase={phase} group={group} />
                  <GroupEditActions editable={editable} phase={phase} group={group} section="sequence" />
                </div>
                <div className="body">
                  {getVisibleRows(group.rows).map((row) => (
                    <SequenceItem
                      key={row.id}
                      phaseId={phase.id}
                      group={group}
                      row={row}
                      defaultSampleRange={defaultSampleRange}
                      editable={editable}
                      renderFee={renderFee}
                    />
                  ))}
                  <div className="subtotal"><span>Subtotal</span><span>{group.totalDurationDays || "-"} d</span></div>
                  <div className="group-fee"><span>Group Total Fee</span><span>{formatCurrency(group.totalCost)}</span></div>
                </div>
                </div>
              );
            })}

            <div className="d-wrap">
              <div className="section-title" style={{ marginTop: 0 }}>{`Group D Parallel Tests\nSamples: ${dGroups.reduce((sum, group) => sum + Number(group.totalSampleQty || 0), 0)}`}</div>
              <div className="d-grid">
                {dGroups.map((group) => (
                  <DCard
                    key={group.id}
                    phase={phase}
                    group={group}
                    editable={editable}
                    renderFee={renderFee}
                  />
                ))}
              </div>
              <div className="group-fee"><span>Group Total Fee</span><span>{formatCurrency(String(dGroups.reduce((sum, group) => sum + Number(group.totalCost || 0), 0)))}</span></div>
            </div>

            {eGroups.length > 0 ? (
              <div className="d-wrap d-wrap--other">
                <div className="section-title" style={{ marginTop: 0 }}>{`Group E Other Tests\nSamples: ${eGroups.reduce((sum, group) => sum + Number(group.totalSampleQty || 0), 0)}`}</div>
                <div className="d-grid d-grid--other">
                  {eGroups.map((group) => (
                    <OtherTestCard
                      key={group.id}
                      phase={phase}
                      group={group}
                      editable={editable}
                      renderFee={renderFee}
                    />
                  ))}
                </div>
                <div className="group-fee"><span>Group Total Fee</span><span>{formatCurrency(String(eGroups.reduce((sum, group) => sum + Number(group.totalCost || 0), 0)))}</span></div>
              </div>
            ) : null}
          </div>

        </div>
      </div>
      {!editable ? <EnvironmentFeeDetailTable phase={phase} /> : null}
    </section>
  );
}

export function EnvironmentOutlinePage() {
  const navigate = useNavigate();
  const { state, dispatch } = useAppState();
  const editable = !state.projectSetup.reuseEnvironmentTemplate;
  const canUndoEnvironmentPlan = Boolean(state.lastEnvironmentPlan);
  const exportMlaFees = () => downloadMlaEnvironmentFeeWorkbook(state.environmentPlan);

  return (
    <AppLayout
      title="环境测试大纲"
      subtitle="参考 MLA test flow chart 展示，可直接编辑各组内容。"
      wide
    >
      <div className="content-stack">
        <div className="form-actions environment-outline-actions environment-outline-actions--top">
          <button type="button" className="secondary-button" onClick={() => navigate("/input")}>
            返回上一页
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!canUndoEnvironmentPlan}
            onClick={() => dispatch({ type: "undoEnvironmentPlan" })}
          >
            撤回上一步
          </button>
          <button type="button" className="secondary-button" onClick={exportMlaFees}>
            导出 MLA 费用 Excel
          </button>
        </div>

        {editable ? (
          <section className="panel flow-edit-notice">
            <strong>不完全复用：可在流程图中插入或删除测试项目</strong>
            <span>当前页面基于完整平台大纲生成副本，所有修改会保存在浏览器本地。</span>
          </section>
        ) : null}

        {state.environmentPlan.phases.map((phase) => (
          <PhaseSection key={phase.id} phase={phase} editable={editable} />
        ))}

        <div className="form-actions environment-outline-actions">
          <button type="button" className="secondary-button" onClick={() => navigate("/input")}>
            返回上一页
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!canUndoEnvironmentPlan}
            onClick={() => dispatch({ type: "undoEnvironmentPlan" })}
          >
            撤回上一步
          </button>
          <button type="button" className="secondary-button" onClick={exportMlaFees}>
            导出 MLA 费用 Excel
          </button>
          <button type="button" className="primary-button" onClick={() => navigate("/results")}>
            确认进入结果页
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
