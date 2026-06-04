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

function noListedLabs(): EnvironmentFeePricingRule["labs"] {
  return allLabs("N/A");
}

function chamberRule(matcher: RegExp, fallbackPrice: number): EnvironmentFeePricingRule {
  return {
    matcher,
    chargeBasis: "hour",
    labs: quotedLabs(fallbackPrice, fallbackPrice, fallbackPrice),
    chamberPrices: {
      large: quotedLabs(30, 25, 40),
      small: quotedLabs(23, 18, 30),
    },
  };
}

export const mlaFeePricingRules: EnvironmentFeePricingRule[] = [
  {
    matcher: /Particle Exposure/i,
    chargeBasis: "pending",
    labs: {
      SGS: "",
      华测: "",
      苏劢: "",
      信测: "N/A",
    },
    notes: "Particle Exposure 费用规则待单独确认",
  },
  {
    matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i,
    chargeBasis: "quantity",
    labs: quotedLabs(400, 700, 400),
  },
  {
    matcher: /L6-photo&xray|L6.*内部|Internal Inspection.*内部/i,
    chargeBasis: "quantity",
    labs: noListedLabs(),
    fixedUnitPrice: 400,
    notes: "L6-photo&xray 固定单价 400/个样品；不按实验室报价中值计算",
  },
  {
    matcher: /L6-SEM&SECTION|L6.*外部|Internal Inspection.*外部/i,
    chargeBasis: "quantity",
    labs: quotedLabs(650, 500, 700),
    notes: "L6-SEM&SECTION 委外组合报价：SEM & Sectioning 按 33 个测试点位取实验室总价中值",
  },
  { matcher: /L6|Internal Inspection|SEM&SECTION/i, chargeBasis: "quantity", labs: quotedLabs(650, 500, 700) },
  chamberRule(/K1\b/i, 30),
  chamberRule(/K2\b/i, 30),
  chamberRule(/K3\b/i, 30),
  chamberRule(/K4\b/i, 30),
  { matcher: /K5\b/i, chargeBasis: "batch", labs: quotedLabs(3360, 5000, 5000) },
  chamberRule(/K6\b/i, 30),
  { matcher: /K7\b/i, chargeBasis: "hour", labs: quotedLabs(100, 70, 100) },
  { matcher: /K8\b/i, chargeBasis: "batch", labs: quotedLabs(4100, 5000, 5000) },
  chamberRule(/K9\b/i, 30),
  { matcher: /K10\b/i, chargeBasis: "quantity", labs: quotedLabs(500, 500, 500) },
  { matcher: /K13\b/i, chargeBasis: "batch", labs: quotedLabs(1500, 1500, 1800) },
  {
    matcher: /K14\b|Dust Blowing Test/i,
    chargeBasis: "batch",
    labs: noListedLabs(),
    fixedUnitPrice: 3000,
    notes: "K14 Dust Blowing 指定国测，按 3000/批计算；每批 3 台样品",
  },
  { matcher: /K28\b|HALT/i, chargeBasis: "hour", labs: quotedLabs(800, 600, 1500) },
  { matcher: /K15\b|Vibartion|Vibration/i, chargeBasis: "hour", labs: quotedLabs(500, 400, 600) },
  { matcher: /K16\.1/i, chargeBasis: "quantity", labs: quotedLabs(300, 120, 300) },
  { matcher: /K16\.4/i, chargeBasis: "quantity", labs: quotedLabs(333, 167, 300) },
  {
    matcher: /K17\b|Audible Noise/i,
    chargeBasis: "quantity",
    labs: quotedLabs(12000, 10000, 3000),
    notes: "K17 Audible Noise 按 MLA 三个方向的组合单价 × 样机数计算",
  },
  {
    matcher: /K18\b|Connector/i,
    chargeBasis: "quantity",
    labs: {
      SGS: 325,
      华测: 500,
      苏劢: 125,
      信测: 500,
    },
    componentMultiplier: 4,
    componentLabel: "K18.1-K18.4 四项",
    quantityLabel: "台样机",
    fixedLabAddOn: {
      label: "K18.1 微应力",
      prices: {
        SGS: 3400,
        华测: 3500,
        苏劢: 3500,
        信测: "N/A",
      },
    },
    notes: "K18.1-K18.4 四项 × 12 台样机 × 单价 + K18.1 微应力费用",
  },
  { matcher: /K20\b|Solar Radiation/i, chargeBasis: "hour", labs: quotedLabs(145, 400, 80) },
  { matcher: /K21\b|Corrosive Gases/i, chargeBasis: "hour", labs: quotedLabs(110, 120, 150) },
  {
    matcher: /K22\b|Chemical Resistance/i,
    chargeBasis: "hour",
    labs: {
      SGS: 20,
      华测: 25,
      苏劢: 30,
      信测: "N/A",
    },
    additiveComponent: {
      fixedCount: 15,
      fixedUnitPrices: {
        SGS: 650,
        华测: 700,
        苏劢: 300,
        信测: "N/A",
      },
      fixedLabel: "种试剂",
      variableBasis: "hour",
      variableLabel: "h",
    },
    notes: "K22 Chemical Resistance 按 MLA 条件 1 的 15 种试剂；试剂数量 × 各实验室试剂单价 + 测试时间 × 时间单价 计算",
  },
  { matcher: /K23\b|Thermal Shock Endurance/i, chargeBasis: "hour", labs: quotedLabs(40, 50, 55) },
  { matcher: /K24\b|High Temperature Endurance/i, chargeBasis: "hour", labs: quotedLabs(23, 15, 30) },
  {
    matcher: /K26\b|Mechanical Wear-Out/i,
    chargeBasis: "hour",
    labs: allLabs("N/A"),
    compositeLabComponents: [
      {
        label: "常温",
        fixedCount: 334,
        countLabel: "h",
        prices: {
          SGS: 10,
          华测: 7,
          苏劢: 20,
          信测: "N/A",
        },
      },
      {
        label: "低温",
        fixedCount: 83,
        countLabel: "h",
        prices: {
          SGS: 23,
          华测: 25,
          苏劢: 30,
          信测: "N/A",
        },
      },
      {
        label: "高温",
        fixedCount: 83,
        countLabel: "h",
        prices: {
          SGS: 23,
          华测: 25,
          苏劢: 30,
          信测: "N/A",
        },
      },
    ],
    notes: "K26 Mechanical Wear-Out 按 334h 常温 + 83h 低温 + 83h 高温分别计费后取实验室总价中值",
  },
  { matcher: /K27\b|High Temperature -High Humidity/i, chargeBasis: "hour", labs: quotedLabs(23, 20, 30) },
  { matcher: /Condensing humidity|K52\.351/i, chargeBasis: "hour", labs: quotedLabs(55, 60, 55) },
  {
    matcher: /Restricted Substance/i,
    chargeBasis: "quantity",
    labs: noListedLabs(),
    fixedUnitPrice: 20000,
    notes: "禁限用物质总价 20000，其中 1500 为评估费",
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
    priceLabel: "参考单价",
    hideUnavailableLabQuotes: true,
    notes: "操作噪声暂按 SGS 合作价 1700/台样机计算",
  },
  {
    matcher: /E-\d/i,
    chargeBasis: "pending",
    labs: allLabs(""),
    notes: "E 组费用规则待单独确认",
  },
];
