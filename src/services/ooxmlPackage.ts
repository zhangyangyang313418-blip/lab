import { unzipSync, zipSync } from "fflate";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface MacroFingerprint {
  hasMacros: boolean;
  parts: Record<string, string>;
}

function bytesFingerprint(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const value of bytes) {
    hash ^= value;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${bytes.byteLength}:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function isMacroRelatedEntry(path: string): boolean {
  return /(^|\/)(vbaProject\.bin|activeX|customUI|.*signature.*)(\/|$)/i.test(path)
    || path === "[Content_Types].xml"
    || path === "xl/_rels/workbook.xml.rels";
}

function cloneBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

export class OoxmlPackage {
  private constructor(private readonly entries: Map<string, Uint8Array>) {}

  static async load(bytes: Uint8Array): Promise<OoxmlPackage> {
    let archive: Record<string, Uint8Array>;
    try {
      archive = unzipSync(bytes);
    } catch (error) {
      throw new Error(`Invalid OOXML ZIP package: ${error instanceof Error ? error.message : String(error)}`);
    }

    return new OoxmlPackage(new Map(
      Object.entries(archive).map(([path, value]) => [path, cloneBytes(value)]),
    ));
  }

  has(path: string): boolean {
    return this.entries.has(path);
  }

  list(): string[] {
    return Array.from(this.entries.keys()).sort();
  }

  readBytes(path: string): Uint8Array {
    const value = this.entries.get(path);
    if (!value) {
      throw new Error(`Missing OOXML part: ${path}`);
    }
    return cloneBytes(value);
  }

  readText(path: string): string {
    return textDecoder.decode(this.readBytes(path));
  }

  writeBytes(path: string, value: Uint8Array): void {
    this.entries.set(path, cloneBytes(value));
  }

  writeText(path: string, value: string): void {
    this.writeBytes(path, textEncoder.encode(value));
  }

  assertRequiredParts(paths: readonly string[]): void {
    const missing = paths.filter((path) => !this.has(path));
    if (missing.length > 0) {
      throw new Error(`Missing required OOXML parts: ${missing.join(", ")}`);
    }
  }

  macroFingerprint(): MacroFingerprint {
    const macroEntries = this.list().filter((path) => /vbaProject\.bin|activeX|customUI|signature/i.test(path));
    const hasMacros = macroEntries.length > 0;
    const trackedEntries = this.list().filter((path) => (
      macroEntries.includes(path)
      || (hasMacros && isMacroRelatedEntry(path))
    ));

    return {
      hasMacros,
      parts: Object.fromEntries(
        trackedEntries.map((path) => [path, bytesFingerprint(this.readBytes(path))]),
      ),
    };
  }

  assertMacroFingerprint(expected: MacroFingerprint): void {
    const actual = this.macroFingerprint();
    if (actual.hasMacros !== expected.hasMacros) {
      throw new Error("Macro presence changed during OOXML export");
    }

    const expectedEntries = Object.entries(expected.parts);
    if (expectedEntries.length !== Object.keys(actual.parts).length) {
      throw new Error("Macro-related OOXML part count changed during export");
    }

    for (const [path, fingerprint] of expectedEntries) {
      if (actual.parts[path] !== fingerprint) {
        throw new Error(`Macro-related OOXML part changed during export: ${path}`);
      }
    }
  }

  assertNoFormulaErrors(): void {
    const errorPattern = /#REF!|#VALUE!|#DIV\/0!|#NAME\?|#N\/A/;
    const failedParts = this.list().filter((path) => (
      path.endsWith(".xml") && errorPattern.test(this.readText(path))
    ));
    if (failedParts.length > 0) {
      throw new Error(`Formula error text found in OOXML parts: ${failedParts.join(", ")}`);
    }
  }

  save(): Uint8Array {
    return zipSync(Object.fromEntries(
      Array.from(this.entries.entries()).map(([path, value]) => [path, cloneBytes(value)]),
    ));
  }
}
