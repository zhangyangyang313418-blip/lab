export type TestDomain = "environment" | "material" | "emc";
export type DurationUnit = "hour" | "day";
export type PricingUnit =
  | "per_sample"
  | "per_hour"
  | "per_item"
  | "per_material_type";

export interface EditableTestItem {
  id: string;
  domain: TestDomain;
  code: string;
  nameZh: string;
  nameEn: string;
  category: string;
  standard: string;
  procedure: string;
  requirement: string;
  sampleQty: number;
  durationValue: number;
  durationUnit: DurationUnit;
  unitPrice: number;
  pricingUnit: PricingUnit;
  pricingFactor?: number;
  cost: number;
  source: string;
  enabled: boolean;
  editable: boolean;
  notes: string[];
  tags: string[];
  reasons: string[];
  templateSection?: string;
  templateGroup?: string;
}

export interface DomainResult {
  domain: TestDomain;
  items: EditableTestItem[];
}

export interface ResultSummary {
  enabledItemCount: number;
  totalSampleQty: number;
  totalDurationHours: number;
  totalCost: number;
}
