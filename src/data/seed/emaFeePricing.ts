import { mlaFeePricingRules } from "./mlaFeePricing";
import type { EnvironmentFeeLabPriceValue, EnvironmentFeePricingRule } from "../../types/environmentFeeDetail";

function allLabs(unitPrice: EnvironmentFeeLabPriceValue): EnvironmentFeePricingRule["labs"] {
  return {
    SGS: unitPrice,
    华测: unitPrice,
    苏劢: unitPrice,
    信测: unitPrice,
  };
}

function quotedLabs(
  sgs: EnvironmentFeeLabPriceValue,
  cti: EnvironmentFeeLabPriceValue,
  subo: EnvironmentFeeLabPriceValue,
): EnvironmentFeePricingRule["labs"] {
  return {
    SGS: sgs,
    华测: cti,
    苏劢: subo,
    信测: "N/A",
  };
}

const emaSpecificFeePricingRules: EnvironmentFeePricingRule[] = [
  {
    matcher: /Particle Exposure/i,
    chargeBasis: "pending",
    labs: allLabs("N/A"),
    notes: "EMA 平台不测试 Particle Exposure",
  },
  {
    matcher: /K14\b|Dust Blowing Test/i,
    chargeBasis: "pending",
    labs: allLabs("N/A"),
    notes: "EMA 平台不测试 K14 Dust Blowing Test",
  },
  {
    matcher: /Condensing humidity|K52\.351/i,
    chargeBasis: "pending",
    labs: allLabs("N/A"),
    notes: "EMA 平台不测试 K52.351 Condensing humidity",
  },
  {
    matcher: /K17\b|Audible Noise/i,
    chargeBasis: "quantity",
    labs: quotedLabs(4000, 3333, 1000),
    notes: "K17 Audible Noise 按 EMA 条件单价 × 样机数计算",
  },
  {
    matcher: /K22\b|Chemical Resistance/i,
    chargeBasis: "quantity",
    labs: quotedLabs(650, 700, 300),
    notes: "K22 Chemical Resistance 按 EMA 条件 2 的 11 种试剂；试剂数量 × 各实验室试剂单价计算",
  },
];

export const emaFeePricingRules: EnvironmentFeePricingRule[] = [
  ...emaSpecificFeePricingRules,
  ...mlaFeePricingRules,
];
