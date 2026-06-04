# EMA Fee MLA Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable EMA environment outlines to calculate fees with the currently locked MLA fee template while keeping EMA timings and sample ranges.

**Architecture:** Keep the existing shared pricing source in `src/data/seed/mlaFeePricing.ts` and the coefficient basis rules in `src/data/seed/mlaFeeBasis.ts`. Expand platform-gated special fee checks in `src/services/environmentFeeDetail.ts` from MLA-only to MLA-or-EMA where the row labels and group semantics match. Bump local draft template version so stale EMA outlines rebuild from the new seed fee results.

**Tech Stack:** TypeScript, React/Vite, Vitest, Testing Library, localStorage draft migration.

---

## File Structure

- Modify `src/tests/environmentFeeDetail.test.ts`: add service-level EMA fee regression tests that fail before implementation.
- Modify `src/services/environmentFeeDetail.ts`: generalize optical and special-row predicates so EMA rows receive the shared fee calculations.
- Modify `src/services/localStore.ts`: bump `ENVIRONMENT_PLAN_TEMPLATE_VERSION` from `28` to `29`.
- Modify `src/tests/localStore.test.ts`: assert stale EMA drafts refresh to fee-enabled seed outlines.
- Modify `docs/MLA费用交接.md` and `docs/LHD费用说明.md`: record that EMA now temporarily reuses the MLA fee template until Excel rule changes are imported.

---

### Task 1: Add EMA Fee Detail Regression Tests

**Files:**
- Modify: `src/tests/environmentFeeDetail.test.ts`

- [ ] **Step 1: Write the EMA LHD representative fee regression test**

Append this test inside the existing `environment fee detail calculations` describe block, near the existing MLA component tests:

```ts
  it("applies the shared MLA fee template to EMA LHD representative rows", () => {
    const phase: EnvironmentPlanPhase = {
      id: "dv",
      title: "DV",
      summary: {
        projectLabel: "项目",
        projectCode: "L481",
        phaseLabel: "阶段",
        phaseValue: "DV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "65",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "104",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "ema-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "94",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "ea-k1", label: "K1 Low Temperature Exposure", testHours: "2", sampleRange: "1-12" },
            { id: "ea-k17", label: "K17 Audible Noise", testHours: "10", sampleRange: "1-12" },
          ],
        },
        {
          id: "ema-group-b",
          title: "Group B",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "12",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "21",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "eb-k22", label: "K22 Chemical Resistance", testHours: "5", sampleRange: "15-26" }],
        },
        {
          id: "ema-group-c",
          title: "Group C",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "6",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "49",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ec-k26", label: "K26 Mechanical Wear-Out", testHours: "23", sampleRange: "27-32" }],
        },
        {
          id: "ema-group-d3",
          title: "Group D-3",
          totalSampleLabel: "Total样机数量",
          totalSamplePrefix: "PCBA",
          totalSampleQty: "8",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "68",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [
            { id: "ed3-post-l6-internal", label: "L6-photo&xray", testHours: "3", sampleRange: "45-52" },
            { id: "ed3-post-l6-external", label: "L6-SEM&SECTION", testHours: "20", sampleRange: "45-52" },
          ],
        },
        {
          id: "ema-group-e2",
          title: "Group E-2",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "25",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "10",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ee2-item", label: "E-2 Noise test", testHours: "10", sampleRange: "83-107" }],
        },
      ],
    };

    const [groupA, groupB, groupC, groupD3, groupE2] = createEnvironmentFeeDetailSections(phase);

    expect(groupA?.rows.find((row) => row.outlineRowId === "ea-k1")?.estimatedItemFee).toBe(720);
    expect(groupA?.rows.find((row) => row.outlineRowId === "ea-k17")?.estimatedItemFee).toBe(120000);
    expect(groupB?.rows.find((row) => row.outlineRowId === "eb-k22")?.estimatedItemFee).toBe(11190);
    expect(groupC?.rows.find((row) => row.outlineRowId === "ec-k26")?.estimatedItemFee).toBe(7158);
    expect(groupD3?.rows.find((row) => row.outlineRowId === "ed3-post-l6-internal")?.estimatedItemFee).toBe(3200);
    expect(groupD3?.rows.find((row) => row.outlineRowId === "ed3-post-l6-external")?.estimatedItemFee).toBe(21450);
    expect(groupE2?.rows.find((row) => row.outlineRowId === "ee2-item")?.estimatedItemFee).toBe(42500);
  });
```

- [ ] **Step 2: Write the failing EMA optical and RHD E-2 test**

Add this second test after the EMA LHD representative test:

```ts
  it("applies shared optical and E-2 fee rules to EMA rows", () => {
    const phase: EnvironmentPlanPhase = {
      id: "dv-rhd",
      title: "DV",
      summary: {
        projectLabel: "项目",
        projectCode: "L481 RHD",
        phaseLabel: "阶段",
        phaseValue: "DV",
        totalSampleLabel: "样本总数量",
        totalSampleQty: "65",
        longestDurationLabel: "最长测试时间(天)",
        longestDurationDays: "104",
        totalCostLabel: "总费用",
        totalCost: "",
      },
      groups: [
        {
          id: "ema-rhd-group-a",
          title: "Group A",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "14",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "94",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ea-optical", label: "Optical Test", testHours: "7", sampleRange: "1-12" }],
        },
        {
          id: "ema-rhd-group-f2",
          title: "Group E-2",
          totalSampleLabel: "Total样机数量",
          totalSampleQty: "25",
          totalDurationLabel: "组测试时间(天)",
          totalDurationDays: "10",
          totalCostLabel: "组费用",
          totalCost: "",
          rows: [{ id: "ef2-item", label: "Operating Noise & Transient Noise", testHours: "10", sampleRange: "39-63" }],
        },
      ],
    };

    const [groupA, groupE2] = createEnvironmentFeeDetailSections(phase);
    const optical = groupA?.rows.find((row) => row.outlineRowId === "ea-optical");
    const noise = groupE2?.rows.find((row) => row.outlineRowId === "ef2-item");

    expect(optical?.estimatedItemFee).toBe(3570);
    expect(optical?.notes).toContain("Optical Test");
    expect(noise?.estimatedItemFee).toBe(42500);
    expect(noise?.labs).toHaveLength(1);
    expect(noise?.labs[0]?.lab).toBe("SGS");
  });
```

- [ ] **Step 3: Run the focused fee tests and verify the current gap**

Run:

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts
```

Expected: the new EMA optical assertion fails because optical rows are still MLA-only. The representative rows may already pass; keep them as regression coverage for the shared fee table.

---

### Task 2: Generalize EMA Special Fee Predicates

**Files:**
- Modify: `src/services/environmentFeeDetail.ts`

- [ ] **Step 1: Implement shared platform group helpers**

Near the current `isMlaBaselineOpticalRow` helper, add these helpers:

```ts
function isSharedFeeTemplateGroup(group: EnvironmentPlanGroup) {
  return group.id.startsWith("mla-group-") || group.id.startsWith("ema-group-") || group.id.startsWith("ema-rhd-group-");
}

function isBaselineOpticalRow(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  return (group.id === "mla-group-a" && row.id === "a-optical")
    || (group.id === "ema-group-a" && row.id === "ea-optical")
    || (group.id === "ema-rhd-group-a" && row.id === "ea-optical");
}

function isBaselineL1L4Row(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  return (group.id === "mla-group-a" && row.id === "a-l1l4")
    || (group.id === "ema-group-a" && row.id === "ea-l1l4")
    || (group.id === "ema-rhd-group-a" && row.id === "ea-l1l4");
}
```

Then replace `isMlaBaselineOpticalRow(group, row)` call sites with `isBaselineOpticalRow(group, row)`, and replace `isMlaBaselineL1L4Row(group, row)` call sites with `isBaselineL1L4Row(group, row)`.

- [ ] **Step 2: Keep Particle Exposure MLA-only**

Leave `isMlaParticleExposureRow` unchanged:

```ts
function isMlaParticleExposureRow(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  return group.id.startsWith("mla-group-") && /Particle Exposure/i.test(row.label);
}
```

This preserves the spec decision not to add EMA Particle Exposure behavior until the EMA outline contains such rows and pricing is confirmed.

- [ ] **Step 3: Expand optical special rows to EMA**

Replace `isMlaOpticalSpecialRow` with:

```ts
function isSharedOpticalSpecialRow(group: EnvironmentPlanGroup, row: EnvironmentPlanRow) {
  if (!isSharedFeeTemplateGroup(group) || !isOpticalTestRow(row)) {
    return false;
  }

  return isBaselineOpticalRow(group, row)
    || mlaOpticalGroupsWithOne51Point.has(group.title)
    || group.title === "Group D-8";
}
```

Then replace all `isMlaOpticalSpecialRow(group, row)` call sites with `isSharedOpticalSpecialRow(group, row)`.

- [ ] **Step 4: Run the focused fee tests**

Run:

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts
```

Expected: all tests in `environmentFeeDetail.test.ts` pass.

---

### Task 3: Refresh Stale EMA Drafts

**Files:**
- Modify: `src/services/localStore.ts`
- Modify: `src/tests/localStore.test.ts`

- [ ] **Step 1: Add a stale EMA draft fee refresh test**

In `src/tests/localStore.test.ts`, inside the existing `local draft persistence` describe block, add this test after the existing stale EMA RHD draft test:

```ts
  it("refreshes stale EMA drafts to the shared MLA fee template results", () => {
    const state = createSeedAppState();
    const emaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "EMA",
        steeringSides: ["LHD"],
        projectCode: "L481",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...emaDraft,
      environmentPlan: {
        ...emaDraft.environmentPlan,
        phases: emaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          summary: { ...phase.summary, totalCost: "" },
          groups: phase.groups.map((group) => ({
            ...group,
            totalCost: "",
            rows: group.rows.map((row) => ({ ...row, fee: "" })),
          })),
        })),
      },
      environmentPlanVersion: 28,
    });

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");
    const groupA = dvPhase?.groups.find((group) => group.id === "ema-group-a");
    const groupE2 = dvPhase?.groups.find((group) => group.id === "ema-group-e2");

    expect(groupA?.rows.find((row) => row.id === "ea-k1")?.fee).toBe("720");
    expect(groupE2?.rows.find((row) => row.id === "ee2-item")?.fee).toBe("42500");
    expect(dvPhase?.summary.totalCost).not.toBe("");
  });
```

- [ ] **Step 2: Run the localStore test and verify it fails before version bump**

Run:

```bash
npm run test:run -- src/tests/localStore.test.ts
```

Expected: the new test fails because version `28` drafts are still considered current.

- [ ] **Step 3: Bump the template version**

Change `src/services/localStore.ts`:

```ts
export const ENVIRONMENT_PLAN_TEMPLATE_VERSION = 29;
```

- [ ] **Step 4: Run localStore tests**

Run:

```bash
npm run test:run -- src/tests/localStore.test.ts
```

Expected: all `localStore.test.ts` tests pass.

---

### Task 4: Update Fee Handoff Documentation

**Files:**
- Modify: `docs/MLA费用交接.md`
- Modify: `docs/LHD费用说明.md`

- [ ] **Step 1: Update MLA handoff status**

In `docs/MLA费用交接.md`, update the current template version line from `28` to `29`, and add this dated section near the 2026-06-04 entries:

```md
## 2026-06-04 EMA 费用临时复用 MLA 模板

用户确认 EMA 费用先按当前已锁定的 MLA 费用模板计算：

- EMA 保留自己的环境大纲、测试时间、样本范围、LHD/RHD 分组差异
- 费用单价、三家实验室报价、中值取费、特殊项目公式暂时复用 MLA 当前实现
- 当前不导入新的 Excel 费用规则；用户后续会先修改 Excel，再由代码导回价格规则
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `29`，用于刷新旧 EMA 草稿中的空费用
```

- [ ] **Step 2: Update LHD fee explanation**

In `docs/LHD费用说明.md`, add this note under `## 适用范围` after the current conclusion list:

```md
补充结论：

- EMA 费用已临时复用当前 MLA 费用模板；EMA 自身测试时间、样本范围和 RHD/LHD 分组不改
- 后续如果用户修改 Excel 费用规则，应按新 Excel 导回价格，再决定继续共享价格表还是拆分 EMA 独立规则
```

- [ ] **Step 3: Search docs for stale version references**

Run:

```bash
rg -n "ENVIRONMENT_PLAN_TEMPLATE_VERSION = 28|模板版本.*28|版本.*28" docs src
```

Expected: no stale current-version reference remains except historical notes that explicitly describe old versions.

---

### Task 5: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/localStore.test.ts
```

Expected: both files pass.

- [ ] **Step 2: Run environment outline page regression**

Run:

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
```

Expected: pass.

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git diff --stat
git diff -- src/services/environmentFeeDetail.ts src/services/localStore.ts src/tests/environmentFeeDetail.test.ts src/tests/localStore.test.ts docs/MLA费用交接.md docs/LHD费用说明.md
```

Expected: changes are limited to EMA fee reuse, version bump, tests, and docs.

- [ ] **Step 5: Commit implementation**

Run:

```bash
git add src/services/environmentFeeDetail.ts src/services/localStore.ts src/tests/environmentFeeDetail.test.ts src/tests/localStore.test.ts docs/MLA费用交接.md docs/LHD费用说明.md
git commit -m "feat: apply MLA fee template to EMA"
```

Expected: commit succeeds.
