export type OemCode = "JLR";
export type ProjectType = "new_project" | "change_project";
export type PlatformCode = "EMA" | "MLA";
export type SteeringSide = "LHD" | "RHD";

export interface ProjectSetup {
  oem: OemCode;
  projectType: ProjectType;
  platform: PlatformCode;
  steeringSides: SteeringSide[];
  projectCode: string;
  isFullyReused: boolean;
  reuseEnvironmentTemplate: boolean;
  reuseMaterialTemplate: boolean;
  reuseEmcTemplate: boolean;
  description: string;
  selectedChangeIds: string[];
  confirmed: boolean;
}
