import type { ResultSummary } from "../../types/testing";

interface SummaryCardsProps {
  summary: ResultSummary;
}

function formatCount(value: number) {
  return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function SummaryCard({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div data-testid={testId}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <section className="panel summary-card">
      <div className="summary-card__header">
        <div>
          <p className="section-label">结果概览</p>
          <h2>汇总统计</h2>
        </div>
      </div>

      <dl className="summary-grid">
        <SummaryCard
          label="启用项数"
          value={formatCount(summary.enabledItemCount)}
          testId="summary-enabledItemCount"
        />
        <SummaryCard
          label="样本总数"
          value={formatCount(summary.totalSampleQty)}
          testId="summary-totalSampleQty"
        />
        <SummaryCard
          label="总时长"
          value={`${formatCount(summary.totalDurationHours)} h`}
          testId="summary-totalDurationHours"
        />
        <SummaryCard
          label="总费用"
          value={formatCurrency(summary.totalCost)}
          testId="summary-totalCost"
        />
      </dl>
    </section>
  );
}
