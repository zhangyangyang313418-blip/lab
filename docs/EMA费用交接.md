# EMA 费用交接

更新时间：2026-06-17

## 新线程使用方式

后续维护 EMA 环境费用时，先读本文件，再看 `docs/MLA费用交接.md` 和 `docs/LHD费用说明.md`。EMA 费用已经从“临时复用 MLA 模板”切换为“EMA 专属规则覆盖 + 继续复用未差异化的 MLA 通用规则”。

项目根目录：

```text
/Users/clytia/Desktop/Codex/产品测试流程自动化
```

当前 Git 状态：

- EMA 费用分支已经 fast-forward 合并进 `main`
- `main` 最新提交：`b3807f1 feat: finalize EMA fee workbooks`
- 已删除本地分支：`codex/mla-fee-export`

## 正式 Excel 交付物

正式文件只保留以下命名：

- `outputs/mla-fee-detail-export/JLR- MLA 费用规则.xlsx`
- `outputs/ema-fee-detail-export/JLR- EMA 费用规则.xlsx`

两份正式 Excel 都必须包含：

- `费用规则去重表`
- `版本记录`

旧命名过程文件已经删除。当前保留的已确认模板归档目录为：

```text
outputs/fee-rule-archive/2026-06-24-ema-fee-export-template/
```

该目录保存 `EMA费用导出模板_2026-06-24_已确认.xlsx`。不要再把 `_修正版`、`_待修改` 或 `V.0 版本` 命名的文件放回正式交付目录。

## 当前 EMA 专属费用规则

EMA 专属规则来自用户回传并确认的 `JLR- EMA 费用规则.xlsx`，当前覆盖项如下：

| 项目 | EMA 规则 |
| --- | --- |
| `K52.351 Condensing humidity` | EMA 平台不测试，不参与费用计算 |
| `Particle Exposure` | EMA 平台不测试，不参与费用计算 |
| `K14 Dust Blowing Test` | EMA 平台不测试，不参与费用计算 |
| `K7 Thermal Shock in Air` | 计费基数 `305h`，适用于 Group A 和 Group C |
| `K17 Audible Noise` | `SGS 4000 / 华测 3333 / 苏勃 1000`，按 12 台样机计费，中值为华测 `39996` |
| `K20 Solar Radiation` | 计费基数 `24h` |
| `K21 Corrosive Gases` | 计费基数 `1000h`；`SGS 100/h / 华测 120/h / 苏勃 150/h`；SGS 费用 `100000`，中值建议费用 `120000` |
| `K22 Chemical Resistance` | 按 `11` 种试剂计费；`SGS 650 / 华测 700 / 苏勃 300`，中值为 SGS `7150` |

未在 EMA 专属规则覆盖的项目继续走现有 MLA 通用规则。MLA 锁定规则不因 EMA 修改而改变。

## 代码入口

EMA 专属价格和计费基数：

- `src/data/seed/emaFeePricing.ts`
- `src/data/seed/emaFeeBasis.ts`

MLA 通用价格和计费基数：

- `src/data/seed/mlaFeePricing.ts`
- `src/data/seed/mlaFeeBasis.ts`

费用计算与平台选择：

- `src/services/environmentFeeDetail.ts`

本地草稿刷新版本：

- `src/services/localStore.ts`
- 当前 `ENVIRONMENT_PLAN_TEMPLATE_VERSION = 40`

Environment Outline 页面费用展示和 Excel 下载：

- `src/pages/EnvironmentOutlinePage.tsx`
- `src/services/mlaEnvironmentFeeExport.ts`

MLA 费用规则 Excel 生成脚本：

- `scripts/export_mla_fee_flat_unique_workbook.mjs`
- 默认输出名必须保持 `JLR- MLA 费用规则.xlsx`

## 回归测试

费用规则相关最小验证：

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/localStore.test.ts
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
npm run build
```

合并进 `main` 前后已跑过的完整相关验证：

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/environmentOutlinePage.test.tsx src/tests/environmentOutlineLayout.test.ts src/tests/localStore.test.ts src/tests/environmentPlan.test.ts src/tests/homePage.test.tsx src/tests/mlaEnvironmentFeeExport.test.ts
npm run build
```

最近一次合并后结果：

- 7 个 test files 通过
- 82 个 tests 通过
- `npm run build` 通过

## 后续维护流程

1. 用户如果修改 `JLR- EMA 费用规则.xlsx`，先检查 `费用规则去重表` 和 `版本记录`。
2. 每次确认费用变化，都要在 Excel 的 `版本记录` 追加 `V.2 / V.3...`，不要覆盖历史记录。
3. 将 Excel 变化同步到 `emaFeePricing.ts`、`emaFeeBasis.ts` 或计算逻辑。
4. 在 `environmentFeeDetail.test.ts` 增加或更新断言，至少检查单价、计费基数、实验室费用和中值建议费用。
5. 如果已有本地草稿可能继续显示旧费用，升 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 并补 `localStore.test.ts`。
6. 更新本文件，以及必要时更新 `docs/MLA费用交接.md` / `docs/LHD费用说明.md`。

## 注意事项

- `苏勃` 在页面和 Excel 中展示为 `苏勃`，代码内部实验室键仍沿用 `苏劢`。
- EMA LHD / RHD 的分组、样本范围、测试时间来自 `environmentPlan.ts`，不要为了费用规则改动随意调整大纲结构。Group A 当前在 `K7` 后、`K15` 前保留中间 `L1&L4`，样本量 `12`，费用 `4800`。
- `K7` 已明确 Group A 和 Group C 都是 `305h`，不要只改 Group A。
- `K21` 的 SGS 单价是 `100/h`，但三家中值建议费用仍为 `120000`，不要因为总价未变而漏掉 SGS 单价断言。
- 正式 Excel 目录中只保留标准命名文件；旧命名文件放归档目录。
