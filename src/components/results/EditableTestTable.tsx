import { useAppState } from "../../store/appState";
import { calculateItemCost } from "../../services/calculationEngine";
import type { EditableTestItem, TestDomain } from "../../types/testing";

interface EditableTestTableProps {
  domain: TestDomain;
  items: EditableTestItem[];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function parseNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function EditableTestTable({ domain, items }: EditableTestTableProps) {
  const { dispatch } = useAppState();
  const groupedItems = items.reduce<Record<string, Record<string, EditableTestItem[]>>>((sections, item) => {
    const groupKey = item.templateGroup || item.category || "默认分组";
    const sectionKey = item.templateSection || groupKey;

    sections[sectionKey] ??= {};
    sections[sectionKey][groupKey] ??= [];
    sections[sectionKey][groupKey].push(item);
    return sections;
  }, {});

  return (
    <section className="panel input-section">
      <div className="section-heading">
        <div>
          <p className="section-label">编辑明细</p>
          <h2>{domain === "environment" ? "环境" : domain === "material" ? "材料" : "EMC"}测试项</h2>
        </div>
        <p className="selector-item__meta">{items.length} 条记录</p>
      </div>

      {items.length === 0 ? (
        <p className="helper-text" style={{ marginTop: 16 }}>
          当前还没有推荐测试项。对于变更项目，请先返回输入页填写变更描述或勾选变更项；你也可以直接在下方手动添加测试项。
        </p>
      ) : null}

      <div className="grouped-table-list">
        {Object.entries(groupedItems).map(([sectionName, sectionGroups]) => {
          const groupEntries = Object.entries(sectionGroups);
          const sectionCount = groupEntries.reduce((count, [, groupRows]) => count + groupRows.length, 0);

          return (
            <section key={sectionName} className="template-group-block">
              <div className="template-group-block__header">
                <div>
                  <p className="section-label">模板章节</p>
                  <h3>{sectionName}</h3>
                </div>
                <p className="selector-item__meta">{sectionCount} 条</p>
              </div>

              {groupEntries.map(([groupName, groupRows]) => {
                const showSubgroup = groupName !== sectionName;

                return (
                  <div key={groupName}>
                    {showSubgroup ? (
                      <div className="template-group-block__header" style={{ marginTop: 16 }}>
                        <div>
                          <p className="section-label">模板分组</p>
                          <h3>{groupName}</h3>
                        </div>
                        <p className="selector-item__meta">{groupRows.length} 条</p>
                      </div>
                    ) : null}

                    <div style={{ overflowX: "auto", marginTop: 12 }}>
                      <table>
                        <thead>
                          <tr>
                            <th>启用</th>
                            <th>代码 / 名称</th>
                            <th>数量</th>
                            <th>时长</th>
                            <th>单价</th>
                            <th>费用</th>
                            <th>操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupRows.map((item) => (
                            <tr key={item.id} data-disabled={!item.enabled || undefined}>
                              <td>
                                <input
                                  aria-label={`启用 ${item.code}`}
                                  type="checkbox"
                                  checked={item.enabled}
                                  onChange={(event) =>
                                    dispatch({
                                      type: "updateItem",
                                      domain,
                                      itemId: item.id,
                                      updates: { enabled: event.target.checked },
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <strong>{item.code}</strong>
                                <div className="selector-item__meta">{item.nameZh}</div>
                                <div className="selector-item__meta">{item.nameEn}</div>
                                <div className="selector-item__meta">标准: {item.standard}</div>
                              </td>
                              <td>
                                <input
                                  aria-label={`数量 ${item.code}`}
                                  className="text-input"
                                  type="number"
                                  min={0}
                                  value={item.sampleQty}
                                  onChange={(event) =>
                                    dispatch({
                                      type: "updateItem",
                                      domain,
                                      itemId: item.id,
                                      updates: { sampleQty: parseNumber(event.target.value) },
                                    })
                                  }
                                />
                              </td>
                              <td>
                                <div style={{ display: "grid", gap: 8 }}>
                                  <input
                                    aria-label={`时长 ${item.code}`}
                                    className="text-input"
                                    type="number"
                                    min={0}
                                    value={item.durationValue}
                                    onChange={(event) =>
                                      dispatch({
                                        type: "updateItem",
                                        domain,
                                        itemId: item.id,
                                        updates: { durationValue: parseNumber(event.target.value) },
                                      })
                                    }
                                  />
                                  <select
                                    aria-label={`时长单位 ${item.code}`}
                                    className="text-input"
                                    value={item.durationUnit}
                                    onChange={(event) =>
                                      dispatch({
                                        type: "updateItem",
                                        domain,
                                        itemId: item.id,
                                        updates: { durationUnit: event.target.value as EditableTestItem["durationUnit"] },
                                      })
                                    }
                                  >
                                    <option value="hour">小时</option>
                                    <option value="day">天</option>
                                  </select>
                                </div>
                              </td>
                              <td>
                                <input
                                  aria-label={`单价 ${item.code}`}
                                  className="text-input"
                                  type="number"
                                  min={0}
                                  value={item.unitPrice}
                                  onChange={(event) =>
                                    dispatch({
                                      type: "updateItem",
                                      domain,
                                      itemId: item.id,
                                      updates: { unitPrice: parseNumber(event.target.value) },
                                    })
                                  }
                                />
                              </td>
                              <td>{formatCurrency(calculateItemCost(item))}</td>
                              <td>
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                    dispatch({
                                      type: "removeItem",
                                      domain,
                                      itemId: item.id,
                                    })
                                  }
                                >
                                  删除
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </section>
  );
}
