export type EnvironmentQuoteChargeBasis = "sample" | "hour" | "batch";

export interface EnvironmentQuoteMedian {
  matcher: RegExp;
  unitPrice: number;
  chargeBasis: EnvironmentQuoteChargeBasis;
}

export const environmentQuoteMedians: EnvironmentQuoteMedian[] = [
  { matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, unitPrice: 400, chargeBasis: "sample" },
  { matcher: /L6|Internal Inspection/i, unitPrice: 650, chargeBasis: "sample" },
  { matcher: /K1\b/i, unitPrice: 40, chargeBasis: "hour" },
  { matcher: /K2\b/i, unitPrice: 40, chargeBasis: "hour" },
  { matcher: /K3\b/i, unitPrice: 40, chargeBasis: "hour" },
  { matcher: /K4\b/i, unitPrice: 40, chargeBasis: "hour" },
  { matcher: /K5\b/i, unitPrice: 5000, chargeBasis: "batch" },
  { matcher: /K6\b/i, unitPrice: 40, chargeBasis: "hour" },
  { matcher: /K7\b/i, unitPrice: 100, chargeBasis: "hour" },
  { matcher: /K8\b/i, unitPrice: 4500, chargeBasis: "batch" },
  { matcher: /K9\b/i, unitPrice: 40, chargeBasis: "hour" },
  { matcher: /K10\b/i, unitPrice: 500, chargeBasis: "sample" },
  { matcher: /K13\b/i, unitPrice: 1800, chargeBasis: "batch" },
  { matcher: /K15\b|Vibartion|Vibration/i, unitPrice: 600, chargeBasis: "hour" },
  { matcher: /K16\.1/i, unitPrice: 300, chargeBasis: "sample" },
  { matcher: /K16\.4/i, unitPrice: 333, chargeBasis: "sample" },
  { matcher: /K17\b|Audible Noise/i, unitPrice: 3333, chargeBasis: "sample" },
  { matcher: /K18\b|Connector/i, unitPrice: 200, chargeBasis: "sample" },
  { matcher: /K20\b|Solar Radiation/i, unitPrice: 100, chargeBasis: "hour" },
  { matcher: /K21\b|Corrosive Gases/i, unitPrice: 100, chargeBasis: "hour" },
  { matcher: /K22\b|Chemical Resistance/i, unitPrice: 300, chargeBasis: "sample" },
  { matcher: /K23\b|Thermal Shock Endurance/i, unitPrice: 40, chargeBasis: "hour" },
  { matcher: /K24\b|High Temperature Endurance/i, unitPrice: 23, chargeBasis: "hour" },
  { matcher: /K26\b|Mechanical Wear-Out/i, unitPrice: 25, chargeBasis: "hour" },
  { matcher: /K27\b|High Temperature -High Humidity/i, unitPrice: 25, chargeBasis: "hour" },
  { matcher: /K28\b|HALT/i, unitPrice: 800, chargeBasis: "hour" },
  { matcher: /Condensing humidity|K52\.351/i, unitPrice: 55, chargeBasis: "hour" },
  { matcher: /Particle Exposure/i, unitPrice: 2500, chargeBasis: "batch" },
];

export function findEnvironmentQuoteMedian(label: string): EnvironmentQuoteMedian | undefined {
  return environmentQuoteMedians.find((quote) => quote.matcher.test(label));
}
