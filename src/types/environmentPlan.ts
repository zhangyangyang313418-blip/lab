import type { PlatformCode } from "./project";

export interface EnvironmentPlanSummary {
  projectLabel: string;
  projectCode: string;
  phaseLabel: string;
  phaseValue: string;
  totalSampleLabel: string;
  totalSampleQty: string;
  longestDurationLabel: string;
  longestDurationDays: string;
  totalCostLabel: string;
  totalCost: string;
}

export interface EnvironmentPlanRow {
  id: string;
  label: string;
  testHours: string;
  sampleRange?: string;
  fee?: string;
}

export interface EnvironmentPlanGroup {
  id: string;
  title: string;
  totalSampleLabel: string;
  totalSamplePrefix?: string;
  totalSampleQty: string;
  totalDurationLabel: string;
  totalDurationDays: string;
  totalCostLabel: string;
  totalCost: string;
  rows: EnvironmentPlanRow[];
}

export interface EnvironmentPlanPhase {
  id: string;
  title: string;
  summary: EnvironmentPlanSummary;
  groups: EnvironmentPlanGroup[];
}

export interface EnvironmentPlanSheet {
  platform: PlatformCode;
  phases: EnvironmentPlanPhase[];
}
