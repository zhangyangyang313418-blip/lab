import fs from 'node:fs';
import path from 'node:path';

const outDir = path.resolve('docs');
const posPath = path.join(outDir, '测试申请流程图-WPS流程图可导入版.pos');
const svgPath = path.join(outDir, '测试申请流程图-WPS流程图预览.svg');

const elements = {};
let z = 1;

const colors = {
  navy: '#17324D',
  text: '#1F2937',
  muted: '#64748B',
  blue: '#2563EB',
  blueSoft: '#DBEAFE',
  tealSoft: '#CCFBF1',
  teal: '#0F766E',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  graySoft: '#EEF2F7',
  white: '#FFFFFF'
};

function id(prefix) {
  return `${prefix}_${Math.random().toString(16).slice(2, 10)}${Date.now().toString(16).slice(-4)}`;
}

function commonElement({ elementId, title, x, y, w, h, fill, stroke, textColor, fontSize, bold = false, pathActions }) {
  elements[elementId] = {
    id: elementId,
    title,
    category: 'flowchart',
    name: 'process',
    link: '',
    children: [],
    parent: '',
    group: '',
    locked: false,
    dataAttributes: [],
    resizeDir: ['tl', 'tr', 'br', 'bl'],
    anchors: [
      { x: 'w/2', y: '0' },
      { x: 'w/2', y: 'h' },
      { x: '0', y: 'h/2' },
      { x: 'w', y: 'h/2' }
    ],
    attribute: {
      linkable: true,
      visible: true,
      container: false,
      rotatable: true,
      markerOffset: 5,
      collapsable: false,
      collapsed: false
    },
    props: { x, y, w, h, angle: 0, zindex: z++ },
    fontStyle: {
      fontFamily: 'Microsoft YaHei',
      color: textColor,
      fontSize,
      bold,
      textAlign: 'center',
      vAlign: 'middle'
    },
    lineStyle: {
      lineColor: stroke,
      lineWidth: 2
    },
    fillStyle: {
      type: 'solid',
      color: fill
    },
    shapeStyle: { alpha: 1 },
    textBlock: [
      {
        position: { x: 8, y: 6, w: 'w-16', h: 'h-12' },
        text: title,
        fontStyle: {
          fontFamily: 'Microsoft YaHei',
          color: textColor,
          fontSize,
          bold,
          textAlign: 'center',
          vAlign: 'middle'
        }
      }
    ],
    path: [
      {
        actions: pathActions || [
          { action: 'move', x: 10, y: 0 },
          { action: 'line', x: 'w-10', y: 0 },
          { action: 'quadraticCurve', x: 'w', y: 10, x1: 'w', y1: 0 },
          { action: 'line', x: 'w', y: 'h-10' },
          { action: 'quadraticCurve', x: 'w-10', y: 'h', x1: 'w', y1: 'h' },
          { action: 'line', x: 10, y: 'h' },
          { action: 'quadraticCurve', x: 0, y: 'h-10', x1: 0, y1: 'h' },
          { action: 'line', x: 0, y: 10 },
          { action: 'quadraticCurve', x: 10, y: 0, x1: 0, y1: 0 },
          { action: 'close' }
        ]
      }
    ]
  };
}

function box(title, x, y, w, h, fill, stroke, textColor = colors.text, fontSize = 15, bold = false) {
  const elementId = id('box');
  commonElement({ elementId, title, x, y, w, h, fill, stroke, textColor, fontSize, bold });
  return elementId;
}

function diamond(title, x, y, w, h, fill, stroke, textColor = colors.text, fontSize = 15, bold = false) {
  const elementId = id('diamond');
  commonElement({
    elementId,
    title,
    x,
    y,
    w,
    h,
    fill,
    stroke,
    textColor,
    fontSize,
    bold,
    pathActions: [
      { action: 'move', x: 'w/2', y: 0 },
      { action: 'line', x: 'w', y: 'h/2' },
      { action: 'line', x: 'w/2', y: 'h' },
      { action: 'line', x: 0, y: 'h/2' },
      { action: 'close' }
    ]
  });
  elements[elementId].name = 'decision';
  return elementId;
}

function line(x1, y1, x2, y2, color = colors.muted, label = '') {
  const elementId = id('line');
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.max(Math.abs(x2 - x1), 1);
  const h = Math.max(Math.abs(y2 - y1), 1);
  elements[elementId] = {
    id: elementId,
    title: label,
    category: 'standard',
    name: 'linker',
    link: '',
    children: [],
    parent: '',
    group: '',
    locked: false,
    dataAttributes: [],
    resizeDir: ['tl', 'tr', 'br', 'bl'],
    anchors: [],
    attribute: {
      linkable: false,
      visible: true,
      container: false,
      rotatable: true,
      markerOffset: 5,
      collapsable: false,
      collapsed: false
    },
    props: { x, y, w, h, angle: 0, zindex: z++ },
    fontStyle: {
      fontFamily: 'Microsoft YaHei',
      color: colors.text,
      fontSize: 12,
      textAlign: 'center'
    },
    lineStyle: {
      lineColor: color,
      lineWidth: 2,
      endArrowStyle: 'solidArrow'
    },
    fillStyle: { type: 'none' },
    shapeStyle: { alpha: 1 },
    textBlock: label ? [
      {
        position: { x: 'w/2-30', y: 'h/2-12', w: 60, h: 24 },
        text: label,
        fontStyle: { fontFamily: 'Microsoft YaHei', color: colors.text, fontSize: 12, textAlign: 'center' }
      }
    ] : [],
    path: [
      {
        fillStyle: { type: 'none' },
        actions: [
          { action: 'move', x: x1 - x, y: y1 - y },
          { action: 'line', x: x2 - x, y: y2 - y }
        ]
      }
    ]
  };
  return elementId;
}

box('测试申请流程图', 560, 20, 480, 50, colors.navy, colors.navy, colors.white, 22, true);
box('测试项数据库（系统地基）\n维护人：产品测试工程师 | 使用人：All\n用途：了解和学习测试项目\n测试项目 ID 为唯一识别号\n支持申请人导出测试大纲，测试参数来源于数据库', 130, 95, 1340, 110, colors.tealSoft, '#5EEAD4', colors.text, 16, true);
line(800, 205, 800, 245, colors.teal);

box('第一步：申请测试', 560, 245, 480, 48, colors.navy, colors.navy, colors.white, 19, true);

const purposeY = 330;
const purposeW = 250;
const purposeGap = 35;
const purposeX = 115;
[
  ['摸底测试（研发使用）- 单项', '可自行编写测试条件及要求\n或通过测试项目筛选'],
  ['摸底测试（研发使用）- 多项', '一般参考测试 Test Flow\n基于模板编辑修改'],
  ['DV / PV', '产品测试工程师使用\n固定 Test Flow 模板\n可按客户需求修改'],
  ['型式试验测试', '质量工程师使用\n固定 Test Flow 模板\n可按客户需求修改'],
  ['变更测试', '研发 / 产品测试 / 质量 / 采购工程师使用\n使用变更测试模板']
].forEach(([title, detail], index) => {
  const x = purposeX + index * (purposeW + purposeGap);
  box(title, x, purposeY, purposeW, 54, colors.blueSoft, '#93C5FD', colors.navy, 14, true);
  box(detail, x, purposeY + 64, purposeW, 90, colors.white, '#BFDBFE', colors.text, 13, false);
  line(x + purposeW / 2, purposeY + 154, 800, 545, '#94A3B8');
});

box('输出：形成测试项目 / Test Flow / 测试大纲', 515, 545, 570, 50, colors.blue, colors.blue, colors.white, 17, true);
line(800, 595, 800, 650);

diamond('第二步：系统筛选\n测试项目执行方式', 690, 650, 220, 110, colors.white, colors.navy, colors.navy, 16, true);
line(690, 705, 395, 795, colors.muted, '必须内部测试');
line(910, 705, 1205, 795, colors.muted, '委外测试');

box('内部测试路径', 160, 795, 470, 45, colors.green, colors.green, colors.white, 17, true);
box('流入东莞实验室负责人', 185, 870, 420, 56, colors.greenSoft, '#86EFAC', colors.text, 15, true);
line(395, 926, 395, 970, colors.green);
box('第三步 A：资源确认\n东莞实验室负责人确认资源是否满足', 185, 970, 420, 64, colors.white, '#86EFAC', colors.text, 15, false);
line(395, 1034, 395, 1080, colors.green);
diamond('资源是否满足？', 300, 1080, 190, 105, colors.graySoft, '#CBD5E1', colors.text, 15, true);
line(300, 1132, 185, 1235, colors.green, '否');
box('退回申请人需求', 50, 1235, 270, 55, '#FEE2E2', '#FCA5A5', colors.text, 15, true);
line(395, 1185, 395, 1235, colors.green, '是');
box('第四步 A：内部测试执行与报告\n东莞实验室测试人员更新资源看板\n编辑原始记录 → 生成草稿报告\n申请人确认无误 → 上传正式报告', 185, 1235, 420, 112, colors.greenSoft, '#86EFAC', colors.text, 14, false);

box('委外测试路径', 970, 795, 470, 45, colors.amber, colors.amber, colors.white, 17, true);
box('流入测试采购人员', 995, 870, 420, 56, colors.amberSoft, '#FCD34D', colors.text, 15, true);
line(1205, 926, 1205, 970, colors.amber);
box('第三步 B：资源确认\n采购人员比价并确认第三方实验室资源', 995, 970, 420, 64, colors.white, '#FCD34D', colors.text, 15, false);
line(1205, 1034, 1205, 1235, colors.amber);
box('第四步 B：委外测试执行与报告\n申请人自行跟进第三方实验室\n确认第三方实验室报告\n上传正式报告至流程', 995, 1235, 420, 112, colors.amberSoft, '#FCD34D', colors.text, 14, false);

line(395, 1347, 800, 1410);
line(1205, 1347, 800, 1410);
box('流程结束', 675, 1410, 250, 52, colors.navy, colors.navy, colors.white, 18, true);

const pos = {
  diagram: {
    image: {
      height: 1500,
      pngdata: '',
      width: 1600,
      x: 0,
      y: 0
    },
    elements: {
      page: {
        gridSize: 15,
        showGrid: true,
        orientation: 'portrait',
        height: 1500,
        backgroundColor: 'transparent',
        width: 1600,
        padding: 20
      },
      elements
    }
  },
  meta: {
    id: 'test-application-flow',
    member: 'Codex',
    exportTime: new Date().toISOString().replace('T', ' ').slice(0, 19),
    diagramInfo: {
      category: 'flow',
      title: '测试申请流程图',
      created: new Date().toISOString().replace('T', ' ').slice(0, 19),
      attributes: null,
      creator: 'Codex',
      modified: new Date().toISOString().replace('T', ' ').slice(0, 19)
    },
    type: 'ProcessOn Schema File',
    version: '1.0'
  }
};

fs.writeFileSync(posPath, JSON.stringify(pos, null, 2), 'utf8');

const svgParts = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1500" viewBox="0 0 1600 1500">',
  '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="#64748B"/></marker></defs>',
  '<rect width="1600" height="1500" fill="#F6F8FB"/>'
];

for (const item of Object.values(elements)) {
  if (item.name === 'linker') {
    const p = item.path[0].actions;
    const x1 = item.props.x + p[0].x;
    const y1 = item.props.y + p[0].y;
    const x2 = item.props.x + p[1].x;
    const y2 = item.props.y + p[1].y;
    svgParts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${item.lineStyle.lineColor}" stroke-width="2.5" marker-end="url(#arrow)"/>`);
    if (item.title) {
      svgParts.push(`<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 8}" font-family="Arial,'Microsoft YaHei',sans-serif" font-size="14" text-anchor="middle" fill="${colors.text}">${escapeXml(item.title)}</text>`);
    }
  } else {
    const { x, y, w, h } = item.props;
    const isDiamond = item.name === 'decision';
    if (isDiamond) {
      svgParts.push(`<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" fill="${item.fillStyle.color}" stroke="${item.lineStyle.lineColor}" stroke-width="2"/>`);
    } else {
      svgParts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${item.fillStyle.color}" stroke="${item.lineStyle.lineColor}" stroke-width="2"/>`);
    }
    const lines = item.title.split('\n');
    const fontSize = item.fontStyle.fontSize;
    const lineHeight = fontSize * 1.35;
    const startY = y + h / 2 - ((lines.length - 1) * lineHeight) / 2 + fontSize * 0.35;
    svgParts.push(`<text font-family="Arial,'Microsoft YaHei',sans-serif" font-size="${fontSize}" font-weight="${item.fontStyle.bold ? 700 : 400}" text-anchor="middle" fill="${item.fontStyle.color}">`);
    lines.forEach((lineText, index) => {
      svgParts.push(`<tspan x="${x + w / 2}" y="${startY + index * lineHeight}">${escapeXml(lineText)}</tspan>`);
    });
    svgParts.push('</text>');
  }
}

svgParts.push('</svg>');
fs.writeFileSync(svgPath, svgParts.join('\n'), 'utf8');

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}
