import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const workbookPath = resolve(
  process.argv[2] ?? "outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx",
);

const legend = [
  { label: "苏勃", color: "4C9FD8" },
  { label: "预估费用", color: "F47C22" },
  { label: "SGS", color: "A6A6A6" },
  { label: "华测", color: "FFC000" },
];

const items = [
  { phase: "DV", label: "苏勃", formula: "J3/10000", value: "61.0535", color: "4C9FD8" },
  { phase: "DV", label: "预估费用", formula: "G3/10000", value: "63.5228", color: "F47C22" },
  { phase: "DV", label: "SGS", formula: "H3/10000", value: "67.6454", color: "A6A6A6" },
  { phase: "DV", label: "华测", formula: "I3/10000", value: "90.0342", color: "FFC000" },
  { spacer: true, label: " ", value: "0" },
  { phase: "PV", label: "预估费用", formula: "G4/10000", value: "67.2028", color: "F47C22" },
  { phase: "PV", label: "苏勃", formula: "J4/10000", value: "68.6135", color: "4C9FD8" },
  { phase: "PV", label: "SGS", formula: "H4/10000", value: "72.4054", color: "A6A6A6" },
  { phase: "PV", label: "华测", formula: "I4/10000", value: "95.1642", color: "FFC000" },
  { spacer: true, label: " ", value: "0" },
  { phase: "DV+PV", label: "苏勃", formula: "J5/10000", value: "129.667", color: "4C9FD8" },
  { phase: "DV+PV", label: "预估费用", formula: "G5/10000", value: "130.7256", color: "F47C22" },
  { phase: "DV+PV", label: "SGS", formula: "H5/10000", value: "140.0508", color: "A6A6A6" },
  { phase: "DV+PV", label: "华测", formula: "I5/10000", value: "185.1984", color: "FFC000" },
];

const lastRow = items.length + 1;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "&#10;");
}

function inlineCell(cellRef, value) {
  return `<c r="${cellRef}" s="6" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
}

function blankCell(cellRef) {
  return `<c r="${cellRef}" s="6"/>`;
}

function formulaCell(cellRef, formula, value) {
  return `<c r="${cellRef}" s="6"><f>${formula}</f><v>${value}</v></c>`;
}

function numberCell(cellRef, value) {
  return `<c r="${cellRef}" s="6"><v>${value}</v></c>`;
}

function replaceRowCells(xml, rowNumber, cells) {
  const rowStart = xml.indexOf(`<row r="${rowNumber}"`);
  if (rowStart < 0) throw new Error(`Missing row ${rowNumber}`);
  const rowEnd = xml.indexOf("</row>", rowStart);
  if (rowEnd < 0) throw new Error(`Missing row end ${rowNumber}`);

  const rowXml = xml.slice(rowStart, rowEnd + "</row>".length);
  const withoutChartCells = rowXml.replace(/<c r="[S-X]\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g, "");
  const nextRowXml = withoutChartCells.replace("</row>", `${cells.join("")}</row>`);
  return `${xml.slice(0, rowStart)}${nextRowXml}${xml.slice(rowEnd + "</row>".length)}`;
}

function updateSheetXml(sheetXml) {
  let xml = sheetXml.replace(/<dimension ref="A1:[A-Z]+(\d+)"\/>/, '<dimension ref="A1:X$1"/>');
  xml = replaceRowCells(xml, 1, [
    inlineCell("S1", "图表阶段"),
    inlineCell("T1", "图表柱项"),
    inlineCell("U1", "苏勃"),
    blankCell("V1"),
    blankCell("W1"),
    blankCell("X1"),
  ]);

  items.forEach((item, index) => {
    const rowNumber = index + 2;
    const cells = item.spacer
      ? [
          inlineCell(`S${rowNumber}`, " "),
          inlineCell(`T${rowNumber}`, " "),
          numberCell(`U${rowNumber}`, "0"),
          blankCell(`V${rowNumber}`),
          blankCell(`W${rowNumber}`),
          blankCell(`X${rowNumber}`),
        ]
      : [
          inlineCell(`S${rowNumber}`, item.phase),
          inlineCell(`T${rowNumber}`, `${item.label}\n${item.phase}`),
          formulaCell(`U${rowNumber}`, item.formula, item.value),
          blankCell(`V${rowNumber}`),
          blankCell(`W${rowNumber}`),
          blankCell(`X${rowNumber}`),
        ];
    xml = replaceRowCells(xml, rowNumber, cells);
  });

  for (let rowNumber = lastRow + 1; rowNumber <= lastRow + 3; rowNumber += 1) {
    xml = replaceRowCells(xml, rowNumber, ["S", "T", "U", "V", "W", "X"].map((column) => blankCell(`${column}${rowNumber}`)));
  }
  return xml;
}

function categoryCache() {
  return `<c:strCache><c:ptCount val="${items.length}"/>${items
    .map((item, index) => `<c:pt idx="${index}"><c:v>${item.spacer ? " " : escapeXml(`${item.label}\n${item.phase}`)}</c:v></c:pt>`)
    .join("")}</c:strCache>`;
}

function valueCache() {
  return `<c:numCache><c:formatCode>0.0&quot;万&quot;</c:formatCode><c:ptCount val="${items.length}"/>${items
    .map((item, index) => `<c:pt idx="${index}"><c:v>${item.spacer ? "0" : item.value}</c:v></c:pt>`)
    .join("")}</c:numCache>`;
}

function dataPointColors() {
  return items
    .map((item, index) =>
      item.spacer
        ? `<c:dPt><c:idx val="${index}"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr></c:dPt>`
        : `<c:dPt><c:idx val="${index}"/><c:spPr><a:solidFill><a:srgbClr val="${item.color}"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr></c:dPt>`,
    )
    .join("");
}

function hiddenSpacerLabels() {
  return items
    .map((item, index) =>
      item.spacer
        ? `<c:dLbl><c:idx val="${index}"/><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="zh-CN" sz="900"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:defRPr></a:pPr></a:p></c:txPr><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/></c:dLbl>`
        : "",
    )
    .join("");
}

function dummyLegendSeriesXml(entry, index) {
  return `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${escapeXml(entry.label)}</c:v></c:tx><c:spPr><a:solidFill><a:srgbClr val="${entry.color}"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr><c:cat><c:strRef><c:f>费用对比!$T$2:$T$${lastRow}</c:f>${categoryCache()}</c:strRef></c:cat><c:val><c:numRef><c:f>费用对比!$V$2:$V$${lastRow}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${items.length}"/></c:numCache></c:numRef></c:val><c:invertIfNegative val="0"/></c:ser>`;
}

function chartXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:date1904 val="0"/><c:lang val="zh-CN"/><c:roundedCorners val="0"/>
<c:chart>
<c:title><c:tx><c:rich><a:bodyPr rot="0" spcFirstLastPara="0" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="zh-CN" sz="1100" b="1" kern="1200"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:defRPr></a:pPr><a:r><a:rPr lang="zh-CN" sz="1100" b="1"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:rPr><a:t>整包报价 vs 预估费用 | 按预估费用居中排序</a:t></a:r></a:p></c:rich></c:tx><c:layout/><c:overlay val="0"/></c:title>
<c:autoTitleDeleted val="0"/>
<c:plotArea><c:layout/>
<c:barChart><c:barDir val="col"/><c:grouping val="stacked"/><c:varyColors val="0"/>
<c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:strRef><c:f>费用对比!$U$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>苏勃</c:v></c:pt></c:strCache></c:strRef></c:tx>
${dataPointColors()}
<c:invertIfNegative val="0"/>
<c:dLbls>${hiddenSpacerLabels()}<c:numFmt formatCode="0.0&quot;万&quot;" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr><c:txPr><a:bodyPr rot="0" spcFirstLastPara="0" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="zh-CN" sz="900" kern="1200"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:defRPr></a:pPr></a:p></c:txPr><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>
<c:cat><c:strRef><c:f>费用对比!$T$2:$T$${lastRow}</c:f>${categoryCache()}</c:strRef></c:cat>
<c:val><c:numRef><c:f>费用对比!$U$2:$U$${lastRow}</c:f>${valueCache()}</c:numRef></c:val>
</c:ser>
${legend.slice(1).map((item, index) => dummyLegendSeriesXml(item, index + 1)).join("")}
<c:gapWidth val="55"/><c:overlap val="100"/><c:axId val="48650112"/><c:axId val="48672768"/>
</c:barChart>
<c:catAx><c:axId val="48650112"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:noFill/><a:ln w="6350"><a:solidFill><a:srgbClr val="8B95A5"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr><c:txPr><a:bodyPr rot="0" spcFirstLastPara="0" vertOverflow="clip" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="zh-CN" sz="700" kern="1200"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:defRPr></a:pPr></a:p></c:txPr><c:crossAx val="48672768"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>
<c:valAx><c:axId val="48672768"/><c:scaling><c:orientation val="minMax"/><c:max val="200"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="D8DEE8"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr></c:majorGridlines><c:numFmt formatCode="0&quot;万&quot;" sourceLinked="0"/><c:majorTickMark val="out"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:spPr><a:noFill/><a:ln w="6350"><a:solidFill><a:srgbClr val="8B95A5"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr><c:txPr><a:bodyPr rot="0" spcFirstLastPara="0" vertOverflow="ellipsis" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="zh-CN" sz="900" kern="1200"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:defRPr></a:pPr></a:p></c:txPr><c:crossAx val="48650112"/><c:crosses val="autoZero"/><c:crossBetween val="between"/><c:majorUnit val="50"/></c:valAx>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></c:spPr>
</c:plotArea>
<c:legend><c:legendPos val="t"/><c:layout/><c:overlay val="0"/></c:legend>
<c:plotVisOnly val="0"/><c:dispBlanksAs val="gap"/><c:showDLblsOverMax val="0"/>
</c:chart>
<c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="9EADBA"/></a:solidFill><a:prstDash val="solid"/><a:round/></a:ln><a:effectLst/></c:spPr>
<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr lang="zh-CN"/></a:pPr></a:p></c:txPr>
<c:printSettings><c:headerFooter/><c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/><c:pageSetup/></c:printSettings>
</c:chartSpace>`;
}

function anchor(fromCol, fromRow, toCol, toRow, body) {
  return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>${body}<xdr:clientData/></xdr:twoCellAnchor>`;
}

function textShape(id, text, fontSize = 900, bold = false) {
  return `<xdr:sp><xdr:nvSpPr><xdr:cNvPr id="${id}" name="chart text ${id}"/><xdr:cNvSpPr txBox="1"/></xdr:nvSpPr><xdr:spPr><a:noFill/><a:ln><a:noFill/></a:ln><a:effectLst/></xdr:spPr><xdr:txBody><a:bodyPr rot="0" spcFirstLastPara="0" vertOverflow="clip" vert="horz" wrap="square" anchor="ctr" anchorCtr="1"/><a:lstStyle/><a:p><a:pPr algn="ctr"><a:defRPr lang="zh-CN" sz="${fontSize}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:defRPr></a:pPr><a:r><a:rPr lang="zh-CN" sz="${fontSize}" b="${bold ? 1 : 0}"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="微软雅黑"/><a:ea typeface="微软雅黑"/></a:rPr><a:t>${escapeXml(text)}</a:t></a:r></a:p></xdr:txBody></xdr:sp>`;
}

function swatchShape(id, color) {
  return `<xdr:sp><xdr:nvSpPr><xdr:cNvPr id="${id}" name="chart swatch ${id}"/><xdr:cNvSpPr/></xdr:nvSpPr><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill><a:ln><a:noFill/></a:ln><a:effectLst/></xdr:spPr><xdr:txBody><a:bodyPr/><a:lstStyle/><a:p/></xdr:txBody></xdr:sp>`;
}

function drawingXml() {
  const legendShapes = "";
  const groupLabels = "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>10</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>18</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>8</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame>
<xdr:nvGraphicFramePr><xdr:cNvPr id="2" name="整包报价 vs 预估费用"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
<xdr:xfrm><a:off x="9743440" y="0"/><a:ext cx="9834880" cy="2514600"/></xdr:xfrm>
<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId1"/></a:graphicData></a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>
${legendShapes}
${groupLabels}
</xdr:wsDr>`;
}

function drawingRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/></Relationships>`;
}

const tempDir = mkdtempSync(join(tmpdir(), "mla-chart-"));
try {
  if (!existsSync(workbookPath)) throw new Error(`Workbook does not exist: ${workbookPath}`);
  copyFileSync(workbookPath, join(tempDir, "workbook.xlsx"));
  execFileSync("unzip", ["-qq", "workbook.xlsx", "-d", "xlsx"], { cwd: tempDir });

  const sheetPath = join(tempDir, "xlsx/xl/worksheets/sheet5.xml");
  const chartPath = join(tempDir, "xlsx/xl/charts/chart1.xml");
  const drawingPath = join(tempDir, "xlsx/xl/drawings/drawing1.xml");
  const drawingRelsPath = join(tempDir, "xlsx/xl/drawings/_rels/drawing1.xml.rels");
  const mediaPath = join(tempDir, "xlsx/xl/media/fee_comparison_chart_preview.png");
  writeFileSync(sheetPath, updateSheetXml(readFileSync(sheetPath, "utf8")));
  writeFileSync(chartPath, chartXml());
  writeFileSync(drawingPath, drawingXml());
  writeFileSync(drawingRelsPath, drawingRelsXml());
  if (existsSync(mediaPath)) rmSync(mediaPath);

  rmSync(join(tempDir, "workbook.xlsx"));
  execFileSync("zip", ["-qr", "../workbook.xlsx", "."], { cwd: join(tempDir, "xlsx") });
  copyFileSync(join(tempDir, "workbook.xlsx"), workbookPath);
  console.log(workbookPath);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
