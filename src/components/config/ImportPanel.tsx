import { useState, type ChangeEvent } from "react";
import { parseImportedWorkbookName, type ImportedWorkbookName } from "../../services/excelImport";

interface SelectedWorkbook {
  fileName: string;
  classification: ImportedWorkbookName;
}

function getKindLabel(kind: ImportedWorkbookName["kind"]): string {
  switch (kind) {
    case "platform_environment":
      return "平台环境";
    case "material_template":
      return "材料模板";
    case "pricing":
      return "报价";
    default:
      return "未识别";
  }
}

export function ImportPanel() {
  const [selectedWorkbook, setSelectedWorkbook] = useState<SelectedWorkbook | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedWorkbook(null);
      return;
    }

    setSelectedWorkbook({
      fileName: file.name,
      classification: parseImportedWorkbookName(file.name),
    });
  }

  return (
    <section className="panel input-section">
      <div className="section-heading">
        <div>
          <p className="section-label">本地导入</p>
          <h2>选择工作簿文件</h2>
        </div>
      </div>

      <div className="field" style={{ marginTop: "16px" }}>
        <label className="field__label" htmlFor="config-workbook-file">
          上传本地文件
        </label>
        <input
          id="config-workbook-file"
          className="text-input"
          type="file"
          accept=".xlsx,.xlsm,.xls"
          onChange={handleFileChange}
        />
      </div>

      <p className="hero-card__copy" style={{ marginTop: "12px" }}>
        这里只做文件名识别和提示，不解析工作簿内容。
      </p>

      <div style={{ marginTop: "16px" }}>
        {selectedWorkbook ? (
          <div className="selector-item">
            <div>
              <div className="selector-item__title">{selectedWorkbook.fileName}</div>
              <div className="selector-item__meta">
                识别结果: {getKindLabel(selectedWorkbook.classification.kind)} · {selectedWorkbook.classification.label}
              </div>
            </div>
          </div>
        ) : (
          <div className="selector-item">
            <div>
              <div className="selector-item__title">尚未选择文件</div>
              <div className="selector-item__meta">请选择一个本地 Excel 文件以查看识别结果。</div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
