import { seedChangeOptions } from "../../data/seed/changeOptions";
import { useAppState } from "../../store/appState";

export function ChangeSelector() {
  const { state, dispatch } = useAppState();

  return (
    <section className="panel input-section">
      <div className="section-heading">
        <p className="section-label">变更识别</p>
        <h2>选择变更项</h2>
      </div>
      <div className="selector-list">
        {seedChangeOptions.map((option) => {
          const checked = state.projectSetup.selectedChangeIds.includes(option.id);

          return (
            <label key={option.id} className="selector-item">
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  dispatch({
                    type: "toggleChangeId",
                    changeId: option.id,
                  })
                }
              />
              <div>
                <div className="selector-item__title">{option.label}</div>
                <div className="selector-item__meta">推荐代码: {option.recommendedCodes.join(", ")}</div>
              </div>
            </label>
          );
        })}
      </div>
    </section>
  );
}
