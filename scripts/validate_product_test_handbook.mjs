import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const handbookPath = resolve("docs/产品测试流程自动化项目工作手册.html");

let html = "";

try {
  html = readFileSync(handbookPath, "utf8");
} catch {
  throw new Error(`Handbook not found: ${handbookPath}`);
}

const requiredSnippets = [
  "<!doctype html>",
  "<style>",
  "产品测试流程自动化项目工作手册",
  "执行摘要",
  "系统全景",
  "核心业务流程",
  "费用规则维护手册",
  "样品及辅助设备需求手册",
  "文件与代码入口",
  "常见任务 SOP",
  "验收清单",
  "风险与维护原则",
  "ENVIRONMENT_PLAN_TEMPLATE_VERSION = 40",
  "SGS / 华测 / 苏勃",
  "Computer Fee",
  "Report Fee",
  "Optical Test",
  "51 点位 134/个",
  "19 点位 50/个",
  "K28 HALT",
  "L6-photo&xray",
  "L6-SEM&SECTION",
  "outputs/mla-fee-detail-export/JLR- MLA 费用规则.xlsx",
  "outputs/ema-fee-detail-export/JLR- EMA 费用规则.xlsx",
  "outputs/mla-sample-equipment-demand/MLA样品及辅助设备需求_计算逻辑确认版.xlsx",
  "A1:AS159",
  "1060 个公式",
  "src/data/seed/environmentPlan.ts",
  "src/services/environmentFeeDetail.ts",
  "src/pages/EnvironmentOutlinePage.tsx",
  "npm run test:run -- src/tests/environmentFeeDetail.test.ts",
  "npm run build",
];

const missing = requiredSnippets.filter((snippet) => !html.includes(snippet));

if (missing.length > 0) {
  throw new Error(`Handbook is missing required content:\n${missing.join("\n")}`);
}

const sectionCount = (html.match(/class="section-card"/g) || []).length;
const tableCount = (html.match(/<table/g) || []).length;

if (sectionCount < 8) {
  throw new Error(`Expected at least 8 section cards, found ${sectionCount}`);
}

if (tableCount < 6) {
  throw new Error(`Expected at least 6 tables, found ${tableCount}`);
}

console.log(`Product test handbook checks passed: ${sectionCount} sections and ${tableCount} tables verified.`);
