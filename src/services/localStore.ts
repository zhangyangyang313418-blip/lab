import type { ProjectSetup } from "../types/project";
import type { EditableTestItem, TestDomain } from "../types/testing";
import type { EnvironmentPlanSheet } from "../types/environmentPlan";

export const PROJECT_DRAFT_STORAGE_KEY = "project_draft";
export const ENVIRONMENT_PLAN_TEMPLATE_VERSION = 28;

export interface ProjectDraft {
  projectSetup: ProjectSetup;
  domainItems: Record<TestDomain, EditableTestItem[]>;
  environmentPlan: EnvironmentPlanSheet;
  environmentPlanVersion?: number;
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function saveProjectDraft(draft: ProjectDraft): void {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(PROJECT_DRAFT_STORAGE_KEY, JSON.stringify(draft));
}

export function loadProjectDraft(): ProjectDraft | null {
  const storage = getStorage();

  if (!storage) {
    return null;
  }

  const raw = storage.getItem(PROJECT_DRAFT_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!isRecord(parsed) || !isRecord(parsed.projectSetup) || !isRecord(parsed.domainItems)) {
      return null;
    }

    return {
      projectSetup: parsed.projectSetup as unknown as ProjectSetup,
      domainItems: parsed.domainItems as unknown as ProjectDraft["domainItems"],
      environmentPlan: parsed.environmentPlan as unknown as EnvironmentPlanSheet,
      ...(typeof parsed.environmentPlanVersion === "number"
        ? { environmentPlanVersion: parsed.environmentPlanVersion }
        : {}),
    };
  } catch {
    return null;
  }
}

export function clearProjectDraft(): void {
  const storage = getStorage();

  storage?.removeItem(PROJECT_DRAFT_STORAGE_KEY);
}
