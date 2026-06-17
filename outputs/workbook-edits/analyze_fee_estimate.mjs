import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const inputPath =
  '/Users/clytia/Desktop/MLA测试项目及费用预估_费用预估页增加费用汇总_D8样品数更新.xlsx';

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);
const sheet = workbook.worksheets.getItem('费用预估');

function valueAt(values, row, col) {
  return values[row - 1]?.[col - 1] ?? null;
}

function colToLetter(col) {
  let s = '';
  while (col > 0) {
    const mod = (col - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}

const all = sheet.getRange('A1:O255');
const values = all.values;
const formulas = all.formulas;
const displayFormulas = all.displayFormulas;

console.log('TOP SUMMARY A10:O26');
for (let r = 10; r <= 26; r++) {
  const row = [];
  for (let c = 1; c <= 15; c++) {
    const v = valueAt(values, r, c);
    const f = valueAt(formulas, r, c);
    const df = valueAt(displayFormulas, r, c);
    if (v !== null || f !== null || df !== null) {
      row.push(`${colToLetter(c)}=${JSON.stringify(v)}${f ? ` formula:${f}` : ''}${df && df !== f ? ` display:${df}` : ''}`);
    }
  }
  console.log(`${r}: ${row.join(' | ')}`);
}

const groups = [];

for (let r = 1; r <= values.length; r++) {
  const a = valueAt(values, r, 1);
  const b = valueAt(values, r, 2);
  const c = valueAt(values, r, 3);
  const d = valueAt(values, r, 4);
  const e = valueAt(values, r, 5);
  if (typeof a === 'string') {
    if (/^Group .+：/.test(a)) groups.push({ row: r, type: 'section', text: a });
    if (/^Group .+ Total Cost$/.test(a)) groups.push({ row: r, type: 'total', text: a, k: valueAt(values, r, 11), l: valueAt(values, r, 12), m: valueAt(values, r, 13), formulas: [valueAt(formulas, r, 11), valueAt(formulas, r, 12), valueAt(formulas, r, 13)] });
  }
  if (d === 'K14' || d === 'E-1' || d === 'E-2') {
    groups.push({ row: r, type: 'specialRow', group: a, phase: c, code: d, name: e, k: valueAt(values, r, 11), l: valueAt(values, r, 12), m: valueAt(values, r, 13) });
  }
}

console.log('GROUP MARKERS AND SPECIAL ROWS');
console.log(JSON.stringify(groups, null, 2));

console.log('FORMULAS A1:O255 TARGETED');
for (let r = 1; r <= formulas.length; r++) {
  for (let c = 1; c <= 15; c++) {
    const f = valueAt(formulas, r, c);
    if (f) console.log(`${colToLetter(c)}${r}: ${f}`);
  }
}
