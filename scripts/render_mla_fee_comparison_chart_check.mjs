import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const workbookPath = resolve(
  process.argv[2] ?? "outputs/mla-fee-export-template/MLA测试项目及费用预估_test-flow组别顺序模板.xlsx",
);
const outputPath = resolve(
  process.argv[3] ?? "outputs/mla-fee-export-template/fee_comparison_native_chart_check.png",
);

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const png = await workbook.render({
  sheetName: "费用对比",
  range: "K1:R9",
  scale: 2,
});
await mkdir(resolve(outputPath, ".."), { recursive: true });
await writeFile(outputPath, Buffer.from(await png.arrayBuffer()));
console.log(outputPath);
