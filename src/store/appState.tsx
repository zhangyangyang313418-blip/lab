import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";
import { seedChangeOptions } from "../data/seed/changeOptions";
import { seedEmcItems } from "../data/seed/emcTemplates";
import { createSeedEnvironmentPlan } from "../data/seed/environmentPlan";
import { seedMaterialItems } from "../data/seed/materialTemplates";
import { seedPlatformTemplates } from "../data/seed/platformTemplates";
import { defaultProjectSetup } from "../data/seed/project";
import { calculateItemCost } from "../services/calculationEngine";
import { applyEnvironmentFeeDetailsToPhase } from "../services/environmentFeeDetail";
import {
  ENVIRONMENT_PLAN_TEMPLATE_VERSION,
  loadProjectDraft,
  saveProjectDraft,
  type ProjectDraft,
} from "../services/localStore";
import { matchRecommendedItems } from "../services/matchEngine";
import type { EnvironmentPlanGroup, EnvironmentPlanPhase, EnvironmentPlanRow, EnvironmentPlanSheet } from "../types/environmentPlan";
import type { PlatformCode, ProjectSetup } from "../types/project";
import type { EditableTestItem, TestDomain } from "../types/testing";
import { formatSteeringSides, normalizeSteeringSides } from "../utils/projectLabels";

export interface AppState {
  projectSetup: ProjectSetup;
  domainItems: Record<TestDomain, EditableTestItem[]>;
  environmentPlan: EnvironmentPlanSheet;
  lastEnvironmentPlan: EnvironmentPlanSheet | null;
}

export type AppAction =
  | {
      type: "updateProjectSetup";
      updates: Partial<ProjectSetup>;
    }
  | {
      type: "applyProjectSetup";
      updates: Partial<ProjectSetup>;
    }
  | {
      type: "setDescription";
      description: string;
    }
  | {
      type: "updateEnvironmentPlanSummary";
      phaseId: string;
      field: keyof EnvironmentPlanPhase["summary"];
      value: string;
    }
  | {
      type: "updateEnvironmentPlanGroup";
      phaseId: string;
      groupId: string;
      field: "title" | "totalSampleQty" | "totalDurationDays" | "totalCost";
      value: string;
    }
  | {
      type: "updateEnvironmentPlanRow";
      phaseId: string;
      groupId: string;
      rowId: string;
      field: "label" | "testHours" | "sampleRange";
      value: string;
    }
  | {
      type: "updateEnvironmentPlanRowFeeBasis";
      phaseId: string;
      groupId: string;
      rowId: string;
      basis: "hour" | "quantity" | "batch";
      value: string;
    }
  | {
      type: "addEnvironmentPlanRow";
      phaseId: string;
      groupId: string;
      row: EnvironmentPlanRow;
      beforeRowId?: string;
      afterRowId?: string;
    }
  | {
      type: "addEnvironmentPlanGroup";
      phaseId: string;
      group: EnvironmentPlanGroup;
      beforeGroupId?: string;
      afterGroupId?: string;
    }
  | {
      type: "removeEnvironmentPlanGroup";
      phaseId: string;
      groupId: string;
    }
  | {
      type: "removeEnvironmentPlanRow";
      phaseId: string;
      groupId: string;
      rowId: string;
    }
  | {
      type: "undoEnvironmentPlan";
    }
  | {
      type: "toggleChangeId";
      changeId: string;
    }
  | {
      type: "setDomainItems";
      domain: TestDomain;
      items: EditableTestItem[];
    }
  | {
      type: "updateItem";
      domain: TestDomain;
      itemId: string;
      updates: Partial<EditableTestItem>;
    }
  | {
      type: "addItem";
      domain: TestDomain;
      item: EditableTestItem;
    }
  | {
      type: "removeItem";
      domain: TestDomain;
      itemId: string;
    }
  | {
      type: "confirmPlan";
    }
  | {
      type: "resetToSeed";
    };

interface AppStateContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function normalizeItem(item: EditableTestItem): EditableTestItem {
  return {
    ...item,
    cost: calculateItemCost(item),
  };
}

function getSeedEnvironmentItems(
  platform: PlatformCode,
  steeringSides: ProjectSetup["steeringSides"] = ["LHD"],
): EditableTestItem[] {
  const selectedSides = normalizeSteeringSides(steeringSides);

  return seedPlatformTemplates
    .filter((template) => template.platform === platform && selectedSides.includes(template.steeringSide))
    .flatMap((template) => template.items);
}

function createChangeProjectDomainItems(projectSetup: ProjectSetup): Record<TestDomain, EditableTestItem[]> {
  const environmentCandidates = getSeedEnvironmentItems(projectSetup.platform, projectSetup.steeringSides);
  const environmentItems = matchRecommendedItems({
    description: projectSetup.description,
    selectedChangeIds: projectSetup.selectedChangeIds,
    changeOptions: seedChangeOptions,
    candidateItems: environmentCandidates,
  }).map(normalizeItem);

  const emcItems = matchRecommendedItems({
    description: projectSetup.description,
    selectedChangeIds: projectSetup.selectedChangeIds,
    changeOptions: seedChangeOptions,
    candidateItems: seedEmcItems,
  }).map(normalizeItem);

  return {
    environment: environmentItems,
    material: [],
    emc: emcItems,
  };
}

function createSeedDomainItems(projectSetup: ProjectSetup): Record<TestDomain, EditableTestItem[]> {
  if (projectSetup.projectType === "change_project") {
    return createChangeProjectDomainItems(projectSetup);
  }

  return {
    environment: projectSetup.reuseEnvironmentTemplate
      ? getSeedEnvironmentItems(projectSetup.platform, projectSetup.steeringSides).map(normalizeItem)
      : [],
    material: projectSetup.reuseMaterialTemplate
      ? seedMaterialItems.map(normalizeItem)
      : [],
    emc: projectSetup.reuseEmcTemplate
      ? seedEmcItems.map(normalizeItem)
      : [],
  };
}

function createSeedProjectSetup(): ProjectSetup {
  return {
    ...defaultProjectSetup,
  };
}

function formatEnvironmentPlanProjectCode(projectSetup: ProjectSetup): string {
  const steeringLabel = formatSteeringSides(projectSetup.steeringSides);
  return `${projectSetup.projectCode} ${steeringLabel}`.trim();
}

function createEnvironmentPlanForSetup(projectSetup: ProjectSetup): EnvironmentPlanSheet {
  const steeringSides = normalizeSteeringSides(projectSetup.steeringSides);

  if (steeringSides.length <= 1) {
    return createSeedEnvironmentPlan(
      projectSetup.platform,
      formatEnvironmentPlanProjectCode(projectSetup),
      getSeedEnvironmentItems(projectSetup.platform, steeringSides).map(normalizeItem),
    );
  }

  const phases = steeringSides.flatMap((steeringSide) => {
    const sideProjectSetup = {
      ...projectSetup,
      steeringSides: [steeringSide],
    };
    const sidePlan = createSeedEnvironmentPlan(
      projectSetup.platform,
      formatEnvironmentPlanProjectCode(sideProjectSetup),
      getSeedEnvironmentItems(projectSetup.platform, [steeringSide]).map(normalizeItem),
    );

    return sidePlan.phases.map((phase) => ({
      ...phase,
      id: `${phase.id}-${steeringSide.toLowerCase()}`,
    }));
  });

  return {
    platform: projectSetup.platform,
    phases,
  };
}

function mergeEnvironmentPlanRow(
  draftRow: EnvironmentPlanRow,
  templateRow?: EnvironmentPlanRow,
  refreshTimings = false,
): EnvironmentPlanRow {
  const shouldRefreshLabel = refreshTimings
    && templateRow
    && (/L6|Internal Inspection/i.test(draftRow.label) || /L6|Internal Inspection/i.test(templateRow.label));

  return {
    ...draftRow,
    ...(templateRow?.sampleRange && (!draftRow.sampleRange || refreshTimings) ? { sampleRange: templateRow.sampleRange } : {}),
    ...(templateRow?.fee && !draftRow.fee ? { fee: templateRow.fee } : {}),
    ...(shouldRefreshLabel ? { label: templateRow.label } : {}),
    ...(refreshTimings && templateRow ? { testHours: templateRow.testHours } : {}),
    ...(refreshTimings && templateRow ? { fee: templateRow.fee } : {}),
    ...(refreshTimings && templateRow?.feeBasisOverrides ? { feeBasisOverrides: templateRow.feeBasisOverrides } : {}),
  };
}

function mergeEnvironmentPlanGroup(
  draftGroup: EnvironmentPlanGroup,
  templateGroup?: EnvironmentPlanGroup,
  refreshTimings = false,
): EnvironmentPlanGroup {
  const templateRowsById = new Map((templateGroup?.rows ?? []).map((row) => [row.id, row]));
  const draftRowsById = new Map(draftGroup.rows.map((row) => [row.id, row]));
  const mergedRows = (templateGroup?.rows ?? []).map((row) =>
    mergeEnvironmentPlanRow(draftRowsById.get(row.id) ?? row, row, refreshTimings),
  );

  return {
    ...draftGroup,
    ...(templateGroup?.totalSamplePrefix && !draftGroup.totalSamplePrefix ? { totalSamplePrefix: templateGroup.totalSamplePrefix } : {}),
    ...(refreshTimings && templateGroup
      ? {
          totalSamplePrefix: templateGroup.totalSamplePrefix,
          totalDurationDays: templateGroup.totalDurationDays,
        }
      : {}),
    rows: mergedRows,
  };
}

function mergeEnvironmentPlanWithTemplate(
  draftPlan: EnvironmentPlanSheet | undefined,
  templatePlan: EnvironmentPlanSheet,
  refreshTimings = false,
): EnvironmentPlanSheet {
  if (!draftPlan) {
    return templatePlan;
  }

  const templatePhasesById = new Map(templatePlan.phases.map((phase) => [phase.id, phase]));
  const draftPhases = refreshTimings
    ? draftPlan.phases.filter((phase) => templatePhasesById.has(phase.id))
    : draftPlan.phases;
  const draftPhaseIds = new Set(draftPhases.map((phase) => phase.id));

  return {
    ...draftPlan,
    phases: [
      ...draftPhases.map((phase) => {
      const templatePhase = templatePhasesById.get(phase.id);
      const templateGroupsById = new Map((templatePhase?.groups ?? []).map((group) => [group.id, group]));
      const seedGroupPrefixes = ["mla-group-", "mla-rhd-group-", "ema-group-", "ema-rhd-group-"];
      const mergedGroups = phase.groups
        .filter((group) => {
          if (!refreshTimings) {
            return true;
          }

          const isSeedGroup = seedGroupPrefixes.some((prefix) => group.id.startsWith(prefix));
          return !isSeedGroup || templateGroupsById.has(group.id);
        })
        .map((group) =>
          mergeEnvironmentPlanGroup(group, templateGroupsById.get(group.id), refreshTimings),
        );
      const missingGroups = (templatePhase?.groups ?? []).filter(
        (group) => !phase.groups.some((draftGroup) => draftGroup.id === group.id),
      );

      return {
        ...phase,
        ...(refreshTimings && templatePhase
          ? {
              summary: templatePhase.summary,
            }
          : {}),
        groups: [...mergedGroups, ...missingGroups],
      };
      }),
      ...templatePlan.phases.filter((phase) => !draftPhaseIds.has(phase.id)),
    ],
  };
}

function recalculateEnvironmentPlanPhaseSummary(phase: EnvironmentPlanPhase): EnvironmentPlanPhase {
  const totalSampleQty = phase.groups.reduce((sum, group) => sum + Number(group.totalSampleQty || 0), 0);

  return {
    ...phase,
    summary: {
      ...phase.summary,
      totalSampleQty: String(totalSampleQty),
    },
  };
}

function isManualEnvironmentPlanRow(row: EnvironmentPlanRow): boolean {
  return row.id.startsWith("manual-");
}

function normalizeEnvironmentPlanLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function findExistingEnvironmentPlanRowByLabel(
  groups: EnvironmentPlanGroup[],
  targetRowId: string,
  label: string,
): EnvironmentPlanRow | undefined {
  const normalizedLabel = normalizeEnvironmentPlanLabel(label);

  if (!normalizedLabel) {
    return undefined;
  }

  return groups
    .flatMap((group) => group.rows)
    .find((row) =>
      row.id !== targetRowId
      && !isManualEnvironmentPlanRow(row)
      && normalizeEnvironmentPlanLabel(row.label) === normalizedLabel);
}

function applyKnownEnvironmentPlanRowMatch(
  phase: EnvironmentPlanPhase,
  groupId: string,
  rowId: string,
  field: "label" | "testHours" | "sampleRange",
  value: string,
): EnvironmentPlanPhase {
  const targetRow = phase.groups.find((group) => group.id === groupId)?.rows.find((row) => row.id === rowId);
  const matchingRow = field === "label" && targetRow && isManualEnvironmentPlanRow(targetRow)
    ? findExistingEnvironmentPlanRowByLabel(phase.groups, rowId, value)
    : undefined;
  const nextPhase = {
    ...phase,
    groups: phase.groups.map((group) =>
      group.id === groupId
        ? {
            ...group,
            rows: group.rows.map((row) =>
              row.id === rowId
                ? {
                    ...row,
                    [field]: value,
                    ...(matchingRow ? { testHours: matchingRow.testHours } : {}),
                  }
                : row),
          }
        : group),
  };

  return matchingRow ? applyEnvironmentFeeDetailsToPhase(nextPhase) : nextPhase;
}

function createStateFromDraft(draft?: ProjectDraft | null): AppState {
  const projectSetup = {
    ...createSeedProjectSetup(),
    ...(draft?.projectSetup ?? {}),
  };
  projectSetup.steeringSides = normalizeSteeringSides(projectSetup.steeringSides);
  const seedDomainItems = createSeedDomainItems(projectSetup);
  const draftDomainItems = {
    environment: (draft?.domainItems?.environment ?? seedDomainItems.environment).map(normalizeItem),
    material: (draft?.domainItems?.material ?? seedDomainItems.material).map(normalizeItem),
    emc: (draft?.domainItems?.emc ?? seedDomainItems.emc).map(normalizeItem),
  };
  const templateEnvironmentPlan = createEnvironmentPlanForSetup(projectSetup);
  const isMismatchedEnvironmentPlatform = Boolean(draft?.environmentPlan && draft.environmentPlan.platform !== projectSetup.platform);
  const refreshEnvironmentTiming = isMismatchedEnvironmentPlatform
    || (draft?.environmentPlanVersion ?? 0) < ENVIRONMENT_PLAN_TEMPLATE_VERSION;
  const environmentPlan = mergeEnvironmentPlanWithTemplate(
    isMismatchedEnvironmentPlatform ? undefined : draft?.environmentPlan,
    templateEnvironmentPlan,
    refreshEnvironmentTiming,
  );

  return {
    projectSetup,
    domainItems: draftDomainItems,
    environmentPlan,
    lastEnvironmentPlan: null,
  };
}

export function createSeedAppState(): AppState {
  return createStateFromDraft();
}

export function createInitialAppState(): AppState {
  return createStateFromDraft(loadProjectDraft());
}

function updateDomainItems(
  state: AppState,
  domain: TestDomain,
  nextItems: EditableTestItem[],
): AppState {
  return {
    ...state,
    domainItems: {
      ...state.domainItems,
      [domain]: nextItems.map(normalizeItem),
    },
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "updateProjectSetup":
      return {
        ...state,
        projectSetup: {
          ...state.projectSetup,
          ...action.updates,
          steeringSides: normalizeSteeringSides(action.updates.steeringSides ?? state.projectSetup.steeringSides),
        },
      };
    case "applyProjectSetup": {
      const projectSetup = {
        ...state.projectSetup,
        ...action.updates,
        steeringSides: normalizeSteeringSides(action.updates.steeringSides ?? state.projectSetup.steeringSides),
        confirmed: false,
      };
      const domainItems = createSeedDomainItems(projectSetup);

      return {
        projectSetup,
        domainItems,
        environmentPlan: createEnvironmentPlanForSetup(projectSetup),
        lastEnvironmentPlan: null,
      };
    }
    case "setDescription":
      if (state.projectSetup.projectType !== "change_project") {
        return {
          ...state,
          projectSetup: {
            ...state.projectSetup,
            description: action.description,
          },
        };
      }

      return {
        ...state,
        projectSetup: {
          ...state.projectSetup,
          description: action.description,
        },
        domainItems: createChangeProjectDomainItems({
          ...state.projectSetup,
          description: action.description,
        }),
      };
    case "toggleChangeId": {
      const selectedChangeIds = state.projectSetup.selectedChangeIds.includes(action.changeId)
        ? state.projectSetup.selectedChangeIds.filter((changeId) => changeId !== action.changeId)
        : [...state.projectSetup.selectedChangeIds, action.changeId];

      if (state.projectSetup.projectType !== "change_project") {
        return {
          ...state,
          projectSetup: {
            ...state.projectSetup,
            selectedChangeIds,
          },
        };
      }

      return {
        ...state,
        projectSetup: {
          ...state.projectSetup,
          selectedChangeIds,
        },
        domainItems: createChangeProjectDomainItems({
          ...state.projectSetup,
          selectedChangeIds,
        }),
      };
    }
    case "setDomainItems":
      return updateDomainItems(state, action.domain, action.items);
    case "updateEnvironmentPlanSummary":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? {
                  ...phase,
                  summary: {
                    ...phase.summary,
                    [action.field]: action.value,
                  },
                }
              : phase),
        },
      };
    case "updateEnvironmentPlanGroup":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? recalculateEnvironmentPlanPhaseSummary({
                  ...phase,
                  groups: phase.groups.map((group) =>
                    group.id === action.groupId ? { ...group, [action.field]: action.value } : group),
                })
              : phase),
        },
      };
    case "updateEnvironmentPlanRow":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? applyKnownEnvironmentPlanRowMatch(phase, action.groupId, action.rowId, action.field, action.value)
              : phase),
        },
      };
    case "updateEnvironmentPlanRowFeeBasis":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? {
                  ...phase,
                  groups: phase.groups.map((group) =>
                    group.id === action.groupId
                      ? {
                          ...group,
                          rows: group.rows.map((row) =>
                            row.id === action.rowId
                              ? {
                                  ...row,
                                  feeBasisOverrides: {
                                    ...(row.feeBasisOverrides ?? {}),
                                    [action.basis]: action.value,
                                  },
                                }
                              : row),
                        }
                      : group),
                }
              : phase),
        },
      };
    case "addEnvironmentPlanRow":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? {
                  ...phase,
                  groups: phase.groups.map((group) =>
                    group.id === action.groupId
                      ? {
                          ...group,
                          rows: action.beforeRowId
                            ? group.rows.flatMap((row) => (row.id === action.beforeRowId ? [action.row, row] : [row]))
                            : action.afterRowId
                              ? group.rows.flatMap((row) => (row.id === action.afterRowId ? [row, action.row] : [row]))
                              : [...group.rows, action.row],
                        }
                      : group),
                }
              : phase),
        },
      };
    case "addEnvironmentPlanGroup":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? recalculateEnvironmentPlanPhaseSummary({
                  ...phase,
                  groups: action.beforeGroupId
                    ? phase.groups.flatMap((group) => (group.id === action.beforeGroupId ? [action.group, group] : [group]))
                    : action.afterGroupId
                      ? phase.groups.flatMap((group) => (group.id === action.afterGroupId ? [group, action.group] : [group]))
                      : [...phase.groups, action.group],
                })
              : phase),
        },
      };
    case "removeEnvironmentPlanGroup":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? recalculateEnvironmentPlanPhaseSummary({
                  ...phase,
                  groups: phase.groups.filter((group) => group.id !== action.groupId),
                })
              : phase),
        },
      };
    case "removeEnvironmentPlanRow":
      return {
        ...state,
        lastEnvironmentPlan: state.environmentPlan,
        environmentPlan: {
          ...state.environmentPlan,
          phases: state.environmentPlan.phases.map((phase) =>
            phase.id === action.phaseId
              ? {
                  ...phase,
                  groups: phase.groups.map((group) =>
                    group.id === action.groupId
                      ? {
                          ...group,
                          rows: group.rows.filter((row) => row.id !== action.rowId),
                        }
                      : group),
                }
              : phase),
        },
      };
    case "undoEnvironmentPlan":
      if (!state.lastEnvironmentPlan) {
        return state;
      }

      return {
        ...state,
        environmentPlan: state.lastEnvironmentPlan,
        lastEnvironmentPlan: null,
      };
    case "updateItem": {
      const items = state.domainItems[action.domain].map((item) => {
        if (item.id !== action.itemId) {
          return item;
        }

        return normalizeItem({
          ...item,
          ...action.updates,
        });
      });

      return updateDomainItems(state, action.domain, items);
    }
    case "addItem":
      return updateDomainItems(state, action.domain, [...state.domainItems[action.domain], action.item]);
    case "removeItem":
      return updateDomainItems(
        state,
        action.domain,
        state.domainItems[action.domain].filter((item) => item.id !== action.itemId),
      );
    case "confirmPlan":
      return {
        ...state,
        projectSetup: {
          ...state.projectSetup,
          confirmed: true,
        },
      };
    case "resetToSeed":
      return createSeedAppState();
    default:
      return state;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, createInitialAppState);

  useEffect(() => {
    saveProjectDraft({
      projectSetup: state.projectSetup,
      domainItems: state.domainItems,
      environmentPlan: state.environmentPlan,
      environmentPlanVersion: ENVIRONMENT_PLAN_TEMPLATE_VERSION,
    });
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);

  if (!value) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }

  return value;
}
