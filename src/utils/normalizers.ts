export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export function mergeKey(code: string, nameEn: string): string {
  return `${normalizeText(code)}::${normalizeText(nameEn)}`;
}
