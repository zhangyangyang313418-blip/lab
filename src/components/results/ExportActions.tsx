import { useAppState } from "../../store/appState";
import { exportResultsWorkbook } from "../../services/excelExport";
import { exportResultsPdf } from "../../services/pdfExport";

export function ExportActions() {
  const { state, dispatch } = useAppState();
  const confirmed = state.projectSetup.confirmed;

  return (
    <section className="panel input-section">
      <div className="section-heading">
        <div>
          <p className="section-label">导出</p>
          <h2>方案确认与导出</h2>
        </div>
        <span className="status-badge">{confirmed ? "已确认" : "待确认"}</span>
      </div>

      <div className="choice-row" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="primary-button"
          disabled={confirmed}
          onClick={() => dispatch({ type: "confirmPlan" })}
        >
          确认方案
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!confirmed}
          onClick={() => exportResultsWorkbook(state)}
        >
          导出 Excel
        </button>
        <button
          type="button"
          className="primary-button"
          disabled={!confirmed}
          onClick={() => exportResultsPdf(state)}
        >
          导出 PDF
        </button>
      </div>

      {!confirmed ? <p className="selector-item__meta">确认方案后，导出按钮才可用。</p> : null}
    </section>
  );
}
