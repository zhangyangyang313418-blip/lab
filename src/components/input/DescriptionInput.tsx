import { useAppState } from "../../store/appState";

export function DescriptionInput() {
  const { state, dispatch } = useAppState();
  const isChangeProject = state.projectSetup.projectType === "change_project";

  return (
    <section className="panel input-section">
      <div className="section-heading">
        <p className="section-label">项目背景</p>
        <h2>{isChangeProject ? "变更说明" : "需求说明"}</h2>
      </div>
      <label className="field">
        <span className="field__label">{isChangeProject ? "变更描述" : "项目描述"}</span>
        <textarea
          className="text-area"
          value={state.projectSetup.description}
          onChange={(event) =>
            dispatch({
              type: "setDescription",
              description: event.target.value,
            })
          }
          placeholder={
            isChangeProject
              ? "填写本次设计变更点、影响范围、特殊风险和需要重点评估的部分"
              : "填写项目目标、边界、特殊约束和关注点"
          }
          rows={6}
        />
      </label>
    </section>
  );
}
