import { useAppState } from "../../store/appState";
import { formatSteeringSides } from "../../utils/projectLabels";

export function ProjectBriefCard() {
  const { state } = useAppState();
  const { projectSetup } = state;
  const projectTypeLabel = projectSetup.projectType === "new_project" ? "新增项目" : "变更项目";

  return (
    <section className="panel summary-card">
      <div className="summary-card__header">
        <div>
          <p className="section-label">项目概览</p>
          <h2>项目输入</h2>
        </div>
        <span className="status-badge">{projectSetup.confirmed ? "已确认" : "待确认"}</span>
      </div>

      <dl className="summary-grid">
        <div>
          <dt>OEM</dt>
          <dd>{projectSetup.oem}</dd>
        </div>
        <div>
          <dt>项目类型</dt>
          <dd>{projectTypeLabel}</dd>
        </div>
        <div>
          <dt>平台</dt>
          <dd>{projectSetup.platform}</dd>
        </div>
        <div>
          <dt>驾驶方向</dt>
          <dd>{formatSteeringSides(projectSetup.steeringSides)}</dd>
        </div>
        <div>
          <dt>项目名称</dt>
          <dd>{projectSetup.projectCode}</dd>
        </div>
        <div>
          <dt>是否完全复用</dt>
          <dd>{projectSetup.isFullyReused ? "是" : "否"}</dd>
        </div>
        {projectSetup.projectType === "change_project" ? (
          <div>
            <dt>已选变更项</dt>
            <dd>{projectSetup.selectedChangeIds.length}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
