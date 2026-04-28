import type { SteeringSide } from "../types/project";

const steeringDisplayOrder: SteeringSide[] = ["LHD", "RHD"];

export function normalizeSteeringSides(sides: SteeringSide[] | undefined): SteeringSide[] {
  const selectedSides = new Set(sides && sides.length > 0 ? sides : ["LHD"]);

  return steeringDisplayOrder.filter((side) => selectedSides.has(side));
}

export function formatSteeringSides(sides: SteeringSide[] | undefined): string {
  return normalizeSteeringSides(sides).join(" / ");
}
