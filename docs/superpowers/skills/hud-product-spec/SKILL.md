---
name: hud-product-spec
description: Use when defining or refining the HUD 产品测试评估助手 product scope, user goals, input-output contract, version boundaries, or MVP priorities for the JLR-first workflow.
---

# HUD Product Spec

Use this skill when the task is about product scope, feature boundaries, or requirements clarification for `HUD 产品测试评估助手`.

## Current product frame

- Product name: `HUD 产品测试评估助手`
- Primary user: test engineers
- Current OEM scope: `JLR` only
- Current platform scope: `EMA` and `MLA`
- Core goal: after the user enters project details, generate recommended `test flow chart`, sample counts, test time, and later test cost
- Output is always system-generated first, then manually adjustable
- Export targets: `Excel` and `PDF`

## Input contract

The product spec should preserve these primary inputs:

- `oem`
- `platform`
- `requestType`
- `isFullyReused`
- `changeDetails` for change projects

For v1, assume:

- `oem` defaults to and is limited to `JLR`
- `platform` is `EMA | MLA`
- `requestType` is `new_project | change_project`

## Output contract

The product spec should preserve these primary outputs:

- `testFlowChart`
- `testItems`
- `sampleCountPerGroup`
- `sampleCountTotal`
- `testTimePerItemPerGroup`
- `testTimeTotal`
- `testCostPerItemPerGroup` and `testCostTotal` as reserved fields until pricing work starts

## Product rules to keep stable

- New project:
  - starts from the selected platform baseline
  - if fully reused, the baseline can be used directly
  - if not fully reused, the baseline becomes an editable recommendation
- Change project:
  - must evaluate impact first
  - then recommend tests from the JLR change matrix
  - result remains editable

## MVP boundaries

Keep v1 narrow unless the user explicitly expands scope:

- Support `JLR` only
- Support `EMA` and `MLA` only
- No backend required for v1 unless requested
- No workflow approval system unless requested
- No multi-user collaboration unless requested
- Pricing logic can be deferred and represented as placeholders

## Source of truth

When the task needs product context, align with:

- [2026-04-10-jlr-product-test-evaluation-tool-design.md](../../specs/2026-04-10-jlr-product-test-evaluation-tool-design.md)
- [2026-04-10-jlr-product-test-evaluation-tool.md](../../plans/2026-04-10-jlr-product-test-evaluation-tool.md)

If the user introduces a new requirement that conflicts with this skill, update the product spec first before changing implementation details.
