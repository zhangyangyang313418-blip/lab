# MLA Optical Fee Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MLA optical test's flat unit-price logic with the new 51-point/19-point mixed pricing rule for both DV and PV.

**Architecture:** Keep the existing fee pipeline intact and add a special-case pricing branch inside the environment fee service for `Optical Test`. The rule should compute a mixed per-group fee while leaving all non-optical items on the current median-price path, and should avoid changing baseline optical pricing until that is separately confirmed.

**Tech Stack:** TypeScript, React, Vitest, Vite.

---

### Task 1: Lock the new optical rule with tests

**Files:**
- Modify: `src/tests/environmentPlan.test.ts`
- Modify: `src/tests/environmentFeeDetail.test.ts`
- Reference: `src/data/seed/environmentPlan.ts`

- [ ] **Step 1: Write the failing tests**

Add one seeded-plan test that checks MLA PV group optical fees use the mixed pricing rule, and one fee-service test that checks D-8 stays fully on 19-point pricing.

- [ ] **Step 2: Run targeted tests**

Run: `npm run test:run -- src/tests/environmentPlan.test.ts src/tests/environmentFeeDetail.test.ts`
Expected: FAIL because optical items still use the old flat pricing path.

- [ ] **Step 3: Implement the minimal pricing branch**

Add an MLA optical-test special rule in `src/services/environmentFeeDetail.ts` that:
- detects non-baseline group optical rows,
- charges `1 × 460 + (quantity - 1) × 210` for `Group A/B/C/D-1/D-2/D-5/D-6/D-7/D-9`,
- charges `quantity × 210` for `Group D-8`,
- leaves baseline optical rows and all other rows on the existing logic.

- [ ] **Step 4: Re-run targeted tests**

Run: `npm run test:run -- src/tests/environmentPlan.test.ts src/tests/environmentFeeDetail.test.ts`
Expected: PASS.

### Task 2: Regression verification

**Files:**
- No planned production edits unless verification exposes a defect.

- [ ] **Step 1: Run full tests**

Run: `npm run test:run`
Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: PASS.
