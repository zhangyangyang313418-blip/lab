import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { AddTestItemForm } from "../components/results/AddTestItemForm";
import { EditableTestTable } from "../components/results/EditableTestTable";
import { ExportActions } from "../components/results/ExportActions";
import { ResultTabs, type ResultTabKey } from "../components/results/ResultTabs";
import { SummaryCards } from "../components/results/SummaryCards";
import { summarizeResults } from "../services/calculationEngine";
import { useAppState } from "../store/appState";
import type { TestDomain } from "../types/testing";
import { formatSteeringSides } from "../utils/projectLabels";

export function ResultsPage() {
  const { state } = useAppState();
  const navigate = useNavigate();
  const [activeDomain, setActiveDomain] = useState<ResultTabKey>("environment");
  const projectTypeLabel = state.projectSetup.projectType === "new_project" ? "新增项目" : "变更项目";
  const steeringLabel = formatSteeringSides(state.projectSetup.steeringSides);
  const reusedDomains = [
    state.projectSetup.reuseEnvironmentTemplate ? "环境" : null,
    state.projectSetup.reuseMaterialTemplate ? "材料" : null,
    state.projectSetup.reuseEmcTemplate ? "EMC" : null,
  ].filter(Boolean).join(" / ");

  const summary = useMemo(() => {
    return summarizeResults([
      ...state.domainItems.environment,
      ...state.domainItems.material,
      ...state.domainItems.emc,
    ]);
  }, [state.domainItems]);

  const domainSummaries = useMemo(() => {
    return {
      environment: summarizeResults(state.domainItems.environment),
      material: summarizeResults(state.domainItems.material),
      emc: summarizeResults(state.domainItems.emc),
    };
  }, [state.domainItems]);

  const items = activeDomain === "cost" ? [] : state.domainItems[activeDomain];
  const costRows = [
    {
      label: "环境费用",
      itemCount: domainSummaries.environment.enabledItemCount,
      sampleQty: domainSummaries.environment.totalSampleQty,
      durationHours: domainSummaries.environment.totalDurationHours,
      totalCost: domainSummaries.environment.totalCost,
    },
    {
      label: "材料费用",
      itemCount: domainSummaries.material.enabledItemCount,
      sampleQty: domainSummaries.material.totalSampleQty,
      durationHours: domainSummaries.material.totalDurationHours,
      totalCost: domainSummaries.material.totalCost,
    },
    {
      label: "EMC费用",
      itemCount: domainSummaries.emc.enabledItemCount,
      sampleQty: domainSummaries.emc.totalSampleQty,
      durationHours: domainSummaries.emc.totalDurationHours,
      totalCost: domainSummaries.emc.totalCost,
    },
  ];

  return (
    <AppLayout
      title="测试结果"
      subtitle="查看系统生成的 HUD 测试建议，并按需进行人工调整。"
    >
      <div className="content-stack">
        <div className="page-actions">
          <button type="button" className="secondary-button" onClick={() => navigate("/environment-outline")}>
            返回上一页
          </button>
        </div>
        <section className="panel summary-card">
          <div className="summary-card__header">
            <div>
              <p className="section-label">项目摘要</p>
              <h2>
                {state.projectSetup.oem} / {state.projectSetup.platform} / {steeringLabel} / {state.projectSetup.projectCode}
              </h2>
            </div>
            <span className="status-badge">
              {reusedDomains ? `已复用: ${reusedDomains}` : "全部手动配置"}
            </span>
          </div>
          <dl className="summary-grid">
            <div>
              <dt>OEM</dt>
              <dd>{state.projectSetup.oem}</dd>
            </div>
            <div>
              <dt>项目类型</dt>
              <dd>{projectTypeLabel}</dd>
            </div>
            <div>
              <dt>平台</dt>
              <dd>{state.projectSetup.platform}</dd>
            </div>
            <div>
              <dt>驾驶方向</dt>
              <dd>{steeringLabel}</dd>
            </div>
            <div>
              <dt>项目代号</dt>
              <dd>{state.projectSetup.projectCode}</dd>
            </div>
            <div>
              <dt>完全复用</dt>
              <dd>{state.projectSetup.isFullyReused ? "是" : "否"}</dd>
            </div>
          </dl>
        </section>
        <SummaryCards summary={summary} />
        <ResultTabs activeDomain={activeDomain} onChange={setActiveDomain} />
        {activeDomain === "cost" ? (
          <section className="panel input-section">
            <div className="section-heading">
              <div>
                <p className="section-label">费用模块</p>
                <h2>费用规则将在后续阶段接入</h2>
              </div>
            </div>
            <p className="helper-text">
              当前页面中的费用仅来自现有种子数据，用于占位演示，不代表最终 JLR 正式报价规则。
            </p>
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>输出物</th>
                    <th>启用项数</th>
                    <th>样本总数</th>
                    <th>总工时</th>
                    <th>总费用</th>
                  </tr>
                </thead>
                <tbody>
                  {costRows.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{row.itemCount}</td>
                      <td>{row.sampleQty}</td>
                      <td>{row.durationHours} h</td>
                      <td>{new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(row.totalCost)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>总汇总</td>
                    <td>{summary.enabledItemCount}</td>
                    <td>{summary.totalSampleQty}</td>
                    <td>{summary.totalDurationHours} h</td>
                    <td>{new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(summary.totalCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <>
            <EditableTestTable domain={activeDomain as TestDomain} items={items} />
            <AddTestItemForm domain={activeDomain as TestDomain} />
          </>
        )}
        <ExportActions />
      </div>
    </AppLayout>
  );
}
