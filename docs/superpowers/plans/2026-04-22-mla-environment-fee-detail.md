# MLA Environment Fee Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an MLA DV/PV fee detail table beneath the existing environment outline and use its estimated item fees to populate the outline Fee values.

**Architecture:** Keep fee pricing rules in focused data/service files, derive fee detail sections from the current `EnvironmentPlanPhase`, and render them as a horizontal Excel-like table below each phase. The environment plan seed builder will apply the same fee detail calculations so outline Fee, Group Fee, and Total Fee stay aligned with the fee detail table.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, CSS.

---

### File Structure

- Create `src/types/environmentFeeDetail.ts`: fee detail row, lab price, charge basis, and group section types.
- Create `src/data/seed/mlaFeePricing.ts`: MLA L460-L PV-derived seed price database, with special rows marked pending.
- Create `src/services/environmentFeeDetail.ts`: median price, fee calculation, row matching, section derivation, and phase fee application.
- Modify `src/data/seed/environmentPlan.ts`: use fee detail service to apply row fees and group/phase totals.
- Create `src/components/environment/EnvironmentFeeDetailTable.tsx`: render the fee detail table for each phase.
- Modify `src/pages/EnvironmentOutlinePage.tsx`: render the fee detail component below each phase outline.
- Modify `src/styles/global.css`: add stable table layout and responsive overflow styling.
- Add `src/tests/environmentFeeDetail.test.ts`: unit coverage for median and fee rules.
- Update `src/tests/environmentPlan.test.ts`: assert fee detail results are reflected in outline fees.
- Add `src/tests/environmentOutlinePage.test.tsx`: UI coverage for fee detail table placement and content.

### Task 1: Fee Detail Calculation Service

**Files:**
- Create: `src/types/environmentFeeDetail.ts`
- Create: `src/data/seed/mlaFeePricing.ts`
- Create: `src/services/environmentFeeDetail.ts`
- Test: `src/tests/environmentFeeDetail.test.ts`

- [ ] **Step 1: Write failing tests**

Add `src/tests/environmentFeeDetail.test.ts` with tests for:

```ts
import { describe, expect, it } from "vitest";
import { calculateLabMedianUnitPrice, calculateFeeAmount, createEnvironmentFeeDetailSections } from "../services/environmentFeeDetail";
import type { EnvironmentPlanPhase } from "../types/environmentPlan";

describe("environment fee detail calculations", () => {
  it("ignores N/A prices and uses the middle value when three labs quote", () => {
    expect(calculateLabMedianUnitPrice([1750, 6500, 4333, "N/A"])).toBe(4333);
  });

  it("uses the lower valid price when two labs quote", () => {
    expect(calculateLabMedianUnitPrice([1200, "N/A", 900, ""])).toBe(900);
  });

  it("returns null when no lab has a valid numeric quote", () => {
    expect(calculateLabMedianUnitPrice(["N/A", "", undefined])).toBeNull();
  });

  it("calculates fees using hour, quantity, and batch bases", () => {
    expect(calculateFeeAmount(40, "hour", { testHours: 24, quantity: 12, batchCount: 2 })).toBe(960);
    expect(calculateFeeAmount(4333, "quantity", { testHours: 24, quantity: 12, batchCount: 2 })).toBe(51996);
    expect(calculateFeeAmount(5000, "batch", { testHours: 24, quantity: 12, batchCount: 2 })).toBe(10000);
  });

  it("marks pending special rows as unpriced and keeps them out of fee totals", () => {
    const phase: EnvironmentPlanPhase = {
      id: "pv",
      title: "PV",
      summary: {
        projectLabel: "项目",
        projectCode: "L460-L",
        phaseLabel: "阶段",
        phaseValue: "PV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "14",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "101",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "mla-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "101",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "a-particle", label: "Particle Exposure", testHours: "5", sampleRange: "1-12" },
            { id: "a-k1", label: "K1 Low Temperature Exposure", testHours: "2", sampleRange: "1-12" },
          ],
        },
      ],
    };

    const [groupA] = createEnvironmentFeeDetailSections(phase);

    expect(groupA?.rows.find((row) => row.outlineRowId === "a-particle")?.status).toBe("规则待确认");
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-particle")?.estimatedItemFee).toBeNull();
    expect(groupA?.rows.find((row) => row.outlineRowId === "a-k1")?.estimatedItemFee).toBe(1920);
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/tests/environmentFeeDetail.test.ts`

Expected: FAIL because `src/services/environmentFeeDetail` does not exist.

- [ ] **Step 3: Implement types, seed pricing, and service**

Create `src/types/environmentFeeDetail.ts`:

```ts
export type EnvironmentFeeChargeBasis = "hour" | "quantity" | "batch" | "pending";
export type LabPriceValue = number | "N/A" | "";
export type EnvironmentFeeStatus = "priced" | "待确认" | "规则待确认" | "未匹配大纲";

export interface EnvironmentFeeLabQuote {
  lab: "SGS" | "华测" | "苏劢" | "信测";
  unitPrice: LabPriceValue;
  itemFee: number | "N/A" | null;
}

export interface EnvironmentFeePricingRule {
  matcher: RegExp;
  chargeBasis: EnvironmentFeeChargeBasis;
  labs: Record<EnvironmentFeeLabQuote["lab"], LabPriceValue>;
  notes?: string;
}

export interface EnvironmentFeeDetailRow {
  groupId: string;
  groupTitle: string;
  outlineRowId: string;
  testCode: string;
  testName: string;
  testHours: number | null;
  quantity: number | null;
  batchCount: number | null;
  chargeBasis: EnvironmentFeeChargeBasis;
  medianUnitPrice: number | null;
  estimatedItemFee: number | null;
  labs: EnvironmentFeeLabQuote[];
  status: EnvironmentFeeStatus;
  notes?: string;
}

export interface EnvironmentFeeDetailSection {
  groupId: string;
  groupTitle: string;
  totalSampleQty: string;
  rows: EnvironmentFeeDetailRow[];
  totalEstimatedFee: number;
}
```

Create `src/data/seed/mlaFeePricing.ts` with rules for the existing MLA outline rows, including `Particle Exposure` and `K14 Dust Blowing Test` as `pending`.

Create `src/services/environmentFeeDetail.ts` with:

```ts
export function calculateLabMedianUnitPrice(values: Array<number | string | undefined>): number | null
export function calculateFeeAmount(unitPrice: number | null, basis: EnvironmentFeeChargeBasis, base: { testHours: number | null; quantity: number | null; batchCount: number | null }): number | null
export function createEnvironmentFeeDetailSections(phase: EnvironmentPlanPhase): EnvironmentFeeDetailSection[]
export function applyEnvironmentFeeDetailsToPhase(phase: EnvironmentPlanPhase): EnvironmentPlanPhase
```

Key implementation rules:

- Convert displayed outline days to hours by multiplying numeric `row.testHours` by `24`.
- Parse `sampleRange` like `1-12` to a quantity of `12`.
- Fall back to `group.totalSampleQty` when no row sample range exists.
- For pending rules, return `estimatedItemFee: null`.
- Group and phase totals sum only numeric `estimatedItemFee` values.

- [ ] **Step 4: Run tests and verify pass**

Run: `npm run test:run -- src/tests/environmentFeeDetail.test.ts`

Expected: PASS.

### Task 2: Seed Environment Plan Fee Sync

**Files:**
- Modify: `src/data/seed/environmentPlan.ts`
- Test: `src/tests/environmentPlan.test.ts`

- [ ] **Step 1: Write failing tests**

Extend `src/tests/environmentPlan.test.ts`:

```ts
it("syncs MLA PV fee detail estimates into outline row fees and totals", () => {
  const plan = createSeedEnvironmentPlan("MLA", "L460-L", mlaLhdItems);
  const pv = plan.phases.find((phase) => phase.id === "pv");
  const groupA = pv?.groups.find((group) => group.id === "mla-group-a");

  expect(groupA?.rows.find((row) => row.id === "a-k1")?.fee).toBe("1920");
  expect(groupA?.rows.find((row) => row.id === "a-particle")?.fee).toBe("");
  expect(Number(groupA?.totalCost ?? 0)).toBeGreaterThan(0);
  expect(Number(pv?.summary.totalCost ?? 0)).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm run test:run -- src/tests/environmentPlan.test.ts`

Expected: FAIL because `Particle Exposure` currently has a fee from the old median fallback.

- [ ] **Step 3: Replace old fee application**

In `src/data/seed/environmentPlan.ts`, remove the local `EnvironmentQuoteMedian` fee fallback from phase creation and import:

```ts
import { applyEnvironmentFeeDetailsToPhase } from "../../services/environmentFeeDetail";
```

Change `createPhase()` so the returned phase is:

```ts
return applyEnvironmentFeeDetailsToPhase(applyBaselineOpticalSampleRange({ ...phase }));
```

Keep the existing baseline optical sample range logic before fee application.

- [ ] **Step 4: Run tests and verify pass**

Run: `npm run test:run -- src/tests/environmentPlan.test.ts src/tests/environmentFeeDetail.test.ts`

Expected: PASS.

### Task 3: Fee Detail Table UI

**Files:**
- Create: `src/components/environment/EnvironmentFeeDetailTable.tsx`
- Modify: `src/pages/EnvironmentOutlinePage.tsx`
- Modify: `src/styles/global.css`
- Test: `src/tests/environmentOutlinePage.test.tsx`

- [ ] **Step 1: Write failing UI test**

Add `src/tests/environmentOutlinePage.test.tsx`:

```ts
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../App";

describe("environment outline fee detail", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows MLA fee detail below the outline and exposes calculated fee columns", () => {
    render(
      <MemoryRouter initialEntries={["/environment-outline"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "PV 费用细则", level: 2 })).toBeInTheDocument();
    expect(screen.getAllByText("实验室单价中值").length).toBeGreaterThan(0);
    expect(screen.getAllByText("单项费用（预计）").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SGS 单价").length).toBeGreaterThan(0);
    expect(screen.getAllByText("华测 单项费用").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Particle Exposure").length).toBeGreaterThan(0);
    expect(screen.getAllByText("规则待确认").length).toBeGreaterThan(0);
    expect(screen.getAllByText("¥1,920").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test and verify failure**

Run: `npm run test:run -- src/tests/environmentOutlinePage.test.tsx`

Expected: FAIL because `PV 费用细则` is not rendered.

- [ ] **Step 3: Create component and render it**

Create `EnvironmentFeeDetailTable` that calls `createEnvironmentFeeDetailSections(phase)` and renders one horizontally scrollable table per phase. Use `th` labels:

- 项目
- 测试时间 h
- 数量
- 批次
- 实验室单价中值
- 单项费用（预计）
- SGS 单价
- SGS 单项费用
- 华测 单价
- 华测 单项费用
- 苏劢 单价
- 苏劢 单项费用
- 信测 单价
- 信测 单项费用

Modify `PhaseSection` in `src/pages/EnvironmentOutlinePage.tsx` to render:

```tsx
<EnvironmentFeeDetailTable phase={phase} />
```

after the flow chart canvas.

- [ ] **Step 4: Add CSS**

Append `.fee-detail-*` styles to `src/styles/global.css`:

- Full-width panel beneath phase.
- Horizontal overflow for wide tables.
- Blue group header cells.
- Fixed numeric columns with `font-variant-numeric: tabular-nums`.
- Pending status cells in muted amber.

- [ ] **Step 5: Run UI test and verify pass**

Run: `npm run test:run -- src/tests/environmentOutlinePage.test.tsx`

Expected: PASS.

### Task 4: Regression Verification

**Files:**
- No planned production edits unless verification exposes a defect.

- [ ] **Step 1: Run full test suite**

Run: `npm run test:run`

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Manual browser check**

Run: `npm run dev`

Open the Vite URL and verify:

- Environment outline still shows DV and PV flow charts.
- Each phase has a fee detail table below its outline.
- PV table includes `Particle Exposure` as `规则待确认`.
- Regular hourly rows show calculated estimated fees.
- Outline Fee boxes show the same estimated values for priced rows.

### Self-Review

- Spec coverage: The plan covers DV/PV fee detail, page placement below the outline, median price rules, fee calculation, pending special rows, deletion of computer fees, and Fee sync.
- Placeholder scan: No `TBD`, `TODO`, or undefined future tasks remain.
- Type consistency: `EnvironmentFeeChargeBasis`, `EnvironmentFeeDetailRow`, `calculateLabMedianUnitPrice`, `calculateFeeAmount`, `createEnvironmentFeeDetailSections`, and `applyEnvironmentFeeDetailsToPhase` are introduced once and used consistently.
