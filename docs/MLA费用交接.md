# MLA 费用交接

更新时间：2026-05-02

## 新线程使用方式

新线程先读这个文件，再继续做 MLA 环境费用确认。旧线程 `MLA 费用` 已经接近上下文上限，继续发消息会触发远端 compact，之前两次失败并断流，所以不要再依赖旧线程继续工作。

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

Git 状态：

- 仓库已在项目根目录完成 `git init`。
- 第一版功能保存点：`8f04e6d Initial project snapshot`。
- 新线程接手后先运行 `git status --short`，确认是否有旧线程遗留改动。

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
- `src/services/localStore.ts`：本地草稿版本号，当前 `ENVIRONMENT_PLAN_TEMPLATE_VERSION = 20`。
- `src/tests/environmentFeeDetail.test.ts`：费用规则回归测试。

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

`K17 / K18 / K22` 已从单项计算改为组成计算：

- K17 Audible Noise：按 `3 个方向 × 样机数 × 单价`。
- K18 Connector：包含 `K18.1-K18.4` 四项子测试，按 `4 项 × 样机数 × 单价`。
- K22 Chemical Resistance：按 MLA 条件 1 的 `试剂数量 × 试剂单价 + 测试时间 × 时间单价`，当前为 `15 × 300 + 72h × 时间单价`。

当前 `mlaFeePricing.ts` 中的关键报价：

- K17：SGS `4000`，华测 `3333`，苏劢 `1000`，信测 `4000`，中值价当前为 `4000`。
- K18：SGS `325`，华测 `200`，苏劢 `125`，信测 `500`，中值价当前为 `325`。
- K22：试剂单价 `300`；时间单价 SGS `20`、华测 `25`、苏劢 `30`、信测 `20`；按实验室总价取中值，当前中值为华测 `6300`。

测试中覆盖的结果：

- K17 / 12 台样机：`3 × 12 × 4000 = 144000`
- K18 / 12 台样机：`4 × 12 × 325 = 15600`
- K22：`15 × 300 + 72 × 25 = 6300`（华测为中值实验室）
- K1：页面 `2d` 不用于费用；使用系数表 `24h`，按 `40 × 24 = 960`

页面费用弹窗已修复 `component-total` 分支，B 组前两项 `K22`、`K18` 可双击展开组成费用。
版本号已升到 `20`，旧本地草稿会刷新 K22 费用。

## 已验证

最近验证命令：

```bash
npm run test:run -- src/tests/environmentOutlinePage.test.tsx
npm run test:run -- src/tests/environmentFeeDetail.test.ts
npm run test:run -- src/tests/environmentPlan.test.ts
npm run test:run -- src/tests/localStore.test.ts
npm run build
```

结果：

- `environmentOutlinePage.test.tsx`：5 个测试通过，覆盖 B 组 `K22`、`K18` 组成费用展开。
- `environmentFeeDetail.test.ts`：12 个测试通过。
- `environmentPlan.test.ts`：10 个测试通过。
- `localStore.test.ts`：14 个测试通过，覆盖版本 19 旧草稿刷新到 K22 新费用。
- `npm run build`：TypeScript + Vite 构建通过。

## 下一步建议

1. 新线程打开本文件，先不要读取旧线程完整历史。
2. 在页面上逐条核对普通环境项的费用组成，优先看 K1、K5、K6、K13、K14、K17、K18、K22、D 组各项。
3. 如果用户指出某一项费用不对，先判断是 `单价`、`计费基数`、还是 `组成倍数` 不对。
4. 修改顺序建议：
   - 单价问题：改 `src/data/seed/mlaFeePricing.ts`
   - 基数问题：改 `src/data/seed/mlaFeeBasis.ts`
   - 展开组成问题：改 `src/services/environmentFeeDetail.ts`
   - 页面展示问题：改 `src/pages/EnvironmentOutlinePage.tsx`
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
