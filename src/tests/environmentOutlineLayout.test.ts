import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync("src/styles/global.css", "utf8");

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`(?:^|\\n)\\s*${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  return match?.[1] ?? "";
}

describe("environment outline layout", () => {
  it("stacks the fee calculation editor controls inside narrow flow columns", () => {
    const formulaText = getRuleBody(".fee-calculation-editor__formula-text");

    expect(formulaText).toContain("white-space: normal");
    expect(formulaText).toContain("overflow-wrap: anywhere");
  });

  it("keeps lab quote formulas horizontal in narrow cards", () => {
    const labCard = getRuleBody(".fee-calculation-editor__lab-card");
    const labFormula = getRuleBody(".fee-calculation-editor__lab-formula");

    expect(labCard).toContain("grid-template-columns: minmax(32px, max-content) minmax(0, 1fr) max-content");
    expect(labCard).toContain("gap: 4px");
    expect(labCard).toContain("padding: 5px 6px");
    expect(labFormula).toContain("white-space: nowrap");
    expect(labFormula).toContain("font-size: 9px");
  });

  it("keeps compact optical fee editors inside narrow flow columns", () => {
    const compactEditor = getRuleBody(".fee-calculation-editor--compact");
    const compactHeader = getRuleBody(".fee-calculation-editor--compact .fee-calculation-editor__header");
    const compactStack = getRuleBody(".fee-calculation-editor--compact .fee-calculation-editor__stack");
    const compactSplitLine = getRuleBody(".fee-calculation-editor--compact .fee-calculation-editor__stack--horizontal .fee-calculation-editor__split-line");

    expect(compactEditor).toContain("padding: 5px");
    expect(compactHeader).toContain("margin-bottom: 3px");
    expect(compactStack).toContain("gap: 3px");
    expect(compactSplitLine).toContain("min-height: 24px");
    expect(compactSplitLine).toContain("padding: 3px 6px");
    expect(compactSplitLine).toContain("font-size: 9px");
  });
});
