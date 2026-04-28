import type { DurationUnit } from "../types/testing";

export function durationToHours(value: number, unit: DurationUnit): number {
  return unit === "day" ? value * 24 : value;
}

export function mergeUniqueStrings(base: string[], extra: string[]): string[] {
  const merged = [...base];

  extra.forEach((value) => {
    if (!merged.includes(value)) {
      merged.push(value);
    }
  });

  return merged;
}
