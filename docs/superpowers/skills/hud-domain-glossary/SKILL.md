---
name: hud-domain-glossary
description: Use when interpreting HUD testing terminology, clarifying business words, naming fields, or mapping user language into consistent domain concepts for the JLR HUD evaluation workflow.
---

# HUD Domain Glossary

Use this skill when the task involves domain vocabulary, field naming, UI labels, or business-logic interpretation for the HUD evaluation product.

## Canonical terms

- `OEM`: vehicle manufacturer customer; v1 supports `JLR`
- `platform`: HUD product platform; v1 supports `EMA` and `MLA`
- `new project`: a new project that typically starts from the full platform baseline
- `change project`: an existing project with design or requirement changes that need impact-based retesting
- `fully reused`: the selected platform baseline can be used directly without trimming
- `not fully reused`: the baseline is only the starting point and needs manual adjustment
- `test flow chart`: the structured test outline or verification flow shown to the engineer
- `test item`: one concrete verification activity or row in the plan
- `sample count per group`: sample quantity required for one group of a test
- `sample count total`: total sample quantity across the chosen plan
- `test time per item per group`: time for one test item under one group
- `test time total`: total planned time across the chosen plan
- `automatic recommendation`: the system-generated initial plan
- `manual adjustment`: engineer edits after recommendation

## UI and model naming guidance

Prefer consistent English ids with Chinese labels in UI text when needed:

- `oem`
- `platform`
- `requestType`
- `isFullyReused`
- `changeCategory`
- `changeItem`
- `testFlowChart`
- `testItems`
- `sampleCountPerGroup`
- `sampleCountTotal`
- `testTimePerItemPerGroup`
- `testTimeTotal`

## Interpretation rules

- Treat `完全复用` as direct use of the selected baseline, not as "locked and uneditable"
- Treat `不完全复用` as "start from baseline, then edit"
- Treat `变更项目` as impact-driven selection, not as full-regression by default
- Treat `每组` and `总计` as different fields; do not merge them in UI or export logic

## When ambiguity appears

If the user uses loose phrases like `大纲`, `测试项`, or `周期`, normalize them to the terms above and state the chosen interpretation when needed.
