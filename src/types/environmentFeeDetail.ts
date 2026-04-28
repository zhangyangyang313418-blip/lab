export type EnvironmentFeeChargeBasis = "hour" | "quantity" | "batch" | "pending";
export type EnvironmentFeeLabName = "SGS" | "华测" | "苏劢" | "信测";
export type EnvironmentFeeLabPriceValue = number | "N/A" | "";
export type EnvironmentFeeStatus = "priced" | "待确认" | "规则待确认" | "未匹配大纲";

export interface EnvironmentFeeLabQuote {
  lab: EnvironmentFeeLabName;
  unitPrice: EnvironmentFeeLabPriceValue;
  itemFee: number | "N/A" | null;
}

export interface EnvironmentFeePricingRule {
  matcher: RegExp;
  chargeBasis: EnvironmentFeeChargeBasis;
  labs: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>;
  fixedUnitPrice?: number;
  componentMultiplier?: number;
  componentLabel?: string;
  quantityLabel?: string;
  additiveComponent?: {
    fixedCount: number;
    fixedUnitPrice: number;
    fixedLabel: string;
    variableBasis: Exclude<EnvironmentFeeChargeBasis, "pending">;
    variableLabel: string;
  };
  notes?: string;
}

export interface EnvironmentFeeDetailRow {
  groupId: string;
  groupTitle: string;
  outlineRowId: string;
  testCode: string;
  testName: string;
  testHours: number | null;
  quantity: number | null;
  batchCount: number | null;
  chargeBasis: EnvironmentFeeChargeBasis;
  medianUnitPrice: number | null;
  estimatedItemFee: number | null;
  labs: EnvironmentFeeLabQuote[];
  status: EnvironmentFeeStatus;
  notes?: string;
}

export interface EnvironmentFeeDetailSection {
  groupId: string;
  groupTitle: string;
  totalSampleQty: string;
  rows: EnvironmentFeeDetailRow[];
  totalEstimatedFee: number;
}
