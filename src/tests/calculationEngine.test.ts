import { describe, expect, it } from "vitest";
import {
  calculateItemCost,
  mergeDuplicateItems,
  summarizeResults,
} from "../services/calculationEngine";
import type { EditableTestItem } from "../types/testing";

function createItem(overrides: Partial<EditableTestItem> = {}): EditableTestItem {
  return {
    id: "item-1",
    domain: "environment",
    code: "K1",
    nameZh: "低温暴露",
    nameEn: "Low Temperature Exposure",
    category: "环境可靠性",
    standard: "ISO 16750-4",
    procedure: "24h at -40C",
    requirement: "No failure",
    sampleQty: 1,
    durationValue: 1,
    durationUnit: "hour",
    unitPrice: 30,
    pricingUnit: "per_item",
    cost: 0,
    source: "seed",
    enabled: true,
    editable: true,
    notes: [],
    tags: [],
    reasons: [],
    ...overrides,
  };
}

describe("calculateItemCost", () => {
  it("calculates per_hour costs", () => {
    expect(
      calculateItemCost(
        createItem({
          pricingUnit: "per_hour",
          durationValue: 24,
          durationUnit: "hour",
          unitPrice: 30,
        }),
      ),
    ).toBe(720);
  });

  it("calculates per_sample costs", () => {
    expect(
      calculateItemCost(
        createItem({
          pricingUnit: "per_sample",
          sampleQty: 6,
          unitPrice: 80,
        }),
      ),
    ).toBe(480);
  });

  it("calculates per_item costs", () => {
    expect(
      calculateItemCost(
        createItem({
          pricingUnit: "per_item",
          unitPrice: 220,
        }),
      ),
    ).toBe(220);
  });

  it("calculates per_material_type costs", () => {
    expect(
      calculateItemCost(
        createItem({
          domain: "material",
          pricingUnit: "per_material_type",
          unitPrice: 620,
        }),
      ),
    ).toBe(620);
  });
});

describe("mergeDuplicateItems", () => {
  it("merges duplicates deterministically and keeps the stronger quantity and duration", () => {
    const merged = mergeDuplicateItems([
      createItem({
        id: "first",
        code: "K1",
        sampleQty: 4,
        durationValue: 8,
        durationUnit: "hour",
        reasons: ["seed"],
        notes: ["first note"],
      }),
      createItem({
        id: "second",
        code: "k1",
        sampleQty: 6,
        durationValue: 2,
        durationUnit: "day",
        reasons: ["manual"],
        notes: ["second note"],
      }),
      createItem({
        id: "third",
        code: "K2",
        sampleQty: 2,
        durationValue: 1,
        durationUnit: "hour",
      }),
    ]);

    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({
      id: "first",
      code: "K1",
      sampleQty: 6,
      durationValue: 2,
      durationUnit: "day",
      reasons: ["seed", "manual"],
      notes: ["first note", "second note"],
    });
    expect(merged[1]?.code).toBe("K2");
  });

  it("prefers a larger pricingFactor over a shorter nominal duration", () => {
    const merged = mergeDuplicateItems([
      createItem({
        id: "base",
        code: "K3",
        durationValue: 2,
        durationUnit: "day",
        unitPrice: 50,
        pricingUnit: "per_hour",
        pricingFactor: 48,
      }),
      createItem({
        id: "winner",
        code: "k3",
        durationValue: 1,
        durationUnit: "hour",
        unitPrice: 80,
        pricingUnit: "per_hour",
        pricingFactor: 72,
        reasons: ["pricing"],
      }),
    ]);

    expect(merged[0]).toMatchObject({
      id: "base",
      code: "K3",
      durationValue: 1,
      durationUnit: "hour",
      unitPrice: 80,
      pricingUnit: "per_hour",
      pricingFactor: 72,
      reasons: ["pricing"],
    });
  });

  it("drops a stale pricingFactor when the winning item does not have one", () => {
    const merged = mergeDuplicateItems([
      createItem({
        id: "loser",
        code: "K4",
        durationValue: 1,
        durationUnit: "hour",
        unitPrice: 30,
        pricingUnit: "per_hour",
        pricingFactor: 24,
      }),
      createItem({
        id: "winner",
        code: "k4",
        durationValue: 2,
        durationUnit: "day",
        unitPrice: 220,
        pricingUnit: "per_item",
        notes: ["keep"],
      }),
    ]);

    expect(merged[0]).toMatchObject({
      id: "loser",
      code: "K4",
      durationValue: 2,
      durationUnit: "day",
      unitPrice: 220,
      pricingUnit: "per_item",
      notes: ["keep"],
    });
    expect(merged[0]!.pricingFactor).toBeUndefined();
  });

  it("keeps disabled items disabled when merging duplicates", () => {
    const merged = mergeDuplicateItems([
      createItem({
        id: "disabled",
        code: "K5",
        enabled: false,
        reasons: ["seed"],
      }),
      createItem({
        id: "enabled",
        code: "k5",
        enabled: false,
        reasons: ["manual"],
      }),
    ]);

    expect(merged[0]).toMatchObject({
      code: "K5",
      enabled: false,
      reasons: ["seed", "manual"],
    });
  });
});

describe("summarizeResults", () => {
  it("summarizes enabled items only", () => {
    const summary = summarizeResults([
      createItem({
        pricingUnit: "per_sample",
        sampleQty: 3,
        durationValue: 2,
        durationUnit: "hour",
        unitPrice: 10,
      }),
      createItem({
        id: "disabled",
        pricingUnit: "per_hour",
        sampleQty: 1,
        durationValue: 1,
        durationUnit: "day",
        unitPrice: 5,
        enabled: false,
      }),
      createItem({
        id: "enabled-2",
        pricingUnit: "per_hour",
        sampleQty: 1,
        durationValue: 1,
        durationUnit: "day",
        unitPrice: 5,
      }),
    ]);

    expect(summary).toEqual({
      enabledItemCount: 2,
      totalSampleQty: 4,
      totalDurationHours: 26,
      totalCost: 150,
    });
  });
});
