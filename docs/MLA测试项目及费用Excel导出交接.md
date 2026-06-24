# MLA 测试项目及费用 Excel 导出交接

更新时间：2026-06-15

## 当前结论

本交接用于继续处理 `/Users/clytia/Desktop/Codex/产品测试流程自动化` 中的 MLA 测试项目及费用 Excel 导出。

当前用户已确认：

- Excel 导出格式以用户手工修改过的 `.xlsx` 为准，后续必须保留公式列、右侧费用汇总工具区、费用对比工具区和 `费用规则校验`。
- `费用对比` 顶部右侧已按用户要求删除“预估费用剔除项”表格，改为参考图样式的 `整包报价 vs 预估费用 | 按预估费用居中排序` 柱状图；图表按 `DV / PV / DV+PV` 三组展示 `预估费用 / SGS / 华测 / 苏勃`，每组中 `预估费用` 固定居中，低于预估的报价放左侧，高于预估的报价按金额从低到高放右侧。顶部整包报价表不再显示 `最低报价` 列。
- “格式锁定”仅表示后续网页导出沿用用户手工确认的版式、配色、列宽、公式和工具区；不得写入 Excel 工作表保护，导出的所有 sheet 仍需可编辑。
- 旧 `.xls` 模板缺少 `费用规则校验` 与右侧费用工具结构，不能再作为完整最终导出基底。
- `Optical Test` / `L1&L4 Performance Evaluation & Functional Evaluation` 的费用和计费基数要按各自 Group 的样本量计算，不再使用跨组汇总样本量。
- `样品范围` 列实际表达的是“样品编号”，导出时必须按当前 Phase 的 test flow Group 顺序连续分配，不再简单重复每个 Group 的组内范围。
- 导出时先按 Phase / Group 顺序确定每个 Group 的连续样品编号，再按行级 `sampleRange` 映射到全局编号；Group A 内允许 `1-12` 与 `1-14` 并存。
- `计费基数` 继续按费用明细逻辑计算，不和 `样品范围` 混用。
- `/environment-outline` 顶部费用汇总中的 `Computer Fee` 与 `Report Fee` 也必须进入 Excel 导出；`费用预估` 和 `特殊项目费用` 均追加 DV / PV 的附加费用区块。
- 网页按钮导出的 SpreadsheetML `.xls` 已把 `样品及辅助设备需求` 接到第一页；完整导出顺序为 `样品及辅助设备需求`、`费用预估`、`SGS`、`华测`、`苏勃`、`费用对比`、`特殊项目费用`、`费用规则校验`。

## 最新文件

当前用户正在修改/查看的样例文件：

```text
outputs/mla-fee-export-template/MLA费用导出模板.xlsx
```

该文件已恢复为保留用户手工格式和公式工具区的完整 `.xlsx` 版本，并合入了全部特殊项目标识、按 Group 样本量计算后的费用数据、蓝色费用汇总表、实验室页备注修正，以及 `Computer Fee` / `Report Fee` 附加费用。

正式导出的母版文件：

```text
outputs/workbook-edits/final/MLA费用导出模板_流程导出基准.xlsx
```

说明：

- `MLA费用导出模板_流程导出基准.xlsx` 是当前完整基底，保留 8 个 sheet、费用计算公式列、`费用预估` 右侧蓝色汇总工具区、`费用对比` 顶部工具区和 `费用规则校验`。
- `outputs/mla-fee-export-template/MLA费用导出模板.xlsx` 是由导出脚本从上述基底复制并校验后生成的正式模板。

## 必须保留的 Excel 格式

后续导出或合并数据时，不要重新生成一个全新的无样式 SpreadsheetML 覆盖用户模板。

必须保留：

- Sheet 顺序：`样品及辅助设备需求`、`费用预估`、`SGS`、`华测`、`苏勃`、`费用对比`、`特殊项目费用`、`费用规则校验`
- 用户手工样式、列宽、行高、边框、填充色、字体、数字格式、合并单元格和公式
- `样品及辅助设备需求` 的主表结构：按 Phase 输出 `Group Max`、`备样`、`Phase Total`，字段包含样品类型、样品编号、样品数量、HUD/PCBA、振动/冲击工装、防尘防水工装、投图板、2m/3m 线束、Sensor 周边和特殊要求。Group 内按测试项目取最大需求，Phase 内 HUD/PCBA/耗材按 Group 合计，振动/冲击工装、防尘防水工装和 3m 线束按最大值准备；DV/PV 各加 3 台 HUD 备样。
- `费用预估` 的 15 列主表结构：
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
  - `费用计算公式`
  - `备注`
- `费用预估` 右侧蓝色费用汇总工具区，包含 `Computer Fee`、`Report Fee`、`Total cost`
- `费用对比` 顶部工具区，包含 `整包报价 vs 预估`、`整包报价 vs 预估费用 | 按预估费用居中排序` 柱状图、`测试项目一致性检查`；不要再恢复旧的 `预估费用剔除项` 表格，也不要在顶部整包报价表恢复 `最低报价` 列
- `费用对比` 图表必须是原生 Excel 图表对象，不得用静态图片替代；绘图对象在 `xl/drawings/drawing1.xml`，图表定义在 `xl/charts/chart1.xml`。隐藏列 `S:X` 保留图表数据：`S=图表阶段`、`T=图表柱项`，`U:X` 分别为 `苏勃`、`预估费用`、`SGS`、`华测` 四个图例系列；`S2:T15` 作为多级分类轴，`U2:X15` 用堆积柱形图承载四个系列，其中第 6 行、第 11 行为空白占位，用于拉开 `DV / PV / DV+PV` 三组间距；其余数据行只有对应系列保留数值，其余为空。每个阶段按实际柱组展示 `DV / PV / DV+PV` 标签；组内 `预估费用` 作为基准，低于预估的报价在左侧，高于预估的报价按金额从低到高在右侧。由于图表数据源在隐藏列，`chart1.xml` 必须保留 `<c:plotVisOnly val="0"/>`，否则 WPS 会因只绘制可见单元格而显示空白图表区。
- `特殊项目费用` 的 `费用计算公式` 列
- `费用规则校验` sheet
- Sheet1 顶部项目概要的压缩排版
- Group 标题行合并整行的格式

重要提醒：

```text
node_modules/.bin/vite-node scripts/export_mla_environment_fee_template.ts
```

当前这个命令以 `outputs/workbook-edits/final/MLA费用导出模板_流程导出基准.xlsx` 为基底，并直接写 `outputs/mla-fee-export-template/MLA费用导出模板.xlsx`。后续不要再用旧 `.xls` 作为完整最终导出基底。

新增数据行如果模板里没有对应旧行，需要在保持模板样式和公式工具区的前提下追加区块。目前 `费用预估` 与 `特殊项目费用` 已在表尾追加 DV / PV 的 `Computer Fee`、`Report Fee`：

- `Computer Fee`：默认 SGS `250/月/台 × 48 = 12000`
- `Report Fee`：默认苏勃 `150/份 × 当前 Phase 组数`，DV 为 `1950`，PV 为 `2100`
- `费用预估`、实验室页、`特殊项目费用` 均必须保留至少一列/一例 `费用计算公式`
- `SGS`、`华测`、`苏勃` 页新增的 `DV附加费用` / `PV附加费用` 区块必须沿用各自实验室页原本蓝色标题、蓝色表头和白色数据行样式，不得套用 `费用预估` 页的橘色费用区块样式。

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
Group A / Optical = 14 个样品 / 784
Group A / L1&L4 = 14 个样品 / 5600
Group C / Optical = 6 个样品 / 384
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
Group D-8 = 77-88
Group D-9 = 89-94
Group E-1 = 95
Group E-2 = 96-120
```

已更新：

- `src/services/mlaEnvironmentFeeExport.ts`：导出层按 Phase / Group 顺序分配样品编号，并支持行级 `sampleRange` 映射。
- `src/tests/mlaEnvironmentFeeExport.test.ts`：锁定连续样品编号、计费基数和费用不混用。
- `src/tests/environmentFeeDetail.test.ts`：锁定 Group A 测试前/测试后 L1&L4 按 `1-14` 计费。
- `src/tests/localStore.test.ts`：锁定旧草稿刷新 Group A post 评估行为 `1-14`。
- `scripts/export_mla_environment_fee_template.ts`：从完整 `.xlsx` 基底导出，避免旧 `.xls` 删除公式工具区；自校验会确认 `费用对比` 使用原生 Excel 图表对象、隐藏图表数据源、且顶部 `最低报价` 列为空。
- `scripts/patch_mla_fee_comparison_chart.mjs`：维护 `费用对比` 顶部图表区，删除旧 `预估费用剔除项` 表格，写入原生堆积柱状图定义 `xl/charts/chart1.xml`，并将图表绑定到隐藏数据源 `S2:T15` 和 `U2:X15`，其中空白行用于控制三组间距。
- `src/tests/mlaEnvironmentFeeTemplateExport.test.ts`：锁定最终 `.xlsx` 必须包含 8 个 sheet、费用计算公式列、蓝色费用工具区、`费用对比` 原生柱状图、隐藏图表数据源、`Computer Fee` / `Report Fee`。

## 验证命令

完成样品编号修正后，至少运行：

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/mlaEnvironmentFeeExport.test.ts src/tests/environmentOutlinePage.test.tsx src/tests/localStore.test.ts
npm run build
```

如果改动只在 Excel 模板合并脚本，还需要额外检查输出文件：

- 主 `.xlsx` 能被解压和 Excel/WPS 打开
- Sheet 顺序为 8 个 sheet，包含第一页 `样品及辅助设备需求` 和隐藏的 `费用规则校验`
- 样式、公式、合并单元格和右侧工具区仍存在
- `费用预估` 主表仍有 `费用计算公式` 列
- `费用预估` 右侧蓝色费用表格仍有 `Computer Fee`、`Report Fee`、`Total cost`
- `费用预估` 和 `特殊项目费用` 能搜到 `Computer Fee` / `Report Fee`，且 DV/PV 金额分别为 `12000/1950` 和 `12000/2100`
- Group A / Group C / D 组 / 特殊项目的样品编号没有重复或断档

## 重要风险

- 不要把导出脚本改回无样式全量生成。
- 不要再把旧 `.xls` 当作完整最终导出，它会丢失费用计算工具。
- 不要删除 `outputs/workbook-edits/final/MLA费用导出模板_流程导出基准.xlsx`，它是当前完整结构恢复锚点。
- 不要把“计费基数的样本数量”和“样品范围的样品编号”混为一列逻辑。
- 不要仅改 Excel 文件而不改测试，否则下一次导出还会复发。
- 不要只改页面汇总；`Computer Fee` / `Report Fee` 必须同步进入 Excel workbook 模型和保留格式模板导出脚本。
