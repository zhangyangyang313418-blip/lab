import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultProjectSetup } from "../data/seed/project";
import { seedEmcItems } from "../data/seed/emcTemplates";
import { seedMaterialItems } from "../data/seed/materialTemplates";
import { seedPlatformTemplates } from "../data/seed/platformTemplates";
import type { ProjectDraft } from "../services/localStore";
import {
  clearProjectDraft,
  loadProjectDraft,
  saveProjectDraft,
} from "../services/localStore";
import { parseImportedWorkbookName } from "../services/excelImport";
import { appReducer, createInitialAppState, createSeedAppState } from "../store/appState";

const seedEnvironmentItems = seedPlatformTemplates.find((template) => template.platform === defaultProjectSetup.platform)?.items ?? [];

function createDraft(): ProjectDraft {
  return {
    projectSetup: {
      ...defaultProjectSetup,
      description: "Door module redesign",
      selectedChangeIds: ["pcb_material_change"],
      confirmed: true,
    },
    domainItems: {
      environment: seedEnvironmentItems,
      material: seedMaterialItems,
      emc: seedEmcItems,
    },
    environmentPlan: {
      platform: defaultProjectSetup.platform,
      phases: [
        {
          id: "dv",
          title: "DV",
          summary: {
            projectLabel: "项目",
            projectCode: defaultProjectSetup.projectCode,
            phaseLabel: "阶段",
            phaseValue: "DV",
            totalSampleLabel: "样本总数量",
            totalSampleQty: "120",
            longestDurationLabel: "最长测试时间(天)",
            longestDurationDays: "13",
            totalCostLabel: "总费用",
            totalCost: "58000",
          },
          groups: [],
        },
        {
          id: "pv",
          title: "PV",
          summary: {
            projectLabel: "项目",
            projectCode: defaultProjectSetup.projectCode,
            phaseLabel: "阶段",
            phaseValue: "PV",
            totalSampleLabel: "样本总数量",
            totalSampleQty: "179",
            longestDurationLabel: "最长测试时间(天)",
            longestDurationDays: "13",
            totalCostLabel: "总费用",
            totalCost: "68000",
          },
          groups: [],
        },
      ],
    },
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("local draft persistence", () => {
  it("saves, loads, and clears the project draft", () => {
    const draft = createDraft();

    expect(loadProjectDraft()).toBeNull();

    saveProjectDraft(draft);

    expect(loadProjectDraft()).toEqual(draft);

    clearProjectDraft();

    expect(loadProjectDraft()).toBeNull();
  });

  it("hydrates missing environment sample ranges from the latest template when loading an old draft", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    const legacyDraft: ProjectDraft = {
      ...mlaDraft,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) => {
              const nextRow = { ...row } as typeof row & { sampleRange?: string };
              delete nextRow.sampleRange;
              return nextRow;
            }),
          })),
        })),
      },
    };

    saveProjectDraft(legacyDraft);

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");
    const groupA = dvPhase?.groups.find((group) => group.id === "mla-group-a");

    expect(groupA?.rows.find((row) => row.id === "a-k1")?.sampleRange).toBe("1-12");
    expect(groupA?.rows.find((row) => row.id === "a-k16-1")?.sampleRange).toBe("1-14");
  });

  it("refreshes drafts saved before the coefficient-table fee basis update", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...mlaDraft,
      environmentPlanVersion: 16,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) => (row.id === "a-k1" ? { ...row, fee: "1920" } : row)),
          })),
        })),
      },
    });

    const hydrated = createInitialAppState();
    const pvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "pv");
    const groupA = pvPhase?.groups.find((group) => group.id === "mla-group-a");

    expect(groupA?.rows.find((row) => row.id === "a-k1")?.fee).toBe("720");
  });

  it("refreshes version 19 drafts saved before the K22 additive component fee update", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...mlaDraft,
      environmentPlanVersion: 19,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) => (row.id === "b-k22" ? { ...row, fee: "324000" } : row)),
          })),
        })),
      },
    });

    const hydrated = createInitialAppState();
    const pvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "pv");
    const groupB = pvPhase?.groups.find((group) => group.id === "mla-group-b");

    expect(groupB?.rows.find((row) => row.id === "b-k22")?.fee).toBe("11190");
  });

  it("refreshes version 21 drafts saved before the K26 composite fee update", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...mlaDraft,
      environmentPlanVersion: 21,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) => (row.id === "c-k26" ? { ...row, fee: "15000" } : row)),
          })),
        })),
      },
    });

    const hydrated = createInitialAppState();
    const pvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "pv");
    const groupC = pvPhase?.groups.find((group) => group.id === "mla-group-c");

    expect(groupC?.rows.find((row) => row.id === "c-k26")?.fee).toBe("7158");
  });

  it("refreshes version 22 drafts saved before the D-3 internal L6 duration fix", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...mlaDraft,
      environmentPlanVersion: 22,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) =>
              row.id === "d3-post-l6-internal" || row.id === "ed3-post-l6-internal"
                ? { ...row, testHours: "20" }
                : row,
            ),
          })),
        })),
      },
    });

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");
    const pvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "pv");
    const dvGroupD3 = dvPhase?.groups.find((group) => group.id === "mla-group-d3");
    const pvGroupD3 = pvPhase?.groups.find((group) => group.id === "mla-group-d3");

    expect(dvGroupD3?.rows.find((row) => row.id === "d3-post-l6-internal")?.testHours).toBe("3");
    expect(pvGroupD3?.rows.find((row) => row.id === "d3-post-l6-internal")?.testHours).toBe("3");
  });

  it("drops obsolete environment rows when the template has been simplified", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    const legacyDraft: ProjectDraft = {
      ...mlaDraft,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) =>
            group.id === "mla-group-c"
              ? {
                  ...group,
                  rows: [
                    ...group.rows.filter((row) => row.id !== "c-k26"),
                    { id: "c-k26-room", label: "K26 Mechanical Wear-Out (Room)", testHours: "14" },
                    { id: "c-k26-cold", label: "K26 Mechanical Wear-Out (Cold)", testHours: "4" },
                    { id: "c-k26-hot", label: "K26 Mechanical Wear-Out (Hot)", testHours: "4" },
                  ],
                }
              : group,
          ),
        })),
      },
    };

    saveProjectDraft(legacyDraft);

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");
    const groupC = dvPhase?.groups.find((group) => group.id === "mla-group-c");

    expect(groupC?.rows.find((row) => row.id === "c-k26")?.label).toBe("K26 Mechanical Wear-Out");
    expect(groupC?.rows.some((row) => row.id === "c-k26-room")).toBe(false);
    expect(groupC?.rows.some((row) => row.id === "c-k26-cold")).toBe(false);
    expect(groupC?.rows.some((row) => row.id === "c-k26-hot")).toBe(false);
  });

  it("upgrades legacy environment timing values from the latest template", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    const legacyDraft: ProjectDraft = {
      ...mlaDraft,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) => ({
              ...row,
              testHours: "1",
            })),
          })),
        })),
      },
    };

    saveProjectDraft(legacyDraft);

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");
    const groupA = dvPhase?.groups.find((group) => group.id === "mla-group-a");
    const groupD1 = dvPhase?.groups.find((group) => group.id === "mla-group-d1");
    const groupE2 = dvPhase?.groups.find((group) => group.id === "mla-group-e2");

    expect(dvPhase?.summary.longestDurationDays).toBe("111");
    expect(groupA?.rows.find((row) => row.id === "a-optical")?.testHours).toBe("7");
    expect(groupA?.rows.find((row) => row.id === "a-k7")?.testHours).toBe("6");
    expect(groupD1?.rows.find((row) => row.id === "d1-k21")?.testHours).toBe("16");
    expect(groupE2?.rows.find((row) => row.id === "e2-item")?.testHours).toBe("20");
  });

  it("refreshes stale L6 labels and durations from the latest template", () => {
    const state = createSeedAppState();
    const mlaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...mlaDraft,
      environmentPlanVersion: 20,
      environmentPlan: {
        ...mlaDraft.environmentPlan,
        phases: mlaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: phase.groups.map((group) => ({
            ...group,
            rows: group.rows.map((row) =>
              row.id.endsWith("post-l6") || row.id === "d3-post-l6-internal" || row.id === "d3-post-l6-external"
                ? {
                    ...row,
                    label: "L6 Internal Inspection",
                    testHours: "1",
                  }
                : row,
            ),
          })),
        })),
      },
    });

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");
    const groupB = dvPhase?.groups.find((group) => group.id === "mla-group-b");
    const groupC = dvPhase?.groups.find((group) => group.id === "mla-group-c");
    const groupD3 = dvPhase?.groups.find((group) => group.id === "mla-group-d3");

    expect(groupB?.rows.find((row) => row.id === "b-post-l6")?.label).toBe("L6-photo&xray");
    expect(groupB?.rows.find((row) => row.id === "b-post-l6")?.testHours).toBe("7");
    expect(groupC?.rows.find((row) => row.id === "c-post-l6")?.label).toBe("L6-photo&xray");
    expect(groupC?.rows.find((row) => row.id === "c-post-l6")?.testHours).toBe("3");
    expect(groupD3?.rows.find((row) => row.id === "d3-post-l6-internal")?.label).toBe("L6-photo&xray");
    expect(groupD3?.rows.find((row) => row.id === "d3-post-l6-internal")?.testHours).toBe("3");
    expect(groupD3?.rows.find((row) => row.id === "d3-post-l6-external")?.label).toBe("L6-SEM&SECTION");
  });

  it("removes obsolete seed groups when hydrating an older RHD draft", () => {
    const state = createSeedAppState();
    const rhdDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        steeringSides: ["RHD"],
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    const legacyDraft: ProjectDraft = {
      ...rhdDraft,
      environmentPlanVersion: 12,
      environmentPlan: {
        ...rhdDraft.environmentPlan,
        phases: rhdDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          groups: [
            ...phase.groups,
            {
              id: "mla-group-b",
              title: "Group B",
              totalSampleLabel: "Total样机数量",
              totalSampleQty: "12",
              totalDurationLabel: "组测试时间(天)",
              totalDurationDays: "21",
              totalCostLabel: "组费用",
              totalCost: "1",
              rows: [{ id: "b-k22", label: "K22 Chemical Resistance", testHours: "5" }],
            },
          ],
        })),
      },
    };

    saveProjectDraft(legacyDraft);

    const hydrated = createInitialAppState();

    expect(hydrated.environmentPlan.phases[0]?.groups.some((group) => group.id === "mla-group-b")).toBe(false);
    expect(hydrated.environmentPlan.phases[1]?.groups.some((group) => group.id === "mla-group-b")).toBe(false);
  });

  it("refreshes stale EMA RHD drafts to the RHD test-flow outline", () => {
    const state = createSeedAppState();
    const staleEmaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "EMA",
        steeringSides: ["LHD"],
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...staleEmaDraft,
      projectSetup: {
        ...staleEmaDraft.projectSetup,
        steeringSides: ["RHD"],
      },
      environmentPlanVersion: 13,
    });

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");

    expect(dvPhase?.groups.some((group) => group.id === "ema-group-b")).toBe(false);
    expect(dvPhase?.groups.some((group) => group.id === "ema-group-d1")).toBe(false);
    expect(dvPhase?.groups.some((group) => group.id === "ema-group-d2")).toBe(false);
    expect(dvPhase?.groups.some((group) => group.id === "ema-group-e1")).toBe(false);
    expect(dvPhase?.groups.some((group) => group.id === "ema-rhd-group-d6")).toBe(true);
    expect(dvPhase?.groups.find((group) => group.id === "ema-rhd-group-f2")?.title).toBe("Group E-2");
    expect(dvPhase?.groups.find((group) => group.id === "ema-rhd-group-f2")?.rows[0]?.label).toBe(
      "Operating Noise & Transient Noise",
    );
  });

  it("refreshes stale EMA drafts to the shared MLA fee template results", () => {
    const state = createSeedAppState();
    const emaDraft = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "EMA",
        steeringSides: ["LHD"],
        projectCode: "L481",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    saveProjectDraft({
      ...emaDraft,
      environmentPlan: {
        ...emaDraft.environmentPlan,
        phases: emaDraft.environmentPlan.phases.map((phase) => ({
          ...phase,
          summary: { ...phase.summary, totalCost: "" },
          groups: phase.groups.map((group) => ({
            ...group,
            totalCost: "",
            rows: group.rows.map((row) => ({ ...row, fee: "" })),
          })),
        })),
      },
      environmentPlanVersion: 28,
    });

    const hydrated = createInitialAppState();
    const dvPhase = hydrated.environmentPlan.phases.find((phase) => phase.id === "dv");
    const groupA = dvPhase?.groups.find((group) => group.id === "ema-group-a");
    const groupE2 = dvPhase?.groups.find((group) => group.id === "ema-group-e2");

    expect(groupA?.rows.find((row) => row.id === "ea-k1")?.fee).toBe("720");
    expect(groupE2?.rows.find((row) => row.id === "ee2-item")?.fee).toBe("42500");
    expect(dvPhase?.summary.totalCost).not.toBe("");
  });
});

describe("app state reducer", () => {
  it("updates the project setup and domain items", () => {
    const state = createSeedAppState();

    const described = appReducer(state, {
      type: "setDescription",
      description: "Updated project brief",
    });
    expect(described.projectSetup.description).toBe("Updated project brief");

    const toggledOn = appReducer(described, {
      type: "toggleChangeId",
      changeId: "pcb_material_change",
    });
    expect(toggledOn.projectSetup.selectedChangeIds).toEqual(["pcb_material_change"]);

    const toggledOff = appReducer(toggledOn, {
      type: "toggleChangeId",
      changeId: "pcb_material_change",
    });
    expect(toggledOff.projectSetup.selectedChangeIds).toEqual([]);

    const updatedItem = appReducer(toggledOff, {
      type: "updateItem",
      domain: "material",
      itemId: seedMaterialItems[0]!.id,
      updates: {
        enabled: false,
        notes: ["manually disabled"],
      },
    });
    expect(updatedItem.domainItems.material[0]).toMatchObject({
      id: seedMaterialItems[0]!.id,
      enabled: false,
      notes: ["manually disabled"],
    });

    const added = appReducer(updatedItem, {
      type: "addItem",
      domain: "emc",
      item: {
        ...seedEmcItems[0]!,
        id: "custom-emc-item",
        code: "CUSTOM-EMC",
      },
    });
    expect(added.domainItems.emc).toHaveLength(seedEmcItems.length + 1);

    const removed = appReducer(added, {
      type: "removeItem",
      domain: "emc",
      itemId: "custom-emc-item",
    });
    expect(removed.domainItems.emc).toHaveLength(seedEmcItems.length);

    const confirmed = appReducer(removed, { type: "confirmPlan" });
    expect(confirmed.projectSetup.confirmed).toBe(true);

    const reset = appReducer(confirmed, { type: "resetToSeed" });
    expect(reset).toEqual(createSeedAppState());
  });

  it("rebuilds domain items from the selected platform and reuse flags", () => {
    const state = createSeedAppState();
    const mlaEnvironmentItems = seedPlatformTemplates.find((template) => template.platform === "MLA")?.items ?? [];

    const rebuilt = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    expect(rebuilt.projectSetup.platform).toBe("MLA");
    expect(rebuilt.domainItems.environment).toHaveLength(mlaEnvironmentItems.length);
    expect(rebuilt.domainItems.environment.some((item) => item.templateSection === "Group D Parallel Tests")).toBe(true);
    expect(rebuilt.domainItems.material).toHaveLength(0);
    expect(rebuilt.domainItems.emc).toHaveLength(0);
    expect(rebuilt.environmentPlan.platform).toBe("MLA");
    expect(rebuilt.environmentPlan.phases).toHaveLength(2);
    expect(rebuilt.environmentPlan.phases[0]?.summary.phaseValue).toBe("DV");
    expect(rebuilt.environmentPlan.phases[1]?.summary.phaseValue).toBe("PV");
    expect(rebuilt.environmentPlan.phases[1]?.groups.some((group) => group.title === "Group D-8")).toBe(true);
    expect(rebuilt.environmentPlan.phases[0]?.groups.some((group) => group.title === "Group D-8")).toBe(false);
    expect(rebuilt.environmentPlan.phases[0]?.summary.projectCode).toBe("L463 LHD");
  });

  it("omits RHD workbook no-test items when rebuilding environment items", () => {
    const state = createSeedAppState();

    const rebuilt = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        steeringSides: ["RHD"],
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    expect(rebuilt.domainItems.environment.find((item) => item.code === "B1")).toBeUndefined();
    expect(rebuilt.environmentPlan.phases[0]?.summary.projectCode).toBe("L463 RHD");
    expect(rebuilt.domainItems.environment.find((item) => item.code === "D3-1")).toMatchObject({
      nameEn: "Thermal Shock Endurance",
      enabled: true,
    });
    expect(rebuilt.domainItems.environment.find((item) => item.code === "D6-1")).toBeUndefined();
    expect(rebuilt.domainItems.environment.find((item) => item.code === "F1")).toBeUndefined();
  });

  it("builds separate environment outline phases when both steering directions are selected", () => {
    const state = createSeedAppState();

    const rebuilt = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        platform: "EMA",
        steeringSides: ["LHD", "RHD"],
        projectCode: "L463",
        reuseEnvironmentTemplate: true,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });

    const phaseIds = rebuilt.environmentPlan.phases.map((phase) => phase.id);

    expect(phaseIds).toEqual(["dv-lhd", "pv-lhd", "dv-rhd", "pv-rhd"]);
    expect(rebuilt.environmentPlan.phases.map((phase) => phase.summary.projectCode)).toEqual([
      "L463 LHD",
      "L463 LHD",
      "L463 RHD",
      "L463 RHD",
    ]);
    expect(rebuilt.environmentPlan.phases.find((phase) => phase.id === "dv-lhd")?.groups.some((group) => group.id === "ema-group-b")).toBe(true);
    expect(rebuilt.environmentPlan.phases.find((phase) => phase.id === "dv-rhd")?.groups.some((group) => group.id === "ema-group-b")).toBe(false);
    expect(rebuilt.environmentPlan.phases.find((phase) => phase.id === "dv-rhd")?.groups.some((group) => group.id === "ema-rhd-group-f2")).toBe(true);
  });

  it("fills manual environment rows from an existing full test label", () => {
    const state = appReducer(createSeedAppState(), {
      type: "applyProjectSetup",
      updates: {
        platform: "MLA",
        projectCode: "L463",
        reuseEnvironmentTemplate: false,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
      },
    });
    const inserted = appReducer(state, {
      type: "addEnvironmentPlanRow",
      phaseId: "dv",
      groupId: "mla-group-a",
      afterRowId: "a-k1",
      row: {
        id: "manual-dv-Group A-a-k1",
        label: "新测试项",
        testHours: "1",
        sampleRange: "1-12",
      },
    });

    const updated = appReducer(inserted, {
      type: "updateEnvironmentPlanRow",
      phaseId: "dv",
      groupId: "mla-group-a",
      rowId: "manual-dv-Group A-a-k1",
      field: "label",
      value: "K6 Power Thermal Cycle",
    });
    const row = updated.environmentPlan.phases
      .find((phase) => phase.id === "dv")
      ?.groups.find((group) => group.id === "mla-group-a")
      ?.rows.find((item) => item.id === "manual-dv-Group A-a-k1");

    expect(row).toMatchObject({
      label: "K6 Power Thermal Cycle",
      testHours: "11",
      sampleRange: "1-12",
      fee: "7200",
    });
  });

  it("rebuilds recommended environment and EMC items for change projects", () => {
    const state = createSeedAppState();

    const rebuilt = appReducer(state, {
      type: "applyProjectSetup",
      updates: {
        projectType: "change_project",
        platform: "EMA",
        isFullyReused: false,
        reuseEnvironmentTemplate: false,
        reuseMaterialTemplate: false,
        reuseEmcTemplate: false,
        description: "PCB 材料变更",
        selectedChangeIds: ["pcb_material_change"],
      },
    });

    expect(rebuilt.projectSetup.projectType).toBe("change_project");
    expect(rebuilt.domainItems.material).toHaveLength(0);
    expect(rebuilt.domainItems.environment).toHaveLength(0);
    expect(rebuilt.domainItems.emc.map((item) => item.code)).toEqual(["RE310", "CE420", "RI112"]);
  });
});

describe("import workbook classification", () => {
  it("classifies workbook names by kind", () => {
    expect(parseImportedWorkbookName("EMA环境可靠性测试大纲.xlsx")).toEqual({
      kind: "platform_environment",
      label: "EMA环境可靠性测试大纲",
    });
    expect(parseImportedWorkbookName("JLR材料测试大纲_v2.xlsm")).toEqual({
      kind: "material_template",
      label: "JLR材料测试大纲_v2",
    });
    expect(parseImportedWorkbookName("JLR-EMC报价清单.xlsx")).toEqual({
      kind: "pricing",
      label: "JLR-EMC报价清单",
    });
    expect(parseImportedWorkbookName("notes.txt")).toEqual({
      kind: "unknown",
      label: "notes",
    });
  });
});
