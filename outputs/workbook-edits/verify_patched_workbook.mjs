import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const outputPath =
  '/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_特殊项目标识_费用汇总补全.xlsx';

const input = await FileBlob.load(outputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: 'table',
  range: '费用预估!A10:C26',
  include: 'values,formulas',
  tableMaxRows: 20,
  tableMaxCols: 3,
  maxChars: 12000,
});
console.log('TOP SUMMARY');
console.log(summary.ndjson);

const totalMatches = await workbook.inspect({
  kind: 'match',
  searchTerm: 'Total Cost',
  sheetId: '费用预估',
  options: { maxResults: 80 },
  maxChars: 24000,
});
console.log('TOTAL MATCHES');
console.log(totalMatches.ndjson);

const specialRows = await workbook.inspect({
  kind: 'match',
  searchTerm: 'K14 Dust Blowing Test|E-1 Restricted Substance Management|E-2 Operating Noise & Transient Noise',
  sheetId: '费用预估',
  options: { useRegex: true, maxResults: 30 },
  maxChars: 16000,
});
console.log('SPECIAL MATCHES');
console.log(specialRows.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'formula error scan',
  maxChars: 12000,
});
console.log('ERROR SCAN');
console.log(errors.ndjson);

for (const [sheetName, range] of [
  ['费用预估', 'A10:O70'],
  ['费用预估', 'A230:O278'],
  ['特殊项目费用', 'A1:M36'],
]) {
  const blob = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const fileName = `${sheetName}_${range.replace(/[:]/g, '_')}.png`;
  await fs.writeFile(`/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/${fileName}`, bytes);
  console.log(`RENDERED ${fileName} ${bytes.length}`);
}
