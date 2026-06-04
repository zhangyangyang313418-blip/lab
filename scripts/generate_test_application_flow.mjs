import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PptxGenJS = require('/Users/clytia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/pptxgenjs@4.0.1/node_modules/pptxgenjs/dist/pptxgen.cjs.js');

const outDir = path.resolve('docs');
const pptxPath = path.join(outDir, '测试申请流程图-WPS可编辑版.pptx');
const svgPath = path.join(outDir, '测试申请流程图-高清预览.svg');

const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Codex';
pptx.company = 'Codex';
pptx.subject = '测试申请流程图';
pptx.title = '测试申请流程图';
pptx.lang = 'zh-CN';
pptx.theme = {
  headFontFace: 'Microsoft YaHei',
  bodyFontFace: 'Microsoft YaHei',
  lang: 'zh-CN'
};
pptx.defineLayout({ name: 'WIDE', width: 13.333, height: 7.5 });
pptx.layout = 'WIDE';

const slide = pptx.addSlide();
slide.background = { color: 'F6F8FB' };

const C = {
  navy: '17324D',
  text: '1F2937',
  muted: '64748B',
  panel: 'FFFFFF',
  border: 'CBD5E1',
  blue: '2563EB',
  blueSoft: 'DBEAFE',
  green: '16A34A',
  greenSoft: 'DCFCE7',
  amber: 'D97706',
  amberSoft: 'FEF3C7',
  teal: '0F766E',
  tealSoft: 'CCFBF1',
  red: 'DC2626',
  redSoft: 'FEE2E2',
  graySoft: 'EEF2F7'
};

function addTextBox(text, x, y, w, h, opts = {}) {
  slide.addShape(pptx.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.06,
    fill: { color: opts.fill || C.panel },
    line: { color: opts.line || C.border, width: opts.lineWidth || 1 },
    shadow: opts.shadow === false ? undefined : { type: 'outer', color: 'D6DEE8', opacity: 0.14, blur: 1, angle: 45, distance: 1 }
  });
  slide.addText(text, {
    x: x + 0.08,
    y: y + 0.05,
    w: w - 0.16,
    h: h - 0.1,
    fontFace: 'Microsoft YaHei',
    fontSize: opts.fontSize || 8.5,
    bold: opts.bold || false,
    color: opts.color || C.text,
    valign: 'mid',
    align: opts.align || 'center',
    fit: 'shrink',
    breakLine: false,
    margin: 0.02
  });
}

function addHeader(text, x, y, w, h, fill, color = 'FFFFFF') {
  addTextBox(text, x, y, w, h, { fill, line: fill, color, bold: true, fontSize: 11, shadow: false });
}

function arrow(x1, y1, x2, y2, color = C.muted) {
  slide.addShape(pptx.ShapeType.line, {
    x: x1,
    y: y1,
    w: x2 - x1,
    h: y2 - y1,
    line: { color, width: 1.5, beginArrowType: 'none', endArrowType: 'triangle' }
  });
}

slide.addText('测试申请流程图', {
  x: 0.35, y: 0.16, w: 4, h: 0.32,
  fontFace: 'Microsoft YaHei',
  fontSize: 18,
  bold: true,
  color: C.navy,
  margin: 0
});
slide.addText('以测试项数据库为基础，串联申请、筛选、资源确认、测试执行与报告上传', {
  x: 0.36, y: 0.52, w: 6.6, h: 0.22,
  fontFace: 'Microsoft YaHei',
  fontSize: 8.2,
  color: C.muted,
  margin: 0
});

addTextBox('测试项数据库（系统地基）\n维护人：产品测试工程师 | 使用人：All | 用于了解和学习测试项目 | 测试项目 ID 为唯一识别号 | 支持导出测试大纲，测试参数来源于数据库', 0.42, 0.78, 12.5, 0.52, { fill: C.tealSoft, line: '5EEAD4', color: C.text, bold: true, fontSize: 7.3 });
arrow(6.68, 1.30, 6.68, 1.42, C.teal);

addHeader('第一步：申请测试', 0.42, 1.42, 12.5, 0.32, C.navy);

const purposes = [
  ['摸底测试（研发）- 单项', '自行编写测试条件及要求\n或通过测试项目筛选'],
  ['摸底测试（研发）- 多项', '参考测试 Test Flow\n基于模板编辑修改'],
  ['DV / PV', '产品测试工程师使用\n固定 Test Flow 模板，可按客户需求修改'],
  ['型式试验测试', '质量工程师使用\n固定 Test Flow 模板，可按客户需求修改'],
  ['变更测试', '研发 / 产品测试 / 质量 / 采购工程师使用\n变更测试模板']
];

const cardW = 2.28;
purposes.forEach(([title, body], i) => {
  const x = 0.48 + i * 2.48;
  addTextBox(title, x, 1.90, cardW, 0.32, { fill: C.blueSoft, line: '93C5FD', color: C.navy, bold: true, fontSize: 8.0 });
  addTextBox(body, x, 2.25, cardW, 0.50, { fill: C.panel, line: 'BFDBFE', color: C.text, fontSize: 6.8 });
  arrow(x + cardW / 2, 2.75, 6.66, 2.95, '94A3B8');
});

addHeader('输出：形成测试项目 / Test Flow / 测试大纲', 4.55, 2.95, 4.25, 0.32, C.blue);
arrow(6.68, 3.27, 6.68, 3.52, C.muted);
addHeader('第二步：系统筛选测试项目', 4.55, 3.52, 4.25, 0.36, C.navy);
arrow(6.68, 3.88, 3.35, 4.18, C.muted);
arrow(6.68, 3.88, 9.98, 4.18, C.muted);

addHeader('内部测试路径', 0.72, 4.18, 5.3, 0.30, C.green);
addHeader('委外测试路径', 7.32, 4.18, 5.3, 0.30, C.amber);

addTextBox('必须内部测试\n流入东莞实验室负责人', 1.0, 4.60, 4.75, 0.44, { fill: C.greenSoft, line: '86EFAC', bold: true, fontSize: 8.0 });
arrow(3.38, 5.04, 3.38, 5.14, C.green);
addTextBox('第三步 A：资源确认\n东莞实验室负责人确认资源是否满足', 1.0, 5.14, 4.75, 0.44, { fill: C.panel, line: '86EFAC', fontSize: 7.8 });
arrow(3.38, 5.58, 3.38, 5.68, C.green);
addTextBox('资源满足：接受申请\n资源不满足：退回申请人需求', 1.0, 5.68, 4.75, 0.44, { fill: C.graySoft, line: C.border, fontSize: 7.8 });
arrow(3.38, 6.12, 3.38, 6.22, C.green);
addTextBox('第四步 A：内部执行与报告\n更新资源看板 → 编辑原始记录 → 生成草稿报告\n申请人确认无误 → 上传正式报告', 0.62, 6.22, 5.5, 0.56, { fill: C.greenSoft, line: '86EFAC', fontSize: 7.0 });

addTextBox('委外测试\n流入测试采购人员', 7.6, 4.60, 4.75, 0.44, { fill: C.amberSoft, line: 'FCD34D', bold: true, fontSize: 8.0 });
arrow(9.98, 5.04, 9.98, 5.14, C.amber);
addTextBox('第三步 B：资源确认\n采购人员比价并确认第三方实验室资源', 7.6, 5.14, 4.75, 0.44, { fill: C.panel, line: 'FCD34D', fontSize: 7.8 });
arrow(9.98, 5.58, 9.98, 5.98, C.amber);
addTextBox('第四步 B：委外执行与报告\n申请人自行跟进第三方实验室\n确认报告 → 上传正式报告', 7.24, 5.98, 5.5, 0.56, { fill: C.amberSoft, line: 'FCD34D', fontSize: 7.4 });

arrow(3.38, 6.78, 6.68, 7.18, C.muted);
arrow(9.98, 6.54, 6.68, 7.18, C.muted);
addTextBox('流程结束', 5.58, 7.03, 2.2, 0.28, { fill: C.navy, line: C.navy, color: 'FFFFFF', bold: true, fontSize: 9.2, shadow: false });

await pptx.writeFile({ fileName: pptxPath });

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
<defs>
  <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="#64748B"/></marker>
  <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#94A3B8" flood-opacity=".18"/></filter>
</defs>
<rect width="1600" height="900" fill="#F6F8FB"/>
<text x="52" y="58" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="34" font-weight="700" fill="#17324D">测试申请流程图</text>
<text x="54" y="88" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="16" fill="#64748B">以测试项数据库为基础，串联申请、筛选、资源确认、测试执行与报告上传</text>
${rect(50, 108, 1500, 62, '#CCFBF1', '#5EEAD4', '测试项数据库（系统地基）\\n维护人：产品测试工程师 | 使用人：All | 用于了解和学习测试项目 | 测试项目 ID 为唯一识别号 | 支持导出测试大纲，测试参数来源于数据库', '#1F2937', 17, true)}
${line(800, 170, 800, 190, '#0F766E')}
${rect(50, 190, 1500, 38, '#17324D', '#17324D', '第一步：申请测试', '#fff', 20, true)}
${purposeSvg()}
${line(800, 358, 800, 390)}
${rect(546, 390, 508, 40, '#2563EB', '#2563EB', '输出：形成测试项目 / Test Flow / 测试大纲', '#fff', 18, true)}
${line(800, 430, 800, 462)}
${rect(546, 462, 508, 44, '#17324D', '#17324D', '第二步：系统筛选测试项目', '#fff', 19, true)}
${line(800, 506, 405, 542)}
${line(800, 506, 1195, 542)}
${rect(86, 542, 636, 36, '#16A34A', '#16A34A', '内部测试路径', '#fff', 18, true)}
${rect(878, 542, 636, 36, '#D97706', '#D97706', '委外测试路径', '#fff', 18, true)}
${rect(120, 600, 570, 52, '#DCFCE7', '#86EFAC', '必须内部测试\\n流入东莞实验室负责人', '#17324D', 17, true)}
${line(405, 652, 405, 666, '#16A34A')}
${rect(120, 666, 570, 52, '#FFFFFF', '#86EFAC', '第三步 A：资源确认\\n东莞实验室负责人确认资源是否满足', '#1F2937', 17, false)}
${line(405, 718, 405, 732, '#16A34A')}
${rect(120, 732, 570, 52, '#EEF2F7', '#CBD5E1', '资源满足：接受申请\\n资源不满足：退回申请人需求', '#1F2937', 17, false)}
${line(405, 784, 405, 798, '#16A34A')}
${rect(74, 798, 660, 66, '#DCFCE7', '#86EFAC', '第四步 A：内部执行与报告\\n更新资源看板 → 编辑原始记录 → 生成草稿报告\\n申请人确认无误 → 上传正式报告', '#1F2937', 15, false)}
${rect(912, 600, 570, 52, '#FEF3C7', '#FCD34D', '委外测试\\n流入测试采购人员', '#17324D', 17, true)}
${line(1197, 652, 1197, 666, '#D97706')}
${rect(912, 666, 570, 52, '#FFFFFF', '#FCD34D', '第三步 B：资源确认\\n采购人员比价并确认第三方实验室资源', '#1F2937', 17, false)}
${line(1197, 718, 1197, 750, '#D97706')}
${rect(866, 750, 660, 66, '#FEF3C7', '#FCD34D', '第四步 B：委外执行与报告\\n申请人自行跟进第三方实验室\\n确认报告 → 上传正式报告', '#1F2937', 16, false)}
${line(405, 864, 800, 872)}
${line(1197, 816, 800, 872)}
${rect(668, 850, 264, 38, '#17324D', '#17324D', '流程结束', '#fff', 18, true)}
</svg>`;

fs.writeFileSync(svgPath, svg, 'utf8');

function rect(x, y, w, h, fill, stroke, text, color, size, bold = false) {
  const lines = text.split('\\n');
  const lineHeight = size * 1.35;
  const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + size * 0.38;
  const tspans = lines.map((line, i) =>
    `<tspan x="${x + w / 2}" y="${startY + i * lineHeight}">${escapeXml(line)}</tspan>`
  ).join('');
  return `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2"/></g><text font-family="Arial,'Microsoft YaHei',sans-serif" font-size="${size}" font-weight="${bold ? 700 : 400}" fill="${color}" text-anchor="middle">${tspans}</text>`;
}

function line(x1, y1, x2, y2, color = '#64748B') {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="3" marker-end="url(#arrow)"/>`;
}

function purposeSvg() {
  const items = [
    ['摸底测试（研发）- 单项', '自行编写测试条件及要求\\n或通过测试项目筛选'],
    ['摸底测试（研发）- 多项', '参考测试 Test Flow\\n基于模板编辑修改'],
    ['DV / PV', '产品测试工程师使用\\n固定模板，可按客户需求修改'],
    ['型式试验测试', '质量工程师使用\\n固定模板，可按客户需求修改'],
    ['变更测试', '研发 / 产品测试 / 质量 / 采购使用\\n变更测试模板']
  ];
  return items.map((item, i) => {
    const x = 58 + i * 297;
    const center = x + 274 / 2;
    return rect(x, 252, 274, 40, '#DBEAFE', '#93C5FD', item[0], '#17324D', 15, true)
      + rect(x, 296, 274, 62, '#FFFFFF', '#BFDBFE', item[1], '#1F2937', 13, false)
      + line(center, 358, 800, 390);
  }).join('');
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
