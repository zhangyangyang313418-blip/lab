import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDrawioXml } from '../scripts/generate_test_application_drawio.mjs';

test('buildDrawioXml creates editable draw.io cells for the complete test workflow', () => {
  const xml = buildDrawioXml();

  assert.match(xml, /^<mxfile /);
  assert.match(xml, /<diagram /);
  assert.match(xml, /<mxCell /);
  assert.match(xml, /value="Phase 01&lt;br&gt;测试申请"/);
  assert.match(xml, /value="Phase 05&lt;br&gt;报告归档与闭环"/);
  assert.match(xml, /data-role=phase-content/);
  assert.match(xml, /value="摸底测试 - 单项&lt;br&gt;研发使用/);
  assert.match(xml, /value="混合测试任务包/);
  assert.match(xml, /value="A\. 内部实验室资源确认&lt;br&gt;东莞实验室负责人"/);
  assert.match(xml, /value="B\. 委外测试执行&lt;br&gt;申请人 \+ 第三方实验室"/);
  assert.match(xml, /value="报告归档 \/ 流程关闭"/);
  assert.match(xml, /value="↓"/);
  assert.match(xml, /value="→"/);
  assert.match(xml, /pageWidth="1480"/);
  assert.match(xml, /width="220" height="360"/);
  assert.match(xml, /width="1180" height="360"/);
  assert.match(xml, /width="210" height="150"/);
  assert.match(xml, /fontSize=12/);
  assert.equal((xml.match(/edge="1"/g) || []).length, 0);
});
