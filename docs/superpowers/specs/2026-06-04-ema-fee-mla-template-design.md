# EMA Fee Rules From MLA Template Design

## Summary

EMA environment outline fees will initially reuse the locked MLA fee template. EMA keeps its own outline rows, timings, sample ranges, LHD/RHD group availability, and phase structure. Fee pricing, median selection, special formulas, and lab quote display reuse the current MLA implementation until the user updates the Excel fee rules and those prices are imported back into code.

## Confirmed Scope

- Apply the existing MLA fee pricing and calculation rules to EMA rows.
- Keep the current three-lab quote set: `SGS / 华测 / 苏勃`; code may continue using the internal `苏劢` key while displaying `苏勃`.
- Keep `信测` excluded from current median calculations and visible quote display.
- Keep EMA timing and sample ranges from the EMA environment outline.
- Preserve current MLA coefficient-style fee bases where already locked, such as K1 `24h`, K22 `72h + 15 种试剂`, K26 composite hours, K28 `8h`, and sample-driven K13/K15 batch or fixture logic.
- Refresh stale local EMA drafts by increasing the environment plan template version.

## Out Of Scope

- Do not import new Excel prices in this change.
- Do not split a separate EMA price table yet.
- Do not change MLA fee results.
- Do not change the environment outline layout.

## Proposed Approach

Use the current `mlaFeePricingRules` and coefficient basis rules as the shared fee template. The implementation should rename or wrap the intent as "environment fee template" where useful, but avoid a broad refactor. The smallest safe change is to expand special-case checks that currently only match `mla-group-*` so equivalent EMA rows also receive the same calculated fees.

The user will later modify the Excel fee rules. After that, prices can be imported back into the existing shared fee table or, if EMA diverges materially, split into a dedicated EMA rule table in a separate change.

## Behavior Requirements

### EMA LHD

- EMA Group A/B/C/D/E rows should show calculated fees where the current MLA template has a matching rule.
- EMA `Optical Test` should use the current optical split logic, based on EMA group/sample context.
- EMA `L6-photo&xray` should use fixed `400 / 个样品`.
- EMA `L6-SEM&SECTION` should use the current 33-point median quote logic.
- EMA `E-1 Restricted Substance Management` should use fixed total `20000`.
- EMA `E-2 Noise test` should match the existing operating/transient noise SGS reference-price rule.

### EMA RHD

- EMA RHD rows should receive the same shared fee rules where matching rows exist.
- EMA RHD `Operating Noise & Transient Noise` should match the existing E-2 operating/transient noise rule.
- EMA RHD must keep its reduced group set and sample ranges.

### Local Drafts

- Drafts saved before this EMA fee change should refresh from the current seed environment plan.
- The template version should increase from the current `28`.

## Testing Requirements

- Add or update service-level tests for EMA LHD representative rows:
  - K1 chamber price with EMA sample range.
  - K22 additive component fee.
  - K26 composite component fee.
  - L6 internal fixed price.
  - E-2 noise reference price.
- Add a test for EMA RHD E-2 operating/transient noise fee.
- Add a local draft migration assertion that stale EMA drafts refresh with calculated fees.
- Run focused fee and draft tests, then build.

## Acceptance Criteria

- Creating an EMA LHD outline produces non-empty calculated fees on rows covered by the shared MLA fee template.
- Creating an EMA RHD outline produces calculated fees on covered rows, including E-2 noise.
- MLA fee tests remain unchanged in result.
- Stale drafts refresh to the new EMA fee-enabled outline after the version bump.
- The implementation remains ready for the user's later Excel fee-rule edits.
