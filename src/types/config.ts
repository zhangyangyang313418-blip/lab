import type { PlatformCode, SteeringSide } from "./project";
import type { EditableTestItem } from "./testing";

export interface PlatformTemplate {
  platform: PlatformCode;
  steeringSide: SteeringSide;
  workbookName: string;
  sheetNames: string[];
  items: EditableTestItem[];
}

export interface ImportedConfigBundle {
  platformTemplates: PlatformTemplate[];
  materialItems: EditableTestItem[];
  emcItems: EditableTestItem[];
  pricingItems: EditableTestItem[];
  importedAt: string;
}
