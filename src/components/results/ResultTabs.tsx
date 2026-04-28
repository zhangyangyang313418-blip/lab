import type { TestDomain } from "../../types/testing";

export type ResultTabKey = TestDomain | "cost";

const tabs: Array<{ domain: ResultTabKey; label: string }> = [
  { domain: "environment", label: "环境" },
  { domain: "material", label: "材料" },
  { domain: "emc", label: "EMC" },
  { domain: "cost", label: "费用预留" },
];

interface ResultTabsProps {
  activeDomain: ResultTabKey;
  onChange: (domain: ResultTabKey) => void;
}

export function ResultTabs({ activeDomain, onChange }: ResultTabsProps) {
  return (
    <section className="panel input-section">
      <div className="section-heading">
        <div>
          <p className="section-label">测试明细</p>
          <h2>按领域查看</h2>
        </div>
      </div>

      <div role="tablist" aria-label="结果领域" className="choice-row" style={{ marginTop: 16 }}>
        {tabs.map((tab) => {
          const selected = tab.domain === activeDomain;

          return (
            <button
              key={tab.domain}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={tab.label}
              className="choice-pill"
              onClick={() => onChange(tab.domain)}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
