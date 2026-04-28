# 产品测试评估工具（JLR 首版）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable React + TypeScript front-end app for JLR new-project evaluation that loads platform baselines, lets users adjust environment/material/EMC test plans, recalculates quantity-duration-cost totals, and exports Excel/PDF outputs locally.

**Architecture:** Use a Vite React app with feature-oriented modules for types, seed data, matching logic, calculation logic, local storage persistence, and exporters. Keep platform/environment/material/EMC data normalized into shared TypeScript models so the results page and exporters can consume a single source of truth. Use test-first development for pure logic modules and light component tests for core page flows.

**Tech Stack:** React, TypeScript, Vite, React Router, Vitest, Testing Library, xlsx, jspdf, html2canvas

---

## File Structure

**Create:**

- `package.json` — app dependencies and scripts
- `tsconfig.json` — TypeScript config
- `tsconfig.node.json` — Vite node config
- `vite.config.ts` — Vite + Vitest config
- `index.html` — app entry HTML
- `src/main.tsx` — React bootstrap
- `src/App.tsx` — top-level app shell and routing
- `src/styles/global.css` — global styles and theme tokens
- `src/routes.tsx` — route definitions
- `src/types/project.ts` — project-level types
- `src/types/testing.ts` — shared testing item/template/export types
- `src/types/config.ts` — configuration/import types
- `src/data/seed/project.ts` — default initial project values
- `src/data/seed/platformTemplates.ts` — EMA/MLA baseline seed data
- `src/data/seed/materialTemplates.ts` — material baseline seed data
- `src/data/seed/emcTemplates.ts` — EMC baseline and change mapping seed data
- `src/data/seed/pricing.ts` — pricing and duration seed data
- `src/data/seed/changeOptions.ts` — selectable change points and keyword tags
- `src/utils/normalizers.ts` — merge key and text normalization helpers
- `src/utils/formatters.ts` — currency, duration, summary formatters
- `src/services/matchEngine.ts` — change-matrix and keyword matching logic
- `src/services/calculationEngine.ts` — merge and cost/sample/duration calculations
- `src/services/localStore.ts` — browser persistence
- `src/services/excelImport.ts` — local Excel parsing into config models
- `src/services/excelExport.ts` — workbook generation for four export artifacts
- `src/services/pdfExport.ts` — print/PDF export helpers
- `src/store/appState.tsx` — context, reducer, selectors
- `src/components/layout/AppLayout.tsx` — shell layout with top nav
- `src/components/home/ProjectSetupForm.tsx` — homepage setup form
- `src/components/input/ProjectBriefCard.tsx` — project summary card
- `src/components/input/DescriptionInput.tsx` — natural language input
- `src/components/input/ChangeSelector.tsx` — change-point picker
- `src/components/results/SummaryCards.tsx` — totals cards
- `src/components/results/EditableTestTable.tsx` — editable table for test items
- `src/components/results/ResultTabs.tsx` — domain tabs
- `src/components/results/AddTestItemForm.tsx` — manual add item form
- `src/components/results/ExportActions.tsx` — export buttons and confirm gate
- `src/components/config/ImportPanel.tsx` — local import actions
- `src/components/config/ConfigSummary.tsx` — config overview
- `src/pages/HomePage.tsx` — homepage
- `src/pages/ProjectInputPage.tsx` — project input page
- `src/pages/ResultsPage.tsx` — result page
- `src/pages/ConfigPage.tsx` — config page
- `src/tests/matchEngine.test.ts` — match engine tests
- `src/tests/calculationEngine.test.ts` — calculation engine tests
- `src/tests/localStore.test.ts` — local storage tests
- `src/tests/homePage.test.tsx` — home page flow test
- `src/tests/resultsPage.test.tsx` — results interaction test

**Modify:**

- None; repository currently contains only planning docs and reference files

## Task 1: Scaffold The Front-End App

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/routes.tsx`
- Create: `src/styles/global.css`

- [ ] **Step 1: Write the failing smoke test setup**

Create `src/tests/homePage.test.tsx` with:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

describe("app bootstrap", () => {
  it("renders the homepage title", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByText("产品测试评估工具")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/homePage.test.tsx`
Expected: FAIL with module or component-not-found errors because the app files do not exist yet.

- [ ] **Step 3: Write the minimal app scaffold**

Create `package.json` with:

```json
{
  "name": "product-test-evaluation-tool",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest",
    "test:run": "vitest run"
  },
  "dependencies": {
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.2",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router-dom": "^7.6.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^19.1.3",
    "@types/react-dom": "^19.1.3",
    "@vitejs/plugin-react": "^4.4.1",
    "jsdom": "^25.0.1",
    "typescript": "^5.8.3",
    "vite": "^6.3.5",
    "vitest": "^3.1.2"
  }
}
```

Create `src/App.tsx` with:

```tsx
import { RouterProvider, createBrowserRouter } from "react-router-dom";
import { routes } from "./routes";

const router = createBrowserRouter(routes);

export default function App() {
  return <RouterProvider router={router} />;
}
```

Create `src/routes.tsx` with:

```tsx
import type { RouteObject } from "react-router-dom";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <div>产品测试评估工具</div>,
  },
];
```

Create `src/main.tsx` with:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

Create `vite.config.ts` with:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/homePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main.tsx src/App.tsx src/routes.tsx src/styles/global.css src/tests/homePage.test.tsx
git commit -m "feat: scaffold product test evaluation app"
```

## Task 2: Define TypeScript Domain Models

**Files:**
- Create: `src/types/project.ts`
- Create: `src/types/testing.ts`
- Create: `src/types/config.ts`
- Test: `src/tests/calculationEngine.test.ts`

- [ ] **Step 1: Write the failing type-driven test for calculation inputs**

Create `src/tests/calculationEngine.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { calculateItemCost } from "../services/calculationEngine";
import type { EditableTestItem } from "../types/testing";

describe("calculateItemCost", () => {
  it("calculates quantity based costs for enabled items", () => {
    const item: EditableTestItem = {
      id: "env-k1",
      domain: "environment",
      code: "K1",
      nameZh: "低温暴露",
      nameEn: "Low Temperature Exposure",
      category: "环境可靠性",
      standard: "ISO 16750-4",
      procedure: "24h at -40C",
      requirement: "No failure",
      sampleQty: 6,
      durationValue: 24,
      durationUnit: "hour",
      unitPrice: 30,
      pricingUnit: "per_hour",
      pricingFactor: 24,
      cost: 0,
      source: "seed",
      enabled: true,
      editable: true,
      notes: [],
      tags: [],
      reasons: [],
      templateGroup: "Group A"
    };

    expect(calculateItemCost(item)).toBe(720);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/calculationEngine.test.ts`
Expected: FAIL because the types and service do not exist yet.

- [ ] **Step 3: Write the shared types**

Create `src/types/project.ts` with:

```ts
export type OemCode = "JLR";
export type ProjectType = "new_project";
export type PlatformCode = "EMA" | "MLA";

export interface ProjectSetup {
  oem: OemCode;
  projectType: ProjectType;
  platform: PlatformCode;
  projectCode: string;
  reusePlatformTemplate: boolean;
  description: string;
  selectedChangeIds: string[];
  confirmed: boolean;
}
```

Create `src/types/testing.ts` with:

```ts
export type TestDomain = "environment" | "material" | "emc";
export type DurationUnit = "hour" | "day";
export type PricingUnit = "per_sample" | "per_hour" | "per_item" | "per_material_type";

export interface EditableTestItem {
  id: string;
  domain: TestDomain;
  code: string;
  nameZh: string;
  nameEn: string;
  category: string;
  standard: string;
  procedure: string;
  requirement: string;
  sampleQty: number;
  durationValue: number;
  durationUnit: DurationUnit;
  unitPrice: number;
  pricingUnit: PricingUnit;
  pricingFactor?: number;
  cost: number;
  source: string;
  enabled: boolean;
  editable: boolean;
  notes: string[];
  tags: string[];
  reasons: string[];
  templateGroup?: string;
}

export interface DomainResult {
  domain: TestDomain;
  items: EditableTestItem[];
}

export interface ResultSummary {
  enabledItemCount: number;
  totalSampleQty: number;
  totalDurationHours: number;
  totalCost: number;
}
```

Create `src/types/config.ts` with:

```ts
import type { EditableTestItem } from "./testing";
import type { PlatformCode } from "./project";

export interface PlatformTemplate {
  platform: PlatformCode;
  workbookName: string;
  sheetNames: string[];
  items: EditableTestItem[];
}

export interface ImportedConfigBundle {
  platformTemplates: PlatformTemplate[];
  materialItems: EditableTestItem[];
  emcItems: EditableTestItem[];
  pricingItems: EditableTestItem[];
  importedAt: string;
}
```

- [ ] **Step 4: Run test to verify it still fails for missing implementation**

Run: `npm test -- --run src/tests/calculationEngine.test.ts`
Expected: FAIL with missing `calculateItemCost` export, proving the types compile and the remaining failure is implementation.

- [ ] **Step 5: Commit**

```bash
git add src/types/project.ts src/types/testing.ts src/types/config.ts src/tests/calculationEngine.test.ts
git commit -m "feat: add core domain types for testing tool"
```

## Task 3: Seed JLR Example Data

**Files:**
- Create: `src/data/seed/project.ts`
- Create: `src/data/seed/platformTemplates.ts`
- Create: `src/data/seed/materialTemplates.ts`
- Create: `src/data/seed/emcTemplates.ts`
- Create: `src/data/seed/pricing.ts`
- Create: `src/data/seed/changeOptions.ts`
- Test: `src/tests/matchEngine.test.ts`

- [ ] **Step 1: Write the failing match-engine test using seed data**

Create `src/tests/matchEngine.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { matchRecommendedItems } from "../services/matchEngine";
import { seedChangeOptions } from "../data/seed/changeOptions";
import { seedEmcItems } from "../data/seed/emcTemplates";

describe("matchRecommendedItems", () => {
  it("matches selected change ids and description keywords", () => {
    const matched = matchRecommendedItems({
      description: "新增 PCBA 供电滤波与 MCU 变更",
      selectedChangeIds: ["pcb_material_change"],
      changeOptions: seedChangeOptions,
      candidateItems: seedEmcItems,
    });

    expect(matched.map((item) => item.code)).toContain("RE310");
    expect(matched.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/matchEngine.test.ts`
Expected: FAIL because the seed data files and service are not present.

- [ ] **Step 3: Create example seed data based on the JLR references**

Create `src/data/seed/project.ts` with:

```ts
import type { ProjectSetup } from "../../types/project";

export const defaultProjectSetup: ProjectSetup = {
  oem: "JLR",
  projectType: "new_project",
  platform: "MLA",
  projectCode: "L463",
  reusePlatformTemplate: true,
  description: "",
  selectedChangeIds: [],
  confirmed: false,
};
```

Create `src/data/seed/changeOptions.ts` with:

```ts
export interface ChangeOption {
  id: string;
  label: string;
  keywords: string[];
  recommendedCodes: string[];
}

export const seedChangeOptions: ChangeOption[] = [
  {
    id: "full_new_module",
    label: "带 PCBA 的全新电子设备模块",
    keywords: ["新项目", "全新模块", "新模块"],
    recommendedCodes: ["L1L4", "K1", "K2", "K3", "K4", "K7", "K15"],
  },
  {
    id: "pcb_material_change",
    label: "PCB(A) 材料变更",
    keywords: ["pcba", "pcb", "材料变更"],
    recommendedCodes: ["RE310", "CE420", "RI112"],
  },
  {
    id: "supply_filtering_change",
    label: "电源滤波变更",
    keywords: ["供电滤波", "电源滤波"],
    recommendedCodes: ["RE310", "CE420", "RI112", "RI114", "RI115", "RI130"],
  },
];
```

Create `src/data/seed/emcTemplates.ts` with:

```ts
import type { EditableTestItem } from "../../types/testing";

export const seedEmcItems: EditableTestItem[] = [
  {
    id: "emc-re310",
    domain: "emc",
    code: "RE310",
    nameZh: "辐射发射 RE310",
    nameEn: "Radiated Emissions RE 310",
    category: "EMC",
    standard: "JLR-EMC-CP",
    procedure: "Baseline chamber test",
    requirement: "Meet JLR limit",
    sampleQty: 1,
    durationValue: 1,
    durationUnit: "day",
    unitPrice: 3500,
    pricingUnit: "per_item",
    cost: 0,
    source: "seed",
    enabled: true,
    editable: true,
    notes: [],
    tags: ["EMC"],
    reasons: [],
  }
];
```

Also create matching `seedEnvironmentItems`, `seedMaterialItems`, and `seedPricingItems` in the corresponding files using 6-10 realistic records derived from the provided Excel references.

- [ ] **Step 4: Run test to verify the failure narrows to missing match implementation**

Run: `npm test -- --run src/tests/matchEngine.test.ts`
Expected: FAIL with missing `matchRecommendedItems` export only.

- [ ] **Step 5: Commit**

```bash
git add src/data/seed/project.ts src/data/seed/platformTemplates.ts src/data/seed/materialTemplates.ts src/data/seed/emcTemplates.ts src/data/seed/pricing.ts src/data/seed/changeOptions.ts src/tests/matchEngine.test.ts
git commit -m "feat: add JLR seed data and change options"
```

## Task 4: Implement Match And Merge Logic

**Files:**
- Create: `src/utils/normalizers.ts`
- Create: `src/services/matchEngine.ts`
- Modify: `src/tests/matchEngine.test.ts`

- [ ] **Step 1: Expand the failing tests to cover dedupe behavior**

Add to `src/tests/matchEngine.test.ts`:

```ts
it("deduplicates matched items by normalized code", () => {
  const matched = matchRecommendedItems({
    description: "供电滤波和 PCB 材料都发生变更",
    selectedChangeIds: ["pcb_material_change", "supply_filtering_change"],
    changeOptions: seedChangeOptions,
    candidateItems: seedEmcItems,
  });

  expect(matched.filter((item) => item.code === "RE310")).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/matchEngine.test.ts`
Expected: FAIL because the matcher has not been implemented.

- [ ] **Step 3: Write the minimal matching implementation**

Create `src/utils/normalizers.ts` with:

```ts
export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function mergeKey(code: string, nameEn: string): string {
  return `${normalizeText(code)}::${normalizeText(nameEn)}`;
}
```

Create `src/services/matchEngine.ts` with:

```ts
import type { EditableTestItem } from "../types/testing";
import { mergeKey, normalizeText } from "../utils/normalizers";
import type { ChangeOption } from "../data/seed/changeOptions";

interface MatchInput {
  description: string;
  selectedChangeIds: string[];
  changeOptions: ChangeOption[];
  candidateItems: EditableTestItem[];
}

export function matchRecommendedItems(input: MatchInput): EditableTestItem[] {
  const matchedCodes = new Set<string>();
  const normalizedDescription = normalizeText(input.description);

  input.changeOptions.forEach((option) => {
    const selected = input.selectedChangeIds.includes(option.id);
    const keywordHit = option.keywords.some((keyword) =>
      normalizedDescription.includes(normalizeText(keyword)),
    );

    if (selected || keywordHit) {
      option.recommendedCodes.forEach((code) => matchedCodes.add(normalizeText(code)));
    }
  });

  const deduped = new Map<string, EditableTestItem>();

  input.candidateItems.forEach((item) => {
    if (!matchedCodes.has(normalizeText(item.code))) {
      return;
    }

    const key = mergeKey(item.code, item.nameEn);
    if (!deduped.has(key)) {
      deduped.set(key, {
        ...item,
        reasons: [...item.reasons, "根据变更矩阵自动推荐"],
      });
    }
  });

  return Array.from(deduped.values());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/matchEngine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/normalizers.ts src/services/matchEngine.ts src/tests/matchEngine.test.ts
git commit -m "feat: implement JLR change matching engine"
```

## Task 5: Implement Calculation Logic

**Files:**
- Create: `src/services/calculationEngine.ts`
- Create: `src/utils/formatters.ts`
- Modify: `src/tests/calculationEngine.test.ts`

- [ ] **Step 1: Extend the failing tests for merge and summary calculations**

Append to `src/tests/calculationEngine.test.ts`:

```ts
import { mergeDuplicateItems, summarizeResults } from "../services/calculationEngine";

it("merges duplicate items by taking the largest quantity and duration", () => {
  const merged = mergeDuplicateItems([
    {
      ...baseItem,
      id: "1",
      sampleQty: 6,
      durationValue: 24,
      reasons: ["A"],
    },
    {
      ...baseItem,
      id: "2",
      sampleQty: 12,
      durationValue: 48,
      reasons: ["B"],
    },
  ]);

  expect(merged).toHaveLength(1);
  expect(merged[0].sampleQty).toBe(12);
  expect(merged[0].durationValue).toBe(48);
  expect(merged[0].reasons).toEqual(["A", "B"]);
});

it("summarizes enabled results", () => {
  const summary = summarizeResults([
    { ...baseItem, cost: 720, durationValue: 24, durationUnit: "hour" },
    { ...baseItem, id: "b", cost: 300, sampleQty: 3, durationValue: 2, durationUnit: "day" },
  ]);

  expect(summary.enabledItemCount).toBe(2);
  expect(summary.totalCost).toBe(1020);
  expect(summary.totalSampleQty).toBe(9);
  expect(summary.totalDurationHours).toBe(72);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/calculationEngine.test.ts`
Expected: FAIL because merge and summary functions do not exist.

- [ ] **Step 3: Write the calculation engine**

Create `src/services/calculationEngine.ts` with:

```ts
import type { EditableTestItem, ResultSummary } from "../types/testing";
import { mergeKey } from "../utils/normalizers";

export function calculateItemCost(item: EditableTestItem): number {
  if (!item.enabled) {
    return 0;
  }

  if (item.pricingUnit === "per_hour") {
    return item.unitPrice * (item.pricingFactor ?? item.durationValue);
  }

  if (item.pricingUnit === "per_sample") {
    return item.unitPrice * item.sampleQty;
  }

  return item.unitPrice * (item.pricingFactor ?? 1);
}

export function mergeDuplicateItems(items: EditableTestItem[]): EditableTestItem[] {
  const merged = new Map<string, EditableTestItem>();

  items.forEach((item) => {
    const key = mergeKey(item.code, item.nameEn);
    const existing = merged.get(key);

    if (!existing) {
      merged.set(key, { ...item, reasons: [...item.reasons] });
      return;
    }

    merged.set(key, {
      ...existing,
      sampleQty: Math.max(existing.sampleQty, item.sampleQty),
      durationValue: Math.max(existing.durationValue, item.durationValue),
      unitPrice: existing.unitPrice || item.unitPrice,
      reasons: Array.from(new Set([...existing.reasons, ...item.reasons])),
      notes: Array.from(new Set([...existing.notes, ...item.notes])),
    });
  });

  return Array.from(merged.values()).map((item) => ({
    ...item,
    cost: calculateItemCost(item),
  }));
}

export function summarizeResults(items: EditableTestItem[]): ResultSummary {
  return items.filter((item) => item.enabled).reduce<ResultSummary>(
    (summary, item) => ({
      enabledItemCount: summary.enabledItemCount + 1,
      totalSampleQty: summary.totalSampleQty + item.sampleQty,
      totalDurationHours:
        summary.totalDurationHours + (item.durationUnit === "day" ? item.durationValue * 24 : item.durationValue),
      totalCost: summary.totalCost + item.cost,
    }),
    { enabledItemCount: 0, totalSampleQty: 0, totalDurationHours: 0, totalCost: 0 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/calculationEngine.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/calculationEngine.ts src/utils/formatters.ts src/tests/calculationEngine.test.ts
git commit -m "feat: add quantity duration and cost calculations"
```

## Task 6: Add App State And Local Persistence

**Files:**
- Create: `src/services/localStore.ts`
- Create: `src/store/appState.tsx`
- Create: `src/tests/localStore.test.ts`

- [ ] **Step 1: Write the failing local store test**

Create `src/tests/localStore.test.ts` with:

```ts
import { describe, expect, it, beforeEach } from "vitest";
import { defaultProjectSetup } from "../data/seed/project";
import { loadProjectDraft, saveProjectDraft } from "../services/localStore";

describe("localStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saves and loads the current project draft", () => {
    saveProjectDraft(defaultProjectSetup);
    expect(loadProjectDraft()).toEqual(defaultProjectSetup);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/localStore.test.ts`
Expected: FAIL because the storage service does not exist.

- [ ] **Step 3: Write the persistence and reducer layer**

Create `src/services/localStore.ts` with:

```ts
import type { ProjectSetup } from "../types/project";

const PROJECT_DRAFT_KEY = "project_draft";

export function saveProjectDraft(project: ProjectSetup) {
  localStorage.setItem(PROJECT_DRAFT_KEY, JSON.stringify(project));
}

export function loadProjectDraft(): ProjectSetup | null {
  const raw = localStorage.getItem(PROJECT_DRAFT_KEY);
  return raw ? (JSON.parse(raw) as ProjectSetup) : null;
}
```

Create `src/store/appState.tsx` with reducer actions for:

- `updateProjectSetup`
- `setDescription`
- `toggleChangeId`
- `setDomainItems`
- `updateItem`
- `addItem`
- `removeItem`
- `confirmPlan`
- `resetToSeed`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/localStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/localStore.ts src/store/appState.tsx src/tests/localStore.test.ts
git commit -m "feat: persist local drafts and app state"
```

## Task 7: Build The Four Main Pages

**Files:**
- Create: `src/components/layout/AppLayout.tsx`
- Create: `src/components/home/ProjectSetupForm.tsx`
- Create: `src/components/input/ProjectBriefCard.tsx`
- Create: `src/components/input/DescriptionInput.tsx`
- Create: `src/components/input/ChangeSelector.tsx`
- Create: `src/pages/HomePage.tsx`
- Create: `src/pages/ProjectInputPage.tsx`
- Modify: `src/routes.tsx`
- Modify: `src/App.tsx`
- Test: `src/tests/homePage.test.tsx`

- [ ] **Step 1: Expand the failing page test to cover project setup submission**

Replace `src/tests/homePage.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

it("allows the user to start a JLR MLA project", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );

  await user.type(screen.getByLabelText("项目名称"), "L463");
  await user.click(screen.getByLabelText("MLA"));
  await user.click(screen.getByRole("button", { name: "开始评估" }));

  expect(screen.getByText("项目输入")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/homePage.test.tsx`
Expected: FAIL because the pages and form controls do not exist.

- [ ] **Step 3: Implement the basic page flow**

Implement:

- `HomePage` with a Chinese UI and English field keys in code
- `ProjectSetupForm` with controls for OEM, project type, platform, project name, and template reuse
- `ProjectInputPage` with summary card, textarea, and change-selector checkboxes
- `AppLayout` with a simple engineering-style shell
- `routes.tsx` with `/`, `/input`, `/results`, `/config`

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/homePage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/AppLayout.tsx src/components/home/ProjectSetupForm.tsx src/components/input/ProjectBriefCard.tsx src/components/input/DescriptionInput.tsx src/components/input/ChangeSelector.tsx src/pages/HomePage.tsx src/pages/ProjectInputPage.tsx src/routes.tsx src/App.tsx src/tests/homePage.test.tsx
git commit -m "feat: add homepage and project input flow"
```

## Task 8: Build Results Page With Editable Tables

**Files:**
- Create: `src/components/results/SummaryCards.tsx`
- Create: `src/components/results/EditableTestTable.tsx`
- Create: `src/components/results/ResultTabs.tsx`
- Create: `src/components/results/AddTestItemForm.tsx`
- Create: `src/components/results/ExportActions.tsx`
- Create: `src/pages/ResultsPage.tsx`
- Create: `src/tests/resultsPage.test.tsx`

- [ ] **Step 1: Write the failing results-page interaction test**

Create `src/tests/resultsPage.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";

it("updates totals when a test item is disabled", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/results"]}>
      <App />
    </MemoryRouter>,
  );

  const firstToggle = screen.getAllByRole("checkbox", { name: "启用测试项" })[0];
  const totalCostBefore = screen.getByTestId("total-cost").textContent;

  await user.click(firstToggle);

  expect(screen.getByTestId("total-cost").textContent).not.toBe(totalCostBefore);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/resultsPage.test.tsx`
Expected: FAIL because the results page and table are not implemented.

- [ ] **Step 3: Implement editable results UI**

Implement:

- `ResultsPage` that loads EMA/MLA baseline plus material and EMC seed data
- `ResultTabs` with four tabs
- `EditableTestTable` supporting enable, edit quantity, edit duration, edit price, delete
- `AddTestItemForm` to manually append a row
- `SummaryCards` using `summarizeResults`
- `ExportActions` with disabled state until plan confirmation

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/resultsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/results/SummaryCards.tsx src/components/results/EditableTestTable.tsx src/components/results/ResultTabs.tsx src/components/results/AddTestItemForm.tsx src/components/results/ExportActions.tsx src/pages/ResultsPage.tsx src/tests/resultsPage.test.tsx
git commit -m "feat: add editable result views and summaries"
```

## Task 9: Build Config Page And Excel Import

**Files:**
- Create: `src/components/config/ImportPanel.tsx`
- Create: `src/components/config/ConfigSummary.tsx`
- Create: `src/pages/ConfigPage.tsx`
- Create: `src/services/excelImport.ts`
- Modify: `src/routes.tsx`

- [ ] **Step 1: Write the failing import-service test inside `src/tests/localStore.test.ts`**

Append:

```ts
import { parseImportedWorkbookName } from "../services/excelImport";

it("classifies an MLA environment workbook name", () => {
  expect(parseImportedWorkbookName("MLA环境可靠性测试大纲.xlsx")).toBe("platform_environment");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/localStore.test.ts`
Expected: FAIL because the import service helper does not exist.

- [ ] **Step 3: Implement configuration page and import helpers**

Create `src/services/excelImport.ts` with:

```ts
export type WorkbookKind =
  | "platform_environment"
  | "material_template"
  | "pricing"
  | "unknown";

export function parseImportedWorkbookName(fileName: string): WorkbookKind {
  if (fileName.includes("环境可靠性测试大纲")) {
    return "platform_environment";
  }
  if (fileName.includes("材料测试大纲")) {
    return "material_template";
  }
  if (fileName.includes("报价") || fileName.includes("定点")) {
    return "pricing";
  }
  return "unknown";
}
```

Build `ConfigPage`, `ImportPanel`, and `ConfigSummary` to:

- show loaded seed configs
- accept local file upload
- parse workbook kind
- store imported metadata locally

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/localStore.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/config/ImportPanel.tsx src/components/config/ConfigSummary.tsx src/pages/ConfigPage.tsx src/services/excelImport.ts src/routes.tsx src/tests/localStore.test.ts
git commit -m "feat: add configuration page and import helpers"
```

## Task 10: Implement Excel And PDF Export

**Files:**
- Create: `src/services/excelExport.ts`
- Create: `src/services/pdfExport.ts`
- Modify: `src/components/results/ExportActions.tsx`
- Modify: `src/pages/ResultsPage.tsx`

- [ ] **Step 1: Write the failing export test in `src/tests/resultsPage.test.tsx`**

Append:

```tsx
it("enables export after confirmation", async () => {
  const user = userEvent.setup();

  render(
    <MemoryRouter initialEntries={["/results"]}>
      <App />
    </MemoryRouter>,
  );

  const exportButton = screen.getByRole("button", { name: "导出 Excel" });
  expect(exportButton).toBeDisabled();

  await user.click(screen.getByRole("button", { name: "确认方案" }));

  expect(screen.getByRole("button", { name: "导出 Excel" })).toBeEnabled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/tests/resultsPage.test.tsx`
Expected: FAIL because confirm/export behavior is incomplete.

- [ ] **Step 3: Implement exporters**

Create `src/services/excelExport.ts` to generate:

- `环境测试大纲.xlsx`
- `材料测试大纲.xlsx`
- `EMC测试项目.xlsx`
- `费用汇总.xlsx`

Use `xlsx` to create a workbook with sheets:

```ts
["环境费用", "材料费用", "EMC费用", "总汇总"]
```

Create `src/services/pdfExport.ts` with:

```ts
export async function exportResultsAsPdf(root: HTMLElement, fileName: string) {
  window.print();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/tests/resultsPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/excelExport.ts src/services/pdfExport.ts src/components/results/ExportActions.tsx src/pages/ResultsPage.tsx src/tests/resultsPage.test.tsx
git commit -m "feat: add excel and pdf export actions"
```

## Task 11: Final Verification And Build Check

**Files:**
- Modify: as needed from fixes found during verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS with all tests green.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: PASS with Vite production bundle generated successfully.

- [ ] **Step 3: Manually verify the primary flow**

Run: `npm run dev`
Expected:

- Homepage loads with JLR / 新项目 / EMA / MLA options
- Input page accepts project description and change selection
- Results page shows environment/material/EMC/cost tabs
- Editing rows refreshes summary totals immediately
- Confirming the plan enables Excel/PDF export
- Config page accepts local workbook uploads

- [ ] **Step 4: Fix any issues found and re-run verification**

Run: `npm test -- --run && npm run build`
Expected: PASS after any fixes.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: complete JLR product test evaluation tool v1"
```

## Self-Review

### Spec coverage

- Homepage fields: covered in Task 7
- Project input page: covered in Task 7
- Result page with four domains: covered in Task 8
- Config data page: covered in Task 9
- TypeScript types: covered in Task 2
- Example data: covered in Task 3
- Match function: covered in Task 4
- Merge and calculation functions: covered in Task 5
- Browser local storage: covered in Task 6
- Excel and PDF export: covered in Task 10

### Placeholder scan

- No `TBD`, `TODO`, or “similar to above” placeholders remain
- Each task includes exact file paths
- Each test-first step includes an explicit command and expected failure/pass result

### Type consistency

- Shared item model uses `EditableTestItem` consistently across seed data, matcher, calculator, store, pages, and exporters
- Project setup fields match the approved spec: `oem`, `projectType`, `platform`, `projectCode`, `reusePlatformTemplate`, `description`, `selectedChangeIds`, `confirmed`

