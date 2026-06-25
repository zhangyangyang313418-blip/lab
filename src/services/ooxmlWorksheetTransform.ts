export interface ReplaceMarkedWorksheetRowsOptions {
  worksheetXml: string;
  startRow: number;
  endRow: number;
  rowXml: string[];
  mergeCellRefs?: string[];
}

export interface WorksheetTransformResult {
  worksheetXml: string;
  delta: number;
  newEndRow: number;
}

type ReferenceMode = "a1" | "drawing";

function replacementEnd(startRow: number, replacementCount: number): number {
  return startRow + Math.max(0, replacementCount - 1);
}

function shiftRowNumber(
  row: number,
  startRow: number,
  endRow: number,
  replacementCount: number,
  endpoint: "single" | "start" | "end" = "single",
): number {
  const delta = replacementCount - (endRow - startRow + 1);
  const newEndRow = replacementEnd(startRow, replacementCount);

  if (row < startRow) {
    return row;
  }
  if (row > endRow) {
    return row + delta;
  }
  if (replacementCount === 0) {
    return startRow;
  }
  if (endpoint === "end") {
    return newEndRow;
  }
  return startRow;
}

function parseCellReference(reference: string): { column: string; row: number } | null {
  const match = reference.match(/^(\$?[A-Z]{1,3}\$?)(\d+)$/);
  if (!match) {
    return null;
  }
  return { column: match[1]!, row: Number(match[2]!) };
}

function rewriteA1References(
  value: string,
  startRow: number,
  endRow: number,
  replacementCount: number,
): string {
  return value.replace(
    /(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/g,
    (full, firstText: string, secondText?: string) => {
      const first = parseCellReference(firstText);
      const second = secondText ? parseCellReference(secondText) : null;
      if (!first) {
        return full;
      }

      const firstRow = shiftRowNumber(
        first.row,
        startRow,
        endRow,
        replacementCount,
        second ? "start" : "single",
      );
      const firstResult = `${first.column}${firstRow}`;
      if (!second) {
        return firstResult;
      }

      const secondRow = shiftRowNumber(
        second.row,
        startRow,
        endRow,
        replacementCount,
        "end",
      );
      return `${firstResult}:${second.column}${secondRow}`;
    },
  );
}

function rewriteRowXml(
  rowXml: string,
  targetRow: number,
  startRow: number,
  endRow: number,
  replacementCount: number,
  rewriteFormulaReferences: boolean,
): string {
  let rewritten = rowXml.replace(/(<row\b[^>]*\br=")\d+(")/, `$1${targetRow}$2`);
  rewritten = rewritten.replace(
    /(<c\b[^>]*\br=")(\$?[A-Z]{1,3}\$?)\d+(")/g,
    `$1$2${targetRow}$3`,
  );
  if (rewriteFormulaReferences) {
    rewritten = rewritten.replace(
      /(<f\b[^>]*>)([\s\S]*?)(<\/f>)/g,
      (_full, open: string, formula: string, close: string) => (
        `${open}${rewriteA1References(formula, startRow, endRow, replacementCount)}${close}`
      ),
    );
  }
  return rewritten;
}

function rewriteWorksheetOutsideSheetData(
  xml: string,
  startRow: number,
  endRow: number,
  replacementCount: number,
): string {
  return xml
    .replace(
      /(\b(?:ref|sqref)=")([^"]+)(")/g,
      (_full, open: string, refs: string, close: string) => {
        const rewritten = refs
          .split(/\s+/)
          .map((ref) => rewriteA1References(ref, startRow, endRow, replacementCount))
          .join(" ");
        return `${open}${rewritten}${close}`;
      },
    );
}

function rangeRows(reference: string): { start: number; end: number } | null {
  const rows = [...reference.matchAll(/\$?[A-Z]{1,3}\$?(\d+)/g)].map((match) => Number(match[1]));
  if (rows.length === 0 || rows.some((row) => !Number.isFinite(row))) {
    return null;
  }
  return {
    start: Math.min(...rows),
    end: Math.max(...rows),
  };
}

function intersectsRows(reference: string, startRow: number, endRow: number): boolean {
  const rows = rangeRows(reference);
  if (!rows) {
    return false;
  }
  return rows.start <= endRow && rows.end >= startRow;
}

function parseWorksheetRows(sheetData: string): { row: number; xml: string }[] {
  const rows: { row: number; xml: string }[] = [];
  const rowTagPattern = /<row\b[^>]*>/g;
  let match: RegExpExecArray | null;

  while ((match = rowTagPattern.exec(sheetData)) !== null) {
    const startTag = match[0];
    const row = Number(startTag.match(/\br="(\d+)"/)?.[1]);
    if (!Number.isFinite(row)) {
      continue;
    }

    if (startTag.endsWith("/>")) {
      rows.push({ row, xml: startTag });
      continue;
    }

    const closeIndex = sheetData.indexOf("</row>", rowTagPattern.lastIndex);
    if (closeIndex === -1) {
      throw new Error(`Worksheet row ${row} is missing closing </row>`);
    }
    const endIndex = closeIndex + "</row>".length;
    rows.push({ row, xml: sheetData.slice(match.index, endIndex) });
    rowTagPattern.lastIndex = endIndex;
  }

  return rows;
}

function rewriteMergeCellsFromOriginal(
  originalXml: string,
  rewrittenXml: string,
  startRow: number,
  endRow: number,
  replacementCount: number,
  dynamicMergeCellRefs: string[],
): string {
  const originalBlock = originalXml.match(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/)?.[0];
  const existingBlock = rewrittenXml.match(/<mergeCells\b[^>]*>[\s\S]*?<\/mergeCells>/)?.[0];
  const sourceMergeRefs = originalBlock
    ? [...originalBlock.matchAll(/<mergeCell ref="([^"]+)"\/>/g)].map((match) => match[1] ?? "")
    : [];

  const nextRefs = [
    ...sourceMergeRefs
      .filter((ref) => !intersectsRows(ref, startRow, endRow))
      .map((ref) => rewriteA1References(ref, startRow, endRow, replacementCount)),
    ...dynamicMergeCellRefs,
  ];
  const uniqueRefs = [...new Set(nextRefs)];
  const nextBlock = uniqueRefs.length > 0
    ? `<mergeCells count="${uniqueRefs.length}">${uniqueRefs.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
    : "";

  if (existingBlock) {
    return rewrittenXml.replace(existingBlock, nextBlock);
  }
  if (!nextBlock) {
    return rewrittenXml;
  }
  return rewrittenXml.replace(/(<pageMargins\b)/, `${nextBlock}$1`);
}

export function rewriteDependentRowReferences(
  xml: string,
  startRow: number,
  endRow: number,
  delta: number,
  mode: ReferenceMode,
): string {
  const replacementCount = endRow - startRow + 1 + delta;
  if (mode === "drawing") {
    return xml.replace(
      /(<(?:xdr:)?row>)(\d+)(<\/(?:xdr:)?row>)/g,
      (_full, open: string, zeroBased: string, close: string) => {
        const actualRow = Number(zeroBased) + 1;
        const shifted = shiftRowNumber(actualRow, startRow, endRow, replacementCount);
        return `${open}${Math.max(0, shifted - 1)}${close}`;
      },
    );
  }
  return rewriteWorksheetOutsideSheetData(xml, startRow, endRow, replacementCount);
}

export function replaceMarkedWorksheetRows(
  options: ReplaceMarkedWorksheetRowsOptions,
): WorksheetTransformResult {
  const { worksheetXml, startRow, endRow, rowXml, mergeCellRefs = [] } = options;
  if (startRow < 1 || endRow < startRow) {
    throw new Error(`Invalid marked row range: ${startRow}-${endRow}`);
  }

  const sheetDataMatch = worksheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
  if (!sheetDataMatch) {
    throw new Error("Worksheet is missing sheetData");
  }

  const sheetData = sheetDataMatch[1] ?? "";
  const rows = parseWorksheetRows(sheetData);
  const before = rows.filter((row) => row.row < startRow);
  const after = rows.filter((row) => row.row > endRow);
  const replacementCount = rowXml.length;
  const delta = replacementCount - (endRow - startRow + 1);
  const newEndRow = replacementEnd(startRow, replacementCount);

  const shiftedBefore = before.map((row) => (
    rewriteRowXml(
      row.xml,
      row.row,
      startRow,
      endRow,
      replacementCount,
      true,
    )
  ));
  const replacements = rowXml.map((xml, index) => (
    rewriteRowXml(xml, startRow + index, startRow, endRow, replacementCount, false)
  ));
  const shiftedAfter = after.map((row) => (
    rewriteRowXml(
      row.xml,
      row.row + delta,
      startRow,
      endRow,
      replacementCount,
      true,
    )
  ));

  const nextSheetData = `<sheetData>${[...shiftedBefore, ...replacements, ...shiftedAfter].join("")}</sheetData>`;
  const beforeSheetData = worksheetXml.slice(0, sheetDataMatch.index);
  const afterSheetData = worksheetXml.slice((sheetDataMatch.index ?? 0) + sheetDataMatch[0].length);
  const rewrittenBefore = rewriteWorksheetOutsideSheetData(
    beforeSheetData,
    startRow,
    endRow,
    replacementCount,
  );
  const rewrittenAfter = rewriteWorksheetOutsideSheetData(
    afterSheetData,
    startRow,
    endRow,
    replacementCount,
  );

  const rewrittenWorksheetXml = `${rewrittenBefore}${nextSheetData}${rewrittenAfter}`;
  const worksheetXmlWithMergedCells = rewriteMergeCellsFromOriginal(
    worksheetXml,
    rewrittenWorksheetXml,
    startRow,
    endRow,
    replacementCount,
    mergeCellRefs,
  );

  return {
    worksheetXml: worksheetXmlWithMergedCells,
    delta,
    newEndRow,
  };
}
