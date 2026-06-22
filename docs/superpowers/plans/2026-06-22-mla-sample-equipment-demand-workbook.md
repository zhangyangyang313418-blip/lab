# MLA Sample and Equipment Demand Workbook Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce an editable `.xlsx` confirmation workbook that preserves the user's template style and calculates MLA DV and PV sample/equipment demand independently.

**Architecture:** Import the user-confirmed workbook with `@oai/artifact-tool`, treat its `A:V / W / X:AS` layout as the style source, and populate independent DV and PV calculation blocks. Derived item quantities, Group Max rows, and Phase totals remain native Excel formulas so changing sample inputs recalculates the workbook.

**Tech Stack:** JavaScript, `@oai/artifact-tool`, native Excel formulas, Codex bundled Node.js runtime.

---

### Task 1: Inspect and stage the template

**Files:**
- Read: `outputs/mla-sample-equipment-demand/MLA样品及辅助设备需求_计算逻辑确认版.xlsx`
- Create: `/tmp/codex-mla-sample-equipment-workbook/build.mjs`

- [ ] **Step 1: Import the template and inspect the used range**

```js
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItemAt(0);
const usedRange = sheet.getUsedRange();
```

- [ ] **Step 2: Render the source template before editing**

```js
const preview = await workbook.render({
  sheetName: sheet.name,
  range: "A1:AS159",
  scale: 1,
  format: "png",
});
```

- [ ] **Step 3: Verify the source contract**

Confirm that the sheet is named `样品及辅助设备需求`, the used range includes `A1:AS159`, and the DV/PV titles are present in `A1` and `X1`.

### Task 2: Build the side-by-side phase layout

**Files:**
- Modify: `/tmp/codex-mla-sample-equipment-workbook/build.mjs`

- [ ] **Step 1: Rename the sheet and copy the template block**

```js
sheet.name = "样品及辅助设备需求";
sheet.getRange("W1:W159").format.fill = "#FFF200";
```

- [ ] **Step 2: Set phase titles**

```js
sheet.getRange("A1").values = [["MLA DV样品及辅助设备需求汇总"]];
sheet.getRange("X1").values = [["MLA PV样品及辅助设备需求汇总"]];
```

- [ ] **Step 3: Populate DV rows from the MLA template**

Copy source rows `144:157` (D-9, E-1, and E-2) to DV rows `131:144`, then clear only the contents in DV rows `145:157`. This compacts the DV detail region while omitting Group D-8 and preserving all remaining MLA groups.

### Task 3: Apply calculation formulas

**Files:**
- Modify: `/tmp/codex-mla-sample-equipment-workbook/build.mjs`

- [ ] **Step 1: Write item-level formulas**

For each phase block, map each test code to formulas defined in `docs/superpowers/specs/2026-06-22-mla-sample-equipment-demand-workbook-design.md`. Examples:

```js
formula("I", row, `=E${row}`);                    // one projection board per HUD
formula("H", row, `=MIN(E${row},3)`);             // dust/water fixture capacity
formula("G", row, `=IF(E${row}=0,0,IF(E${row}<6,3,6))`); // vibration fixture rule
formula("Q", row, `=P${row}*3`);                  // USB extension cables
formula("R", row, `=E${row}*3`);                  // sensors
```

- [ ] **Step 2: Correct confirmed template exceptions**

Apply Particle accessories from fixture count, count K18 double 2m harnesses and retain the new-harness note, add D-4 HUD/FPD 2m harnesses equal to PCBA count, keep K23 at one set, and cap D-8 HALT concurrent demand at three sets.

- [ ] **Step 3: Write Group Max formulas**

```js
sheet.getRange(`E${maxRow}:T${maxRow}`).formulas = [[
  `=MAX(E${start}:E${end})`,
  `=MAX(F${start}:F${end})`,
  `=MAX(G${start}:G${end})`,
  `=MAX(H${start}:H${end})`,
  `=MAX(I${start}:I${end})`,
  `=MAX(J${start}:J${end})`,
  `=MAX(K${start}:K${end})`,
  `=MAX(L${start}:L${end})`,
  `=MAX(M${start}:M${end})`,
  `=MAX(N${start}:N${end})`,
  `=MAX(O${start}:O${end})`,
  `=MAX(P${start}:P${end})`,
  `=MAX(Q${start}:Q${end})`,
  `=MAX(R${start}:R${end})`,
  `=MAX(S${start}:S${end})`,
  `=MAX(T${start}:T${end})`,
]];
```

- [ ] **Step 4: Write phase-summary formulas**

Use `SUM` for HUD, PCBA, projection accessories, 2m harnesses, and Sensor accessories. Use `MAX` across Group summary rows for vibration/impact fixtures, dust/water fixtures, HUD power 3m harnesses, and FPD LINK 3m harnesses. Include the separate HUD backup row of 3 in each phase HUD total.

### Task 4: Verify formulas and presentation

**Files:**
- Modify: `/tmp/codex-mla-sample-equipment-workbook/build.mjs`
- Create: `outputs/mla-sample-equipment-demand/MLA样品及辅助设备需求_计算逻辑确认版.xlsx`

- [ ] **Step 1: Inspect key ranges**

```js
await workbook.inspect({
  kind: "table",
  range: "样品及辅助设备需求!A1:AS25",
  include: "values,formulas",
  tableMaxRows: 24,
  tableMaxCols: 43,
});
```

- [ ] **Step 2: Scan formula errors**

```js
await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 300 },
  summary: "final formula error scan",
});
```

- [ ] **Step 3: Render the full sheet**

```js
await workbook.render({
  sheetName: "样品及辅助设备需求",
  range: "A1:AS159",
  scale: 1,
  format: "png",
});
```

- [ ] **Step 4: Repair severe visual defects**

Check that DV and PV titles, summary tables, detail headers, special requirements, merged regions, and the blank separator column are visible and aligned. If a title or detail label is clipped, widen only its source column; if a merged header is broken, recreate only that merge from the source template coordinates.

- [ ] **Step 5: Export and reopen**

```js
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
```

Reinspect the final summary and formula-error scan after reopening.
