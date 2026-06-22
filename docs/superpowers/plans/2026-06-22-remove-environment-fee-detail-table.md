# Remove Environment Fee Detail Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the duplicate DV/PV fee-detail tables from `/environment-outline` while preserving phase summaries, per-item fee controls, calculations, and Excel export.

**Architecture:** Stop mounting the table component at the page boundary, then delete the now-unreferenced component and its isolated CSS block. Keep all fee services and export code unchanged; use a page-level regression test to lock both the absence of the duplicate table and the continued presence of the retained fee surfaces.

**Tech Stack:** React 18, TypeScript, Testing Library, Vitest, CSS.

---

### Task 1: Lock the removal behavior with a failing test

**Files:**
- Modify: `src/tests/environmentOutlinePage.test.tsx:19-58`

- [ ] **Step 1: Replace the collapse test with a removal test**

```tsx
it("omits duplicate DV and PV fee detail tables while preserving fee access and export", () => {
  render(
    <MemoryRouter initialEntries={["/environment-outline"]}>
      <App />
    </MemoryRouter>,
  );

  expect(screen.queryByRole("heading", { name: "DV 费用细则" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "PV 费用细则" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "展开 DV 费用明细" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "展开 PV 费用明细" })).not.toBeInTheDocument();
  expect(screen.getAllByLabelText(/fee summary$/)).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "导出 MLA 费用 Excel" })).toHaveLength(2);
  expect(screen.getByRole("button", { name: "DV / Group A / K1 Low Temperature Exposure 费用 ¥720.00" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "PV / Group A / K1 Low Temperature Exposure 费用 ¥720.00" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx -t "omits duplicate DV and PV fee detail tables"
```

Expected: FAIL because the existing collapsed implementation still renders both fee-detail headings and expand buttons.

### Task 2: Remove the duplicate page surface and dead presentation code

**Files:**
- Modify: `src/pages/EnvironmentOutlinePage.tsx:3,1691`
- Delete: `src/components/environment/EnvironmentFeeDetailTable.tsx`
- Modify: `src/styles/global.css:1329-1472`

- [ ] **Step 1: Remove the component import and render call**

Delete:

```tsx
import { EnvironmentFeeDetailTable } from "../components/environment/EnvironmentFeeDetailTable";
```

Delete the phase footer render:

```tsx
{!editable ? <EnvironmentFeeDetailTable phase={phase} /> : null}
```

- [ ] **Step 2: Delete the unused component file**

Remove `src/components/environment/EnvironmentFeeDetailTable.tsx`. Do not modify `src/services/environmentFeeDetail.ts`; the page still uses that service for single-item fees and summaries.

- [ ] **Step 3: Delete the table-only CSS block**

Remove every selector from `.fee-detail` through `.fee-detail__status--pending`, including the collapse button styles. Keep the following unrelated rule as the next rule in the file.

- [ ] **Step 4: Run the focused test and verify GREEN**

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx -t "omits duplicate DV and PV fee detail tables"
```

Expected: PASS, including the assertions that fee summaries, export buttons, and item-fee buttons remain available.

### Task 3: Update the confirmed rule and run regression checks

**Files:**
- Modify: `docs/LHD费用说明.md`

- [ ] **Step 1: Replace the superseded collapse rule**

Replace:

```markdown
- `/environment-outline` 底部 DV、PV 费用明细默认收起，各阶段使用独立按钮展开或收起；折叠仅影响页面展示，不改变费用计算、导出或本地草稿。
```

With:

```markdown
- `/environment-outline` 不再展示底部 DV、PV 费用细则表；费用明细统一通过现有 Excel 模板导出。页面继续保留顶部费用汇总和流程图单项费用按钮，此调整不改变费用计算、导出或本地草稿。
```

- [ ] **Step 2: Run the page regression file**

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
```

Expected: 12 tests PASS.

- [ ] **Step 3: Run the required fee UI regression suite**

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/environmentOutlinePage.test.tsx src/tests/environmentOutlineLayout.test.ts src/tests/localStore.test.ts src/tests/environmentPlan.test.ts src/tests/homePage.test.tsx
```

Expected: 6 test files and 92 tests PASS.

- [ ] **Step 4: Build the application**

```bash
npm run build
```

Expected: TypeScript compilation and Vite production build complete successfully.

- [ ] **Step 5: Verify the targeted diff**

```bash
git diff --check -- docs/LHD费用说明.md src/pages/EnvironmentOutlinePage.tsx src/components/environment/EnvironmentFeeDetailTable.tsx src/styles/global.css src/tests/environmentOutlinePage.test.tsx
git diff --stat -- docs/LHD费用说明.md src/pages/EnvironmentOutlinePage.tsx src/components/environment/EnvironmentFeeDetailTable.tsx src/styles/global.css src/tests/environmentOutlinePage.test.tsx
```

Expected: no whitespace errors; only the page, deleted component, table-only styles, page test, and fee handoff documentation change.

- [ ] **Step 6: Verify the branch preview in a browser**

At `http://127.0.0.1:5174/environment-outline`, confirm no DV/PV fee-detail headings or expand buttons exist, while the fee summaries and export buttons remain visible.

