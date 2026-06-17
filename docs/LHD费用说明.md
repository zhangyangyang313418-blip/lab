# LHD费用说明

更新时间：2026-06-12

## 适用范围

本文件仅用于当前已确认并锁定的 `MLA / LHD` 环境模板与费用规则说明。

当前结论：

- `MLA / LHD` 模板可继续作为默认模板使用
- 当前费用规则以代码实现为准，不再依赖旧聊天上下文
- 当前报价和中值计算仅使用 `SGS / 华测 / 苏勃` 三家；代码内部仍沿用 `苏劢` 键名，页面展示为 `苏勃`
- `信测` 不参与当前版本报价展示和中值计算
- `MLA / RHD` 右舵大纲沿用当前锁定的 MLA 费用规则；`mla-rhd-group-*` 已参与 Optical、Particle Exposure、L1&L4、L6、E-2 及 K 系列费用计算
- baseline `Optical Test` 与 `L1&L4 Performance Evaluation & Functional Evaluation` 按各自 Group 样本量计算和导出，不再按跨组汇总样本量计算
- Group A 样品范围：普通 sequence rows 为 `1-12`；只有 `K16.1 Mechanical Shock Package Drop`、测试前评估、测试后 `L1&L4 / Optical / L6-photo&xray` 使用 `1-14`
- Group D-8 样品基数：前置 `Optical Test` / `L1&L4` 使用 `15 个样品`；HALT 五项保持 `8h / 800/h`；后置 `L1&L4 / Optical Test / L6-photo&xray` 使用 `9 个样品`
- 后续若有修改，应先更新本文件，再改代码

补充结论：

- EMA 费用已按用户回传的 EMA 费用规则 Excel 导回专属规则；EMA 自身测试时间、样本范围和 RHD/LHD 分组不改
- EMA 专属规则与 MLA 锁定规则分开维护，避免后续 EMA 条件差异影响 MLA
- `/environment-outline` 顶部已新增独立费用汇总行：`TOTAL COST` 后跟各组费用、`Computer Fee`、`Report Fee`；总费用口径为各组测试费用合计 + 电脑费用 + 报告费用

## 代码入口

- 模板结构与默认测试时间：
  - `src/data/seed/environmentPlan.ts`
- 单价与组合费用规则：
  - `src/data/seed/mlaFeePricing.ts`
- 计费基数：
  - `src/data/seed/mlaFeeBasis.ts`
- 费用计算主逻辑：
  - `src/services/environmentFeeDetail.ts`
- 页面展示与费用弹窗：
  - `src/pages/EnvironmentOutlinePage.tsx`
- 本地草稿迁移版本：
  - `src/services/localStore.ts`

## 当前锁定的模板口径

### L6 Internal Inspection

- `Group D-3` 需要拆成两行：
  - `L6-photo&xray`
  - `L6-SEM&SECTION`
- 其他组只保留：
  - `L6-photo&xray`

### L6 内部测试时间

- 样本量 `12`：`7d`
- 样本量 `6`：`3d`
- `D-3 / L6-photo&xray`：当前锁定为 `3d`
- `D-3 / L6-SEM&SECTION`：当前保留 `20d`

### L6 费用

- `L6-photo&xray`：固定单价 `400 / 个样品`，按样本数量计费，不展示 `SGS / 华测 / 苏勃` 实验室报价明细
- Group A 测试后 `L6-photo&xray` 按 `1-14` 全部样品计费，当前费用 `14 × 400 = 5600`
- Group D-3 `L6-photo&xray` 按 `8 个样品` 计费，当前费用 `8 × 400 = 3200`
- `L6-SEM&SECTION`：按 `3 样品 × 11 点位 = 33 点位` 计费，使用 `SGS 650 / 华测 500 / 苏勃 700` 的中值计算
- `D-3` 内部和外部分别单独计费

## 当前锁定的重点费用规则

### 展开费用展示规则

- 费用计算仍按当前规则取实验室总价中值，不因展开展示改变。
- 展开费用弹窗上方保留完整公式；下方实验室明细默认只展示各实验室名称、是否中值和报价总价摘要，避免重复展示完整计算过程。
- `Particle Exposure` 例外：实验室明细必须保留批次费、粉尘费、清洁费的报价计算细节。
- `K26 Mechanical Wear-Out` 例外：实验室明细必须用三行紧凑列出每家常温、高温、低温价格和报价总价，卡片中省略“单价”两个字。
- 中值实验室在明细中标记为“（中值）”。
- 该展示要求适用于 K17、K18、K22、K26 等组合/特殊费用项；不修改计费基数、单价或本地草稿迁移版本。

### 已确认的特殊项

- `Computer Fee`
  - SGS `250/月/台`、华测 `450/月/台`、苏勃 `150/月/台`
  - 默认系数 `48`，可在页面双击费用后展开修改
  - 当前按 SGS 报价计入 `TOTAL COST`
- `Report Fee`
  - SGS `0/份`、华测 `0/份`、苏勃 `150/份`
  - 报告份数默认按当前 phase 实际组数量，每组一份，可在页面双击费用后展开修改
  - 当前按苏勃报价计入 `TOTAL COST`
- `Particle Exposure`
  - 保留特殊实验室总价逻辑
- `Optical Test`
  - 保留 51 点位 / 19 点位拆分逻辑；普通 Group 按本组样本量计算为 `1 台 51 点位 + 其余 19 点位`
- `L1&L4 Performance Evaluation & Functional Evaluation`
  - 按本组样机数量计费；无 `sampleRange` 时优先取当前 Group `totalSampleQty`
  - Group A baseline 与 post 评估均按 `1-14 / 14 个样品` 计费
  - Group D-3 按 `8 个 PCBA 样品` 计费，每行费用 `8 × 400 = 3200`
- `L6-photo&xray`
  - 内部固定单价 `400 / 个样品`
- `L6-SEM&SECTION`
  - D-3 外部委外组合费用，按 `3 样品 × 11 点位 = 33 点位` 中值计费
- `E-2 Operating Noise & Transient Noise`
  - 无中值口径，参考 SGS `1700/台样机` 计费
  - 费用明细只展示 SGS，不展示华测/苏勃无报价信息
- `K28 HALT`
  - 拆分为 `HALT Cold / HALT Hot / HALT Thermal Shock / HALT Vibration / HALT TST & Vibration`
  - 每个子项目预估测试时间和计费基数均为 `8h`
  - SGS `800/h`，华测 `600/h`，苏勃 `1500/h`
  - 当前按中值 `800/h` 计费，每项 `6400`
- `Group D-8` 前后评估
  - 前置 `Optical Test`：`15 个样品`，费用 `750`
  - 前置 `L1&L4`：`15 个样品`，费用 `6000`
  - 后置 `L1&L4`：`9 个样品`，费用 `3600`
  - 后置 `Optical Test`：`9 个样品`，费用 `450`
  - 后置 `L6-photo&xray`：`9 个样品`，费用 `3600`

### K13

- 与样本量挂钩
- 每批最多 `3` 个样品
- 当前三家单价：
  - `SGS = 1500/批`
  - `华测 = 1500/批`
  - `苏勃 = 1800/批`
- 当前按实验室总价中值取费，中值单价为 `1500/批`
- 样本量 `12` 时：系数 `4`
- 样本量 `12` 时当前结果：`4 批 × 1500 = 6000`
- 样本量 `6` 时：系数 `2`
- 样本量 `6` 时当前结果：`2 批 × 1500 = 3000`

### K14

- 当前仅按指定国测口径
- `3000 / 批`
- 每批最多 `3` 个样品
- 与样本量挂钩

### K15

- 与样本量挂钩
- 每次工装最多 `6` 个样品
- 样本量 `12` 时：系数 `48`
- 样本量 `6` 时：系数 `24`

### K17 Audible Noise

- 公式：`3 个方向 × 样机数 × 单价`
- 当前三家单价：
  - `SGS = 12000`
  - `华测 = 10000`
  - `苏勃 = 3000`
- 12 台样机当前结果：
  - `SGS = 144000`
  - `华测 = 120000`
  - `苏勃 = 36000`
- 当前按实验室总价中值选中：
  - `华测 = 120000`

### K18 Connector and lead/lock strength

- 弹窗底部公式说明：`K18.1-K18.4 四项 × 12 台样机 × 单价 + K18.1 微应力费用`
- 四项子测试单价：
  - `SGS = 325`
  - `华测 = 500`
  - `苏勃 = 125`
- 微应力固定费用：
  - `SGS = 3400`
  - `华测 = 3500`
  - `苏勃 = 3500`
- 12 台样机当前结果：
  - `SGS = 19000`
  - `华测 = 27500`
  - `苏勃 = 9500`
- 当前按实验室总价中值选中：
  - `SGS = 19000`
- 弹窗实验室明细展示关键单价摘要：
  - `SGS`：`四项单价 325；微应力 3400`
  - `华测`：`四项单价 500；微应力 3500`
  - `苏勃`：`四项单价 125；微应力 3500`

### K22 Chemical Resistance

- 公式：`15 种试剂 × 各实验室试剂单价 + 72h × 实验室时间单价`
- 来源：`资料/JLR实验室定点及报价说明.xls` / `一般环境测试项目单价及能力` / `K22 Chemical Resistance--条件1(MLA)`
- 2026-06-03 已按用户修改后的单页 Excel 导回当前价格，以下列当前实现为准
- 试剂单价：
  - `SGS = 650/种`
  - `华测 = 700/种`
  - `苏勃 = 300/种`
- 时间单价：
  - `SGS = 20/h`
  - `华测 = 25/h`
  - `苏勃 = 30/h`
- 当前按实验室总价中值取费
- 当前结果：
  - `SGS = 11190`
  - `华测 = 12300`
  - `苏勃 = 6660`
- 按当前实现，中值选中：
  - `SGS = 11190`
- 页面显示：
  - 费用按钮：`¥11,190.00`
  - 弹窗中值：`中值（SGS）`
  - 弹窗公式：`15 种试剂 × 650 + 72 小时 × 20`
  - 弹窗实验室明细展示 `SGS / 华测 / 苏勃` 各自公式和合计

### K26 Mechanical Wear-Out

- 公式拆分为三段：
  - 常温 `334h`
  - 低温 `83h`
  - 高温 `83h`
- 单价如下：
  - 常温：
    - `SGS = 10/h`
    - `华测 = 7/h`
    - `苏勃 = 20/h`
  - 低温：
    - `SGS = 23/h`
    - `华测 = 25/h`
    - `苏勃 = 30/h`
  - 高温：
    - `SGS = 23/h`
    - `华测 = 25/h`
    - `苏勃 = 30/h`
- 当前系统按实验室总价中值取费
- 当前结果：
  - `SGS = 7158`
  - `华测 = 6488`
  - `苏勃 = 11660`
- 按当前实现，中值选中：
  - `SGS = 7158`

## 当前计费基数入口

普通环境项的计费基数不直接使用页面显示天数，而是优先使用：

- `src/data/seed/mlaFeeBasis.ts`

典型规则示例：

- `Group A / K1 = 24h`
- `Group A / K4 = 96h`
- `Group A / K6 = 240h`
- `Group A / K13 = 按样本量换算批次`
- `Group A / K14 = 按样本量换算批次`
- `Group B / K22 = 72h + quantity 15`
- `Group B / K18 = quantity 12`
- `Group C / K26 = 500h`
- `Group D-3 / K23 = 1017h`
- `Group D-3 / L1&L4 = quantity 8`
- `Group D-3 / L6-SEM&SECTION = quantity 33`，页面展示为 `3 样品 × 11 点位`，Excel 导出计费基数展示为 `33 个点位`

## 修改规则时怎么判断改哪里

### 1. 页面测试时间不对

改：

- `src/data/seed/environmentPlan.ts`

例如：

- 某组默认显示 `20d` 应改为 `3d`
- 某测试项需要拆成两行

### 2. 单价不对

改：

- `src/data/seed/mlaFeePricing.ts`

例如：

- 某实验室单价更新
- 新增固定费用
- 新增组合费用段

### 3. 计费基数不对

改：

- `src/data/seed/mlaFeeBasis.ts`

例如：

- 某项应按 `24h`，现在写成了 `48h`
- 某项应按 `quantity` 而不是 `hour`

### 4. 公式逻辑不对

改：

- `src/services/environmentFeeDetail.ts`

例如：

- 多段组合费用
- 实验室总价中值
- 固定加项与变量项混合

### 5. 页面按钮和弹窗显示不一致

优先检查：

- `src/pages/EnvironmentOutlinePage.tsx`
- `src/services/environmentFeeDetail.ts`

### 6. 刷新页面后还是旧值

优先检查：

- `src/services/localStore.ts`

如果是旧草稿未刷新，通常需要：

- 提升 `ENVIRONMENT_PLAN_TEMPLATE_VERSION`

## 当前迁移版本

当前：

```text
ENVIRONMENT_PLAN_TEMPLATE_VERSION = 36
```

这个版本已覆盖的刷新目标包括：

- `K22` 新组成费用
- `K22` 试剂单价按实验室区分后的费用
- `K26` 新组合费用
- `D-3 / L6-photo&xray = 3d`
- 三家实验室报价口径：仅 `SGS / 华测 / 苏勃` 参与展示与中值计算
- EMA 费用按回传 Excel 导回专属规则：K52.351 / Particle / K14 不测；K7/K17/K20/K21/K22 按 EMA 条件差异计费
- 附加费用字段与总费用刷新：`Computer Fee`、`Report Fee` 计入 `TOTAL COST`
- MLA RHD 旧草稿刷新到锁定 MLA 费用规则：补齐右舵 Optical、Particle Exposure、L1&L4、L6、E-2 及 K 系列费用
- baseline `Optical Test` / `L1&L4` 旧草稿刷新到按各自 Group 样本量计算和导出
- Group A post `L1&L4 / Optical / L6-photo&xray` 旧草稿刷新到 `1-14` 全部样品
- Group D-3 `L1&L4` 旧草稿刷新到 `8 个样品 / 3200`
- Group D-8 前后评估旧草稿刷新到前置 `15 个样品`、后置 `9 个样品`

## 修改后的最少验证

至少运行：

```bash
npm run test:run -- src/tests/environmentFeeDetail.test.ts
npm run test:run -- src/tests/environmentPlan.test.ts
npm run test:run -- src/tests/localStore.test.ts
```

如果涉及页面展示，再运行：

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
npm run test:run -- src/tests/homePage.test.tsx
```

最终构建验证：

```bash
npm run build
```

## 交接建议

- 后续如果先改 `LHD`，不要顺手一起改 `RHD`，除非用户明确要求
- 每次确认一条新费用规则，都要同步更新本文件
- 如果用户口头确认“模板锁定”，优先在本文件里落文字，再改代码
