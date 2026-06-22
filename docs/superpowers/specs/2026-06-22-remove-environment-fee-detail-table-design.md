# 移除环境大纲重复费用明细表设计

## 决策

`/environment-outline` 页面不再展示 DV、PV 底部“费用细则”表格。本设计替代 `2026-06-22-environment-fee-detail-collapse-design.md` 中的折叠方案：费用表不是默认收起，而是从页面完全移除。

## 保留范围

- 保留流程图内每个测试项目的单项费用按钮及费用计算弹窗。
- 保留每个阶段顶部的总费用、Group 费用、Computer Fee 与 Report Fee 汇总。
- 保留现有 Excel 导出按钮、导出模板、费用计算服务及导出逻辑。
- 保留费用规则数据，用于页面汇总、单项费用与 Excel 导出。

## 删除范围

- 删除 `EnvironmentOutlinePage` 对 `EnvironmentFeeDetailTable` 的导入和渲染。
- 删除不再被使用的 `EnvironmentFeeDetailTable` 组件文件。
- 删除只服务于底部费用表的 `.fee-detail*` 样式。
- 删除折叠按钮、展开状态及相应页面测试断言。

## 数据与迁移

本次只调整页面展示层，不修改环境费用数据结构、本地草稿、模板版本、费用规则、费用计算或 Excel 文件。不需要草稿迁移，也不新增费用版本记录。

## 测试与验收

- 页面中不存在“DV 费用细则”“PV 费用细则”标题或费用明细表。
- 页面仍显示 DV/PV 顶部费用汇总、流程图单项费用按钮与“导出 MLA 费用 Excel”按钮。
- 费用计算、页面布局、本地草稿、环境模板与首页回归测试继续通过。
- 生产构建通过，浏览器确认页面在 Group Total Fee 后直接进入下一阶段或页面操作区。

