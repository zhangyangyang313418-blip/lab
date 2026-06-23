import { expect, test } from 'vitest';

import { buildDrawioXml } from '../scripts/generate_test_application_drawio.mjs';

test('buildDrawioXml creates editable draw.io cells for the complete test workflow', () => {
  const xml = buildDrawioXml();

  expect(xml).toMatch(/^<mxfile /);
  expect(xml).toMatch(/<diagram /);
  expect(xml).toMatch(/<mxCell /);
  expect(xml).toMatch(/value="Phase 01&lt;br&gt;测试申请"/);
  expect(xml).toMatch(/value="Phase 05&lt;br&gt;报告归档与闭环"/);
  expect(xml).toMatch(/data-role=phase-content/);
  expect(xml).toMatch(/value="摸底测试 - 单项&lt;br&gt;研发使用/);
  expect(xml).toMatch(/value="混合测试任务包/);
  expect(xml).toMatch(/value="A\. 内部实验室资源确认&lt;br&gt;东莞实验室负责人"/);
  expect(xml).toMatch(/value="B\. 委外测试执行&lt;br&gt;申请人 \+ 第三方实验室"/);
  expect(xml).toMatch(/value="报告归档 \/ 流程关闭"/);
  expect(xml).toMatch(/value="↓"/);
  expect(xml).toMatch(/value="→"/);
  expect(xml).toMatch(/pageWidth="1480"/);
  expect(xml).toMatch(/width="220" height="360"/);
  expect(xml).toMatch(/width="1180" height="360"/);
  expect(xml).toMatch(/width="210" height="150"/);
  expect(xml).toMatch(/fontSize=12/);
  expect((xml.match(/edge="1"/g) || []).length).toBe(0);
});
