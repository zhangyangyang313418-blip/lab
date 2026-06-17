import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath =
  '/Users/clytia/Desktop/MLA测试项目及费用预估_费用预估页增加费用汇总_D8样品数更新.xlsx';

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
console.log(workbook.help('range.insert', { include: 'index,examples,notes', maxChars: 5000 }).ndjson);
