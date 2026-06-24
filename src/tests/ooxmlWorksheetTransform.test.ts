import { describe, expect, it } from "vitest";
import {
  replaceMarkedWorksheetRows,
  rewriteDependentRowReferences,
} from "../services/ooxmlWorksheetTransform";

const worksheet = `<?xml version="1.0"?>
<worksheet>
  <dimension ref="A1:B4"/>
  <sheetData>
    <row r="1"><c r="A1"><v>1</v></c></row>
    <row r="2"><c r="A2"><v>2</v></c></row>
    <row r="3"><c r="A3"><v>3</v></c></row>
    <row r="4"><c r="A4"><f>SUM(A2:A3)</f><v>5</v></c></row>
  </sheetData>
  <mergeCells count="1"><mergeCell ref="A4:B4"/></mergeCells>
  <conditionalFormatting sqref="A2:A3"><cfRule type="cellIs"/></conditionalFormatting>
  <autoFilter ref="A1:B4"/>
</worksheet>`;

describe("OOXML worksheet row transformation", () => {
  it("replaces a marked region and updates row, cell, formula, merge, condition and filter references", () => {
    const result = replaceMarkedWorksheetRows({
      worksheetXml: worksheet,
      startRow: 2,
      endRow: 3,
      rowXml: [
        '<row r="2"><c r="A2"><v>20</v></c></row>',
        '<row r="3"><c r="A3"><v>30</v></c></row>',
        '<row r="4"><c r="A4"><v>40</v></c></row>',
      ],
    });

    expect(result.delta).toBe(1);
    expect(result.worksheetXml).toContain('<dimension ref="A1:B5"');
    expect(result.worksheetXml).toContain('<row r="5"><c r="A5"><f>SUM(A2:A4)</f>');
    expect(result.worksheetXml).toContain('<mergeCell ref="A5:B5"/>');
    expect(result.worksheetXml).toContain('sqref="A2:A4"');
    expect(result.worksheetXml).toContain('<autoFilter ref="A1:B5"/>');
  });

  it("contracts references when rows are deleted", () => {
    const result = replaceMarkedWorksheetRows({
      worksheetXml: worksheet,
      startRow: 2,
      endRow: 3,
      rowXml: ['<row r="2"><c r="A2"><v>99</v></c></row>'],
    });

    expect(result.delta).toBe(-1);
    expect(result.worksheetXml).toContain('<dimension ref="A1:B3"');
    expect(result.worksheetXml).toContain('<row r="3"><c r="A3"><f>SUM(A2:A2)</f>');
    expect(result.worksheetXml).toContain('<mergeCell ref="A3:B3"/>');
    expect(result.worksheetXml).toContain('sqref="A2:A2"');
  });

  it("updates table ranges and zero-based drawing anchors", () => {
    const tableXml = '<table ref="A1:B4"><autoFilter ref="A1:B4"/></table>';
    const drawingXml = '<xdr:twoCellAnchor><xdr:from><xdr:row>3</xdr:row></xdr:from><xdr:to><xdr:row>6</xdr:row></xdr:to></xdr:twoCellAnchor>';

    expect(rewriteDependentRowReferences(tableXml, 2, 3, 1, "a1"))
      .toBe('<table ref="A1:B5"><autoFilter ref="A1:B5"/></table>');
    expect(rewriteDependentRowReferences(drawingXml, 2, 3, 1, "drawing"))
      .toContain("<xdr:row>4</xdr:row>");
    expect(rewriteDependentRowReferences(drawingXml, 2, 3, 1, "drawing"))
      .toContain("<xdr:row>7</xdr:row>");
  });
});
