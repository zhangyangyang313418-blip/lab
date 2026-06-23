# Product Test Evaluation Tool Status Index

更新时间：2026-06-17

## 目的

新线程优先读本文件，不再回看旧 Codex 线程“确认当前开发状态”。旧线程累计上下文过大，会显著拖慢响应。

## 项目路径

```text
/Users/clytia/Desktop/Codex/产品测试流程自动化
```

## 常用命令

```bash
npm run dev
npm run test:run -- src/tests/environmentFeeDetail.test.ts
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
npm run test:run -- src/tests/localStore.test.ts
npm run build
```

## 当前重点

- MLA/LHD 环境费用规则维护以 `docs/MLA费用交接.md` 和 `docs/LHD费用说明.md` 为准。
- EMA 环境费用规则维护以 `docs/EMA费用交接.md` 为准。
- 2026-06-03 已按用户修改后的单页 Excel 导回 MLA 费用：当前仅 `SGS / 华测 / 苏勃` 三家参与报价和中值计算，信测不参与本版。
- 环境箱项目按样本量自动选价：`> 6` 使用大环境箱，`<= 6` 使用小环境箱。
- 本地草稿迁移版本当前为 `ENVIRONMENT_PLAN_TEMPLATE_VERSION = 40`。
- `/environment-outline` 顶部新增独立费用汇总行：`TOTAL COST` 后跟各组费用、`Computer Fee`、`Report Fee`；总费用口径为各组测试费用合计 + 电脑费用 + 报告费用。
- EMA 费用已按 `outputs/ema-fee-detail-export/JLR- EMA 费用规则.xlsx` 导回专属规则；MLA 锁定费用不变。
- MLA RHD 右舵费用已补齐使用锁定 MLA 费用规则：`mla-rhd-group-*` 会参与 Optical、Particle Exposure、L1&L4、L6、E-2 及 K 系列费用计算。
- MLA/LHD/RHD 导出和费用明细中，baseline `Optical Test` 与 `L1&L4` 按各自 Group 样本量计算与展示，不再使用跨组汇总样本量。
- MLA / EMA Group A 样品范围已确认：普通 sequence rows 为 `1-12`；`K7 Thermal Shock in Air` 完成后、`K15 Vibration` 开始前需要增加一项 `L1&L4 Performance Evaluation & Functional Evaluation`，样本量 `12`，费用 `12 × 400 = 4800`；`K16.1 Mechanical Shock Package Drop`、测试前评估、测试后 `L1&L4 / Optical / L6-photo&xray` 使用 `1-14`。
- MLA LHD 中拥有 `K23 Thermal Shock Endurance` 的 Group D-3 与拥有 `K8 Dewing Test` 的 Group D-4 不做测试前/测试后 `Optical Test`；`environment-outline` 和费用 Excel 导出都不得生成这些 Optical 费用行。
- MLA Group D-3 已确认按 `8` 个 PCBA 样品：`L1&L4` 和 `L6-photo&xray` 计费基数为 `8 个样品`；`L6-SEM&SECTION` 仍按 `33 个点位`。
- MLA Group D-8 PV 总样本量已从 `15` 改为 `12`；前置 `Optical Test` / HALT 前 `L1&L4` 按 `12 个样品`；HALT 五项仍为 `8h × 800/h = 6400`；后置 `L1&L4` / `Optical Test` / `L6-photo&xray` 仍按 `9 个样品`。
- 流程图维护以 `docs/*.drawio` 和对应 `scripts/generate_*drawio*.mjs` 为准。

## 关键文件入口

### MLA/LHD 费用

- `docs/MLA费用交接.md`
- `docs/LHD费用说明.md`
- `docs/EMA费用交接.md`
- `src/data/seed/environmentPlan.ts`
- `src/data/seed/mlaFeePricing.ts`
- `src/data/seed/mlaFeeBasis.ts`
- `src/data/seed/emaFeePricing.ts`
- `src/data/seed/emaFeeBasis.ts`
- `src/services/environmentFeeDetail.ts`
- `src/pages/EnvironmentOutlinePage.tsx`
- `src/services/localStore.ts`
- `src/types/environmentFeeDetail.ts`

### 回归测试

- `src/tests/environmentFeeDetail.test.ts`
- `src/tests/environmentOutlinePage.test.tsx`
- `src/tests/localStore.test.ts`
- `src/tests/homePage.test.tsx`
- `src/tests/environmentPlan.test.ts`

### 流程图

- `docs/测试申请三栏流程图.drawio`
- `docs/设备资源软硬锁定流程图.drawio`
- `scripts/generate_test_application_drawio.mjs`
- `scripts/generate_three_column_test_flow_drawio.mjs`
- `tests/generate_test_application_drawio.test.mjs`

## 上下文控制规则

- 不要读取旧线程全文。
- 不要粘贴完整 `git diff`、完整浏览器技能说明或完整测试日志。
- 使用 `git diff --stat`、定向 `sed -n`、`rg -n` 和失败断言摘要。
- 只在视觉验证需要时打开浏览器；不需要每轮都重读 browser skill 全文。
- 如果费用规则被确认，更新 `docs/MLA费用交接.md`、`docs/EMA费用交接.md` 或 `docs/LHD费用说明.md`，让下一轮不用依赖聊天历史。

## 已清理噪声

- `docs/.$*.bkp` 为 WPS/draw.io 临时备份文件，不作为来源。
- `.gitignore` 已新增 `.$*.bkp`。
