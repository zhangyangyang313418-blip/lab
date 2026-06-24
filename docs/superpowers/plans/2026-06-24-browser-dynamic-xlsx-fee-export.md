# Browser Dynamic XLSX Fee Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser SpreadsheetML `.xls` fee download with MLA/EMA template-backed OOXML export that supports dynamic Group/item changes while preserving workbook formatting, formulas, charts, and optional macro parts.

**Architecture:** Keep the existing fee workbook model as the business-data source, add explicit defined-name markers to both formal templates, and use a browser-safe ZIP/XML transformer to replace marker-bounded worksheet regions. Preserve every untouched ZIP entry byte-for-byte, update all row-dependent OOXML references, validate the completed package, then download `.xlsx` or `.xlsm` according to the source template.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, `fflate`, browser DOMParser/XMLSerializer, Office Open XML.

---

## File Structure

- Create `scripts/prepare_fee_export_template_assets.mjs`: add/validate explicit defined-name markers and copy formal templates into `public/templates`.
- Create `public/templates/MLA费用导出模板.xlsx`: generated browser asset from the formal MLA template.
- Create `public/templates/EMA费用导出模板.xlsx`: generated browser asset from the formal EMA template.
- Create `src/services/feeWorkbookTemplateManifest.ts`: platform-to-template mapping, marker names, required sheet/part contracts.
- Create `src/services/ooxmlPackage.ts`: ZIP decode/encode, XML parse/serialize, package-part validation, macro-part preservation checks.
- Create `src/services/ooxmlWorksheetTransform.ts`: marker resolution, row cloning, cell writing, address/formula/range shifting.
- Create `src/services/templateFeeWorkbookExport.ts`: orchestrate model-to-template transformation, chart cache update, validation, and download.
- Modify `src/services/mlaEnvironmentFeeExport.ts`: expose reusable workbook model and retire production SpreadsheetML download.
- Modify `src/pages/EnvironmentOutlinePage.tsx`: asynchronous template export, busy/error UI, no `.xls` fallback.
- Modify `package.json` and `package-lock.json`: add `fflate` and template asset preparation command.
- Create `src/tests/feeWorkbookTemplateManifest.test.ts`.
- Create `src/tests/ooxmlWorksheetTransform.test.ts`.
- Create `src/tests/templateFeeWorkbookExport.test.ts`.
- Modify `src/tests/mlaEnvironmentFeeExport.test.ts`.
- Modify `src/tests/environmentOutlinePage.test.tsx`.
- Modify `src/tests/mlaEnvironmentFeeTemplateExport.test.ts`.
- Modify `docs/MLA测试项目及费用Excel导出交接.md`, `docs/EMA费用交接.md`, `docs/PROJECT_STATUS_INDEX.md`, and the HTML handbook.

### Task 1: Add template marker preparation and asset synchronization

**Files:**
- Create: `scripts/prepare_fee_export_template_assets.mjs`
- Modify: `package.json`
- Test: `src/tests/mlaEnvironmentFeeTemplateExport.test.ts`

- [ ] **Step 1: Write the failing template marker test**

Add assertions that both formal templates and both public assets contain the same required defined names:

```ts
const requiredMarkers = [
  "_PT_META_OEM",
  "_PT_META_PLATFORM",
  "_PT_META_PROJECT_CODE",
  "_PT_META_STEERING",
  "_PT_META_PROJECT_TYPE",
  "_PT_META_EXPORT_SCOPE",
  "_PT_META_FULL_REUSE",
  "_PT_META_ENV_TEMPLATE",
  "_PT_SAMPLE_DYNAMIC_START",
  "_PT_SAMPLE_DYNAMIC_END",
  "_PT_FORECAST_DYNAMIC_START",
  "_PT_FORECAST_DYNAMIC_END",
  "_PT_SGS_DYNAMIC_START",
  "_PT_SGS_DYNAMIC_END",
  "_PT_CTI_DYNAMIC_START",
  "_PT_CTI_DYNAMIC_END",
  "_PT_SUBO_DYNAMIC_START",
  "_PT_SUBO_DYNAMIC_END",
  "_PT_COMPARE_HELPER_RANGE",
  "_PT_SPECIAL_DYNAMIC_START",
  "_PT_SPECIAL_DYNAMIC_END",
  "_PT_VALIDATION_DYNAMIC_START",
  "_PT_VALIDATION_DYNAMIC_END",
];
```

The test must also compare SHA-256 for every non-workbook XML ZIP part before and after marker injection, except `[Content_Types].xml`, `xl/workbook.xml`, and `xl/_rels/workbook.xml.rels` when a relationship change is required.

- [ ] **Step 2: Run the marker test and verify RED**

Run:

```bash
npm run test:run -- src/tests/mlaEnvironmentFeeTemplateExport.test.ts
```

Expected: FAIL because public template assets and required marker defined names do not exist.

- [ ] **Step 3: Implement marker injection**

The script must:

1. Read the formal MLA and EMA templates.
2. Resolve sheets by name through workbook relationships.
3. Locate one-time seed ranges using exact current template labels only during asset preparation.
4. Add stable hidden defined names to `xl/workbook.xml`.
5. Add prototype-row markers for each dynamic sheet:

```text
_PT_<SHEET>_PROTO_PHASE
_PT_<SHEET>_PROTO_GROUP
_PT_<SHEET>_PROTO_HEADER
_PT_<SHEET>_PROTO_DATA
_PT_<SHEET>_PROTO_LAST_DATA
_PT_<SHEET>_PROTO_TOTAL
_PT_<SHEET>_PROTO_ADDITIONAL
```

6. Fail if any seed label is missing or ambiguous.
7. Copy the marked workbook to `public/templates`.
8. Verify macros and all unrelated ZIP entries are byte-identical.

- [ ] **Step 4: Add asset preparation command**

Add:

```json
"prepare:fee-templates": "node scripts/prepare_fee_export_template_assets.mjs",
"prebuild": "npm run prepare:fee-templates"
```

- [ ] **Step 5: Run marker preparation and marker tests**

Run:

```bash
npm run prepare:fee-templates
npm run test:run -- src/tests/mlaEnvironmentFeeTemplateExport.test.ts
```

Expected: PASS; both assets contain all markers and preserve unrelated parts.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/prepare_fee_export_template_assets.mjs public/templates src/tests/mlaEnvironmentFeeTemplateExport.test.ts
git commit -m "feat: prepare marked fee workbook templates"
```

### Task 2: Add browser-safe OOXML package primitives

**Files:**
- Create: `src/services/ooxmlPackage.ts`
- Create: `src/tests/ooxmlPackage.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install `fflate`**

Run:

```bash
npm install fflate
```

- [ ] **Step 2: Write failing ZIP round-trip tests**

Tests must prove:

- ZIP begins with `PK`.
- All entry names survive.
- Untouched binary entries remain byte-identical.
- A template with a synthetic `xl/vbaProject.bin` preserves that entry byte-for-byte.
- A template without VBA does not gain VBA entries.

- [ ] **Step 3: Run and verify RED**

Run:

```bash
npm run test:run -- src/tests/ooxmlPackage.test.ts
```

Expected: FAIL because package helpers do not exist.

- [ ] **Step 4: Implement `OoxmlPackage`**

Provide:

```ts
export class OoxmlPackage {
  static async load(bytes: Uint8Array): Promise<OoxmlPackage>;
  has(path: string): boolean;
  readBytes(path: string): Uint8Array;
  readText(path: string): string;
  writeText(path: string, value: string): void;
  list(): string[];
  macroFingerprint(): MacroFingerprint;
  assertMacroFingerprint(expected: MacroFingerprint): void;
  save(): Uint8Array;
}
```

Use `unzipSync` and `zipSync` from `fflate`. Track original bytes and mutated paths so untouched entries are copied without text conversion.

- [ ] **Step 5: Implement XML helpers and package validation**

Add helpers for:

- XML parse errors
- required package parts
- workbook/sheet relationship resolution
- required chart and drawing parts
- formula-error scan across XML parts
- macro content type/relationship validation

- [ ] **Step 6: Run tests and commit**

```bash
npm run test:run -- src/tests/ooxmlPackage.test.ts
git add package.json package-lock.json src/services/ooxmlPackage.ts src/tests/ooxmlPackage.test.ts
git commit -m "feat: add browser ooxml package support"
```

### Task 3: Resolve explicit markers and transform worksheet rows

**Files:**
- Create: `src/services/feeWorkbookTemplateManifest.ts`
- Create: `src/services/ooxmlWorksheetTransform.ts`
- Create: `src/tests/feeWorkbookTemplateManifest.test.ts`
- Create: `src/tests/ooxmlWorksheetTransform.test.ts`

- [ ] **Step 1: Write failing marker-resolution tests**

Cover:

- required marker resolves exactly once
- missing marker throws
- duplicate marker throws
- runtime does not search labels or style IDs
- MLA/EMA platform aliases select the correct template

- [ ] **Step 2: Write failing row-shift tests**

Use a small fixture worksheet with:

- dynamic rows
- formulas above and below
- merge cells
- conditional formatting `sqref`
- autoFilter
- table range
- drawing anchor

Assert insertion and deletion update every row/cell/range reference.

- [ ] **Step 3: Run and verify RED**

```bash
npm run test:run -- src/tests/feeWorkbookTemplateManifest.test.ts src/tests/ooxmlWorksheetTransform.test.ts
```

- [ ] **Step 4: Implement manifest**

Define:

```ts
export interface FeeTemplateDefinition {
  platformFamily: "MLA" | "EMA";
  url: string;
  baseFilename: string;
  requiredSheets: readonly string[];
  requiredParts: readonly string[];
  markers: TemplateMarkerContract;
}
```

No row numbers may appear in the runtime manifest.

- [ ] **Step 5: Implement worksheet transformation**

Provide:

```ts
replaceMarkedRows({
  worksheetXml,
  markerRange,
  prototypeRows,
  generatedRows,
  dependentParts,
}): WorksheetTransformResult
```

The implementation must update:

- row `r`
- cell `r`
- formulas
- merge cells
- conditional formatting
- autoFilter
- table refs
- drawing anchors
- worksheet dimension

- [ ] **Step 6: Run tests and commit**

```bash
npm run test:run -- src/tests/feeWorkbookTemplateManifest.test.ts src/tests/ooxmlWorksheetTransform.test.ts
git add src/services/feeWorkbookTemplateManifest.ts src/services/ooxmlWorksheetTransform.ts src/tests/feeWorkbookTemplateManifest.test.ts src/tests/ooxmlWorksheetTransform.test.ts
git commit -m "feat: transform marked worksheet regions"
```

### Task 4: Map the fee workbook model into template rows

**Files:**
- Modify: `src/services/mlaEnvironmentFeeExport.ts`
- Create: `src/services/templateFeeWorkbookRows.ts`
- Create: `src/tests/templateFeeWorkbookRows.test.ts`
- Modify: `src/tests/mlaEnvironmentFeeExport.test.ts`

- [ ] **Step 1: Write failing semantic-row tests**

Cover baseline and edited plans:

- added item
- removed item
- added Group
- removed Group
- empty Group
- MLA and EMA

Expected semantic roles:

```ts
type TemplateRowRole =
  | "phase"
  | "group"
  | "header"
  | "data"
  | "last-data"
  | "total"
  | "additional"
  | "blank";
```

- [ ] **Step 2: Run and verify RED**

```bash
npm run test:run -- src/tests/templateFeeWorkbookRows.test.ts src/tests/mlaEnvironmentFeeExport.test.ts
```

- [ ] **Step 3: Expose the existing workbook model**

Keep `buildMlaEnvironmentFeeWorkbook()` as the business model builder, but change its filename contract to `.xlsx` only after the template export is active. Remove production use of `workbookXml()` and `workbookBlob()`.

- [ ] **Step 4: Implement semantic row mapping**

Generate role-tagged rows for:

- sample/equipment demand
- forecast
- three labs
- special fees
- validation

Add real formula descriptors for totals instead of only hard-coded totals:

```ts
interface TemplateCell {
  value?: string | number;
  formula?: string;
  cachedValue?: number;
}
```

- [ ] **Step 5: Run tests and commit**

```bash
npm run test:run -- src/tests/templateFeeWorkbookRows.test.ts src/tests/mlaEnvironmentFeeExport.test.ts
git add src/services/mlaEnvironmentFeeExport.ts src/services/templateFeeWorkbookRows.ts src/tests/templateFeeWorkbookRows.test.ts src/tests/mlaEnvironmentFeeExport.test.ts
git commit -m "feat: map fee data to template rows"
```

### Task 5: Build complete MLA/EMA workbooks and update charts

**Files:**
- Create: `src/services/templateFeeWorkbookExport.ts`
- Create: `src/tests/templateFeeWorkbookExport.test.ts`

- [ ] **Step 1: Write failing end-to-end package tests**

For MLA and EMA, plus add/remove scenarios, assert:

- output starts with `PK`
- output has correct extension/MIME
- correct template-specific marker/fingerprint remains
- all 8 Sheets exist in order
- validation Sheet hidden
- styles, drawing, chart, table and merge parts remain
- formulas cover generated rows
- no formula-error text
- chart helper values equal model totals
- chart cache values equal helper values

- [ ] **Step 2: Run and verify RED**

```bash
npm run test:run -- src/tests/templateFeeWorkbookExport.test.ts
```

- [ ] **Step 3: Implement orchestrator**

Provide:

```ts
export async function buildTemplateFeeWorkbook(
  plan: EnvironmentPlanSheet,
  context: ProjectSetup,
  fetchTemplate?: TemplateFetcher,
): Promise<TemplateWorkbookFile>;
```

Process:

1. Select template.
2. Fetch and load package.
3. Capture macro fingerprint.
4. Resolve/validate markers.
5. Build semantic rows.
6. Replace all dynamic regions.
7. Update metadata.
8. Update comparison helper cells.
9. Update `chart1.xml` formulas and caches.
10. Set full calculation on load.
11. Validate package and macro fingerprint.
12. Return bytes, filename and MIME.

- [ ] **Step 4: Implement chart update**

Keep the fixed 14-point, four-series chart layout. Rewrite:

- category cache
- series caches
- helper range references
- formula references

Fail if chart or drawing is missing.

- [ ] **Step 5: Run tests and commit**

```bash
npm run test:run -- src/tests/templateFeeWorkbookExport.test.ts
git add src/services/templateFeeWorkbookExport.ts src/tests/templateFeeWorkbookExport.test.ts
git commit -m "feat: build dynamic template fee workbooks"
```

### Task 6: Switch the page to asynchronous XLSX download

**Files:**
- Modify: `src/pages/EnvironmentOutlinePage.tsx`
- Modify: `src/services/mlaEnvironmentFeeExport.ts`
- Modify: `src/tests/environmentOutlinePage.test.tsx`
- Modify: `src/tests/mlaEnvironmentFeeExport.test.ts`

- [ ] **Step 1: Write failing UI tests**

Assert:

- button downloads `.xlsx`
- MLA and EMA choose different template URLs
- button is disabled while generating
- template failure displays error
- no anchor with `.xls` is created
- legacy SpreadsheetML function is not called

- [ ] **Step 2: Run and verify RED**

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx src/tests/mlaEnvironmentFeeExport.test.ts
```

- [ ] **Step 3: Implement async export UI**

Use state:

```ts
const [isExportingFees, setIsExportingFees] = useState(false);
const [feeExportError, setFeeExportError] = useState<string | null>(null);
```

On click:

1. clear error
2. disable button
3. build template workbook
4. create Blob URL
5. trigger one download
6. revoke URL
7. display platform-specific errors

- [ ] **Step 4: Remove legacy production download**

Delete or make test-only:

- SpreadsheetML `workbookXml()`
- `workbookBlob()`
- production `downloadMlaEnvironmentFeeWorkbook()`

No runtime code may create `application/vnd.ms-excel` fee files.

- [ ] **Step 5: Run tests and commit**

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx src/tests/mlaEnvironmentFeeExport.test.ts
git add src/pages/EnvironmentOutlinePage.tsx src/services/mlaEnvironmentFeeExport.ts src/tests/environmentOutlinePage.test.tsx src/tests/mlaEnvironmentFeeExport.test.ts
git commit -m "feat: download template based xlsx fees"
```

### Task 7: Documentation and full verification

**Files:**
- Modify: `docs/MLA测试项目及费用Excel导出交接.md`
- Modify: `docs/EMA费用交接.md`
- Modify: `docs/PROJECT_STATUS_INDEX.md`
- Modify: `docs/产品测试流程自动化项目工作手册.html`
- Modify: `scripts/validate_product_test_handbook.mjs`

- [ ] **Step 1: Update documentation**

Document:

- browser now downloads `.xlsx`
- formal template paths
- marker contract
- template asset sync command
- no `.xls` fallback
- macro preservation
- dynamic add/delete support

- [ ] **Step 2: Run focused tests**

```bash
npm run test:run -- \
  src/tests/mlaEnvironmentFeeExport.test.ts \
  src/tests/mlaEnvironmentFeeTemplateExport.test.ts \
  src/tests/ooxmlPackage.test.ts \
  src/tests/feeWorkbookTemplateManifest.test.ts \
  src/tests/ooxmlWorksheetTransform.test.ts \
  src/tests/templateFeeWorkbookRows.test.ts \
  src/tests/templateFeeWorkbookExport.test.ts \
  src/tests/environmentOutlinePage.test.tsx
```

Expected: all PASS.

- [ ] **Step 3: Run complete fee regression**

```bash
npm run test:run -- \
  src/tests/environmentFeeDetail.test.ts \
  src/tests/environmentOutlinePage.test.tsx \
  src/tests/environmentOutlineLayout.test.ts \
  src/tests/localStore.test.ts \
  src/tests/environmentPlan.test.ts \
  src/tests/homePage.test.tsx \
  src/tests/mlaEnvironmentFeeExport.test.ts \
  src/tests/mlaEnvironmentFeeTemplateExport.test.ts
```

- [ ] **Step 4: Build and inspect artifacts**

```bash
npm run build
node scripts/validate_product_test_handbook.mjs
```

Verify built assets include both templates.

- [ ] **Step 5: Browser download verification**

Using the current localhost site:

1. Export baseline MLA.
2. Export baseline EMA.
3. Add an item and export.
4. Delete an item and export.
5. Add a Group and export.
6. Delete a Group and export.

Inspect every downloaded ZIP for required parts, markers, formulas, merges, ranges and chart cache.

- [ ] **Step 6: WPS visual verification**

Open MLA and EMA exports in WPS and verify:

- 8 Sheets
- correct data
- preserved styling
- working formulas
- editable native chart
- hidden validation Sheet
- no recovery warning

- [ ] **Step 7: Final commit**

```bash
git add docs scripts src public package.json package-lock.json
git commit -m "feat: export dynamic fees from xlsx templates"
```

