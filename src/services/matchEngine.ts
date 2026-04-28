import type { ChangeOption } from "../data/seed/changeOptions";
import type { EditableTestItem } from "../types/testing";
import { normalizeText } from "../utils/normalizers";

export interface MatchInput {
  description: string;
  selectedChangeIds: string[];
  changeOptions: ChangeOption[];
  candidateItems: EditableTestItem[];
}

const AUTO_RECOMMEND_REASON = "根据变更矩阵自动推荐";

function createSearchText(item: EditableTestItem): string {
  return normalizeText([
    item.code,
    item.nameZh,
    item.nameEn,
    item.standard,
    item.procedure,
    item.requirement,
    ...(item.tags ?? []),
  ].join(" "));
}

function itemMatchesRecommendedCode(item: EditableTestItem, normalizedCode: string): boolean {
  const normalizedItemCode = normalizeText(item.code);
  if (normalizedItemCode === normalizedCode) {
    return true;
  }

  return createSearchText(item).includes(normalizedCode);
}

function mergeReasons(baseReasons: string[], extraReasons: string[]): string[] {
  const reasons = [...baseReasons];

  extraReasons.forEach((reason) => {
    if (!reasons.includes(reason)) {
      reasons.push(reason);
    }
  });

  return reasons;
}

export function matchRecommendedItems(input: MatchInput): EditableTestItem[] {
  const normalizedDescription = normalizeText(input.description);
  const matchedCodes = new Set<string>();

  input.changeOptions.forEach((option) => {
    const selected = input.selectedChangeIds.includes(option.id);
    const keywordMatched = option.keywords.some((keyword) => {
      const normalizedKeyword = normalizeText(keyword);
      return normalizedKeyword !== "" && normalizedDescription.includes(normalizedKeyword);
    });

    if (!selected && !keywordMatched) {
      return;
    }

    option.recommendedCodes.forEach((code) => {
      matchedCodes.add(normalizeText(code));
    });
  });

  const deduped = new Map<string, EditableTestItem>();

  input.candidateItems.forEach((item) => {
    const matchedCode = Array.from(matchedCodes).find((code) => itemMatchesRecommendedCode(item, code));

    if (!matchedCode) {
      return;
    }

    const key = normalizeText(item.code || matchedCode);

    const reasons = item.reasons.includes(AUTO_RECOMMEND_REASON)
      ? item.reasons
      : [...item.reasons, AUTO_RECOMMEND_REASON];

    if (deduped.has(key)) {
      const existing = deduped.get(key);

      if (existing) {
        deduped.set(key, {
          ...existing,
          reasons: mergeReasons(existing.reasons, reasons),
        });
      }

      return;
    }

    deduped.set(key, {
      ...item,
      reasons,
    });
  });

  return Array.from(deduped.values());
}
