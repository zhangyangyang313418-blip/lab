import type { EditableTestItem, ResultSummary } from "../types/testing";
import { normalizeText } from "../utils/normalizers";
import { durationToHours, mergeUniqueStrings } from "../utils/formatters";

function calculateDurationHours(item: EditableTestItem): number {
  return item.pricingFactor ?? durationToHours(item.durationValue, item.durationUnit);
}

function getBillableMagnitude(item: EditableTestItem): number {
  return calculateDurationHours(item);
}

export function calculateSampleCost(item: EditableTestItem): number {
  return item.unitPrice * item.sampleQty;
}

export function calculatePeriodCost(item: EditableTestItem): number {
  return item.unitPrice * calculateDurationHours(item);
}

export function calculateItemCost(item: EditableTestItem): number {
  if (!item.enabled) {
    return 0;
  }

  switch (item.pricingUnit) {
    case "per_sample":
      return calculateSampleCost(item);
    case "per_hour":
      return calculatePeriodCost(item);
    case "per_item":
    case "per_material_type":
      return item.unitPrice;
    default:
      return 0;
  }
}

function mergeDuplicateItem(existing: EditableTestItem, incoming: EditableTestItem): EditableTestItem {
  const strongerPricingItem = getBillableMagnitude(incoming) > getBillableMagnitude(existing) ? incoming : existing;

  const merged: EditableTestItem = {
    ...existing,
    sampleQty: Math.max(existing.sampleQty, incoming.sampleQty),
    durationValue: strongerPricingItem.durationValue,
    durationUnit: strongerPricingItem.durationUnit,
    unitPrice: strongerPricingItem.unitPrice,
    pricingUnit: strongerPricingItem.pricingUnit,
    enabled: existing.enabled || incoming.enabled,
    editable: existing.editable || incoming.editable,
    notes: mergeUniqueStrings(existing.notes, incoming.notes),
    tags: mergeUniqueStrings(existing.tags, incoming.tags),
    reasons: mergeUniqueStrings(existing.reasons, incoming.reasons),
  };

  if (strongerPricingItem.pricingFactor !== undefined) {
    merged.pricingFactor = strongerPricingItem.pricingFactor;
  } else {
    delete merged.pricingFactor;
  }

  return {
    ...merged,
    cost: calculateItemCost(merged),
  };
}

export function mergeDuplicateItems(items: EditableTestItem[]): EditableTestItem[] {
  const merged = new Map<string, EditableTestItem>();

  items.forEach((item) => {
    const key = `${item.domain}::${normalizeText(item.code)}`;
    const existing = merged.get(key);

    if (existing) {
      merged.set(key, mergeDuplicateItem(existing, item));
      return;
    }

    merged.set(key, {
      ...item,
      cost: calculateItemCost(item),
    });
  });

  return Array.from(merged.values());
}

export function summarizeResults(items: EditableTestItem[]): ResultSummary {
  return items.reduce<ResultSummary>(
    (summary, item) => {
      if (!item.enabled) {
        return summary;
      }

      return {
        enabledItemCount: summary.enabledItemCount + 1,
        totalSampleQty: summary.totalSampleQty + item.sampleQty,
        totalDurationHours: summary.totalDurationHours + durationToHours(item.durationValue, item.durationUnit),
        totalCost: summary.totalCost + calculateItemCost(item),
      };
    },
    {
      enabledItemCount: 0,
      totalSampleQty: 0,
      totalDurationHours: 0,
      totalCost: 0,
    },
  );
}
