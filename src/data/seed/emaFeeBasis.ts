import { findMlaFeeBasisRule, type EnvironmentFeeBasisRule } from "./mlaFeeBasis";

const emaFeeBasisRules: EnvironmentFeeBasisRule[] = [
  { groupTitle: "Group A", matcher: /\bK7\b/i, basis: { hour: 305 } },
  { groupTitle: "Group B", matcher: /\bK22\b|Chemical Resistance/i, basis: { quantity: 11 } },
  { groupTitle: "Group D-1", matcher: /\bK21\b|Corrosive Gases/i, basis: { hour: 1000 } },
  { groupTitle: "Group D-2", matcher: /\bK20\b|Solar Radiation/i, basis: { hour: 24 } },
];

export function findEmaFeeBasisRule(groupTitle: string, label: string): EnvironmentFeeBasisRule | undefined {
  return emaFeeBasisRules.find((rule) => rule.groupTitle === groupTitle && rule.matcher.test(label))
    ?? findMlaFeeBasisRule(groupTitle, label);
}
