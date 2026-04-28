# MLA 环境费用细则设计

## 1. 目标

在现有产品测试自动化平台中，为 MLA 环境测试大纲增加费用细则区域。费用细则与环境大纲放在同一页面：大纲在上，费用细则在下。用户先确认大纲，再确认费用；费用细则计算出的预计单项费用回填到上方大纲的 `Fee` 字段，并进一步汇总到 Group Fee 与 Total Fee。

首版聚焦 MLA DV / PV 两个阶段。由于 `JLR实验室定点及报价说明.xls` 中 L460-L PV 阶段费用最完整，先以 L460-L PV 作为费用主数据模板，再按测试项同步到 DV。

## 2. 页面结构

费用细则位于现有环境大纲页面下方，不单独放到结果页费用标签中。

页面顺序：

1. 项目与阶段摘要
2. 环境测试大纲 flow chart
3. 费用细则表
4. 返回、撤销、进入结果页等现有操作

费用细则表参考用户提供的 Excel 样式，采用横向分组表格：

- 蓝色 Group 标题块
- 每个 Group 顶部显示 `Total样机数量`
- 行项目包含测试时间、数量、批次
- 右侧展示实验室单价中值、单项费用预计、各实验室单价与单项费用

## 3. 数据范围

首版包含：

- MLA PV 费用细则
- MLA DV 费用细则
- L460-L PV 作为首版费用主数据来源
- DV 从 PV 按测试项 code/name 同步报价信息

首版特殊处理：

- `Particle Exposure` 保留费用项，但费用规则待后续单独确认
- `Dust Blowing` 保留费用项，但费用规则待后续单独确认
- E 组保留费用项，但费用可为空白
- 电脑费用删除，不进入首版费用细则

## 4. 表格字段

顶部项目区：

- 项目
- 项目代号，例如 `L460-L`
- 阶段，例如 `PV` / `DV`
- `L1&L4总计数量`

费用明细行：

- `groupId`
- `groupTitle`
- `testCode`
- `testName`
- `testHours`
- `quantity`
- `batchCount`
- `chargeBasis`: `hour | quantity | batch | pending`
- `medianUnitPrice`
- `estimatedItemFee`
- `labs.SGS.unitPrice`
- `labs.SGS.itemFee`
- `labs.华测.unitPrice`
- `labs.华测.itemFee`
- `labs.苏劢.unitPrice`
- `labs.苏劢.itemFee`
- `labs.信测.unitPrice`
- `labs.信测.itemFee`
- `notes`
- `outlineRowId`，用于回填上方大纲 Fee

## 5. 中值单价规则

实验室单价中值只使用有效报价。空值、`N/A`、非数字报价不参与计算。

规则：

- 0 家有效报价：显示 `待确认`，不回填 Fee
- 1 家有效报价：取该报价
- 2 家有效报价：取较低值
- 3 家及以上有效报价：取中位数

示例：`Particle Exposure` 有效报价为 SGS `1750`、华测 `6500`、苏劢 `4333`，信测 `N/A`。有效报价数为 3，中值单价为 `4333`。

## 6. 费用计算规则

预计单项费用用于回填上方大纲 `Fee`。

通用公式：

- 按小时项：`estimatedItemFee = medianUnitPrice * testHours`
- 按数量项：`estimatedItemFee = medianUnitPrice * quantity`
- 按批次项：`estimatedItemFee = medianUnitPrice * batchCount`
- 待确认项：`estimatedItemFee` 为空，不回填 Fee

各实验室单项费用使用同一计费基数：

- `labItemFee = labUnitPrice * chargeBase`
- 若实验室单价为 `N/A` 或空值，实验室单项费用显示 `N/A`

## 7. 与大纲同步

费用细则通过 `outlineRowId` 或测试项 code/name 对应上方环境大纲行。

同步方向：

1. 大纲确定测试项、数量、批次、测试时间
2. 费用细则读取这些基础字段
3. 费用细则计算预计单项费用
4. 预计单项费用回填大纲 `Fee`
5. 大纲重新汇总 Group Fee 与 Total Fee

当 DV 中存在 PV 主数据没有报价的项目时，费用细则显示 `待确认`，不自动回填 Fee。

## 8. 错误与待确认状态

费用细则需要清晰显示不可计算原因：

- 无有效实验室报价：`待确认`
- 特殊费用规则未确定：`规则待确认`
- 大纲行未匹配：`未匹配大纲`
- 电脑费用：不显示

这些状态不参与费用汇总。

## 9. 测试策略

首版测试覆盖：

- 中值单价计算规则
- 0/1/2/3 家有效报价场景
- 按小时、按数量、按批次费用计算
- `N/A` 不参与中值和实验室单项费用
- 待确认项不回填大纲 Fee
- 费用细则计算结果能回填大纲行 Fee
- Group Fee 与 Total Fee 随 Fee 更新

## 10. 非目标

首版不做：

- 从 `.xls` 自动解析完整费用数据库
- 电脑费用
- Particle Exposure / Dust Blowing / E 组的最终特殊计费规则
- 材料、EMC 费用细则
- 多实验室选择与报价锁定流程
- Excel 导出费用细则版式还原
