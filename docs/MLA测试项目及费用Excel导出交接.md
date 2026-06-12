# MLA 测试项目及费用 Excel 导出交接

更新时间：2026-06-10

## 当前结论

本交接用于继续处理 `/Users/clytia/Desktop/Codex/产品测试流程自动化` 中的 MLA 测试项目及费用 Excel 导出。

当前用户已确认：

- Excel 导出格式以用户手工修改过的 `.xls` 为准，后续必须保留格式。
- `Optical Test` / `L1&L4 Performance Evaluation & Functional Evaluation` 的费用和计费基数要按各自 Group 的样本量计算，不再使用跨组汇总样本量。
- `样品范围` 列实际表达的是“样品编号”，导出时必须按当前 Phase 的 test flow Group 顺序连续分配，不再简单重复每个 Group 的组内范围。
- 导出时先按 Phase / Group 顺序确定每个 Group 的连续样品编号，再按行级 `sampleRange` 映射到全局编号；Group A 内允许 `1-12` 与 `1-14` 并存。
- `计费基数` 继续按费用明细逻辑计算，不和 `样品范围` 混用。

## 最新文件

当前用户正在修改/查看的样例文件：

```text
outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xls
```

该文件已恢复为保留用户手工格式的版本，并合入了按 Group 样本量计算后的费用数据及按 test flow 顺序分配后的样品编号。

同目录内重要备份/辅助文件：

```text
outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xls.bak3
outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板_保留格式_按组样本量.xls
outputs/mla-fee-export-template/MLA测试项目及费用预估_按组样本量数据验证.xls
```

说明：

- `.bak3` 是用户手工格式的备份，保留了样式、列宽、合并单元格和 Sheet1 14 列结构。
- `_保留格式_按组样本量.xls` 是用 `.bak3` 格式骨架合并最新数据后的候选备份。
- `_按组样本量数据验证.xls` 是脚本直接生成的无样式数据验证版本，不应作为用户继续编辑的格式基准。

## 必须保留的 Excel 格式

后续导出或合并数据时，不要重新生成一个全新的无样式 SpreadsheetML 覆盖用户模板。

必须保留：

- Sheet 顺序：`费用预估`、`SGS`、`华测`、`苏勃`、`费用对比`、`特殊项目费用`
- 用户手工样式定义，当前格式模板约有 `51` 个样式定义
- Sheet1 `费用预估` 的 14 列结构：
  - `组别顺序`
  - `组内顺序`
  - `Phase`
  - `测试编号`
  - `测试项目`
  - `样品范围`
  - `计费基数`
  - `测试时间`
  - `计费方式`
  - `费用归属`
  - `内部费用`
  - `委外费用`
  - `费用合计`
  - `备注`
- Sheet1 顶部项目概要的压缩排版
- Group 标题行合并整行的格式
- 列宽、行高、边框、填充色、字体、数字格式、合并单元格

重要提醒：

```text
node_modules/.bin/vite-node scripts/export_mla_environment_fee_template.ts
```

当前这个命令已改为以 `.bak3` 为格式模板，只替换工作表数据行的单元格值，并直接写 `outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xls`。后续不要再改回全新生成无样式 SpreadsheetML 的方式。

## 当前代码口径

已修改/涉及的主要文件：

```text
src/data/seed/environmentPlan.ts
src/services/environmentFeeDetail.ts
src/services/localStore.ts
src/store/appState.tsx
src/services/mlaEnvironmentFeeExport.ts
src/tests/environmentFeeDetail.test.ts
src/tests/mlaEnvironmentFeeExport.test.ts
src/tests/environmentOutlinePage.test.tsx
src/tests/localStore.test.ts
docs/PROJECT_STATUS_INDEX.md
docs/MLA费用交接.md
docs/LHD费用说明.md
```

当前已确认的费用口径：

- baseline `Optical Test` 按当前 Group 样本量计算。
- 普通 Group 的 `Optical Test` 费用规则为：`1 台 51 点位 + 其余 19 点位`。
- baseline `L1&L4` 无 `sampleRange` 时优先取当前 Group `totalSampleQty`。
- Group A 测试前/测试后 `L1&L4 Performance Evaluation & Functional Evaluation` 按行级样品范围计费；当样品范围为 `1-14` 时，计费基数为 `14 个样品`。
- Group A 测试后 `Optical Test` 与 `L6-photo&xray` 也按 `1-14` 计费。
- 本地草稿迁移版本已升到：

```text
ENVIRONMENT_PLAN_TEMPLATE_VERSION = 34
```

已验证过的关键示例：

```text
Group A / Optical = 14 个样品 / 3190
Group A / L1&L4 = 14 个样品 / 5600
Group C / Optical = 6 个样品 / 1510
Group C / L1&L4 = 6 个样品 / 2400
Group D-3 / L1&L4 = 8 个样品 / 3200
```

注意：上述“14 个样品 / 6 个样品”是计费基数；`样品范围` 列现在展示连续样品编号。

## 已确认规则：样品范围 / 样品编号

用户最新确认：

```text
样品范围，也就是样品编号，目前是错的，请按顺序重新填入
```

已采用导出层样品编号规范化，不把样品编号硬编码到每一行：

```text
EnvironmentPlanPhase
  -> 按网页 test flow group 顺序遍历
  -> 根据 group.totalSampleQty 生成 group 的连续样品编号区间
  -> 导出时把行级 sampleRange 映射到该 Group 的全局样品编号区间
```

当前规则：

- 每个 Phase 内从 `1` 开始单独编号，DV 和 PV 各自独立。
- 按当前 Phase 中的 Group 顺序连续累加。
- 若行级 `sampleRange` 是组内编号（例如 Group A 的 `1-12` 或 Group C baseline 的 `1-6`），导出时换算成当前 Phase 的全局编号。
- 若行级 `sampleRange` 已经是全局编号（例如 Group C sequence 的 `27-32`），导出时保持不再二次偏移。
- 行无 `sampleRange` 时才默认使用该 Group 的完整编号区间。
- Group A 特殊确认：普通 sequence rows 使用 `1-12`；只有 `K16.1 Mechanical Shock Package Drop` 使用 `1-14`；测试前/测试后评估仍使用 `1-14` 全部样品。
- PCBA-only Group（D-3/D-4）、D-8/D-9、E-1/E-2 都进入同一个 Phase 编号序列。
- 只影响 Excel 导出的 `样品范围` 展示，不改变费用计算中的 `计费基数`。

## 已确认规则：L6-SEM&SECTION 点位口径

用户确认 `L6-SEM&SECTION` 的 `计费基数` 应展示为点位，不是样品：

- 费用计算底层仍沿用 `quantity = 33` 承载该基数。
- Excel 导出展示必须写为 `33 个点位`。
- 公式和备注口径保持 `3 样品 × 11 点位 = 33 点位`。
- 不要把该展示修正扩散到其他 `quantity` 项；普通 L1&L4、K18、L6-photo&xray 等仍显示 `个样品`。
- D-3 总样品数为 `8`；D-3 的 `L1&L4` 与 `L6-photo&xray` 显示 `8 个样品`，只有 `L6-SEM&SECTION` 显示 `33 个点位`。

PV 示例：

```text
Group A baseline Optical/L1&L4 = 1-14
Group A normal sequence rows = 1-12
Group A K16.1 Mechanical Shock Package Drop = 1-14
Group A post L1&L4 / Optical / L6 = 1-14
Group B = 15-26
Group C = 27-32
Group D-1 = 33-38
Group D-2 = 39-44
Group D-3 = 45-52
Group D-4 = 53-58
Group D-5 = 59-64
Group D-6 = 65-70
Group D-7 = 71-76
Group D-8 = 77-91
Group D-9 = 92-97
Group E-1 = 98
Group E-2 = 99-123
```

已更新：

- `src/services/mlaEnvironmentFeeExport.ts`：导出层按 Phase / Group 顺序分配样品编号，并支持行级 `sampleRange` 映射。
- `src/tests/mlaEnvironmentFeeExport.test.ts`：锁定连续样品编号、计费基数和费用不混用。
- `src/tests/environmentFeeDetail.test.ts`：锁定 Group A 测试前/测试后 L1&L4 按 `1-14` 计费。
- `src/tests/localStore.test.ts`：锁定旧草稿刷新 Group A post 评估行为 `1-14`。
- `scripts/export_mla_environment_fee_template.ts`：从 `.bak3` 套模板写数据，保留用户手工格式。

## 验证命令

完成样品编号修正后，至少运行：

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/mlaEnvironmentFeeExport.test.ts src/tests/environmentOutlinePage.test.tsx src/tests/localStore.test.ts
npm run build
```

如果改动只在 Excel 模板合并脚本，还需要额外检查输出文件：

- 主 `.xls` 能被 XML 解析
- Sheet 顺序不变
- 样式定义仍存在
- `费用预估` Sheet1 仍是用户手工 14 列结构
- Group A / Group C / D 组 / 特殊项目的样品编号没有重复或断档

## 重要风险

- 不要把导出脚本改回无样式全量生成。
- 不要把 `.bak3` 删除，它是当前格式恢复锚点。
- 不要把“计费基数的样本数量”和“样品范围的样品编号”混为一列逻辑。
- 不要仅改 Excel 文件而不改测试，否则下一次导出还会复发。
