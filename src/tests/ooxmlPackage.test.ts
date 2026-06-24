import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { OoxmlPackage } from "../services/ooxmlPackage";

function fixture(withMacro = false): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      withMacro
        ? '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/><Override PartName="/xl/vbaProject.bin" ContentType="application/vnd.ms-office.vbaProject"/></Types>'
        : '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
    ),
    "_rels/.rels": strToU8("<Relationships/>"),
    "xl/workbook.xml": strToU8("<workbook><sheets/></workbook>"),
    "xl/_rels/workbook.xml.rels": strToU8(
      withMacro
        ? '<Relationships><Relationship Id="rIdVba" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>'
        : "<Relationships/>",
    ),
    "xl/styles.xml": strToU8("<styleSheet/>"),
    "xl/worksheets/sheet1.xml": strToU8('<worksheet><dimension ref="A1"/></worksheet>'),
  };

  if (withMacro) {
    entries["xl/vbaProject.bin"] = new Uint8Array([0, 1, 2, 3, 254, 255]);
  }

  return zipSync(entries);
}

describe("OoxmlPackage", () => {
  it("round-trips untouched package entries and only mutates requested XML", async () => {
    const source = fixture();
    const workbook = await OoxmlPackage.load(source);
    const originalStyles = workbook.readBytes("xl/styles.xml");

    workbook.writeText("xl/worksheets/sheet1.xml", '<worksheet><dimension ref="A1:B2"/></worksheet>');
    const output = workbook.save();
    const reopened = await OoxmlPackage.load(output);

    expect(String.fromCharCode(...output.subarray(0, 2))).toBe("PK");
    expect(reopened.list()).toEqual(expect.arrayContaining([
      "[Content_Types].xml",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
    ]));
    expect(reopened.readBytes("xl/styles.xml")).toEqual(originalStyles);
    expect(reopened.readText("xl/worksheets/sheet1.xml")).toContain("A1:B2");
  });

  it("preserves VBA parts and relationships byte-for-byte", async () => {
    const workbook = await OoxmlPackage.load(fixture(true));
    const macroFingerprint = workbook.macroFingerprint();

    workbook.writeText("xl/worksheets/sheet1.xml", '<worksheet><dimension ref="A1:C3"/></worksheet>');
    const reopened = await OoxmlPackage.load(workbook.save());

    expect(() => reopened.assertMacroFingerprint(macroFingerprint)).not.toThrow();
    expect(reopened.readBytes("xl/vbaProject.bin")).toEqual(new Uint8Array([0, 1, 2, 3, 254, 255]));
  });

  it("does not add macro parts to a macro-free workbook", async () => {
    const workbook = await OoxmlPackage.load(fixture(false));
    const macroFingerprint = workbook.macroFingerprint();
    const reopened = await OoxmlPackage.load(workbook.save());

    expect(macroFingerprint.hasMacros).toBe(false);
    expect(reopened.list().some((entry) => /vba|activeX|customUI/i.test(entry))).toBe(false);
  });

  it("rejects a package missing required OOXML parts", async () => {
    const workbook = await OoxmlPackage.load(zipSync({
      "[Content_Types].xml": strToU8("<Types/>"),
    }));

    expect(() => workbook.assertRequiredParts([
      "xl/workbook.xml",
      "xl/styles.xml",
    ])).toThrow(/xl\/workbook\.xml/);
  });
});
