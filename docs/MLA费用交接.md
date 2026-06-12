# MLA 费用交接

更新时间：2026-06-12

## 新线程使用方式

新线程先读这个文件，再继续做环境费用维护。当前已确认并锁定的是 `MLA / LHD` 模板；后续如果继续改费用、模板或迁移逻辑，先以本文件和 [LHD费用说明.md](/Users/clytia/Desktop/Codex/产品测试流程自动化/docs/LHD费用说明.md) 为准。

项目根目录：

```text
/Users/clytia/Desktop/Codex/产品测试流程自动化
```

常用命令：

```bash
npm run dev
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
npm run test:run -- src/tests/environmentFeeDetail.test.ts
npm run build
```

页面入口：

```text
http://127.0.0.1:5173/environment-outline
```

当前本地草稿模板版本：

```text
ENVIRONMENT_PLAN_TEMPLATE_VERSION = 35
```

Git 状态：

- 仓库已在项目根目录完成 `git init`。
- 第一版功能保存点：`8f04e6d Initial project snapshot`。
- MLA 交接文档保存点：`53dfb63 docs: update MLA handoff`。
- 2026-05-13 之后的接手重点不再是旧线程历史，而是当前 seed / 计费规则 / 本地迁移版本三者是否一致。
- 新线程接手后先运行 `git status --short`，确认是否有旧线程遗留改动。

## 当前状态

- `MLA / LHD` 已确认可作为当前锁定模板继续使用。
- `EMA` 费用已按用户回传的 EMA 费用规则 Excel 导回专属规则；不再完全复用 MLA 费用模板。
- 当前工作重点已经从“逐条试错确认”切到“文档化、交接、后续小范围维护”。
- 页面中涉及 LHD 的默认环境大纲、费用按钮、费用弹窗、本地草稿迁移已经一致。
- 页面中涉及 RHD 右舵的费用计算已补齐使用锁定 MLA 费用规则；`mla-rhd-group-*` 会参与 Optical、Particle Exposure、L1&L4、L6、E-2 及 K 系列费用计算。
- baseline `Optical Test` 与 `L1&L4 Performance Evaluation & Functional Evaluation` 已改为按各自 Group 样本量计算和导出；例如 Group A 使用 `1-14 / 14 个样品`，Group C 使用 `1-6 / 6 个样品`，不再导出跨组汇总样本量。
- Group A 样品范围已确认：普通 sequence rows 为 `1-12`；只有 `K16.1 Mechanical Shock Package Drop`、测试前评估、测试后 `L1&L4 / Optical / L6-photo&xray` 使用 `1-14` 全部样品。
- Group D-3 已确认按 `8` 个 PCBA 样品；`L1&L4` 与 `L6-photo&xray` 使用 `8 个样品`，`L6-SEM&SECTION` 仍按 `33 个点位`。
- Group D-8 已确认前置 `Optical Test` / `L1&L4` 使用 `15 个样品`；HALT 五项仍按 `8h × 800/h = 6400`；后置 `L1&L4` / `Optical Test` / `L6-photo&xray` 使用 `9 个样品`。
- 如果用户后续说“刷新后还是旧值”，优先检查是否需要再升 `ENVIRONMENT_PLAN_TEMPLATE_VERSION`。

## 2026-06-12 MLA Group D-8 样品基数修正

用户确认 `D-8 HALT` 相关计费不改 `8h / 800/h`，本轮仅修正同组光学、L1&L4 和 L6 的样品数量：

- `Group D-8 / Optical Test` 前置行：按 `15 个样品`，费用 `15 × 210 = 3150`
- `Group D-8 / L1&L4 Performance Evaluation & Functional Evaluation` 前置行：按 `15 个样品`，费用 `15 × 400 = 6000`
- `Group D-8 / K28 HALT Cold / Hot / Thermal Shock / Vibration / TST & Vibration`：保持每项 `8h × 800/h = 6400`
- `Group D-8` 后置 `L1&L4`：按 `9 个样品`，费用 `9 × 400 = 3600`
- `Group D-8` 后置 `Optical Test`：按 `9 个样品`，费用 `9 × 210 = 1890`
- `Group D-8` 后置 `L6-photo&xray`：按 `9 个样品`，费用 `9 × 400 = 3600`
- Excel 导出中 D-8 样品范围仍按该组全量连续编号展示，例如 `77-91`；计费基数列单独展示 `15 个样品` 或 `9 个样品`
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `35`，用于刷新旧草稿中 D-8 前后评估行旧基数和旧费用

## 2026-06-11 MLA Group D-3 样品基数修正

用户确认 `D-3 是 8 个样品`，本轮已同步到计费规则和导出：

- `Group D-3 / L1&L4 Performance Evaluation & Functional Evaluation` 计费基数从 `6 个样品` 改为 `8 个样品`
- `L1&L4` 中值单价仍按当前三家报价中值 `400/个样品`，每行费用为 `8 × 400 = 3200`
- `Group D-3 / L6-photo&xray` 保持 `8 个样品`，费用 `3200`
- `Group D-3 / L6-SEM&SECTION` 不改为样品口径，仍按 `3 样品 × 11 点位 = 33 点位`，费用 `21450`
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `34`，用于刷新旧草稿中 D-3 `L1&L4` 的旧费用

## 2026-06-10 MLA Group A 样品范围修正

用户确认 Group A 中只有 Drop Test 需要 14 个样品，但测试前后评估仍需要 14 个全部测试：

- Group A 普通 sequence rows 保持 `1-12`
- `K16.1 Mechanical Shock Package Drop` 使用 `1-14`
- baseline `Optical Test` / `L1&L4` 使用 `1-14`
- post `L1&L4` / post `Optical Test` / post `L6-photo&xray` 使用 `1-14`
- Excel 导出层按 Phase / Group 顺序生成全局样品编号，但保留行级 `sampleRange` 差异；不再把 Group A 所有行强制覆盖成整组 `1-14`
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `33`，用于刷新旧草稿中 Group A post 评估行的样品范围与费用
- 最新生成样例：`outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xls`

## 2026-06-09 MLA 导出 baseline 样本量口径修正

用户确认每一组 `Optical Test` / `L1&L4 Performance Evaluation & Functional Evaluation` 应完成该组自己的样本量，而不是导出后全部变成跨组汇总：

- baseline `Optical Test` 不再使用“baseline 汇总”口径；按该 Group 样本量计算，普通 Group 为 `1 台 51 点位 + 其余 19 点位`
- baseline `L1&L4` 不再取 phase / pre-test 总样本量；无 `sampleRange` 时优先取当前 Group `totalSampleQty`
- 默认大纲会给 baseline `Optical` / `L1&L4` 补当前 Group 的样本范围，例如 `Group A = 1-14`、`Group C = 1-6`
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `32`，用于刷新旧草稿中 `Optical` / `L1&L4` 的样本范围和费用
- 最新生成样例：`outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xls`

## 2026-06-04 EMA 费用临时复用 MLA 模板

用户确认 EMA 费用先按当前已锁定的 MLA 费用模板计算：

- EMA 保留自己的环境大纲、测试时间、样本范围、LHD/RHD 分组差异
- 费用单价、三家实验室报价、中值取费、特殊项目公式暂时复用 MLA 当前实现
- 当前不导入新的 Excel 费用规则；用户后续会先修改 Excel，再由代码导回价格规则
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `29`，用于刷新旧 EMA 草稿中的空费用

## 2026-06-08 EMA 费用规则 Excel 导回

用户修改并确认 `outputs/ema-fee-detail-export/JLR- EMA 费用规则.xlsx` 后，已按 EMA 专属费用规则导回：

- `K52.351 Condensing humidity`：EMA 平台不测试，不参与费用计算
- `Particle Exposure`：EMA 平台不测试，不参与费用计算
- `K14 Dust Blowing Test`：EMA 平台不测试，不参与费用计算
- `K7 Thermal Shock in Air`：计费基数从 MLA `105h` 改为 EMA `305h`
- `K17 Audible Noise`：EMA 单价为 `SGS 4000 / 华测 3333 / 苏勃 1000`，按 12 台样机计算，中值为华测 `39996`
- `K20 Solar Radiation`：计费基数从 MLA `720h` 改为 EMA `24h`
- `K21 Corrosive Gases`：计费基数从 MLA `336h` 改为 EMA `1000h`；SGS 单价按 EMA 平台修正为 `100/h`，华测 `120/h`、苏勃 `150/h` 保持不变
- `K22 Chemical Resistance`：EMA 条件 2，按 `11` 种试剂 × 实验室单价计算；`SGS 650 / 华测 700 / 苏勃 300`，中值为 SGS `7150`
- 已新增 EMA 专属 pricing/basis 规则，MLA 当前锁定费用不变
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `30`，用于刷新旧 EMA 草稿中的费用

## 2026-06-08 MLA RHD 费用规则补齐

已确认并修复 MLA RHD 右舵费用没有完整套用锁定 MLA 费用规则的问题：

- `mla-rhd-group-*` 现在进入 MLA 费用模板识别
- RHD Group A 的 baseline `Optical Test` 与 `L1&L4 Performance Evaluation & Functional Evaluation` 使用与 MLA LHD 一致的特殊规则
- RHD `Particle Exposure` 使用已确认的实验室总价中值与 C 组批次费减免逻辑
- RHD `L6-photo&xray`、`L6-SEM&SECTION`、`E-2 Operating Noise & Transient Noise` 及 K 系列费用按当前锁定 MLA 规则计算
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `31`，用于刷新旧 RHD 草稿中的费用

## 2026-06-03 Excel 导回费用口径

本轮按用户修改后的 `outputs/mla-fee-detail-export/MLA费用规则_单页去重版.xlsx` 导回费用规则。用户确认：

- 以 Excel 修改后的单价和结果为准，不恢复原始报价表旧值。
- Excel 表头命名不改；代码只导入价格和计算口径。
- 当前版本移除信测报价和展示，仅保留 `SGS / 华测 / 苏勃` 三家参与中值计算；代码内部实验室键仍为 `苏劢`，页面展示为 `苏勃`。
- 环境箱项目不使用下拉：样品数量 `> 6` 自动按大环境箱，样品数量 `<= 6` 自动按小环境箱。
- `L6-photo&xray` 是单一项目命名，不是组合总价；按 `400/个样品` 计算。

当前关键结果：

- 环境箱 K1/K2/K3/K4/K6/K9：
  - 大箱：SGS `30`，华测 `25`，苏勃 `40`
  - 小箱：SGS `23`，华测 `18`，苏勃 `30`
  - 例如 12 个样品的 K1：`24h × 中值 30 = 720`
  - 例如 6 个样品的 K1：`24h × 中值 23 = 552`
- K6 Power Thermal Cycle：`240h × 中值 30 = 7200`
- K13 Dust Ingress：每批最多 3 个样品；SGS `1500/批`，华测 `1500/批`，苏勃 `1800/批`，中值单价 `1500/批`；12 个样品 `4 批 × 1500 = 6000`，6 个样品 `2 批 × 1500 = 3000`
- K15 Vibration：12 个样品按 `48h`，中值单价 `500`，费用 `24000`；6 个样品按 `24h`，费用 `12000`
- K17 Audible Noise：SGS `144000`，华测 `120000`，苏勃 `36000`，中值 `120000`
- K18 Connector：SGS `19000`，华测 `27500`，苏勃 `9500`，中值 `19000`
- K22 Chemical Resistance：SGS `11190`，华测 `12300`，苏勃 `6660`，中值 `11190`
- K26 Mechanical Wear-Out：SGS `7158`，华测 `6488`，苏勃 `11660`，中值 `7158`
- K28 HALT：拆分为 `HALT Cold / HALT Hot / HALT Thermal Shock / HALT Vibration / HALT TST & Vibration` 五个子项目；每项计费基数固定 `8h`；SGS `800/h`，华测 `600/h`，苏勃 `1500/h`，中值 `800/h`，每项费用 `6400`
- L6 内部：`L6-photo&xray`，固定单价 `400/个样品`，按样本数量计费，不展示 `SGS / 华测 / 苏勃` 实验室报价明细
- D-3 `L1&L4`：按 `8 个样品`，中值单价 `400/个样品`，每行费用 `3200`
- L6 外部：`L6-SEM&SECTION`，SGS `650`，华测 `500`，苏勃 `700`，按 `3 样品 × 11 点位 = 33 点位` 中值费用 `21450`
- E-1 Restricted Substance Management：总价 `20000`，其中 `1500` 为评估费
- E-2 Operating Noise & Transient Noise：无中值口径，参考 SGS `1700/台样机` 计费；费用明细只展示 SGS，不展示华测/苏勃无报价信息

已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `25`，用于刷新旧草稿中的费用。

## 2026-06-04 K13 单价修正

用户在 `outputs/mla-fee-detail-export/MLA费用规则_单页去重版.xlsx` 中修改了 `K13 Dust Ingress` 单价，已按当前 Excel 行导回：

- `SGS = 1500/批`
- `华测 = 1500/批`
- `苏勃 = 1800/批`
- 中值单价为 `1500/批`
- 12 个样品按 `4 批 × 1500 = 6000`
- 6 个样品按 `2 批 × 1500 = 3000`

## 2026-06-04 L6 内部命名与固定单价修正

用户确认 `L6 Internal Inspection 内部` 应使用 Excel 中的项目命名 `L6-photo&xray`：

- 页面模板行名称改为 `L6-photo&xray`
- 单价为固定 `400/个样品`
- 按数量计费，数量来自样本范围或组样本量
- 该项没有 `SGS / 华测 / 苏勃` 三家实验室报价，不展示实验室报价明细
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `27`，用于刷新旧草稿中的 L6 内部和外部名称

## 2026-06-04 L6 外部命名修正

用户确认 `D-3 / L6 外部` 页面显示名称应为 Excel 命名：

- 页面模板行名称改为 `L6-SEM&SECTION`
- 该项仍保留 `20d`
- 费用规则不变：按 `3 样品 × 11 点位 = 33 点位` 计算，使用 `SGS 650 / 华测 500 / 苏勃 700` 的中值，当前费用 `21450`
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `27`，用于刷新旧草稿中的 D-3 外部 L6 名称

## 2026-06-04 K28 HALT 五项拆分与 8h 计费修正

用户确认 `K28 HALT` 应拆分为五个子项目：

- `K28 HALT Cold`
- `K28 HALT Hot`
- `K28 HALT Thermal Shock`
- `K28 HALT Vibration`
- `K28 HALT TST & Vibration`

当前规则：

- 每个子项目预估测试时间和计费基数均为 `8h`
- 实验室报价：SGS `800/h`，华测 `600/h`，苏勃 `1500/h`
- 当前按三家报价中值 `800/h` 计费
- 每个子项目费用：`8h × 800 = 6400`
- 已将 `ENVIRONMENT_PLAN_TEMPLATE_VERSION` 升到 `28`，用于刷新旧草稿中的 HALT 费用与 D-8 基数

## 2026-06-04 实验室明细展示简化

用户确认弹窗上方和下方公式已经足够清楚，实验室报价明细需要节省空间：

- `K18 / K22 / K26` 等特殊或组合费用项，下方实验室明细优先节省空间，不重复完整计算过程
- `Particle Exposure` 例外：下方实验室明细必须保留各实验室的批次费、粉尘费、清洁费计算细节
- 除 `Particle Exposure`、`K18 Connector` 关键单价摘要、`K26 Mechanical Wear-Out` 常温/高温/低温价格摘要外，不再在每个实验室卡片中重复完整计算过程
- `K18 Connector` 的实验室明细仍需要展示关键单价摘要：`四项单价 325/500/125` 和 `微应力 3400/3500/3500`
- `K26 Mechanical Wear-Out` 的实验室明细需要用三行紧凑展示每家 `常温 / 高温 / 低温` 价格及总价，卡片中省略“单价”两个字
- `K18 Connector` 底部说明展示公式：`K18.1-K18.4 四项 × 12 台样机 × 单价 + K18.1 微应力费用`
- `K18 Connector` 底部说明删除信测相关信息；当前展示仅保留 `SGS / 华测 / 苏勃`

## 2026-05-27 K22 单价修正交接

本轮用户确认：`K22 Chemical Resistance` 中华测试剂单价应为 `240`，不是 `300`；`300` 对应苏劢/苏勃和信测。

已从原始文件 `资料/JLR实验室定点及报价说明.xls` 复核：

- Sheet：`一般环境测试项目单价及能力`
- 行：`K22 Chemical Resistance--条件1(MLA)`
- 条件：`Test Temp:85℃; Test Duration:72h`，`15种试剂`
- 试剂单价：
  - `SGS = 650`
  - `华测 = 240`
  - `苏劢/苏勃 = 300`
  - `信测 = 300`

当前代码已改为按实验室区分试剂单价：

- `src/types/environmentFeeDetail.ts`
  - `additiveComponent.fixedUnitPrice` 改为可选
  - 新增 `additiveComponent.fixedUnitPrices`
- `src/data/seed/mlaFeePricing.ts`
  - K22 试剂单价改为 `SGS 650 / 华测 240 / 苏劢 300 / 信测 300`
- `src/services/environmentFeeDetail.ts`
  - K22 公式计算优先读取当前实验室的 `fixedUnitPrices[lab]`
- `src/services/localStore.ts`
  - `ENVIRONMENT_PLAN_TEMPLATE_VERSION = 24`，用于刷新旧草稿中的 K22 费用
- `src/tests/environmentFeeDetail.test.ts`
  - 覆盖 K22 各实验室计算结果
- `src/tests/environmentOutlinePage.test.tsx`
  - 覆盖页面费用按钮和弹窗公式

当前 K22 结果：

- `SGS = 15 × 650 + 72 × 20 = 11190`
- `华测 = 15 × 240 + 72 × 25 = 5400`
- `苏劢 = 15 × 300 + 72 × 30 = 6660`
- `信测 = 15 × 300 + 72 × 20 = 5940`

系统按实验室总价中值取费，当前选中：

- `苏劢 = 6660`

页面验证结果：

- 页面入口：`http://127.0.0.1:5173/environment-outline`
- `PV / Group B / K22 Chemical Resistance` 费用按钮显示：`¥6,660.00`
- 双击费用按钮后弹窗显示：
  - `中值（苏劢）`
  - `15 种试剂 × 300 + 72 小时 × 30`
  - `合计 ¥6,660`
- 2026-05-27 继续确认：展开费用弹窗需要额外展示所有可报价实验室的公式、单价构成和合计；费用按钮和最终计算仍按实验室总价中值取值，不修改计费基数或迁移版本。

本轮同步检查了当前已做特殊/组合计费项：

- `K17 Audible Noise`
- `K18 Connector and lead/lock strength`
- `K26 Mechanical Wear-Out`

目前同类“华测误用 300”问题集中在 `K22`，未发现上述项目存在同样问题。

## 2026-05-13 保存点

- 已确认 `MLA / LHD` 模板可锁定。
- 已新增费用说明文档：[LHD费用说明.md](/Users/clytia/Desktop/Codex/产品测试流程自动化/docs/LHD费用说明.md)。
- 已修正并确认 `D-3 / L6 Internal Inspection 内部 = 3d`：
  - `MLA D-3` 内部 `L6` 为 `3d`
  - `MLA D-3` 外部 `L6` 为 `20d`
  - `EMA D-3` 内部 `L6` 也同步为 `3d`
- 已修正 `K26 Mechanical Wear-Out` 费用组成：
  - 常温 `334h`
  - 低温 `83h`
  - 高温 `83h`
  - 当前按实验室总价中值选中 `信测 = 9140`
- 已修正“费用按钮显示值”和“展开后的计算值”不一致问题：
  - 特殊计费项按钮不再直接吃旧 `row.fee`
  - 页面展示优先显示实时计算值
- 已将本地草稿模板版本升到 `23`，用于刷新以下旧草稿：
  - `K26` 旧费用
  - `D-3 L6 内部` 的旧 `20d`
- 已在 2026-05-27 将本地草稿模板版本升到 `24`，用于刷新：
  - `K22` 试剂单价按实验室区分后的费用

## 费用说明入口

后续交接或修改费用时，优先阅读：

- [LHD费用说明.md](/Users/clytia/Desktop/Codex/产品测试流程自动化/docs/LHD费用说明.md)

该文档专门说明：

- 当前锁定范围
- 默认模板口径
- 已确认费用规则
- 各类修改应该改哪个文件
- 修改后最少验证命令

## 仍然保留的 2026-05-08 记录

以下内容仍然有效，保留作为背景：

- 继续沿用页面入口：`http://127.0.0.1:5173/environment-outline`。
- 已新增“不完全复用”编辑场景下的手动测试项自动匹配：
  - 在环境大纲页点击“向上插入/向下插入”生成 `新测试项` 后，如果把名称改成已有完整英文测试标签，例如 `K6 Power Thermal Cycle`，系统会自动带出模板中已有项的页面测试时间。
  - 匹配仅对手动新增行生效，不影响原始模板行的普通编辑。
  - 匹配规则是大小写不敏感、压缩多余空格后精确匹配完整 label；不支持只输入 `K6` 或不完整英文名称。
  - 匹配成功后会用 `applyEnvironmentFeeDetailsToPhase()` 重新计算该 phase，手动行费用会按现有 MLA 费用规则刷新。例如 `K6 Power Thermal Cycle` 自动显示 `11d`，当前费用为 `7200`。
- 主要改动：
  - `src/store/appState.tsx`：新增手动环境行完整 label 匹配逻辑；匹配成功时复制现有行 `testHours` 并刷新费用。
  - `src/tests/homePage.test.tsx`：覆盖页面上插入手动行、输入 `K6 Power Thermal Cycle` 后自动带出 `11` 天和 `¥7,200.00`。
  - `src/tests/localStore.test.ts`：覆盖 reducer 层自动填充行为。
- 顺手更新了 `homePage.test.tsx` 中一个过期总费用断言：当前 MLA L463 初始总费用按现有规则显示为 `¥1,058,766.00`，旧断言 `¥949,266.00` 已不符合当前费用规则。
- 今日验证：
  - `npm run test:run -- src/tests/homePage.test.tsx src/tests/environmentOutlinePage.test.tsx src/tests/environmentFeeDetail.test.ts src/tests/localStore.test.ts` 通过，4 个测试文件、45 个测试通过。
  - `npm run build` 通过，TypeScript + Vite 构建成功。

## 2026-05-06 保存点

- 已修复“网页打不开”的本地开发环境问题：原因是 `5173` 端口没有 dev server 监听。
- `vite.config.ts` 已接入 `src/config/devServerConfig.ts`，固定本地服务为 `127.0.0.1:5173`，并固定 HMR 连接到同一端点。
- `tsconfig.node.json` 已包含 dev server 配置文件，并将 node 构建输出放到 `.tsbuild-node/`，避免在 `src/config` 旁生成 `.js/.d.ts`。
- `.gitignore` 已忽略 `.tsbuild-node/`。
- 新增 `src/tests/viteConfig.test.ts`，覆盖 dev server 端口、host、strictPort 和 HMR 配置。
- 今日验证：
  - `npm run test:run -- src/tests/viteConfig.test.ts` 通过，1 个测试通过。
  - `npm run build` 通过，TypeScript + Vite 构建成功。

## 已确认口径

- `L460 / L460-L / L460-R` 按 `MLA` 平台项目处理。
- `Particle Exposure` 价格已确认，下一轮不要改价格规则。
- `Optical Test` 价格已确认，下一轮不要改价格规则。
- 当前主要问题不是页面格式，而是“费用组成”和“计费基数”。
- 普通环境项的费用基数不要用测试流程页面显示的天数。例：K1 页面显示 `2d`，这个包含实验室搭建时间，不应用于费用计算。
- 普通环境项应按 `资料/JLR实验室定点及报价说明.xls` 里的 `一般环境测试系数计算表`，使用测试时间 / 数量 / 批次作为费用基数。
- 目标是先让系统按已知口径更新，然后用户逐条手动确认。

## 主要文件

- `src/data/seed/mlaFeePricing.ts`：MLA 费用单价和特殊组成规则。
- `src/data/seed/mlaFeeBasis.ts`：L460-L PV 计费基数，来自一般环境测试系数计算表。
- `src/services/environmentFeeDetail.ts`：费用明细计算主逻辑。
- `src/pages/EnvironmentOutlinePage.tsx`：环境大纲页面和费用计算弹窗展示。
- `src/store/appState.tsx`：环境大纲编辑状态更新；手动新增测试项完整名称匹配逻辑在这里。
- `src/services/localStore.ts`：本地草稿版本号，当前 `ENVIRONMENT_PLAN_TEMPLATE_VERSION = 35`。
- `src/tests/environmentFeeDetail.test.ts`：费用规则回归测试。
- `src/tests/environmentPlan.test.ts`：模板结构与默认时间回归测试。
- `src/tests/localStore.test.ts`：旧草稿迁移回归测试。
- `src/tests/homePage.test.tsx`：页面默认展示回归测试。

## 当前实现状态

`src/data/seed/mlaFeeBasis.ts` 已加入 L460-L PV 计费基数规则。普通环境项会通过 `applyCoefficientBasis()` 覆盖页面显示基数，例如：

- Group A / K1：`hour = 24`
- Group A / K4：`hour = 96`
- Group A / K5：`batch = 1`
- Group A / K6：`hour = 240`
- Group A / K7：`hour = 105`
- Group A / K13：`batch = 4`
- Group B / K22：`hour = 72`，`quantity = 15`
- Group B / K18：`quantity = 12`
- Group C / K26：`hour = 500`
- Group D-1 / K21：`hour = 336`
- Group D-2 / K20：`hour = 720`
- Group D-3 / K23：`hour = 1017`
- Group D-5 / K24：`hour = 1000`
- Group D-6 / K27 85/85：`hour = 1000`
- Group D-7 / K27 60/95：`hour = 1100`
- Group D-9 / Condensing humidity：`hour = 120`

注意：`Particle Exposure`、`Optical Test`、baseline `L1/L4` 仍保留各自已确认的特殊逻辑，不走普通系数覆盖。

## 已更新的费用组成

`K17 / K18 / K22 / K26` 已从简单单价计算改为组成计算：

- K17 Audible Noise：按 `3 个方向 × 样机数 × 单价`。
- K18 Connector：包含 `K18.1-K18.4` 四项子测试，按 `4 项 × 样机数 × 单价 + K18.1 微应力固定费用`。
- K22 Chemical Resistance：按 MLA 条件 1 的 `试剂数量 × 各实验室试剂单价 + 测试时间 × 时间单价`。
- K26 Mechanical Wear-Out：按 `334h 常温 + 83h 低温 + 83h 高温` 分段计费后，按实验室总价取中值。

当前 `mlaFeePricing.ts` 中的关键报价：

- K17：SGS `4000`，华测 `3333`，苏劢 `1000`，信测 `4000`，中值价当前为 `4000`。
- K18：SGS `325 + 3400`，华测 `200 + 3500`，苏劢 `125 + 3500`，信测 `N/A`（微应力无能力）。
- K22：试剂单价 SGS `650`、华测 `240`、苏劢 `300`、信测 `300`；时间单价 SGS `20`、华测 `25`、苏劢 `30`、信测 `20`；按实验室总价取中值，当前中值为苏劢 `6660`。
- K26：常温单价 SGS `10`、华测 `8`、苏劢 `20`、信测 `5`；低温单价 SGS `23`、华测 `25`、苏劢 `30`、信测 `50`；高温单价 SGS `23`、华测 `25`、苏劢 `30`、信测 `40`；按实验室总价中值，当前选中信测 `9140`。

测试中覆盖的结果：

- K17 / 12 台样机：`3 × 12 × 4000 = 144000`
- K18 / 12 台样机：当前中值实验室为华测，结果 `13100`
- K22：当前中值实验室为苏劢，结果 `15 × 300 + 72 × 30 = 6660`；华测明细为 `15 × 240 + 72 × 25 = 5400`。
- K26：当前中值实验室为信测，结果 `9140`
- K1：页面 `2d` 不用于费用；使用系数表 `24h`，按 `40 × 24 = 960`

页面费用弹窗已支持 `component-total` 和组合实验室总价展示，`K22`、`K18`、`K26` 可双击展开组成费用。
版本号已升到 `24`，旧本地草稿会刷新 K22 / K26 / D-3 L6 内部等已确认更新。

## 已验证

最近验证命令：

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts src/tests/environmentOutlinePage.test.tsx src/tests/environmentPlan.test.ts src/tests/localStore.test.ts src/tests/homePage.test.tsx
npm run build
```

结果：

- 最近一次验证日期：`2026-05-27`
- `environmentOutlinePage.test.tsx`：6 个测试通过。
- `environmentFeeDetail.test.ts`：15 个测试通过。
- `environmentPlan.test.ts`：13 个测试通过。
- `localStore.test.ts`：18 个测试通过。
- `homePage.test.tsx`：13 个测试通过。
- 合计：5 个测试文件、65 个测试通过。
- `npm run build`：TypeScript + Vite 构建通过。

## 下一步建议

1. 新线程打开本文件和 [LHD费用说明.md](/Users/clytia/Desktop/Codex/产品测试流程自动化/docs/LHD费用说明.md)，先不要依赖旧聊天记录。
2. 如果后续继续改 `LHD`，先确认是：
   - 改模板显示时间
   - 改计费单价
   - 改计费基数
   - 改组合公式
   - 改旧草稿迁移
3. 修改顺序建议：
   - 单价问题：改 `src/data/seed/mlaFeePricing.ts`
   - 基数问题：改 `src/data/seed/mlaFeeBasis.ts`
   - 模板时间/结构问题：改 `src/data/seed/environmentPlan.ts`
   - 展开组成问题：改 `src/services/environmentFeeDetail.ts`
   - 页面展示问题：改 `src/pages/EnvironmentOutlinePage.tsx`
   - 旧草稿刷新问题：改 `src/services/localStore.ts` 中的 `ENVIRONMENT_PLAN_TEMPLATE_VERSION`
5. 每轮修改后至少跑：

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts
```

涉及类型或页面结构时再跑：

```bash
npm run build
```

## 注意事项

- 不要把 Excel 大段内容、长日志、截图 base64 或整段 diff 塞进聊天，容易再次撑爆上下文。
- 如果需要从 Excel 取数据，优先提取成小表或直接更新 seed 文件。
- 每完成一批确认，更新这个交接文件，让后续线程能继续接班。
