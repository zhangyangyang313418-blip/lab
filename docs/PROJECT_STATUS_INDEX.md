# Product Test Evaluation Tool Status Index

更新时间：2026-06-03

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
- 2026-06-03 已按用户修改后的单页 Excel 导回 MLA 费用：当前仅 `SGS / 华测 / 苏勃` 三家参与报价和中值计算，信测不参与本版。
- 环境箱项目按样本量自动选价：`> 6` 使用大环境箱，`<= 6` 使用小环境箱。
- 本地草稿迁移版本当前为 `ENVIRONMENT_PLAN_TEMPLATE_VERSION = 28`。
- 流程图维护以 `docs/*.drawio` 和对应 `scripts/generate_*drawio*.mjs` 为准。

## 关键文件入口

### MLA/LHD 费用

- `docs/MLA费用交接.md`
- `docs/LHD费用说明.md`
- `src/data/seed/environmentPlan.ts`
- `src/data/seed/mlaFeePricing.ts`
- `src/data/seed/mlaFeeBasis.ts`
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
- 如果费用规则被确认，更新 `docs/MLA费用交接.md` 或 `docs/LHD费用说明.md`，让下一轮不用依赖聊天历史。

## 已清理噪声

- `docs/.$*.bkp` 为 WPS/draw.io 临时备份文件，不作为来源。
- `.gitignore` 已新增 `.$*.bkp`。
