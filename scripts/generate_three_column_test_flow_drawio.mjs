import fs from 'node:fs';
import path from 'node:path';

const outputPath = path.resolve('docs/测试申请三栏流程图.drawio');

const c = {
  bg: '#f4f7fb',
  white: '#ffffff',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d8dee9',
  blue: '#1f4e79',
  applicant: '#e8f1fb',
  applicantLine: '#5b9bd5',
  system: '#fff4d6',
  systemLine: '#d7a928',
  lab: '#e8f5e9',
  labLine: '#4f9d69',
  purchase: '#fff0e6',
  purchaseLine: '#e27a2c',
  report: '#f0e9ff',
  reportLine: '#8064a2',
  danger: '#fff1f2',
  dangerLine: '#d1495b',
  darkLine: '#4b5563',
  arrow: '#64748b'
};

const fills = {
  applicant: [c.applicant, c.applicantLine],
  system: [c.system, c.systemLine],
  lab: [c.lab, c.labLine],
  purchase: [c.purchase, c.purchaseLine],
  report: [c.report, c.reportLine],
  danger: [c.danger, c.dangerLine],
  decision: [c.white, c.darkLine],
  phase: [c.blue, c.blue],
  panel: [c.white, c.border]
};

let cells = [];

function esc(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '&lt;br&gt;');
}

function style(entries) {
  return Object.entries(entries)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${key}=${value}`)
    .join(';') + ';';
}

function addBox(id, value, x, y, w, h, kind = 'panel', opts = {}) {
  const [fill, stroke] = fills[kind] || fills.panel;
  const fontColor = kind === 'phase' ? '#ffffff' : c.text;
  cells.push(`<mxCell id="${id}" value="${esc(value)}" style="${style({
    rounded: 1,
    whiteSpace: 'wrap',
    html: 1,
    arcSize: opts.arcSize ?? 8,
    fillColor: opts.fillColor || fill,
    strokeColor: opts.strokeColor || stroke,
    strokeWidth: opts.strokeWidth ?? 1.5,
    shadow: opts.shadow ?? 1,
    fontColor: opts.fontColor || fontColor,
    fontFamily: 'Microsoft YaHei',
    fontSize: opts.fontSize || 13,
    fontStyle: opts.bold === false ? 0 : 1,
    align: opts.align || 'center',
    verticalAlign: opts.verticalAlign || 'middle',
    spacing: opts.spacing ?? 10,
    spacingTop: opts.spacingTop,
    spacingLeft: opts.spacingLeft,
    dashed: opts.dashed ? 1 : 0
  })}" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
}

function addText(id, value, x, y, w, h, opts = {}) {
  addBox(id, value, x, y, w, h, 'panel', {
    fillColor: 'none',
    strokeColor: 'none',
    strokeWidth: 0,
    shadow: 0,
    fontColor: opts.fontColor || c.text,
    fontSize: opts.fontSize || 13,
    bold: opts.bold || false,
    align: opts.align || 'center',
    verticalAlign: opts.verticalAlign || 'middle',
    spacing: 0
  });
}

function addEdge(id, source, target, opts = {}) {
  cells.push(`<mxCell id="${id}" value="${esc(opts.label || '')}" style="${style({
    edgeStyle: 'orthogonalEdgeStyle',
    rounded: 0,
    html: 1,
    strokeColor: opts.color || c.arrow,
    strokeWidth: opts.width || 2,
    dashed: opts.dashed ? 1 : 0,
    endArrow: 'block',
    endFill: 1,
    fontFamily: 'Microsoft YaHei',
    fontSize: 12,
    fontColor: opts.color || c.arrow
  })}" edge="1" parent="1" source="${source}" target="${target}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
}

function addInfo(id, title, body, x, y, w = 360, h = 108) {
  addBox(id, `${title}\n${body}`, x, y, w, h, 'panel', {
    align: 'left',
    verticalAlign: 'top',
    fontSize: 12,
    bold: false,
    spacing: 12
  });
}

function phase(id, text, y) {
  addBox(id, text, 460, y, 900, 40, 'phase', { fontSize: 16 });
}

function buildXml() {
  cells = [
    '<mxCell id="0"/>',
    '<mxCell id="1" parent="0"/>'
  ];

  addBox('bg', '', 0, 0, 2200, 3000, 'panel', {
    fillColor: c.bg,
    strokeColor: 'none',
    shadow: 0,
    arcSize: 0
  });

  addBox('title', '测试申请、分流、执行与报告归档流程图\n三栏式流程视图：使用人 / 触发条件 · 主流程 · 输入物 / 输出物 / 系统模块', 40, 30, 2120, 90, 'phase', {
    fontSize: 28,
    align: 'left',
    spacingLeft: 28
  });

  addBox('left-header', '使用人 / 触发条件', 40, 150, 360, 52, 'phase', { fontSize: 18 });
  addBox('main-header', '主流程', 460, 150, 900, 52, 'phase', { fontSize: 18 });
  addBox('right-header', '输入物 / 输出物 / 系统模块', 1420, 150, 740, 52, 'phase', { fontSize: 18 });

  phase('phase01', 'PHASE 01：测试申请', 225);
  addBox('p01-panel', '', 460, 275, 900, 485, 'panel');
  addBox('node01', '01 申请人发起测试申请\n填写项目、产品、客户/OEM、样品、测试背景、期望完成时间和附件', 660, 300, 500, 78, 'applicant', { fontSize: 15 });
  addBox('decision-purpose', '判断：选择测试申请目的', 700, 425, 420, 58, 'decision', { fontSize: 15 });
  const purposes = [
    ['purpose01', '摸底测试 - 单项\n研发使用；自定义条件或筛选单项测试项目', 490],
    ['purpose02', '摸底测试 - 多项\n研发使用；参考 Test Flow 模板并编辑', 670],
    ['purpose03', 'DV / PV 测试\n产品测试工程师使用；固定模板，可修改', 850],
    ['purpose04', '型式试验测试\n质量工程师使用；固定模板，可修改', 1030],
    ['purpose05', '变更测试\n研发 / 产品测试 / 质量 / 采购使用', 1210]
  ];
  for (const [id, label, x] of purposes) addBox(id, label, x, 530, x === 1210 ? 120 : 160, 92, 'panel', { fontSize: 12 });
  addBox('node02', '02 形成测试项目清单 / Test Flow\n形成测试项目、标准、条件、样品数量、判定标准、报告要求', 620, 670, 580, 66, 'applicant', { fontSize: 15 });

  phase('phase02', 'PHASE 02：系统筛选与分流', 805);
  addBox('p02-panel', '', 460, 855, 900, 245, 'panel');
  addBox('node03', '03 系统识别测试项目属性\n基于测试项目库、标准库、实验室能力和内外部规则进行判断', 610, 885, 600, 70, 'system', { fontSize: 15 });
  addBox('decision-execution', '判断：执行方式判定\n内部测试 / 委外测试 / 内部 + 委外混合测试', 650, 990, 520, 66, 'decision', { fontSize: 15 });

  phase('phase03', 'PHASE 03：资源确认', 1150);
  addBox('p03-panel', '', 460, 1200, 900, 390, 'panel');
  addBox('lane-internal-resource', 'A. 内部测试路径', 490, 1225, 400, 335, 'panel', { dashed: true, shadow: 0, verticalAlign: 'top', spacingTop: 10 });
  addBox('lane-outsource-resource', 'B. 委外测试路径', 930, 1225, 400, 335, 'panel', { dashed: true, shadow: 0, verticalAlign: 'top', spacingTop: 10 });
  addBox('node04a', '04A 流入东莞实验室负责人\n确认设备、人员、样品、测试条件和交期', 525, 1280, 330, 64, 'lab', { fontSize: 14 });
  addBox('decision-resource', '判断：资源是否满足', 550, 1380, 280, 54, 'decision', { fontSize: 14 });
  addBox('node04a-accept', '满足：接受申请\n生成内部测试执行任务', 515, 1470, 160, 58, 'lab', { fontSize: 13 });
  addBox('node04a-return', '退回申请人\n补充或修改需求', 700, 1470, 160, 58, 'danger', { fontSize: 13 });
  addBox('node04b', '04B 流入测试采购人员\n接收委外测试任务包', 965, 1270, 330, 58, 'purchase', { fontSize: 14 });
  addBox('node04b-compare', '采购人员进行比价\n比较报价、周期、资质和历史评价', 965, 1370, 330, 58, 'purchase', { fontSize: 14 });
  addBox('node04b-confirm', '确认第三方实验室资源\n确定实验室、报价、周期、联系人和状态', 965, 1470, 330, 58, 'purchase', { fontSize: 14 });

  phase('phase04', 'PHASE 04：执行与报告确认', 1645);
  addBox('p04-panel', '', 460, 1695, 900, 505, 'panel');
  addBox('lane-internal-execution', 'A. 内部测试执行', 490, 1720, 400, 450, 'panel', { dashed: true, shadow: 0, verticalAlign: 'top', spacingTop: 10 });
  addBox('lane-outsource-execution', 'B. 委外测试执行', 930, 1720, 400, 450, 'panel', { dashed: true, shadow: 0, verticalAlign: 'top', spacingTop: 10 });
  addBox('node05a', '05A 接收任务并更新资源看板\n维护设备、人员、排期和任务状态', 525, 1770, 330, 56, 'lab', { fontSize: 13 });
  addBox('node05a-record', '执行测试并编辑原始记录\n记录数据、照片、异常说明和附件', 525, 1850, 330, 56, 'lab', { fontSize: 13 });
  addBox('node05a-draft', '生成草稿报告\n基于原始记录和报告模板生成草稿', 525, 1930, 330, 56, 'report', { fontSize: 13 });
  addBox('decision-draft-confirm', '判断：申请人确认草稿报告\n确认无误进入正式报告；需修改则退回', 525, 2010, 330, 58, 'decision', { fontSize: 13 });
  addBox('node05a-formal', '内部正式报告确认完成', 525, 2090, 330, 46, 'report', { fontSize: 13 });
  addBox('node05b', '05B 申请人跟进第三方实验室\n跟进送样、进度、异常和报告出具', 965, 1795, 330, 58, 'applicant', { fontSize: 13 });
  addBox('node05b-confirm', '确认第三方实验室报告\n确认报告内容、条件、资质和结论', 965, 1905, 330, 58, 'applicant', { fontSize: 13 });
  addBox('node05b-upload', '上传第三方正式报告\n将第三方正式报告上传至流程', 965, 2015, 330, 58, 'report', { fontSize: 13 });

  phase('phase05', 'PHASE 05：报告归档', 2250);
  addBox('p05-panel', '', 460, 2300, 900, 210, 'panel');
  addBox('node06', '06 上传正式报告并归档\n关联申请单、项目、产品、标准、Test Flow、原始记录、附件和流程日志', 620, 2335, 580, 70, 'report', { fontSize: 15 });
  addBox('node-close', '流程关闭 / 可追溯档案形成\n形成报告库、测试记录库和后续查询统计数据', 620, 2430, 580, 58, 'phase', { fontSize: 15 });

  const left = [
    ['left01', '01 测试申请', '使用人：研发、产品测试工程师、质量工程师、采购工程师\n触发条件：研发摸底、DV/PV、型式试验、客户验证、变更验证等需求产生', 300, 110],
    ['left02', '02 形成 Test Flow', '使用人：申请人\n触发条件：测试目的选择完成后，系统加载模板或进入自定义测试项目选择', 645, 95],
    ['left03', '03 系统筛选分流', '使用人：系统自动执行，管理员维护规则\n触发条件：申请人提交 Test Flow', 895, 95],
    ['left04a', '04A 内部资源确认', '使用人：东莞实验室负责人\n触发条件：存在内部测试任务包', 1265, 92],
    ['left04b', '04B 委外资源确认', '使用人：测试采购人员\n触发条件：存在委外测试任务包，或内部资源不满足需转委外', 1435, 105],
    ['left05a', '05A 内部测试执行', '使用人：东莞实验室测试人员、申请人\n触发条件：实验室负责人接受申请并分配任务', 1760, 105],
    ['left05b', '05B 委外测试执行', '使用人：申请人主跟进，采购可查看状态\n触发条件：采购确认第三方实验室资源', 1955, 105],
    ['left06', '06 报告归档', '使用人：申请人、测试人员、系统管理员\n触发条件：内部草稿确认无误，或第三方报告确认完成', 2335, 110]
  ];
  for (const [id, title, body, y, h] of left) addInfo(id, `${title}`, body, 40, y, 360, h);

  const right = [
    ['right01', '01 输入 / 输出', '输入物：项目、产品、客户、样品、测试背景、附件\n输出物：测试申请单、申请编号、草稿 / 已提交状态\n系统模块：测试申请管理', 300, 120],
    ['right02', '02 输入 / 输出', '输入物：测试目的、产品类型、客户要求、Test Flow 模板\n输出物：Test Flow、测试项目清单\n系统模块：Test Flow 模板库、测试项目库', 645, 110],
    ['right03', '03 输入 / 输出', '输入物：Test Flow、测试项目属性、内外部测试规则\n输出物：内部任务包、委外任务包、混合任务包\n系统模块：分流规则引擎', 895, 110],
    ['right04a', '04A 输入 / 输出', '输入物：内部任务包、样品、测试条件、期望交期\n输出物：接受申请、退回意见、资源确认结果\n系统模块：内部实验室资源管理', 1265, 112],
    ['right04b', '04B 输入 / 输出', '输入物：委外任务包、资质要求、候选第三方实验室\n输出物：比价记录、选定实验室、报价、周期\n系统模块：委外采购管理、第三方实验室库', 1435, 112],
    ['right05a', '05A 输入 / 输出', '输入物：内部测试任务、样品、标准、Test Flow\n输出物：资源看板、原始记录、草稿报告、申请人确认结果\n系统模块：测试执行、原始记录、报告管理', 1760, 118],
    ['right05b', '05B 输入 / 输出', '输入物：委外任务、第三方实验室信息、第三方报告\n输出物：委外状态、第三方正式报告、异常记录\n系统模块：委外任务管理、报告管理', 1955, 112],
    ['right06', '06 输入 / 输出', '输入物：正式报告、原始记录、附件、流程日志\n输出物：归档档案、报告库、统计数据\n系统模块：报告归档、权限、数据看板', 2335, 112]
  ];
  for (const [id, title, body, y, h] of right) addInfo(id, title, body, 1420, y, 740, h);

  addBox('modules-title', '平台建设模块总览', 40, 2580, 2120, 46, 'phase', { fontSize: 18 });
  const modules = [
    ['测试申请管理', '新建申请、草稿、提交、退回修改、附件上传'],
    ['Test Flow 模板库', '摸底、DV/PV、型式试验、变更测试模板及版本管理'],
    ['测试项目 / 标准库', '标准号、测试条件、判定标准、内部/委外属性'],
    ['分流规则引擎', '内部、委外、混合测试任务自动拆分'],
    ['内部实验室资源管理', '资源确认、任务分配、设备/人员排期、资源看板'],
    ['委外采购管理', '第三方实验室库、比价、报价、周期、状态'],
    ['测试执行记录', '测试任务、原始数据、异常记录、过程附件'],
    ['报告管理归档', '草稿确认、正式报告、第三方报告、版本管理'],
    ['审批与确认', '接受、退回、转交、节点意见、操作轨迹'],
    ['通知与待办', '待办中心、节点提醒、退回提醒、超期提醒'],
    ['角色权限', '申请人、负责人、测试人员、采购、管理员权限'],
    ['数据看板', '测试进度、资源负荷、委外费用、报告完成率']
  ];
  modules.forEach(([name, desc], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    addBox(`module${String(index + 1).padStart(2, '0')}`, `${index + 1}. ${name}\n${desc}`, 40 + col * 540, 2650 + row * 100, 500, 78, 'panel', {
      align: 'left',
      fontSize: 12,
      spacing: 12
    });
  });

  addEdge('edge01', 'node01', 'decision-purpose');
  addEdge('edge02', 'decision-purpose', 'purpose03');
  addEdge('edge03', 'purpose03', 'node02');
  addEdge('edge04', 'node02', 'node03');
  addEdge('edge05', 'node03', 'decision-execution');
  addEdge('edge06a', 'decision-execution', 'node04a', { label: '内部测试', color: c.labLine });
  addEdge('edge06b', 'decision-execution', 'node04b', { label: '委外 / 混合', color: c.purchaseLine });
  addEdge('edge07a', 'node04a', 'decision-resource', { color: c.labLine });
  addEdge('edge07b', 'decision-resource', 'node04a-accept', { label: '满足', color: c.labLine });
  addEdge('edge07c', 'decision-resource', 'node04a-return', { label: '不满足', color: c.dangerLine, dashed: true });
  addEdge('edge08a', 'node04b', 'node04b-compare', { color: c.purchaseLine });
  addEdge('edge08b', 'node04b-compare', 'node04b-confirm', { color: c.purchaseLine });
  addEdge('edge09a', 'node04a-accept', 'node05a', { color: c.labLine });
  addEdge('edge09b', 'node04b-confirm', 'node05b', { color: c.purchaseLine });
  addEdge('edge10a', 'node05a', 'node05a-record', { color: c.labLine });
  addEdge('edge10b', 'node05a-record', 'node05a-draft', { color: c.labLine });
  addEdge('edge10c', 'node05a-draft', 'decision-draft-confirm', { color: c.reportLine });
  addEdge('edge10d', 'decision-draft-confirm', 'node05a-formal', { label: '确认无误', color: c.reportLine });
  addEdge('edge10e', 'decision-draft-confirm', 'node05a-record', { label: '需修改', color: c.dangerLine, dashed: true });
  addEdge('edge11a', 'node05b', 'node05b-confirm', { color: c.applicantLine });
  addEdge('edge11b', 'node05b-confirm', 'node05b-upload', { color: c.reportLine });
  addEdge('edge12a', 'node05a-formal', 'node06', { color: c.reportLine });
  addEdge('edge12b', 'node05b-upload', 'node06', { color: c.reportLine });
  addEdge('edge13', 'node06', 'node-close');

  return `<mxfile host="app.diagrams.net" modified="2026-05-14T00:00:00.000Z" agent="Codex" version="24.7.17" type="device"><diagram id="test-application-archive-flow" name="测试申请流程图"><mxGraphModel dx="2200" dy="3000" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="2200" pageHeight="3000" math="0" shadow="0"><root>${cells.join('')}</root></mxGraphModel></diagram></mxfile>`;
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, buildXml(), 'utf8');
console.log(outputPath);
