import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync("src/styles/global.css", "utf8");

function getRuleBody(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = stylesheet.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`));

  return match?.[1] ?? "";
}

describe("environment outline layout", () => {
  it("stacks the fee calculation editor controls inside narrow flow columns", () => {
    const editorGrid = getRuleBody(".fee-calculation-editor__grid");
    const formula = getRuleBody(".fee-calculation-editor__formula");

    expect(editorGrid).toContain("grid-template-columns: 1fr");
    expect(formula).toContain("white-space: normal");
    expect(formula).toContain("overflow-wrap: anywhere");
  });
});
