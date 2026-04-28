import type { EnvironmentFeeChargeBasis } from "../../types/environmentFeeDetail";

export interface EnvironmentFeeBasisRule {
  groupTitle: string;
  matcher: RegExp;
  basis: Partial<Record<Exclude<EnvironmentFeeChargeBasis, "pending">, number>>;
}

const l460PvCoefficientRules: EnvironmentFeeBasisRule[] = [
  { groupTitle: "Group A", matcher: /\bK1\b/i, basis: { hour: 24 } },
  { groupTitle: "Group A", matcher: /\bK2\b/i, basis: { hour: 24 } },
  { groupTitle: "Group A", matcher: /\bK3\b/i, basis: { hour: 24 } },
  { groupTitle: "Group A", matcher: /\bK4\b/i, basis: { hour: 96 } },
  { groupTitle: "Group A", matcher: /\bK5\b/i, basis: { batch: 1 } },
  { groupTitle: "Group A", matcher: /\bK6\b/i, basis: { hour: 240 } },
  { groupTitle: "Group A", matcher: /\bK7\b/i, basis: { hour: 105 } },
  { groupTitle: "Group A", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 12 } },
  { groupTitle: "Group A", matcher: /\bK15\b|Vibartion|Vibration/i, basis: { hour: 24 } },
  { groupTitle: "Group A", matcher: /\bK16\.1\b/i, basis: { quantity: 14 } },
  { groupTitle: "Group A", matcher: /\bK16\.4\b/i, basis: { quantity: 12 } },
  { groupTitle: "Group A", matcher: /\bK17\b|Audible Noise/i, basis: { quantity: 12, batch: 3 } },
  { groupTitle: "Group A", matcher: /\bK9\b/i, basis: { hour: 264 } },
  { groupTitle: "Group A", matcher: /\bK10\b/i, basis: { quantity: 12 } },
  { groupTitle: "Group A", matcher: /\bK13\b/i, basis: { batch: 4 } },
  { groupTitle: "Group A", matcher: /\bK14\b|Dust Blowing Test/i, basis: { batch: 4 } },

  { groupTitle: "Group B", matcher: /\bK22\b|Chemical Resistance/i, basis: { hour: 72, quantity: 15 } },
  { groupTitle: "Group B", matcher: /\bK18\b|Connector/i, basis: { quantity: 12 } },
  { groupTitle: "Group B", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 12 } },

  { groupTitle: "Group C", matcher: /\bK7\b/i, basis: { hour: 105 } },
  { groupTitle: "Group C", matcher: /\bK15\b|Vibartion|Vibration/i, basis: { hour: 24 } },
  { groupTitle: "Group C", matcher: /\bK13\b/i, basis: { batch: 2 } },
  { groupTitle: "Group C", matcher: /\bK14\b|Dust Blowing Test/i, basis: { batch: 2 } },
  { groupTitle: "Group C", matcher: /\bK26\b|Mechanical Wear-Out/i, basis: { hour: 500 } },
  { groupTitle: "Group C", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },

  { groupTitle: "Group D-1", matcher: /\bK21\b|Corrosive Gases/i, basis: { hour: 336 } },
  { groupTitle: "Group D-1", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-2", matcher: /\bK20\b|Solar Radiation/i, basis: { hour: 720 } },
  { groupTitle: "Group D-2", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-3", matcher: /\bK23\b|Thermal Shock Endurance/i, basis: { hour: 1017 } },
  { groupTitle: "Group D-3", matcher: /\bL6\b|Internal Inspection/i, basis: { quantity: 33 } },
  { groupTitle: "Group D-3", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-4", matcher: /\bK8\b|Dewing Test/i, basis: { batch: 1 } },
  { groupTitle: "Group D-4", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-5", matcher: /\bK24\b|High Temperature Endurance/i, basis: { hour: 1000 } },
  { groupTitle: "Group D-5", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-6", matcher: /\bK27\b|85\/85/i, basis: { hour: 1000 } },
  { groupTitle: "Group D-6", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-7", matcher: /\bK27\b|60\/95/i, basis: { hour: 1100 } },
  { groupTitle: "Group D-7", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-8", matcher: /TST\s*&\s*Vibration|Thermal Shock\s*&\s*Vibration/i, basis: { hour: 8 } },
  { groupTitle: "Group D-8", matcher: /Hot/i, basis: { hour: 16 } },
  { groupTitle: "Group D-8", matcher: /Cold|Thermal Shock|Vibration/i, basis: { hour: 8 } },
  { groupTitle: "Group D-8", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
  { groupTitle: "Group D-9", matcher: /Condensing humidity|K52\.351/i, basis: { hour: 120 } },
  { groupTitle: "Group D-9", matcher: /L1\s*&?\s*L4|Performance Evaluation.*Functional Evaluation/i, basis: { quantity: 6 } },
];

export function findMlaFeeBasisRule(groupTitle: string, label: string): EnvironmentFeeBasisRule | undefined {
  return l460PvCoefficientRules.find((rule) => rule.groupTitle === groupTitle && rule.matcher.test(label));
}
