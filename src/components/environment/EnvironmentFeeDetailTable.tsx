import { Fragment } from "react";
import { createEnvironmentFeeDetailSections } from "../../services/environmentFeeDetail";
import type { EnvironmentPlanPhase } from "../../types/environmentPlan";
import type { EnvironmentFeeLabPriceValue } from "../../types/environmentFeeDetail";

function formatCurrency(value: number | null | "N/A") {
  if (value === "N/A") {
    return "N/A";
  }

  if (value === null) {
    return "";
  }

  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUnitPrice(value: EnvironmentFeeLabPriceValue | number | null) {
  if (value === "N/A") {
    return "N/A";
  }

  if (value === "" || value === null) {
    return "";
  }

  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null) {
  if (value === null) {
    return "";
  }

  return new Intl.NumberFormat("zh-CN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLabName(lab: string) {
  return lab === "苏劢" ? "苏勃" : lab;
}

export function EnvironmentFeeDetailTable({ phase }: { phase: EnvironmentPlanPhase }) {
  const sections = createEnvironmentFeeDetailSections(phase);

  return (
    <section className="fee-detail" aria-labelledby={`fee-detail-${phase.id}`}>
      <div className="fee-detail__heading-row">
        <div>
          <p className="section-label">费用明细</p>
          <h2 id={`fee-detail-${phase.id}`}>{phase.title} 费用细则</h2>
        </div>
        <div className="fee-detail__meta">
          <span>项目 {phase.summary.projectCode}</span>
          <span>阶段 {phase.summary.phaseValue}</span>
          <span>L1&L4总计数量 {phase.summary.totalSampleQty}</span>
        </div>
      </div>
      <div className="fee-detail__scroll">
        <table className="fee-detail__table">
          <thead>
            <tr>
              <th>Group</th>
              <th>项目</th>
              <th>测试时间 h</th>
              <th>数量</th>
              <th>批次</th>
              <th>实验室单价中值</th>
              <th>单项费用（预计）</th>
              <th>SGS 单价</th>
              <th>SGS 单项费用</th>
              <th>华测 单价</th>
              <th>华测 单项费用</th>
              <th>苏勃 单价</th>
              <th>苏勃 单项费用</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {sections.flatMap((section) =>
              section.rows.map((row, rowIndex) => (
                <tr key={`${section.groupId}-${row.outlineRowId}`}>
                  {rowIndex === 0 ? (
                    <th className="fee-detail__group" rowSpan={section.rows.length}>
                      <span>{section.groupTitle}</span>
                      <small>Total样机数量 {section.totalSampleQty}</small>
                    </th>
                  ) : null}
                  <td className="fee-detail__item">{row.testName}</td>
                  <td>{formatNumber(row.testHours)}</td>
                  <td>{formatNumber(row.quantity)}</td>
                  <td>{formatNumber(row.batchCount)}</td>
                  <td>{formatUnitPrice(row.medianUnitPrice)}</td>
                  <td>{formatCurrency(row.estimatedItemFee)}</td>
                  {row.labs.map((lab) => (
                    <Fragment key={formatLabName(lab.lab)}>
                      <td>{formatUnitPrice(lab.unitPrice)}</td>
                      <td>{formatCurrency(lab.itemFee)}</td>
                    </Fragment>
                  ))}
                  <td className={row.status === "priced" ? "fee-detail__status" : "fee-detail__status fee-detail__status--pending"}>
                    {row.status === "priced" ? "" : row.status}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
