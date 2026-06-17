import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const outputPath =
  '/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全_蓝色费用表格已填写.xlsx';

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));

const table = await workbook.inspect({
  kind: 'table',
  range: '费用预估!Q10:W26',
  include: 'values,formulas',
  tableMaxRows: 20,
  tableMaxCols: 8,
  maxChars: 30000,
});
console.log(table.ndjson);

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'formula error scan',
  maxChars: 12000,
});
console.log(errors.ndjson);

const blob = await workbook.render({ sheetName: '费用预估', range: 'Q10:W26', scale: 2, format: 'png' });
const bytes = new Uint8Array(await blob.arrayBuffer());
await fs.writeFile('/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/蓝色费用表格_Q10_W26.png', bytes);
console.log(`rendered ${bytes.length}`);
