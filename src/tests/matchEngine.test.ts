import { describe, expect, it } from "vitest";
import { seedChangeOptions } from "../data/seed/changeOptions";
import { seedEmcItems } from "../data/seed/emcTemplates";
import { matchRecommendedItems } from "../services/matchEngine";
import type { EditableTestItem } from "../types/testing";
import { normalizeText } from "../utils/normalizers";

describe("matchRecommendedItems", () => {
  it("ignores blank or whitespace keywords when matching descriptions", () => {
    const matched = matchRecommendedItems({
      description: "完全无关的描述",
      selectedChangeIds: [],
      changeOptions: [
        ...seedChangeOptions,
        {
          id: "blank_keyword_option",
          label: "空关键词选项",
          keywords: ["   ", ""],
          recommendedCodes: ["RE310"],
        },
      ],
      candidateItems: seedEmcItems,
    });

    expect(matched).toHaveLength(0);
  });

  it("matches EMC items from normalized description keywords", () => {
    const matched = matchRecommendedItems({
      description: "  pCbA   材料变更  ",
      selectedChangeIds: [],
      changeOptions: seedChangeOptions,
      candidateItems: seedEmcItems,
    });

    expect(matched.map((item) => item.code)).toEqual(["RE310", "CE420", "RI112"]);
    expect(matched.every((item) => item.reasons.includes("根据变更矩阵自动推荐"))).toBe(true);
  });

  it("matches EMC items from selected change ids", () => {
    const matched = matchRecommendedItems({
      description: "完全无关的描述",
      selectedChangeIds: ["supply_filtering_change"],
      changeOptions: seedChangeOptions,
      candidateItems: seedEmcItems,
    });

    expect(matched.map((item) => item.code)).toEqual([
      "RE310",
      "CE420",
      "RI112",
      "RI114",
      "RI115",
      "RI130",
    ]);
    expect(matched.every((item) => item.reasons.includes("根据变更矩阵自动推荐"))).toBe(true);
  });

  it("merges duplicate-code items while preserving reasons", () => {
    const duplicateItem: EditableTestItem = {
      ...seedEmcItems[0]!,
      id: "emc-re310-duplicate",
      code: " re310 ",
      nameEn: "Different Name For The Same Code",
      reasons: ["later-reason"],
    };

    const originalItem: EditableTestItem = {
      ...seedEmcItems[0]!,
      id: "emc-re310-original",
      code: "RE310",
      nameEn: "Radiated Emissions RE 310",
      reasons: ["first-reason", "根据变更矩阵自动推荐"],
    };

    const matched = matchRecommendedItems({
      description: "供电滤波和 PCB 材料都发生变更",
      selectedChangeIds: ["pcb_material_change", "supply_filtering_change"],
      changeOptions: seedChangeOptions,
      candidateItems: [
        duplicateItem,
        originalItem,
        ...seedEmcItems.slice(1),
      ],
    });

    expect(matched).toHaveLength(6);
    expect(matched.map((item) => normalizeText(item.code))).toEqual([
      "re310",
      "ce420",
      "ri112",
      "ri114",
      "ri115",
      "ri130",
    ]);
    expect(matched.filter((item) => normalizeText(item.code) === "re310")).toHaveLength(1);
    expect(matched[0]?.nameEn).toBe("Different Name For The Same Code");
    expect(matched[0]?.reasons).toEqual([
      "later-reason",
      "根据变更矩阵自动推荐",
      "first-reason",
    ]);
  });

  it("does not duplicate an existing auto recommendation reason", () => {
    const alreadyTaggedItem: EditableTestItem = {
      ...seedEmcItems[0]!,
      reasons: ["根据变更矩阵自动推荐"],
    };

    const matched = matchRecommendedItems({
      description: "PCB 材料变更",
      selectedChangeIds: [],
      changeOptions: seedChangeOptions,
      candidateItems: [alreadyTaggedItem],
    });

    expect(matched).toHaveLength(1);
    expect(matched[0]?.reasons).toEqual(["根据变更矩阵自动推荐"]);
  });
});
