import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const outputPath =
  '/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/MLA测试项目及费用预估_费用预估模板已同步后续页面_格式锁定.xlsx';

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));

for (const sheetNumber of [1, 2, 3, 4, 5, 6, 7]) {
  const xml = execFileSync('unzip', ['-p', outputPath, `xl/worksheets/sheet${sheetNumber}.xml`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (xml.includes('<sheetProtection')) {
    throw new Error(`Unexpected sheet protection in sheet${sheetNumber}.xml`);
  }
}

for (const sheetName of ['费用预估', 'SGS', '华测', '苏勃']) {
  const table = await workbook.inspect({
    kind: 'table',
    range: `${sheetName}!Q10:W28`,
    include: 'values,formulas',
    tableMaxRows: 22,
    tableMaxCols: 8,
    maxChars: 24000,
  });
  console.log(`TABLE ${sheetName}!Q10:W28`);
  console.log(table.ndjson);

  const blob = await workbook.render({ sheetName, range: 'Q10:W28', scale: 2, format: 'png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await fs.writeFile(
    `/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/${sheetName}_费用汇总_Q10_W28.png`,
    bytes,
  );
  console.log(`rendered ${sheetName} ${bytes.length}`);
}

const additionalRanges = {
  SGS: ['A83:O86', 'A172:O175'],
  华测: ['A82:O85', 'A171:O174'],
  苏勃: ['A86:O89', 'A176:O179'],
};

for (const [sheetName, ranges] of Object.entries(additionalRanges)) {
  for (const range of ranges) {
    const table = await workbook.inspect({
      kind: 'table',
      range: `${sheetName}!${range}`,
      include: 'values,formulas',
      tableMaxRows: 5,
      tableMaxCols: 16,
      maxChars: 12000,
    });
    console.log(`TABLE ${sheetName}!${range}`);
    console.log(table.ndjson);

    const blob = await workbook.render({ sheetName, range, scale: 2, format: 'png' });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    await fs.writeFile(
      `/Users/clytia/Desktop/Codex/产品测试流程自动化/outputs/workbook-edits/final/${sheetName}_${range.replace(':', '_')}_附加费用.png`,
      bytes,
    );
    console.log(`rendered ${sheetName} ${range} ${bytes.length}`);
  }
}

const errors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?',
  options: { useRegex: true, maxResults: 300 },
  summary: 'formula error scan',
  maxChars: 12000,
});
console.log(errors.ndjson);
