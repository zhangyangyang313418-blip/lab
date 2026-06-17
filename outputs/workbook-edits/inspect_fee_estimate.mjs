import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath =
  '/Users/clytia/Desktop/MLA测试项目及费用预估_费用预估页增加费用汇总_D8样品数更新.xlsx';

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

for (const range of ['A1:O80', 'A81:O160', 'A161:O255']) {
  const table = await workbook.inspect({
    kind: 'table',
    range: `费用预估!${range}`,
    include: 'values,formulas',
    tableMaxRows: 90,
    tableMaxCols: 15,
    tableMaxCellChars: 180,
    maxChars: 60000,
  });
  console.log(`RANGE ${range}`);
  console.log(table.ndjson);
}

const formulas = await workbook.inspect({
  kind: 'formula',
  sheetId: '费用预估',
  range: 'A1:O255',
  options: { maxResults: 400 },
  maxChars: 60000,
});
console.log('FORMULAS');
console.log(formulas.ndjson);

const styles = await workbook.inspect({
  kind: 'computedStyle',
  sheetId: '费用预估',
  range: 'A1:O40',
  maxChars: 40000,
});
console.log('STYLES A1:O40');
console.log(styles.ndjson);
