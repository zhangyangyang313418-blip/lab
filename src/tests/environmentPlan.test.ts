import { describe, expect, it } from "vitest";
import { createSeedEnvironmentPlan } from "../data/seed/environmentPlan";
import { seedPlatformTemplates } from "../data/seed/platformTemplates";

const mlaLhdItems = seedPlatformTemplates.find(
  (template) => template.platform === "MLA" && template.steeringSide === "LHD",
)?.items ?? [];

function getSampleRangeQuantity(sampleRange: string | undefined): number | null {
  const match = sampleRange?.match(/^(\d+)-(\d+)$/);
  if (!match) {
    return null;
  }

  return Number(match[2]) - Number(match[1]) + 1;
}

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

    expect(groupA?.rows.find((row) => row.id === "a-k1")?.fee).toBe("720");
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

  it("splits D-3 L6 into internal and external rows while other L6 rows stay internal-only", () => {
    const mlaPlan = createSeedEnvironmentPlan("MLA", "L460-L", mlaLhdItems);
    const emaItems = seedPlatformTemplates.find(
      (template) => template.platform === "EMA" && template.steeringSide === "LHD",
    )?.items ?? [];
    const emaPlan = createSeedEnvironmentPlan("EMA", "L460-L", emaItems);

    const mlaPv = mlaPlan.phases.find((phase) => phase.id === "pv");
    const mlaGroupA = mlaPv?.groups.find((group) => group.id === "mla-group-a");
    const mlaGroupD3 = mlaPv?.groups.find((group) => group.id === "mla-group-d3");
    const emaPv = emaPlan.phases.find((phase) => phase.id === "pv");
    const emaGroupA = emaPv?.groups.find((group) => group.id === "ema-group-a");
    const emaGroupD3 = emaPv?.groups.find((group) => group.id === "ema-group-d3");

    expect(mlaGroupA?.rows.find((row) => row.id === "a-post-l6")?.label).toBe("L6-photo&xray");
    expect(
      mlaGroupD3?.rows
        .filter((row) => row.id === "d3-post-l6-internal" || row.id === "d3-post-l6-external")
        .map((row) => row.label),
    ).toEqual([
      "L6-photo&xray",
      "L6-SEM&SECTION",
    ]);
    expect(mlaGroupD3?.rows.find((row) => row.id === "d3-post-l6-internal")?.testHours).toBe("3");
    expect(emaGroupA?.rows.find((row) => row.id === "ea-post-l6")?.label).toBe("L6-photo&xray");
    expect(
      emaGroupD3?.rows
        .filter((row) => row.id === "ed3-post-l6-internal" || row.id === "ed3-post-l6-external")
        .map((row) => row.label),
    ).toEqual([
      "L6-photo&xray",
      "L6-SEM&SECTION",
    ]);
    expect(emaGroupD3?.rows.find((row) => row.id === "ed3-post-l6-internal")?.testHours).toBe("3");
  });

  it("keeps non-D-3 L6 rows internal-only across MLA and EMA default templates", () => {
    const templates = seedPlatformTemplates.filter(
      (template) => template.platform === "MLA" || template.platform === "EMA",
    );

    for (const template of templates) {
      const plan = createSeedEnvironmentPlan(template.platform, "L460-L", template.items);
      const l6Rows = plan.phases.flatMap((phase) =>
        phase.groups.flatMap((group) =>
          group.rows
            .filter((row) => row.label.includes("L6 Internal Inspection"))
            .map((row) => ({ groupTitle: group.title, row })),
        ),
      );

      for (const { groupTitle, row } of l6Rows) {
        if (groupTitle === "Group D-3") {
          continue;
        }

        expect(row.label).toBe("L6-photo&xray");
      }
    }
  });

  it("sets L6 internal inspection duration from sample quantity in MLA and EMA default templates", () => {
    const templates = seedPlatformTemplates.filter(
      (template) => template.platform === "MLA" || template.platform === "EMA",
    );

    for (const template of templates) {
      const plan = createSeedEnvironmentPlan(template.platform, "L460-L", template.items);
      const l6InternalRows = plan.phases.flatMap((phase) =>
        phase.groups.flatMap((group) =>
          group.rows
            .filter((row) => row.label === "L6-photo&xray")
            .map((row) => ({ group, row })),
        ),
      );

      expect(l6InternalRows.length).toBeGreaterThan(0);
      for (const { group, row } of l6InternalRows) {
        const quantity = getSampleRangeQuantity(row.sampleRange) ?? Number(group.totalSampleQty || 0);

        if (quantity === 12) {
          expect(row.testHours).toBe("7");
        }

        if (quantity === 6) {
          expect(row.testHours).toBe("3");
        }
      }
    }
  });

  it("syncs MLA PV fee detail estimates into outline row fees and totals", () => {
    const plan = createSeedEnvironmentPlan("MLA", "L460-L", mlaLhdItems);
    const pv = plan.phases.find((phase) => phase.id === "pv");
    const groupA = pv?.groups.find((group) => group.id === "mla-group-a");

    expect(groupA?.rows.find((row) => row.id === "a-k1")?.fee).toBe("720");
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

    expect(groupA?.rows.find((row) => row.id === "a-k6")?.fee).toBe("7200");
    expect(groupA?.rows.find((row) => row.id === "a-k14")?.fee).toBe("12000");
    expect(groupE1?.rows.find((row) => row.id === "e1-item")?.fee).toBe("20000");
    expect(groupE2?.rows.find((row) => row.id === "e2-item")?.fee).toBe("42500");
  });
});
