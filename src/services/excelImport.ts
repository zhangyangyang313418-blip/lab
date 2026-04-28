export type ImportedWorkbookKind =
  | "platform_environment"
  | "material_template"
  | "pricing"
  | "unknown";

export interface ImportedWorkbookName {
  kind: ImportedWorkbookKind;
  label: string;
}

function getBaseWorkbookName(fileName: string): string {
  const trimmed = fileName.trim();
  const lastPathSegment = trimmed.split(/[\\/]/).pop() ?? trimmed;

  return lastPathSegment.replace(/\.[^.]+$/, "") || lastPathSegment;
}

export function parseImportedWorkbookName(fileName: string): ImportedWorkbookName {
  const label = getBaseWorkbookName(fileName);
  const normalized = label.toLowerCase();

  if (/(环境|可靠性|environment|platform)/.test(label) || /(environment|platform)/.test(normalized)) {
    return { kind: "platform_environment", label };
  }

  if (/材料|material/.test(label) || /material/.test(normalized)) {
    return { kind: "material_template", label };
  }

  if (/报价|pricing|price|quote/.test(label) || /pricing|price|quote/.test(normalized)) {
    return { kind: "pricing", label };
  }

  return { kind: "unknown", label };
}
