import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const outputPath =
  '/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_全部特殊项目标识_费用汇总补全_蓝色费用表格已填写_实验室页备注修正.xlsx';

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 300 },
  summary: 'formula error scan',
  maxChars: 12000,
});
console.log(errors.ndjson);

for (const [sheetName, range] of [
  ['SGS', 'A35:N60'],
  ['华测', 'A38:N62'],
  ['苏勃', 'A38:N62'],
]) {
  const table = await workbook.inspect({
    kind: 'table',
    range: `${sheetName}!${range}`,
    include: 'values,formulas',
    tableMaxRows: 30,
    tableMaxCols: 14,
    maxChars: 24000,
  });
  console.log(`TABLE ${sheetName}!${range}`);
  console.log(table.ndjson);
  const blob = await workbook.render({ sheetName, range, scale: 1, format: 'png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(
    `/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/${sheetName}_备注修正预览.png`,
    bytes,
  );
  console.log(`rendered ${sheetName} ${bytes.length}`);
}
