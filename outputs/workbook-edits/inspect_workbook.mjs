import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath =
  '/Users/clytia/Desktop/MLA测试项目及费用预估_费用预估页增加费用汇总_D8样品数更新.xlsx';

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheetInfo = await workbook.inspect({
  kind: 'sheet',
  include: 'id,name',
  maxChars: 8000,
});
console.log('SHEETS');
console.log(sheetInfo.ndjson);

const overview = await workbook.inspect({
  kind: 'workbook,sheet,table',
  tableMaxRows: 12,
  tableMaxCols: 12,
  tableMaxCellChars: 120,
  maxChars: 24000,
});
console.log('OVERVIEW');
console.log(overview.ndjson);
