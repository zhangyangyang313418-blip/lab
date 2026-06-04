import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.resolve('docs');
const outPath = path.join(outDir, '测试申请、分流、执行与报告归档流程.drawio');

const C = {
  bg: '#f4f7fb',
  card: '#ffffff',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d8dee9',
  primary: '#1f4e79',
  primaryLight: '#e8f1fb',
  applicantBorder: '#5b9bd5',
  system: '#fff4d6',
  systemBorder: '#d7a928',
  lab: '#e8f5e9',
  labBorder: '#4f9d69',
  purchase: '#fff0e6',
  purchaseBorder: '#e27a2c',
  report: '#f0e9ff',
  reportBorder: '#8064a2',
  danger: '#fff1f2',
  dangerBorder: '#d1495b',
  decisionBorder: '#4b5563',
  header2: '#2a6f9f'
};

const PALETTE = {
  applicant: [C.primaryLight, C.applicantBorder, C.text],
  system: [C.system, C.systemBorder, C.text],
  lab: [C.lab, C.labBorder, C.text],
  purchase: [C.purchase, C.purchaseBorder, C.text],
  report: [C.report, C.reportBorder, C.text],
  return: [C.danger, C.dangerBorder, C.text],
  decision: [C.card, C.decisionBorder, C.text],
  start: [C.primary, C.primary, '#ffffff'],
  panel: ['#ffffff', C.border, C.text],
  phase: [C.primary, C.primary, '#ffffff'],
  transparent: ['none', 'none', C.text]
};

let next = 2;
let cells = [];

function reset() {
  next = 2;
  cells = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];
}

function id(prefix) {
  const value = `${prefix}-${next}`;
  next += 1;
  return value;
}

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function html(value) {
  return esc(value).replaceAll('\n', '&lt;br&gt;');
}

function style(entries) {
  return Object.entries(entries)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join(';') + ';';
}

function box(value, x, y, w, h, kind = 'panel', opts = {}) {
  const [fill, stroke, fontColor] = PALETTE[kind] || PALETTE.panel;
  const cellId = opts.id || id('node');
  const shape = opts.shape || 'rounded';
  const isText = shape === 'text';
  cells.push(
    `<mxCell id="${cellId}" value="${html(value)}" style="${style({
      rounded: isText ? 0 : 1,
      whiteSpace: 'wrap',
      html: 1,
      arcSize: opts.arcSize ?? 10,
      fillColor: opts.fillColor || fill,
      strokeColor: opts.strokeColor || stroke,
      strokeWidth: opts.strokeWidth ?? (isText ? 0 : 1.5),
      fontColor: opts.fontColor || fontColor,
      fontFamily: 'Microsoft YaHei',
      fontSize: opts.fontSize || 13,
      fontStyle: opts.bold ? 1 : 0,
      align: opts.align || 'center',
      verticalAlign: opts.verticalAlign || 'middle',
      spacing: opts.spacing ?? 8,
      spacingLeft: opts.spacingLeft,
      spacingRight: opts.spacingRight,
      spacingTop: opts.spacingTop,
      dashed: opts.dashed ? 1 : 0,
      opacity: opts.opacity,
      'data-role': opts.dataRole
    })}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`
  );
  return cellId;
}

function text(value, x, y, w, h, opts = {}) {
  return box(value, x, y, w, h, 'transparent', {
    shape: 'text',
    fontSize: opts.fontSize || 13,
    fontColor: opts.fontColor || C.muted,
    bold: opts.bold || false,
    align: opts.align || 'center',
    verticalAlign: opts.verticalAlign || 'middle',
    fillColor: 'none',
    strokeColor: 'none'
  });
}

function arrow(value, x, y, w = 34, h = 34) {
  return text(value, x, y, w, h, { fontSize: 28, fontColor: '#64748b' });
}

function phase(no, title, y, h) {
  box(`${no}\n${title}`, 32, y, 220, h, 'phase', {
    fontSize: 18,
    bold: true,
    arcSize: 8
  });
  box('', 266, y, 1180, h, 'panel', {
    id: `phase-content-${no.toLowerCase().replaceAll(' ', '-')}`,
    dataRole: 'phase-content',
    fillColor: '#ffffff',
    strokeColor: C.border,
    opacity: 78,
    arcSize: 8
  });
}

function legend() {
  box('', 40, 128, 1580, 54, 'panel', { fillColor: C.card, strokeColor: C.border });
  const items = [
    ['申请人 / 业务发起', 'applicant'],
    ['系统识别 / 自动分流', 'system'],
    ['东莞实验室', 'lab'],
    ['采购 / 委外', 'purchase'],
    ['报告 / 归档', 'report'],
    ['退回 / 修正', 'return']
  ];
  items.forEach(([label, kind], index) => {
    const x = 80 + index * 245;
    box('', x, 146, 16, 16, kind, { arcSize: 4, strokeWidth: 1 });
    text(label, x + 24, 139, 190, 30, { align: 'left', fontSize: 13 });
  });
}

function card(value, x, y, w, h, kind, opts = {}) {
  return box(value, x, y, w, h, kind, {
    fontSize: opts.fontSize || 13,
    bold: opts.bold ?? true,
    arcSize: 10,
    spacing: 10,
    align: opts.align || 'center'
  });
}

function lane(title, subtitle, x, y, w, h) {
  box(`${title}\n${subtitle}`, x, y, w, h, 'panel', {
    dashed: true,
    fillColor: '#ffffff',
    strokeColor: '#cfd6df',
    opacity: 85,
    fontSize: 14,
    bold: true,
    verticalAlign: 'top',
    spacingTop: 12,
    arcSize: 10
  });
}

function buildLayout() {
  reset();
  box('', 0, 0, 1480, 1990, 'panel', { fillColor: C.bg, strokeColor: 'none', strokeWidth: 0, arcSize: 0 });
  box('测试申请、分流、执行与报告归档流程\n覆盖测试申请目的选择、Test Flow 生成、系统筛选分流、内部/委外执行、报告确认与归档闭环。', 32, 28, 1416, 82, 'phase', {
    fillColor: C.primary,
    strokeColor: C.primary,
    fontSize: 24,
    bold: true,
    align: 'left',
    spacingLeft: 28,
    arcSize: 10
  });
  legend();

  phase('Phase 01', '测试申请', 210, 360);
  card('流程启动', 296, 238, 130, 54, 'start', { fontSize: 14 });
  arrow('→', 438, 247, 28, 28);
  card('申请人发起测试申请\n触发：新产品验证、DV/PV、型式试验、变更验证、研发摸底等需求\n输入：项目 / 产品 / 客户 / 样品 / 期望完成时间 / 附件', 482, 226, 370, 80, 'applicant', { fontSize: 12 });
  arrow('→', 866, 247, 28, 28);
  card('判断\n选择测试申请目的\n测试目的决定模板、必填项、流程路径与责任角色', 914, 226, 340, 80, 'decision', { fontSize: 12 });
  arrow('↓', 842, 307, 28, 28);
  [
    ['摸底测试 - 单项\n研发使用\n\n自定义测试条件及要求\n或通过测试项目筛选选择单项'],
    ['摸底测试 - 多项\n研发使用\n\n参考测试 Test Flow\n调用模板后编辑修改'],
    ['DV / PV 测试\n产品测试工程师使用\n\n调用固定 Test Flow 模板\n按客户需求调整'],
    ['型式试验测试\n质量工程师使用\n\n调用固定 Test Flow 模板\n按客户需求调整'],
    ['变更测试\n多角色使用\n\n研发 / 产品测试 / 质量 / 采购\n调用变更测试模板']
  ].forEach(([value], index) => {
    card(value, 296 + index * 226, 344, 210, 150, 'panel', { fontSize: 11, bold: true });
  });
  arrow('↓', 842, 500, 28, 28);
  card('形成测试项目清单 / Test Flow\n输出：测试项目、标准号、测试条件、样品数量、判定标准、执行方式建议、报告要求', 296, 526, 1118, 34, 'applicant', { fontSize: 12 });

  phase('Phase 02', '系统筛选与分流', 594, 140);
  card('系统识别测试项目属性\n触发：申请人提交 Test Flow 后自动执行\n输入：测试项目库、标准库、模板规则、内部/委外属性、客户要求', 296, 626, 340, 74, 'system', { fontSize: 11 });
  arrow('→', 646, 647, 28, 28);
  card('判断\n执行方式判定\n内部 / 委外 / 内部+委外混合', 690, 626, 230, 74, 'decision', { fontSize: 11 });
  arrow('→', 930, 647, 28, 28);
  card('内部测试任务包\n输出至：东莞实验室负责人', 974, 618, 130, 82, 'lab', { fontSize: 10 });
  card('委外测试任务包\n输出至：测试采购人员', 1122, 618, 130, 82, 'purchase', { fontSize: 10 });
  card('混合测试任务包\n拆分为内部任务 + 委外任务，并保持同一申请单关联', 1270, 618, 130, 82, 'system', { fontSize: 9 });

  phase('Phase 03', '资源确认', 758, 260);
  lane('A. 内部实验室资源确认', '东莞实验室负责人', 296, 786, 555, 204);
  lane('B. 委外实验室资源确认', '测试采购人员', 872, 786, 555, 204);
  card('接收内部测试任务\n输入：内部测试任务包、样品信息、测试条件、期望交期', 318, 836, 222, 58, 'lab', { fontSize: 10 });
  arrow('→', 548, 848, 28, 28);
  card('判断\n确认资源是否满足\n设备 / 人员 / 样品 / 条件 / 交期', 592, 836, 222, 58, 'decision', { fontSize: 10 });
  card('满足：接受申请\n输出：内部测试执行任务', 318, 918, 222, 52, 'lab', { fontSize: 10 });
  card('不满足：退回申请人\n输出：退回意见、需补充资料、资源限制说明', 592, 918, 222, 52, 'return', { fontSize: 10 });
  card('接收委外测试任务\n输入：委外测试任务包、标准、测试条件、资质要求、期望交期', 894, 826, 218, 58, 'purchase', { fontSize: 10 });
  arrow('→', 1120, 838, 28, 28);
  card('采购人员进行比价\n输入：候选第三方实验室、报价、周期、资质、历史评价', 1164, 826, 218, 58, 'purchase', { fontSize: 10 });
  arrow('↓', 1124, 890, 28, 28);
  card('确认第三方实验室资源\n输出：选定实验室、报价记录、预计周期、联系人、委外任务状态', 980, 918, 330, 52, 'purchase', { fontSize: 10 });

  phase('Phase 04', '测试执行与报告确认', 1042, 340);
  lane('A. 内部测试执行', '东莞实验室测试人员 + 申请人', 296, 1070, 555, 286);
  lane('B. 委外测试执行', '申请人 + 第三方实验室', 872, 1070, 555, 286);
  card('测试人员接收任务\n输入：内部测试任务、Test Flow、样品与标准要求', 318, 1120, 222, 52, 'lab', { fontSize: 10 });
  arrow('→', 548, 1130, 28, 28);
  card('更新资源看板\n输出：设备 / 人员 / 时间排期', 592, 1120, 222, 52, 'lab', { fontSize: 10 });
  card('执行测试并编辑原始记录\n输出：测试数据、照片、异常记录、原始记录附件', 318, 1198, 222, 52, 'lab', { fontSize: 10 });
  arrow('→', 548, 1208, 28, 28);
  card('生成草稿报告\n输出：内部草稿报告、结论、待确认事项', 592, 1198, 222, 52, 'report', { fontSize: 10 });
  card('判断\n申请人确认草稿报告\n确认无误 / 退回修改 / 补充说明', 318, 1276, 222, 52, 'decision', { fontSize: 10 });
  arrow('→', 548, 1286, 28, 28);
  card('上传正式报告\n输出：正式报告文件、报告版本、确认记录', 592, 1276, 222, 52, 'report', { fontSize: 10 });
  card('需修改时返回\n申请人填写修改意见，流程返回“原始记录编辑 / 草稿报告生成”环节。', 318, 1338, 496, 40, 'return', { fontSize: 10 });
  card('申请人跟进第三方实验室测试进度\n输入：委外任务、实验室联系人、预计周期、样品寄送信息', 894, 1114, 500, 52, 'applicant', { fontSize: 10 });
  card('维护委外任务状态\n待送样 → 已送样 → 测试中 → 报告待确认 → 已完成\n输出：委外进度、异常记录、延期说明', 894, 1184, 500, 62, 'system', { fontSize: 10 });
  card('申请人确认第三方实验室报告\n输入：第三方正式报告、测试条件、结论、报告资质', 894, 1262, 500, 52, 'applicant', { fontSize: 10 });
  card('上传第三方正式报告\n输出：第三方报告文件、确认记录、委外任务关闭', 894, 1332, 500, 52, 'report', { fontSize: 10 });

  phase('Phase 05', '报告归档与闭环', 1406, 126);
  card('汇总报告与过程资料\n输入：正式报告、第三方报告、原始记录、附件、流程日志、确认记录', 296, 1442, 330, 56, 'report', { fontSize: 10 });
  arrow('→', 638, 1454, 28, 28);
  card('关联项目 / 产品 / 客户 / 标准 / Test Flow\n输出：可追溯测试档案', 690, 1442, 330, 56, 'report', { fontSize: 10 });
  arrow('→', 1032, 1454, 28, 28);
  card('报告归档 / 流程关闭', 1084, 1448, 300, 44, 'start', { fontSize: 13 });
  box('平台设计提示：该流程建议配套 12 个模块建设：测试申请管理、Test Flow 模板管理、测试项目库/标准库、分流规则、内部实验室资源管理、采购委外管理、测试执行与原始记录、报告管理、审批确认、通知待办、权限角色、数据看板统计。', 32, 1564, 1416, 48, 'panel', {
    align: 'left',
    fontSize: 13,
    fontColor: C.muted,
    spacingLeft: 16,
    fillColor: C.card
  });
}

export function buildDrawioXml() {
  buildLayout();
  return `<mxfile host="app.diagrams.net" modified="2026-05-14T00:00:00.000Z" agent="Codex" version="24.7.17" type="device"><diagram id="test-application-flow" name="测试申请流程"><mxGraphModel dx="1480" dy="1000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1480" pageHeight="1640" math="0" shadow="0"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
}

export function writeDrawioFile(filePath = outPath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buildDrawioXml(), 'utf8');
  return filePath;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  console.log(`Wrote ${writeDrawioFile()}`);
}
