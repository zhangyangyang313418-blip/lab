import { useAppState } from "../../store/appState";

export function EnvironmentPlanBoard() {
  const { state, dispatch } = useAppState();
  const { phases } = state.environmentPlan;

  function handleAddRow(phaseId: string, groupId: string) {
    dispatch({
      type: "addEnvironmentPlanRow",
      phaseId,
      groupId,
      row: {
        id: `manual-row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: "新测试项",
        testHours: "",
        sampleRange: "",
      },
    });
  }

  return (
    <section className="panel environment-plan-board">
      <div className="section-heading">
        <div>
          <p className="section-label">环境可靠性</p>
          <h2>环境变更推荐清单</h2>
          <p className="environment-plan-hint">默认先载入变更推荐清单。你可以在这里删除、补充或调整测试项，第三页大纲会沿用这里的结果。</p>
        </div>
        <span className="status-badge">可直接增删和编辑</span>
      </div>

      <div className="environment-plan-phase-stack">
        {phases.map((phase) => (
          <section key={phase.id} className="environment-plan-phase">
            <h2>{phase.title} 环境测试系统计算表</h2>

            <div className="environment-plan-scroll">
              <div className="environment-plan-summary">
                <div className="environment-plan-summary__cell environment-plan-summary__cell--accent">
                  <span>{phase.summary.projectLabel}</span>
                  <input
                    className="environment-plan-input"
                    value={phase.summary.projectCode}
                    onChange={(event) =>
                      dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "projectCode", value: event.target.value })}
                  />
                </div>
                <div className="environment-plan-summary__cell">
                  <span>{phase.summary.phaseLabel}</span>
                  <input
                    className="environment-plan-input environment-plan-input--center"
                    value={phase.summary.phaseValue}
                    onChange={(event) =>
                      dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "phaseValue", value: event.target.value })}
                  />
                </div>
                <div className="environment-plan-summary__cell">
                  <span>{phase.summary.totalSampleLabel}</span>
                  <input
                    className="environment-plan-input environment-plan-input--center"
                    value={phase.summary.totalSampleQty}
                    onChange={(event) =>
                      dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "totalSampleQty", value: event.target.value })}
                  />
                </div>
                <div className="environment-plan-summary__cell environment-plan-summary__cell--wide">
                  <span>{phase.summary.longestDurationLabel}</span>
                  <input
                    className="environment-plan-input environment-plan-input--center"
                    value={phase.summary.longestDurationDays}
                    onChange={(event) =>
                      dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "longestDurationDays", value: event.target.value })}
                  />
                </div>
                <div className="environment-plan-summary__cell">
                  <span>{phase.summary.totalCostLabel}</span>
                  <input
                    className="environment-plan-input environment-plan-input--center"
                    value={phase.summary.totalCost}
                    onChange={(event) =>
                      dispatch({ type: "updateEnvironmentPlanSummary", phaseId: phase.id, field: "totalCost", value: event.target.value })}
                  />
                </div>
              </div>

              <div className="environment-plan-groups">
                {phase.groups.map((group) => (
                  <section key={group.id} className="environment-plan-group">
                    <div className="environment-plan-group__title">{group.title}</div>
                    <div className="environment-plan-group__totals environment-plan-group__totals--meta">
                      <div className="environment-plan-group__metric environment-plan-group__metric--compact">
                        <span>{group.totalSampleLabel}</span>
                        <input
                          className="environment-plan-input environment-plan-input--center"
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
                      </div>
                      <div className="environment-plan-group__metric">
                        <span>{group.totalDurationLabel}</span>
                        <input
                          className="environment-plan-input environment-plan-input--center"
                          value={group.totalDurationDays}
                          onChange={(event) =>
                            dispatch({
                              type: "updateEnvironmentPlanGroup",
                              phaseId: phase.id,
                              groupId: group.id,
                              field: "totalDurationDays",
                              value: event.target.value,
                            })}
                        />
                      </div>
                    </div>
                    <div className="environment-plan-group__totals environment-plan-group__totals--cost">
                      <span>{group.totalCostLabel}</span>
                      <input
                        className="environment-plan-input environment-plan-input--center"
                        value={group.totalCost}
                        onChange={(event) =>
                          dispatch({
                            type: "updateEnvironmentPlanGroup",
                            phaseId: phase.id,
                            groupId: group.id,
                            field: "totalCost",
                            value: event.target.value,
                          })}
                      />
                    </div>

                    <div className="environment-plan-group__header">
                      <span>测试项目</span>
                      <span>样品编号</span>
                      <span>测试时间 天</span>
                      <span>操作</span>
                    </div>

                    {group.rows.map((row) => (
                      <div key={row.id} className="environment-plan-row">
                        <input
                          aria-label={`${phase.title}-${group.title}-${row.id}-label`}
                          className="environment-plan-input"
                          value={row.label}
                          onChange={(event) =>
                            dispatch({
                              type: "updateEnvironmentPlanRow",
                              phaseId: phase.id,
                              groupId: group.id,
                              rowId: row.id,
                              field: "label",
                              value: event.target.value,
                            })}
                        />
                        <input
                          aria-label={`${phase.title}-${group.title}-${row.id}-sample-range`}
                          className="environment-plan-input environment-plan-input--center"
                          value={row.sampleRange ?? ""}
                          onChange={(event) =>
                            dispatch({
                              type: "updateEnvironmentPlanRow",
                              phaseId: phase.id,
                              groupId: group.id,
                              rowId: row.id,
                              field: "sampleRange",
                              value: event.target.value,
                            })}
                        />
                        <input
                          aria-label={`${phase.title}-${group.title}-${row.id}-hours`}
                          className="environment-plan-input environment-plan-input--center"
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
                        <button
                          type="button"
                          className="secondary-button"
                          aria-label={`删除 ${phase.title} / ${group.title} / ${row.label}`}
                          onClick={() =>
                            dispatch({
                              type: "removeEnvironmentPlanRow",
                              phaseId: phase.id,
                              groupId: group.id,
                              rowId: row.id,
                            })}
                        >
                          删除
                        </button>
                      </div>
                    ))}
                    <div className="form-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => handleAddRow(phase.id, group.id)}
                      >
                        添加 {phase.title} / {group.title} 测试项
                      </button>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
