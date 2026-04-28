import type { EnvironmentFeeLabPriceValue, EnvironmentFeePricingRule } from "../../types/environmentFeeDetail";

function allLabs(unitPrice: EnvironmentFeeLabPriceValue): EnvironmentFeePricingRule["labs"] {
  return {
    SGS: unitPrice,
    华测: unitPrice,
    苏劢: unitPrice,
    信测: unitPrice,
  };
}

function noListedLabs(): EnvironmentFeePricingRule["labs"] {
  return allLabs("N/A");
}

export const mlaFeePricingRules: EnvironmentFeePricingRule[] = [
  {
    matcher: /Particle Exposure/i,
    chargeBasis: "pending",
    labs: {
      SGS: 1750,
      华测: 6500,
      苏劢: 4333,
      信测: "N/A",
    },
    notes: "Particle Exposure 费用规则待单独确认",
  },
  {
    matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i,
    chargeBasis: "quantity",
    labs: allLabs(400),
  },
  { matcher: /L6|Internal Inspection/i, chargeBasis: "quantity", labs: allLabs(650) },
  { matcher: /K1\b/i, chargeBasis: "hour", labs: allLabs(40) },
  { matcher: /K2\b/i, chargeBasis: "hour", labs: allLabs(40) },
  { matcher: /K3\b/i, chargeBasis: "hour", labs: allLabs(40) },
  { matcher: /K4\b/i, chargeBasis: "hour", labs: allLabs(40) },
  { matcher: /K5\b/i, chargeBasis: "batch", labs: allLabs(6000) },
  { matcher: /K6\b/i, chargeBasis: "hour", labs: allLabs(45) },
  { matcher: /K7\b/i, chargeBasis: "hour", labs: allLabs(100) },
  { matcher: /K8\b/i, chargeBasis: "batch", labs: allLabs(4500) },
  { matcher: /K9\b/i, chargeBasis: "hour", labs: allLabs(45) },
  { matcher: /K10\b/i, chargeBasis: "quantity", labs: allLabs(500) },
  { matcher: /K13\b/i, chargeBasis: "batch", labs: allLabs(2000) },
  {
    matcher: /K14\b|Dust Blowing Test/i,
    chargeBasis: "quantity",
    labs: noListedLabs(),
    fixedUnitPrice: 3000,
    notes: "K14 Dust Blowing 指定国测，按 3000/台样机计算；每批 3 台样品",
  },
  { matcher: /K15\b|Vibartion|Vibration/i, chargeBasis: "hour", labs: allLabs(650) },
  { matcher: /K16\.1/i, chargeBasis: "quantity", labs: allLabs(300) },
  { matcher: /K16\.4/i, chargeBasis: "quantity", labs: allLabs(333) },
  {
    matcher: /K17\b|Audible Noise/i,
    chargeBasis: "quantity",
    labs: {
      SGS: 4000,
      华测: 3333,
      苏劢: 1000,
      信测: 4000,
    },
    componentMultiplier: 3,
    componentLabel: "3 个方向",
    quantityLabel: "台样机",
    notes: "K17 Audible Noise 按 3 个方向 × 样机数 × 单价计算",
  },
  {
    matcher: /K18\b|Connector/i,
    chargeBasis: "quantity",
    labs: {
      SGS: 325,
      华测: 200,
      苏劢: 125,
      信测: 500,
    },
    componentMultiplier: 4,
    componentLabel: "K18.1-K18.4 四项",
    quantityLabel: "台样机",
    notes: "K18 Connector 包含 K18.1-K18.4 四项子测试，按 4 项 × 样机数 × 单价计算",
  },
  { matcher: /K20\b|Solar Radiation/i, chargeBasis: "hour", labs: allLabs(100) },
  { matcher: /K21\b|Corrosive Gases/i, chargeBasis: "hour", labs: allLabs(110) },
  {
    matcher: /K22\b|Chemical Resistance/i,
    chargeBasis: "hour",
    labs: {
      SGS: 20,
      华测: 25,
      苏劢: 30,
      信测: 20,
    },
    additiveComponent: {
      fixedCount: 15,
      fixedUnitPrice: 300,
      fixedLabel: "种试剂",
      variableBasis: "hour",
      variableLabel: "小时",
    },
    notes: "K22 Chemical Resistance 按 MLA 条件 1 的 15 种试剂；试剂数量 × 试剂单价 + 测试时间 × 时间单价 计算",
  },
  { matcher: /K23\b|Thermal Shock Endurance/i, chargeBasis: "hour", labs: allLabs(50) },
  { matcher: /K24\b|High Temperature Endurance/i, chargeBasis: "hour", labs: allLabs(30) },
  { matcher: /K26\b|Mechanical Wear-Out/i, chargeBasis: "hour", labs: allLabs(30) },
  { matcher: /K27\b|High Temperature -High Humidity/i, chargeBasis: "hour", labs: allLabs(30) },
  { matcher: /K28\b|HALT/i, chargeBasis: "hour", labs: allLabs(800) },
  { matcher: /Condensing humidity|K52\.351/i, chargeBasis: "hour", labs: allLabs(55) },
  {
    matcher: /Restricted Substance/i,
    chargeBasis: "quantity",
    labs: noListedLabs(),
    fixedUnitPrice: 21500,
    notes: "禁限用物质按评估费用 1500 + 实测费用 20000 计算",
  },
  {
    matcher: /Operating Noise|Transient Noise|Noise test/i,
    chargeBasis: "quantity",
    labs: {
      SGS: 1700,
      华测: "N/A",
      苏劢: "N/A",
      信测: "N/A",
    },
    notes: "操作噪声暂按 SGS 合作价 1700/台样机计算",
  },
  {
    matcher: /E-\d/i,
    chargeBasis: "pending",
    labs: allLabs(""),
    notes: "E 组费用规则待单独确认",
  },
];
