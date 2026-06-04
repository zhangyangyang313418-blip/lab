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
  chamberPrices?: {
    large: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>;
    small: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>;
  };
  compositeLabComponents?: Array<{
    label: string;
    fixedCount?: number;
    countLabel: string;
    basis?: Exclude<EnvironmentFeeChargeBasis, "pending">;
    prices: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>;
  }>;
  fixedUnitPrice?: number;
  componentMultiplier?: number;
  componentLabel?: string;
  quantityLabel?: string;
  fixedLabAddOn?: {
    label: string;
    prices: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>;
  };
  additiveComponent?: {
    fixedCount: number;
    fixedUnitPrice?: number;
    fixedUnitPrices?: Record<EnvironmentFeeLabName, EnvironmentFeeLabPriceValue>;
    fixedLabel: string;
    variableBasis: Exclude<EnvironmentFeeChargeBasis, "pending">;
    variableLabel: string;
  };
  priceLabel?: string;
  hideUnavailableLabQuotes?: boolean;
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
  priceLabel?: string;
  hideUnavailableLabQuotes?: boolean;
  notes?: string;
}

export interface EnvironmentFeeDetailSection {
  groupId: string;
  groupTitle: string;
  totalSampleQty: string;
  rows: EnvironmentFeeDetailRow[];
  totalEstimatedFee: number;
}
