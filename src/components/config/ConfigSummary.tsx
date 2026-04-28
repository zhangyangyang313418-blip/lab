import { seedMaterialItems } from "../../data/seed/materialTemplates";
import { seedPlatformTemplates } from "../../data/seed/platformTemplates";
import { seedPricingItems } from "../../data/seed/pricing";
import type { AppState } from "../../store/appState";
import { defaultProjectSetup } from "../../data/seed/project";
import { formatSteeringSides, normalizeSteeringSides } from "../../utils/projectLabels";

interface ConfigSummaryProps {
  state: AppState;
}

export function ConfigSummary({ state }: ConfigSummaryProps) {
  const steeringSides = normalizeSteeringSides(state.projectSetup.steeringSides);
  const platformTemplates = seedPlatformTemplates.filter(
    (template) => template.platform === state.projectSetup.platform && steeringSides.includes(template.steeringSide),
  );

  return (
    <section className="panel summary-card">
      <div className="summary-card__header">
        <div>
          <p className="section-label">已加载种子配置</p>
          <h2>当前项目与默认模板</h2>
        </div>
        <span className="status-badge">seed</span>
      </div>

      <dl className="summary-grid">
        <div>
          <dt>项目平台</dt>
          <dd>{state.projectSetup.platform}</dd>
        </div>
        <div>
          <dt>驾驶方向</dt>
          <dd>{formatSteeringSides(state.projectSetup.steeringSides)}</dd>
        </div>
        <div>
          <dt>项目编号</dt>
          <dd>{state.projectSetup.projectCode}</dd>
        </div>
        <div>
          <dt>平台环境模板</dt>
          <dd>{platformTemplates.map((template) => template.workbookName).join(" / ") || "未找到"}</dd>
        </div>
        <div>
          <dt>材料模板条目</dt>
          <dd>{seedMaterialItems.length} 条</dd>
        </div>
        <div>
          <dt>报价条目</dt>
          <dd>{seedPricingItems.length} 条</dd>
        </div>
      </dl>

      <p className="hero-card__copy" style={{ marginTop: "16px" }}>
        当前配置基于默认种子数据，平台环境模板会跟随项目平台切换。
      </p>
      {state.projectSetup.platform !== defaultProjectSetup.platform ? (
        <p className="hero-card__copy" style={{ marginTop: "8px" }}>
          你的项目平台是 {state.projectSetup.platform}，默认平台为 {defaultProjectSetup.platform}。
        </p>
      ) : null}
    </section>
  );
}
