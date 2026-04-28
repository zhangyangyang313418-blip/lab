export interface ChangeOption {
  id: string;
  label: string;
  keywords: string[];
  recommendedCodes: string[];
}

export const seedChangeOptions: ChangeOption[] = [
  {
    id: "full_new_module",
    label: "带 PCBA 的全新电子设备模块",
    keywords: ["新项目", "全新模块", "新模块"],
    recommendedCodes: ["K1", "K2", "K4"],
  },
  {
    id: "pcb_material_change",
    label: "PCB(A) 材料变更",
    keywords: ["pcba", "pcb", "材料变更"],
    recommendedCodes: ["RE310", "CE420", "RI112"],
  },
  {
    id: "supply_filtering_change",
    label: "电源滤波变更",
    keywords: ["供电滤波", "电源滤波"],
    recommendedCodes: ["RE310", "CE420", "RI112", "RI114", "RI115", "RI130"],
  },
];
