import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";

const defaultWorkbookPath = "outputs/workbook-edits/final/MLA测试项目及费用预估_费用预估模板已同步后续页面_格式锁定.xlsx";
const workbookPath = resolve(process.argv[2] ?? defaultWorkbookPath);

function readXml(root, entry) {
  return readFileSync(join(root, entry), "utf8");
}

function writeXml(root, entry, content) {
  const path = join(root, entry);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

function replaceOnce(content, search, replacement, label) {
  if (!content.includes(search)) {
    throw new Error(`Missing ${label}`);
  }
  return content.replace(search, replacement);
}

function escapeXml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setInlineCell(xml, rowNumber, cellRef, styleId, value) {
  const cellXml = `<c r="${cellRef}" s="${styleId}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
  const cellBoundary = `(?=["\\s/>])`;
  const targetColumn = cellRef.replace(/\d+$/, "");
  const rowStart = xml.indexOf(`<row r="${rowNumber}"`);
  if (rowStart < 0) {
    throw new Error(`Missing row ${rowNumber}`);
  }
  const rowEnd = xml.indexOf("</row>", rowStart);
  if (rowEnd < 0) {
    throw new Error(`Missing row end ${rowNumber}`);
  }

  const rowXml = xml.slice(rowStart, rowEnd + "</row>".length);
  const nextRowXml = (() => {
    const pairedPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*>[\\s\\S]*?</c>`);
    const selfClosingPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*/>`);
    if (pairedPattern.test(rowXml)) {
      return rowXml.replace(pairedPattern, cellXml);
    }
    if (selfClosingPattern.test(rowXml)) {
      return rowXml.replace(selfClosingPattern, cellXml);
    }

    const cellPattern = /<c r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g;
    const cells = [...rowXml.matchAll(cellPattern)];
    const nextCell = cells.find((match) => match[1].localeCompare(targetColumn, "en", { numeric: true }) > 0);
    if (nextCell?.index !== undefined) {
      return `${rowXml.slice(0, nextCell.index)}${cellXml}${rowXml.slice(nextCell.index)}`;
    }
    return rowXml.replace("</row>", `${cellXml}</row>`);
  })();

  return `${xml.slice(0, rowStart)}${nextRowXml}${xml.slice(rowEnd + "</row>".length)}`;
}

function setNumberCell(xml, rowNumber, cellRef, styleId, value) {
  const cellXml = `<c r="${cellRef}" s="${styleId}"><v>${value}</v></c>`;
  const cellBoundary = `(?=["\\s/>])`;
  const targetColumn = cellRef.replace(/\d+$/, "");
  const rowStart = xml.indexOf(`<row r="${rowNumber}"`);
  if (rowStart < 0) {
    throw new Error(`Missing row ${rowNumber}`);
  }
  const rowEnd = xml.indexOf("</row>", rowStart);
  if (rowEnd < 0) {
    throw new Error(`Missing row end ${rowNumber}`);
  }

  const rowXml = xml.slice(rowStart, rowEnd + "</row>".length);
  const nextRowXml = (() => {
    const pairedPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*>[\\s\\S]*?</c>`);
    const selfClosingPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*/>`);
    if (pairedPattern.test(rowXml)) {
      return rowXml.replace(pairedPattern, cellXml);
    }
    if (selfClosingPattern.test(rowXml)) {
      return rowXml.replace(selfClosingPattern, cellXml);
    }

    const cellPattern = /<c r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g;
    const cells = [...rowXml.matchAll(cellPattern)];
    const nextCell = cells.find((match) => match[1].localeCompare(targetColumn, "en", { numeric: true }) > 0);
    if (nextCell?.index !== undefined) {
      return `${rowXml.slice(0, nextCell.index)}${cellXml}${rowXml.slice(nextCell.index)}`;
    }
    return rowXml.replace("</row>", `${cellXml}</row>`);
  })();

  return `${xml.slice(0, rowStart)}${nextRowXml}${xml.slice(rowEnd + "</row>".length)}`;
}

function setFormulaCell(xml, rowNumber, cellRef, styleId, formula, cachedValue) {
  const cellXml = `<c r="${cellRef}" s="${styleId}"><f>${escapeXml(formula)}</f><v>${cachedValue}</v></c>`;
  const cellBoundary = `(?=["\\s/>])`;
  const targetColumn = cellRef.replace(/\d+$/, "");
  const rowStart = xml.indexOf(`<row r="${rowNumber}"`);
  if (rowStart < 0) {
    throw new Error(`Missing row ${rowNumber}`);
  }
  const rowEnd = xml.indexOf("</row>", rowStart);
  if (rowEnd < 0) {
    throw new Error(`Missing row end ${rowNumber}`);
  }

  const rowXml = xml.slice(rowStart, rowEnd + "</row>".length);
  const nextRowXml = (() => {
    const pairedPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*>[\\s\\S]*?</c>`);
    const selfClosingPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*/>`);
    if (pairedPattern.test(rowXml)) {
      return rowXml.replace(pairedPattern, cellXml);
    }
    if (selfClosingPattern.test(rowXml)) {
      return rowXml.replace(selfClosingPattern, cellXml);
    }

    const cellPattern = /<c r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g;
    const cells = [...rowXml.matchAll(cellPattern)];
    const nextCell = cells.find((match) => match[1].localeCompare(targetColumn, "en", { numeric: true }) > 0);
    if (nextCell?.index !== undefined) {
      return `${rowXml.slice(0, nextCell.index)}${cellXml}${rowXml.slice(nextCell.index)}`;
    }
    return rowXml.replace("</row>", `${cellXml}</row>`);
  })();

  return `${xml.slice(0, rowStart)}${nextRowXml}${xml.slice(rowEnd + "</row>".length)}`;
}

function setBlankCell(xml, rowNumber, cellRef, styleId) {
  const cellXml = `<c r="${cellRef}" s="${styleId}"/>`;
  const cellBoundary = `(?=["\\s/>])`;
  const targetColumn = cellRef.replace(/\d+$/, "");
  const rowStart = xml.indexOf(`<row r="${rowNumber}"`);
  if (rowStart < 0) {
    throw new Error(`Missing row ${rowNumber}`);
  }
  const rowEnd = xml.indexOf("</row>", rowStart);
  if (rowEnd < 0) {
    throw new Error(`Missing row end ${rowNumber}`);
  }

  const rowXml = xml.slice(rowStart, rowEnd + "</row>".length);
  const nextRowXml = (() => {
    const pairedPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*>[\\s\\S]*?</c>`);
    const selfClosingPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*/>`);
    if (pairedPattern.test(rowXml)) {
      return rowXml.replace(pairedPattern, cellXml);
    }
    if (selfClosingPattern.test(rowXml)) {
      return rowXml.replace(selfClosingPattern, cellXml);
    }

    const cellPattern = /<c r="([A-Z]+)\d+"[^>]*(?:\/>|>[\s\S]*?<\/c>)/g;
    const cells = [...rowXml.matchAll(cellPattern)];
    const nextCell = cells.find((match) => match[1].localeCompare(targetColumn, "en", { numeric: true }) > 0);
    if (nextCell?.index !== undefined) {
      return `${rowXml.slice(0, nextCell.index)}${cellXml}${rowXml.slice(nextCell.index)}`;
    }
    return rowXml.replace("</row>", `${cellXml}</row>`);
  })();

  return `${xml.slice(0, rowStart)}${nextRowXml}${xml.slice(rowEnd + "</row>".length)}`;
}

function clearCell(xml, cellRef, styleId) {
  const cellBoundary = `(?=["\\s/>])`;
  const pattern = new RegExp(`<c r="${cellRef}${cellBoundary}"(?![^>]*\\/>)[^>]*>[\\s\\S]*?</c>`);
  const selfClosingPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*/>`);
  const replacement = `<c r="${cellRef}" s="${styleId}"/>`;
  if (pattern.test(xml)) {
    return xml.replace(pattern, replacement);
  }
  if (selfClosingPattern.test(xml)) {
    return xml.replace(selfClosingPattern, replacement);
  }
  // Blank cells may be omitted entirely after a previous patch run.
  return xml;
}

function deleteCell(xml, cellRef) {
  const cellBoundary = `(?=["\\s/>])`;
  const selfClosingPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"[^>]*/>`);
  const pairedPattern = new RegExp(`<c r="${cellRef}${cellBoundary}"(?![^>]*\\/>)[^>]*>[\\s\\S]*?</c>`);
  return xml.replace(selfClosingPattern, "").replace(pairedPattern, "");
}

function upsertContentType(contentTypesXml, partName, contentType) {
  if (contentTypesXml.includes(`PartName="${partName}"`)) {
    return contentTypesXml;
  }
  return contentTypesXml.replace("</Types>", `<Override PartName="${partName}" ContentType="${contentType}"/>\n</Types>`);
}

function upsertDefaultContentType(contentTypesXml, extension, contentType) {
  if (contentTypesXml.includes(`Extension="${extension}"`)) {
    return contentTypesXml;
  }
  return contentTypesXml.replace(/(<Types\b[^>]*>)/, `$1\n<Default Extension="${extension}" ContentType="${contentType}"/>`);
}

function removeContentTypeOverride(contentTypesXml, partName) {
  const pattern = new RegExp(`<Override PartName="${partName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}" ContentType="[^"]+"\\/>\\s*`);
  return contentTypesXml.replace(pattern, "");
}

const chartItems = [
  { phase: "DV", label: "苏勃", kind: "低于预估", color: "E15759", value: 61.0535, formula: "J3/10000" },
  { phase: "DV", label: "预估费用", kind: "预估费用", color: "073E63", value: 63.5228, formula: "G3/10000" },
  { phase: "DV", label: "SGS", kind: "高于预估", color: "F28E2B", value: 67.6454, formula: "H3/10000" },
  { phase: "DV", label: "华测", kind: "高于预估", color: "59A14F", value: 90.0342, formula: "I3/10000" },
  { phase: "", label: "", kind: "组间留白", color: "", value: undefined, formula: undefined, spacer: true },
  { phase: "PV", label: "预估费用", kind: "预估费用", color: "073E63", value: 67.2028, formula: "G4/10000" },
  { phase: "PV", label: "苏勃", kind: "高于预估", color: "E15759", value: 68.6135, formula: "J4/10000" },
  { phase: "PV", label: "SGS", kind: "高于预估", color: "F28E2B", value: 72.4054, formula: "H4/10000" },
  { phase: "PV", label: "华测", kind: "高于预估", color: "59A14F", value: 95.1642, formula: "I4/10000" },
  { phase: "", label: "", kind: "组间留白", color: "", value: undefined, formula: undefined, spacer: true },
  { phase: "DV+PV", label: "苏勃", kind: "低于预估", color: "E15759", value: 129.667, formula: "J5/10000" },
  { phase: "DV+PV", label: "预估费用", kind: "预估费用", color: "073E63", value: 130.7256, formula: "G5/10000" },
  { phase: "DV+PV", label: "SGS", kind: "高于预估", color: "F28E2B", value: 140.0508, formula: "H5/10000" },
  { phase: "DV+PV", label: "华测", kind: "高于预估", color: "59A14F", value: 185.1984, formula: "I5/10000" },
];

const chartSeries = [
  { label: "苏勃", color: "E15759", column: "U" },
  { label: "预估费用", color: "073E63", column: "V" },
  { label: "SGS", color: "F28E2B", column: "W" },
  { label: "华测", color: "59A14F", column: "X" },
];

const chartLastRow = chartItems.length + 1;
const chartPointCount = chartItems.length;

function chartCategoryLevel(items, field) {
  return `<c:lvl>${items.map((item, index) => `<c:pt idx="${index}"><c:v>${item[field]}</c:v></c:pt>`).join("")}</c:lvl>`;
}

function chartSeriesPointCache(series) {
  return chartItems
    .map((item, index) => (item.label === series.label && item.value !== undefined ? `<c:pt idx="${index}"><c:v>${item.value}</c:v></c:pt>` : ""))
    .join("");
}

function chartSeriesXml(series, index) {
  return `<c:ser>
<c:idx val="${index}"/>
<c:order val="${index}"/>
<c:tx>
<c:strRef>
<c:f>'费用对比'!$${series.column}$1</c:f>
<c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${series.label}</c:v></c:pt></c:strCache>
</c:strRef>
</c:tx>
<c:spPr>
<a:solidFill><a:srgbClr val="${series.color}"/></a:solidFill>
<a:ln><a:solidFill><a:srgbClr val="${series.color}"/></a:solidFill></a:ln>
</c:spPr>
<c:cat>
<c:multiLvlStrRef>
<c:f>'费用对比'!$S$2:$T$${chartLastRow}</c:f>
<c:multiLvlStrCache>
<c:ptCount val="${chartPointCount}"/>
${chartCategoryLevel(chartItems, "label")}
${chartCategoryLevel(chartItems, "phase")}
</c:multiLvlStrCache>
</c:multiLvlStrRef>
</c:cat>
<c:val>
<c:numRef>
<c:f>'费用对比'!$${series.column}$2:$${series.column}$${chartLastRow}</c:f>
<c:numCache>
<c:formatCode>0.0万</c:formatCode>
<c:ptCount val="${chartPointCount}"/>
${chartSeriesPointCache(series)}
</c:numCache>
</c:numRef>
</c:val>
<c:invertIfNegative val="0"/>
</c:ser>`;
}

const chartXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<c:date1904 val="0"/>
<c:lang val="zh-CN"/>
<c:roundedCorners val="0"/>
<c:chart>
<c:title>
<c:tx>
<c:rich>
<a:bodyPr/>
<a:lstStyle/>
<a:p>
<a:pPr><a:defRPr sz="1100" b="1"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:defRPr></a:pPr>
<a:r><a:rPr lang="zh-CN" sz="1100" b="1"><a:solidFill><a:srgbClr val="111827"/></a:solidFill><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/></a:rPr><a:t>整包报价 vs 预估费用 | 按预估费用居中排序</a:t></a:r>
</a:p>
</c:rich>
</c:tx>
<c:layout/>
<c:overlay val="0"/>
</c:title>
<c:autoTitleDeleted val="0"/>
<c:plotArea>
<c:layout/>
<c:barChart>
<c:barDir val="col"/>
<c:grouping val="stacked"/>
<c:varyColors val="0"/>
${chartSeries.map(chartSeriesXml).join("")}
<c:dLbls>
<c:numFmt formatCode="0.0万" sourceLinked="0"/>
<c:showLegendKey val="0"/>
<c:showVal val="1"/>
<c:showCatName val="0"/>
<c:showSerName val="0"/>
<c:showPercent val="0"/>
<c:showBubbleSize val="0"/>
<c:dLblPos val="outEnd"/>
</c:dLbls>
<c:gapWidth val="80"/>
<c:overlap val="100"/>
<c:axId val="48650112"/>
<c:axId val="48672768"/>
</c:barChart>
<c:catAx>
<c:axId val="48650112"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="b"/>
<c:majorTickMark val="none"/>
<c:minorTickMark val="none"/>
<c:tickLblPos val="nextTo"/>
<c:crossAx val="48672768"/>
<c:crosses val="autoZero"/>
<c:auto val="1"/>
<c:lblAlgn val="ctr"/>
<c:lblOffset val="100"/>
<c:noMultiLvlLbl val="0"/>
</c:catAx>
<c:valAx>
<c:axId val="48672768"/>
<c:scaling><c:orientation val="minMax"/></c:scaling>
<c:delete val="0"/>
<c:axPos val="l"/>
<c:majorGridlines/>
<c:numFmt formatCode="0万" sourceLinked="0"/>
<c:majorUnit val="25"/>
<c:max val="200"/>
<c:min val="0"/>
<c:majorTickMark val="out"/>
<c:minorTickMark val="none"/>
<c:tickLblPos val="nextTo"/>
<c:crossAx val="48650112"/>
<c:crosses val="autoZero"/>
<c:crossBetween val="between"/>
</c:valAx>
<c:spPr>
<a:solidFill><a:srgbClr val="F6F7FB"/></a:solidFill>
<a:ln><a:noFill/></a:ln>
</c:spPr>
</c:plotArea>
<c:legend>
<c:legendPos val="t"/>
<c:layout/>
<c:overlay val="0"/>
</c:legend>
<c:plotVisOnly val="0"/>
<c:dispBlanksAs val="gap"/>
<c:showDLblsOverMax val="0"/>
</c:chart>
<c:spPr>
<a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
<a:ln w="9525"><a:solidFill><a:srgbClr val="9EADBA"/></a:solidFill></a:ln>
</c:spPr>
<c:printSettings>
<c:headerFooter/>
<c:pageMargins b="0.75" l="0.7" r="0.7" t="0.75" header="0.3" footer="0.3"/>
<c:pageSetup/>
</c:printSettings>
</c:chartSpace>`;

const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<xdr:twoCellAnchor editAs="oneCell">
<xdr:from><xdr:col>11</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>18</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>8</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
<xdr:graphicFrame macro="">
<xdr:nvGraphicFramePr>
<xdr:cNvPr id="2" name="整包报价 vs 预估费用"/>
<xdr:cNvGraphicFramePr/>
</xdr:nvGraphicFramePr>
<xdr:xfrm>
<a:off x="0" y="0"/>
<a:ext cx="0" cy="0"/>
</xdr:xfrm>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
<c:chart r:id="rId1"/>
</a:graphicData>
</a:graphic>
</xdr:graphicFrame>
<xdr:clientData/>
</xdr:twoCellAnchor>
</xdr:wsDr>`;

const drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
</Relationships>`;

if (!existsSync(workbookPath)) {
  throw new Error(`Workbook does not exist: ${workbookPath}`);
}

const tempDir = mkdtempSync(join(tmpdir(), "mla-fee-chart-"));
const unpackedDir = join(tempDir, "xlsx");
const patchedPath = join(tempDir, basename(workbookPath));

try {
  execFileSync("unzip", ["-q", workbookPath, "-d", unpackedDir]);

  let sharedStringsXml = readXml(unpackedDir, "xl/sharedStrings.xml");
  if (sharedStringsXml.includes("<t>预估费用剔除项</t>")) {
    sharedStringsXml = sharedStringsXml.replace("<t>预估费用剔除项</t>", "<t>整包报价 vs 预估费用 | 按预估费用居中排序</t>");
  } else if (sharedStringsXml.includes("<t>实验室报价对比</t>")) {
    sharedStringsXml = sharedStringsXml.replace("<t>实验室报价对比</t>", "<t>整包报价 vs 预估费用 | 按预估费用居中排序</t>");
  } else if (sharedStringsXml.includes("<t>预估与实验室报价对比</t>")) {
    sharedStringsXml = sharedStringsXml.replace("<t>预估与实验室报价对比</t>", "<t>整包报价 vs 预估费用 | 按预估费用居中排序</t>");
  } else if (!sharedStringsXml.includes("<t>整包报价 vs 预估费用 | 按预估费用居中排序</t>")) {
    throw new Error("Missing chart title shared string");
  }
  writeXml(unpackedDir, "xl/sharedStrings.xml", sharedStringsXml);

  let sheetXml = readXml(unpackedDir, "xl/worksheets/sheet5.xml");
  sheetXml = sheetXml.replace(/ref="A1:[A-Z]+37"/, 'ref="A1:X37"');
  const hiddenHelperColumns = '<col min="19" max="24" width="12" style="1" hidden="1" customWidth="1"/>';
  if (/<col min="19" max="2[1-4]" width="12" style="1" hidden="1" customWidth="1"\/>/.test(sheetXml)) {
    sheetXml = sheetXml.replace(/<col min="19" max="2[1-4]" width="12" style="1" hidden="1" customWidth="1"\/>/, hiddenHelperColumns);
  } else if (!sheetXml.includes('<col min="19" max="24"')) {
    sheetXml = sheetXml.replace("</cols>", `${hiddenHelperColumns}\n</cols>`);
  }
  for (const cellRef of ["L2", "M2", "N2", "O2"]) {
    sheetXml = clearCell(sheetXml, cellRef, 6);
  }
  for (const cellRef of ["K2", "K3", "K4", "K5"]) {
    sheetXml = clearCell(sheetXml, cellRef, 6);
  }
  sheetXml = setInlineCell(sheetXml, 2, "P2", 17, "检查项");
  sheetXml = setInlineCell(sheetXml, 2, "Q2", 17, "结果");
  sheetXml = setInlineCell(sheetXml, 3, "P3", 24, "三家实验室项目清单");
  sheetXml = setInlineCell(sheetXml, 3, "Q3", 25, "一致");
  sheetXml = setInlineCell(sheetXml, 4, "P4", 24, "预估费用口径");
  sheetXml = setInlineCell(sheetXml, 4, "Q4", 25, "已剔除");
  sheetXml = setInlineCell(sheetXml, 5, "P5", 24, "图表口径");
  sheetXml = setInlineCell(sheetXml, 5, "Q5", 25, "按预估居中排序");
  sheetXml = setInlineCell(sheetXml, 5, "R5", 24, "每组中预估费用固定在中间；低于预估的报价放左侧，高于预估的报价按金额从低到高放右侧");
  for (const cellRef of ["L3", "M3", "N3", "O3", "L4", "M4", "N4", "O4", "L5", "M5", "N5", "O5"]) {
    sheetXml = clearCell(sheetXml, cellRef, 6);
  }
  sheetXml = setInlineCell(sheetXml, 1, "S1", 6, "图表阶段");
  sheetXml = setInlineCell(sheetXml, 1, "T1", 6, "图表柱项");
  chartSeries.forEach((series) => {
    sheetXml = setInlineCell(sheetXml, 1, `${series.column}1`, 6, series.label);
  });
  chartItems.forEach((item, index) => {
    const rowNumber = index + 2;
    if (item.spacer) {
      sheetXml = setBlankCell(sheetXml, rowNumber, `S${rowNumber}`, 6);
      sheetXml = setBlankCell(sheetXml, rowNumber, `T${rowNumber}`, 6);
    } else {
      sheetXml = setInlineCell(sheetXml, rowNumber, `S${rowNumber}`, 6, item.phase);
      sheetXml = setInlineCell(sheetXml, rowNumber, `T${rowNumber}`, 6, item.label);
    }
    chartSeries.forEach((series) => {
      const cellRef = `${series.column}${rowNumber}`;
      if (series.label === item.label) {
        sheetXml = setFormulaCell(sheetXml, rowNumber, cellRef, 6, item.formula, item.value);
      } else {
        sheetXml = setBlankCell(sheetXml, rowNumber, cellRef, 6);
      }
    });
  });
  for (let rowNumber = chartLastRow + 1; rowNumber <= chartLastRow + 2; rowNumber += 1) {
    for (const column of ["S", "T", "U", "V", "W", "X"]) {
      sheetXml = setBlankCell(sheetXml, rowNumber, `${column}${rowNumber}`, 6);
    }
  }
  if (!sheetXml.includes("<drawing r:id=\"rId3\"/>")) {
    sheetXml = sheetXml.replace(/<headerFooter\s*\/>/, (match) => `${match}\n<drawing r:id="rId3"/>`);
    if (!sheetXml.includes("<drawing r:id=\"rId3\"/>")) {
      throw new Error("Missing sheet headerFooter anchor");
    }
  }
  sheetXml = sheetXml.replace('<mergeCell ref="F7:O7"/>', '<mergeCell ref="F7:K7"/>');
  writeXml(unpackedDir, "xl/worksheets/sheet5.xml", sheetXml);

  let sheetRelsXml = readXml(unpackedDir, "xl/worksheets/_rels/sheet5.xml.rels");
  if (!sheetRelsXml.includes("Target=\"../drawings/drawing1.xml\"")) {
    sheetRelsXml = sheetRelsXml.replace("</Relationships>", "<Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing\" Target=\"../drawings/drawing1.xml\"/>\n</Relationships>");
  }
  writeXml(unpackedDir, "xl/worksheets/_rels/sheet5.xml.rels", sheetRelsXml);

  writeXml(unpackedDir, "xl/drawings/drawing1.xml", drawingXml);
  writeXml(unpackedDir, "xl/drawings/_rels/drawing1.xml.rels", drawingRelsXml);
  writeXml(unpackedDir, "xl/charts/chart1.xml", chartXml);
  rmSync(join(unpackedDir, "xl/media/fee-comparison-chart.png"), { force: true });

  let contentTypesXml = readXml(unpackedDir, "[Content_Types].xml");
  contentTypesXml = upsertContentType(contentTypesXml, "/xl/drawings/drawing1.xml", "application/vnd.openxmlformats-officedocument.drawing+xml");
  contentTypesXml = upsertContentType(contentTypesXml, "/xl/charts/chart1.xml", "application/vnd.openxmlformats-officedocument.drawingml.chart+xml");
  writeXml(unpackedDir, "[Content_Types].xml", contentTypesXml);

  execFileSync("zip", ["-qr", patchedPath, "."], { cwd: unpackedDir });
  copyFileSync(patchedPath, workbookPath);
  console.log(workbookPath);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
