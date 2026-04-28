---
name: hud-evaluation-rules
description: Use when recommending HUD test scope, mapping JLR project inputs to EMA or MLA baselines, selecting tests from the JLR change matrix, or deciding which fields remain manually adjustable.
---

# HUD Evaluation Rules

Use this skill when the task is about recommendation logic for `HUD 产品测试评估助手`.

## Supported scope

- OEM: `JLR` only
- Platforms: `EMA`, `MLA`
- Request types: `new_project`, `change_project`

## Core rule flow

1. Read `oem`, `platform`, `requestType`, and `isFullyReused`
2. If `requestType = new_project`, start from the full platform baseline
3. If `requestType = change_project`, start from the change matrix
4. Produce a system recommendation first
5. Keep the result editable

## New project rules

- `EMA` source:
  - `/Users/clytia/Desktop/Codex/产品测试流程自动化/资料/EMA环境可靠性测试大纲.xlsx`
- `MLA` source:
  - `/Users/clytia/Desktop/Codex/产品测试流程自动化/资料/MLA环境可靠性测试大纲.xlsx`

For new projects:

- If `isFullyReused = true`:
  - use the selected platform baseline directly
- If `isFullyReused = false`:
  - use the selected platform baseline as the initial recommendation
  - allow row-level edits afterward

## Change project rules

Primary source:

- `/Users/clytia/Desktop/Codex/产品测试流程自动化/资料/JLR设计变更测试矩阵.xls`

Use these sheets:

- `DV变更验证条目`
- `EMC变更验证条目`

For change projects:

- identify the change category and specific change item first
- use the matrix to recommend impacted tests
- keep the recommendation editable
- do not silently convert change projects into full-baseline plans unless the user asks for full regression

## Recommended data mapping

For `EMA` and `MLA` baselines, prefer these sheets:

- `PVP&R` or `DVP&R`: row-level test items
- `Test Flow chart`: flow chart output source
- `Testing Requirements`: requirement and procedure details
- `Testing Evaluation`: acceptance criteria
- `optical test`: optical detail rows

Use these field mappings when building system models:

- `testItemCode` from `ITEM No.`
- `procedureStandard` from `PROCEDURE STANDARD`
- `testItemName` from `TEST ITEM`
- `testFlowRef` from `TEST / NO TEST`
- `sampleQty` from `SAMPLE QTY.`
- `durationHours` from `TYPICAL DURATION (h)`

## Editability rules

Even after automatic recommendation, the engineer must be able to:

- add test items
- remove test items
- change sample counts
- change time values
- adjust test-flow-related output

Mark edited rows clearly when implementing UI or exports.

## Deferred pricing rule

Pricing is intentionally deferred. Keep cost fields in the data model, but do not invent pricing formulas before the user provides the approved pricing inputs.
