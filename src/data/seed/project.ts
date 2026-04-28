import type { ProjectSetup } from "../../types/project";

export const defaultProjectSetup: ProjectSetup = {
  oem: "JLR",
  projectType: "new_project",
  platform: "MLA",
  steeringSides: ["LHD"],
  projectCode: "L463",
  isFullyReused: true,
  reuseEnvironmentTemplate: true,
  reuseMaterialTemplate: true,
  reuseEmcTemplate: true,
  description: "",
  selectedChangeIds: [],
  confirmed: false,
};
