# Environment Fee Detail Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep each DV/PV fee-detail summary visible while hiding its large table by default and allowing independent expand/collapse control.

**Architecture:** Encapsulate the local expanded state inside each `EnvironmentFeeDetailTable` instance so DV and PV remain independent. Always render the summary header and accessible toggle; conditionally mount the existing scrollable table only while expanded, without changing fee data or persistence.

**Tech Stack:** React 18, TypeScript, Testing Library, Vitest, CSS.

---

### Task 1: Lock the collapse behavior with a failing page test

**Files:**
- Modify: `src/tests/environmentOutlinePage.test.tsx:19-42`

- [ ] **Step 1: Replace the always-visible table test with an interaction test**

```tsx
it("keeps DV and PV fee details collapsed by default and expands them independently", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/environment-outline"]}>
      <App />
    </MemoryRouter>,
  );

  const dvToggle = screen.getByRole("button", { name: "展开 DV 费用明细" });
  const pvToggle = screen.getByRole("button", { name: "展开 PV 费用明细" });

  expect(dvToggle).toHaveAttribute("aria-expanded", "false");
  expect(pvToggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("table", { name: "DV 费用细则" })).not.toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "PV 费用细则" })).not.toBeInTheDocument();

  await user.click(dvToggle);

  expect(screen.getByRole("button", { name: "收起 DV 费用明细" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("table", { name: "DV 费用细则" })).toBeInTheDocument();
  expect(screen.queryByRole("table", { name: "PV 费用细则" })).not.toBeInTheDocument();
  expect(screen.getAllByText("实验室单价中值").length).toBeGreaterThan(0);

  await user.click(screen.getByRole("button", { name: "收起 DV 费用明细" }));

  expect(screen.getByRole("button", { name: "展开 DV 费用明细" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("table", { name: "DV 费用细则" })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx -t "keeps DV and PV fee details collapsed"
```

Expected: FAIL because the existing component has no expand buttons and both tables are mounted immediately.

### Task 2: Implement the accessible per-phase toggle

**Files:**
- Modify: `src/components/environment/EnvironmentFeeDetailTable.tsx:1,49-116`
- Modify: `src/styles/global.css:1329-1374`

- [ ] **Step 1: Add local state and accessible control IDs**

Change the React import and initialize state inside the component:

```tsx
import { Fragment, useState } from "react";

export function EnvironmentFeeDetailTable({ phase }: { phase: EnvironmentPlanPhase }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sections = createEnvironmentFeeDetailSections(phase);
  const headingId = `fee-detail-${phase.id}`;
  const contentId = `fee-detail-content-${phase.id}`;
```

- [ ] **Step 2: Render the toggle in the existing heading row**

Keep the current title and meta badges, then add:

```tsx
<button
  type="button"
  className="fee-detail__toggle"
  aria-expanded={isExpanded}
  aria-controls={contentId}
  onClick={() => setIsExpanded((expanded) => !expanded)}
>
  {isExpanded ? `收起 ${phase.title} 费用明细` : `展开 ${phase.title} 费用明细`}
</button>
```

Group the meta badges and button in a `fee-detail__heading-actions` wrapper so the title remains separate from the controls.

- [ ] **Step 3: Conditionally mount and label the existing table**

Wrap the existing scroll/table block without changing its rows or columns:

```tsx
{isExpanded ? (
  <div id={contentId} className="fee-detail__scroll">
    <table className="fee-detail__table" aria-labelledby={headingId}>
      {/* existing thead and tbody unchanged */}
    </table>
  </div>
) : null}
```

- [ ] **Step 4: Style the compact header controls**

Add focused styles consistent with the existing page:

```css
.fee-detail__heading-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.fee-detail__toggle {
  min-height: 38px;
  border: 1px solid #1f5f8b;
  border-radius: 7px;
  padding: 8px 14px;
  background: #123f63;
  color: #fff;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.fee-detail__toggle:hover {
  background: #0d3150;
}

.fee-detail__toggle:focus-visible {
  outline: 3px solid rgba(43, 137, 194, 0.35);
  outline-offset: 2px;
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx -t "keeps DV and PV fee details collapsed"
```

Expected: PASS.

### Task 3: Run regression checks and document the confirmed behavior

**Files:**
- Modify: `docs/LHD费用说明.md`

- [ ] **Step 1: Run the page test suite**

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
```

Expected: all tests in the file PASS. If any existing test expects table content immediately, update it to expand the relevant phase first while preserving its original fee assertion.

- [ ] **Step 2: Add the interaction rule to the fee documentation**

Append this confirmed rule under `展开费用展示规则`:

```markdown
- `/environment-outline` 底部 DV、PV 费用明细默认收起，各阶段使用独立按钮展开或收起；折叠仅影响页面展示，不改变费用计算、导出或本地草稿。
```

- [ ] **Step 3: Run the required focused regression suite**

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/environmentOutlinePage.test.tsx src/tests/environmentOutlineLayout.test.ts src/tests/localStore.test.ts src/tests/environmentPlan.test.ts src/tests/homePage.test.tsx
```

Expected: all selected test files PASS.

- [ ] **Step 4: Build the application**

```bash
npm run build
```

Expected: TypeScript compilation and Vite production build complete successfully.

- [ ] **Step 5: Inspect the targeted diff**

```bash
git diff --check -- src/components/environment/EnvironmentFeeDetailTable.tsx src/styles/global.css src/tests/environmentOutlinePage.test.tsx docs/LHD费用说明.md
git diff --stat -- src/components/environment/EnvironmentFeeDetailTable.tsx src/styles/global.css src/tests/environmentOutlinePage.test.tsx docs/LHD费用说明.md
```

Expected: no whitespace errors; only the four scoped files appear in the implementation diff.

