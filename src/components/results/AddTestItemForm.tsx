import { useEffect, useState, type FormEvent } from "react";
import { useAppState } from "../../store/appState";
import { calculateItemCost } from "../../services/calculationEngine";
import type { EditableTestItem, TestDomain } from "../../types/testing";

interface AddTestItemFormProps {
  domain: TestDomain;
}

function createManualItem(domain: TestDomain, values: {
  code: string;
  nameZh: string;
  sampleQty: number;
  durationValue: number;
  durationUnit: EditableTestItem["durationUnit"];
  unitPrice: number;
  pricingUnit: EditableTestItem["pricingUnit"];
}): EditableTestItem {
  return {
    id: `manual-${domain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    domain,
    code: values.code,
    nameZh: values.nameZh,
    nameEn: values.nameZh,
    category: "自定义",
    standard: "手动添加",
    procedure: "手动录入",
    requirement: "待确认",
    sampleQty: values.sampleQty,
    durationValue: values.durationValue,
    durationUnit: values.durationUnit,
    unitPrice: values.unitPrice,
    pricingUnit: values.pricingUnit,
    cost: 0,
    source: "manual",
    enabled: true,
    editable: true,
    notes: [],
    tags: [],
    reasons: [],
  };
}

export function AddTestItemForm({ domain }: AddTestItemFormProps) {
  const { dispatch } = useAppState();
  const [code, setCode] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [sampleQty, setSampleQty] = useState(1);
  const [durationValue, setDurationValue] = useState(1);
  const [durationUnit, setDurationUnit] = useState<EditableTestItem["durationUnit"]>("hour");
  const [unitPrice, setUnitPrice] = useState(0);
  const [pricingUnit, setPricingUnit] = useState<EditableTestItem["pricingUnit"]>("per_item");

  useEffect(() => {
    setDurationUnit(domain === "material" ? "day" : "hour");
  }, [domain]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const item = createManualItem(domain, {
      code: code.trim(),
      nameZh: nameZh.trim(),
      sampleQty,
      durationValue,
      durationUnit,
      unitPrice,
      pricingUnit,
    });

    dispatch({
      type: "addItem",
      domain,
      item: {
        ...item,
        cost: calculateItemCost(item),
      },
    });

    setCode("");
    setNameZh("");
    setSampleQty(1);
    setDurationValue(1);
    setUnitPrice(0);
    setPricingUnit("per_item");
  }

  return (
    <section className="panel input-section">
      <div className="section-heading">
        <div>
          <p className="section-label">手动新增</p>
          <h2>添加测试项</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="field-grid" style={{ marginTop: 16 }}>
          <label className="field">
            <span className="field__label">代码</span>
            <input
              className="text-input"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">名称</span>
            <input
              className="text-input"
              value={nameZh}
              onChange={(event) => setNameZh(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">数量</span>
            <input
              className="text-input"
              type="number"
              min={0}
              value={sampleQty}
              onChange={(event) => setSampleQty(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span className="field__label">时长</span>
            <input
              className="text-input"
              type="number"
              min={0}
              value={durationValue}
              onChange={(event) => setDurationValue(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span className="field__label">时长单位</span>
            <select
              className="text-input"
              value={durationUnit}
              onChange={(event) => setDurationUnit(event.target.value as EditableTestItem["durationUnit"])}
            >
              <option value="hour">小时</option>
              <option value="day">天</option>
            </select>
          </label>
          <label className="field">
            <span className="field__label">单价</span>
            <input
              className="text-input"
              type="number"
              min={0}
              value={unitPrice}
              onChange={(event) => setUnitPrice(Number(event.target.value))}
            />
          </label>
          <label className="field">
            <span className="field__label">计费方式</span>
            <select
              className="text-input"
              value={pricingUnit}
              onChange={(event) => setPricingUnit(event.target.value as EditableTestItem["pricingUnit"])}
            >
              <option value="per_item">按项</option>
              <option value="per_sample">按样本</option>
              <option value="per_hour">按小时</option>
              <option value="per_material_type">按材料类型</option>
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit">
            添加测试项
          </button>
        </div>
      </form>
    </section>
  );
}
