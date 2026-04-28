# Outline Fee Inline Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make outline Fee read-only and allow double-clicking it to expand a one-time editable median-price calculation panel below the test item.

**Architecture:** Keep persisted environment plan fees as calculated defaults, then layer temporary per-row overrides in `EnvironmentOutlinePage` component state. The inline panel derives defaults from `createEnvironmentFeeDetailSections`, lets the user edit charge basis, unit price, and base quantity, and updates only the current rendered Fee value.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS.

---

### Task 1: Inline Fee Panel UI

**Files:**
- Modify: `src/pages/EnvironmentOutlinePage.tsx`
- Modify: `src/styles/global.css`
- Test: `src/tests/environmentOutlinePage.test.tsx`

- [ ] **Step 1: Write failing test**

Add a UI test that opens a Fee detail by double-clicking the K1 Fee, edits the one-time unit price, sees the Fee update, and confirms no direct Fee textbox exists.

- [ ] **Step 2: Run targeted test**

Run: `npm run test:run -- src/tests/environmentOutlinePage.test.tsx`

Expected: FAIL because the Fee is not double-click expandable.

- [ ] **Step 3: Implement panel**

In `EnvironmentOutlinePage.tsx`, add component-level temporary override state:

```ts
type FeeOverride = {
  chargeBasis: EnvironmentFeeChargeBasis;
  unitPrice: string;
  baseValue: string;
};
```

Render Fee as a button-like read-only element. On double-click, expand `FeeCalculationEditor` below the relevant item. The editor shows charge basis select, unit price input, base input, formula result, and close button.

- [ ] **Step 4: Run targeted test**

Run: `npm run test:run -- src/tests/environmentOutlinePage.test.tsx`

Expected: PASS.

### Task 2: Regression Verification

**Files:**
- No planned production edits unless verification exposes a defect.

- [ ] **Step 1: Run full tests**

Run: `npm run test:run`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS.

### Self-Review

- Covers Fee read-only, double-click expand, one-time editable calculation, and median-only detail.
- Does not persist overrides to seed data, local storage, or quote database.
- Keeps the full lab quote table below the outline.
