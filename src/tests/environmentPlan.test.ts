import { describe, expect, it } from "vitest";
import { createSeedEnvironmentPlan } from "../data/seed/environmentPlan";
import { seedPlatformTemplates } from "../data/seed/platformTemplates";

const mlaLhdItems = seedPlatformTemplates.find(
  (template) => template.platform === "MLA" && template.steeringSide === "LHD",
)?.items ?? [];

describe("environment plan fees", () => {
  it("populates baseline L1&L4 fee from the displayed baseline sample quantity", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L481-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupA = pv?.groups.find((group) => group.id === "mla-group-a");

    expect(pv?.summary.totalSampleQty).toBe("123");
    expect(groupA?.rows.find((row) => row.id === "a-l1l4")?.fee).toBe("38800");
  });

  it("populates per-hour environmental row fee from the coefficient-table hours", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L481-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupA = pv?.groups.find((group) => group.id === "mla-group-a");

    expect(groupA?.rows.find((row) => row.id === "a-k1")?.fee).toBe("960");
  });

  it("uses 8 as the initial sample quantity for MLA LHD Group D-3", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L481-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupD3 = pv?.groups.find((group) => group.id === "mla-group-d3");

    expect(groupD3?.totalSampleQty).toBe("8");
  });

  it("marks D-3 and D-4 samples as PCBA groups", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L481-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");

    expect(pv?.groups.find((group) => group.id === "mla-group-d3")?.totalSamplePrefix).toBe("PCBA");
    expect(pv?.groups.find((group) => group.id === "mla-group-d4")?.totalSamplePrefix).toBe("PCBA");
  });

  it("subtracts PCBA-only D-3 and D-4 samples from the baseline optical sample range", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L481-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupA = pv?.groups.find((group) => group.id === "mla-group-a");

    expect(pv?.summary.totalSampleQty).toBe("123");
    expect(groupA?.rows.find((row) => row.id === "a-optical")?.sampleRange).toBe("1-109");
    expect(groupA?.rows.find((row) => row.id === "a-l1l4")?.sampleRange).toBeUndefined();
  });

  it("applies the MLA optical mixed rule to the baseline optical summary row", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L481-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupA = pv?.groups.find((group) => group.id === "mla-group-a");

    expect(groupA?.rows.find((row) => row.id === "a-optical")?.sampleRange).toBe("1-109");
    expect(groupA?.rows.find((row) => row.id === "a-optical")?.fee).toBe("25140");
  });

  it("uses the displayed baseline sample count for MLA baseline L1&L4 fees", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L463", mlaLhdItems);
    const dv = plan.phases.find((phase) => phase.id === "dv");
    const groupA = dv?.groups.find((group) => group.id === "mla-group-a");

    expect(dv?.summary.totalSampleQty).toBe("108");
    expect(groupA?.rows.find((row) => row.id === "a-l1l4")?.fee).toBe("32800");
  });

  it("syncs MLA PV fee detail estimates into outline row fees and totals", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L460-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupA = pv?.groups.find((group) => group.id === "mla-group-a");

    expect(groupA?.rows.find((row) => row.id === "a-k1")?.fee).toBe("960");
    expect(groupA?.rows.find((row) => row.id === "a-particle")?.fee).toBe("24000");
    expect(Number(groupA?.totalCost ?? 0)).toBeGreaterThan(0);
    expect(Number(pv?.summary.totalCost ?? 0)).toBeGreaterThan(0);
  });

  it("uses the MLA optical mixed 51-point and 19-point rule for seeded PV groups", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L460-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");

    expect(pv?.groups.find((group) => group.id === "mla-group-a")?.rows.find((row) => row.id === "a-post-optical")?.fee).toBe("2770");
    expect(pv?.groups.find((group) => group.id === "mla-group-b")?.rows.find((row) => row.id === "b-post-optical")?.fee).toBe("2770");
    expect(pv?.groups.find((group) => group.id === "mla-group-d8")?.rows.find((row) => row.id === "d8-post-optical")?.fee).toBe("3150");
  });

  it("syncs approved MLA fee updates for K6, K14, and E groups into the seeded PV outline", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L460-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupA = pv?.groups.find((group) => group.id === "mla-group-a");
    const groupE1 = pv?.groups.find((group) => group.id === "mla-group-e1");
    const groupE2 = pv?.groups.find((group) => group.id === "mla-group-e2");

    expect(groupA?.rows.find((row) => row.id === "a-k6")?.fee).toBe("10800");
    expect(groupA?.rows.find((row) => row.id === "a-k14")?.fee).toBe("36000");
    expect(groupE1?.rows.find((row) => row.id === "e1-item")?.fee).toBe("21500");
    expect(groupE2?.rows.find((row) => row.id === "e2-item")?.fee).toBe("42500");
  });
});
