import type { SteeringSide } from "../types/project";

const steeringDisplayOrder: SteeringSide[] = ["LHD", "RHD"];

export function normalizeSteeringSides(sides: SteeringSide[] | undefined): SteeringSide[] {
  const firstValidSide = sides?.find((side) => steeringDisplayOrder.includes(side)) ?? "LHD";

  return [firstValidSide];
}

export function formatSteeringSides(sides: SteeringSide[] | undefined): string {
  return normalizeSteeringSides(sides).join(" / ");
}
