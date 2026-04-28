---
name: hud-workflow-and-ui
description: Use when designing or implementing the HUD 产品测试评估助手 user flow, page structure, editable results experience, or export interactions for test engineers.
---

# HUD Workflow And UI

Use this skill when the task is about page flow, interaction design, screen structure, or editable results UX for the HUD evaluation tool.

## Primary user

- Test engineer

Optimize for fast review, low ambiguity, and traceable manual edits.

## Recommended page flow

1. Project setup
2. Recommendation generation
3. Results review
4. Manual adjustment
5. Export

## Page structure

### Project setup area

Collect:

- `OEM`
- `platform`
- `requestType`
- `isFullyReused`
- `change details` when `requestType = change_project`

For v1, `OEM` can default to `JLR`, but keep it in a control that can expand later.

### Recommendation results area

Show at minimum:

- `Test Flow Chart`
- `Test Items`
- `Sample Counts`
- `Test Time`
- `Cost` as placeholder or deferred section until pricing is implemented

Use summary cards for:

- total test items
- total sample count
- total test time
- total estimated cost once pricing exists

### Editable results area

Prefer an editable table with row-level actions:

- add row
- remove row
- edit sample counts
- edit duration
- flag manual changes

When feasible, show both:

- original recommended value
- current edited value

## UX rules

- New project + fully reused:
  - load the selected baseline immediately
- New project + not fully reused:
  - load the baseline, then keep it editable
- Change project:
  - ask for change details before generating recommendations
  - show that the output came from the change matrix

## Export rules

Provide export actions for:

- `Excel`
- `PDF`

Export should include:

- project metadata
- test flow chart or its structured representation
- test item table
- totals
- manual edit markers when available

## Out of scope for v1

- approval workflow
- permissions
- collaboration
- complex diagram editing
- historical diffing

Keep the first implementation practical and editable rather than visually complex.
