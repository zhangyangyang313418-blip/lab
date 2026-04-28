import { useNavigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { ChangeSelector } from "../components/input/ChangeSelector";
import { DescriptionInput } from "../components/input/DescriptionInput";
import { ProjectBriefCard } from "../components/input/ProjectBriefCard";
import { AddTestItemForm } from "../components/results/AddTestItemForm";
import { useAppState } from "../store/appState";
import { formatSteeringSides } from "../utils/projectLabels";

export function ProjectInputPage() {
  const navigate = useNavigate();
  const { state } = useAppState();
  const isChangeProject = state.projectSetup.projectType === "change_project";
  const steeringLabel = formatSteeringSides(state.projectSetup.steeringSides);
  const manualEditingEnabled = isChangeProject;
  const domainPlans = [
    {
      domain: "environment" as const,
      title: "环境可靠性",
      reused: state.projectSetup.reuseEnvironmentTemplate,
      reusedMessage: `环境可靠性将使用 ${state.projectSetup.platform} 平台 ${steeringLabel} 完整大纲作为推荐基础。`,
      manualMessage: isChangeProject
        ? "环境可靠性将基于变更矩阵与平台基线联合推荐，并保留人工调整。"
        : "环境可靠性将先按平台基线推荐，后续可手动补充或删改。",
    },
    {
      domain: "material" as const,
      title: "材料",
      reused: state.projectSetup.reuseMaterialTemplate,
      reusedMessage: "材料模块暂沿用现有基线数据，后续会继续细化。",
      manualMessage: "材料模块当前保留编辑入口，后续再按正式规则完善。",
    },
    {
      domain: "emc" as const,
      title: "EMC",
      reused: state.projectSetup.reuseEmcTemplate,
      reusedMessage: "EMC 将先使用现有种子数据，后续再与 JLR 矩阵做更细映射。",
      manualMessage: isChangeProject
        ? "EMC 变更项可在本页选择，系统会据此补充推荐测试。"
        : "EMC 模块当前保留编辑入口，后续再按正式规则完善。",
    },
  ];
  const manualEntryPlans = [
    { domain: "material" as const, title: "材料" },
    { domain: "emc" as const, title: "EMC" },
  ];
  const visibleManualEntryPlans = manualEditingEnabled ? manualEntryPlans : [];

  return (
    <AppLayout
      title="项目输入"
      subtitle="补充需求或变更背景，让系统生成第一版 HUD 测试建议。"
    >
      <div className="content-stack">
        <div className="form-actions" style={{ justifyContent: "flex-start" }}>
          <button
            type="button"
            className="secondary-button"
            onClick={() => navigate("/")}
          >
            返回上一页
          </button>
        </div>
        <ProjectBriefCard />
        <DescriptionInput />
        {isChangeProject ? <ChangeSelector /> : null}
        <section className="panel input-section">
          <div className="section-heading">
            <div>
              <p className="section-label">输出物入口</p>
              <h2>生成初始评估结果</h2>
            </div>
          </div>
          <div className="content-stack">
            {domainPlans.map((plan) => (
              <p key={plan.domain} className="helper-text">
                {plan.reused ? plan.reusedMessage : plan.manualMessage}
              </p>
            ))}
          </div>
          <div className="form-actions" style={{ marginTop: 16, justifyContent: "flex-start" }}>
            <button
              type="button"
              className="primary-button"
              onClick={() => navigate("/environment-outline")}
            >
              查看环境测试大纲
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => navigate("/results")}
            >
              {isChangeProject ? "直接查看推荐结果" : "直接查看测试结果"}
            </button>
          </div>
        </section>

        {visibleManualEntryPlans.map((plan) => (
          <section key={plan.domain} className="content-stack">
            <section className="panel input-section">
              <div className="section-heading">
                <div>
                  <p className="section-label">手动添加入口</p>
                  <h2>{plan.title}</h2>
                </div>
              </div>
              <p className="helper-text">
                可在本页直接补充 {plan.title} 测试项，后续系统会与变更推荐结果一起进入汇总。
              </p>
            </section>
            <AddTestItemForm domain={plan.domain} />
          </section>
        ))}
      </div>
    </AppLayout>
  );
}
