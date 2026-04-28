import { summarizeResults } from "./calculationEngine";
import type { EditableTestItem } from "../types/testing";
import type { ExportState } from "./excelExport";
import { formatSteeringSides } from "../utils/projectLabels";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDuration(item: EditableTestItem): string {
  return `${item.durationValue} ${item.durationUnit === "day" ? "天" : "小时"}`;
}

function renderItemRows(items: EditableTestItem[]): string {
  return items
    .map(
      (item) => `<tr>
        <td>${escapeHtml(item.code)}</td>
        <td>${escapeHtml(item.nameZh)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${item.sampleQty}</td>
        <td>${escapeHtml(formatDuration(item))}</td>
        <td>${escapeHtml(formatCurrency(item.cost))}</td>
        <td>${item.enabled ? "是" : "否"}</td>
      </tr>`,
    )
    .join("");
}

function renderDomainSection(title: string, items: EditableTestItem[]): string {
  return `<section class="card">
    <h2>${escapeHtml(title)}</h2>
    <table>
      <thead>
        <tr>
          <th>代码</th>
          <th>名称</th>
          <th>类别</th>
          <th>样本数</th>
          <th>时长</th>
          <th>费用</th>
          <th>启用</th>
        </tr>
      </thead>
      <tbody>${renderItemRows(items)}</tbody>
    </table>
  </section>`;
}

function renderSummary(state: ExportState): string {
  const allItems = [
    ...state.domainItems.environment,
    ...state.domainItems.material,
    ...state.domainItems.emc,
  ];
  const summary = summarizeResults(allItems);

  return `<section class="card">
    <h2>总汇总</h2>
    <table>
      <tbody>
        <tr><th>项目编号</th><td>${escapeHtml(state.projectSetup.projectCode)}</td></tr>
        <tr><th>平台</th><td>${escapeHtml(state.projectSetup.platform)}</td></tr>
        <tr><th>驾驶方向</th><td>${escapeHtml(formatSteeringSides(state.projectSetup.steeringSides))}</td></tr>
        <tr><th>方案确认</th><td>${state.projectSetup.confirmed ? "已确认" : "待确认"}</td></tr>
        <tr><th>启用项数</th><td>${summary.enabledItemCount}</td></tr>
        <tr><th>样本总数</th><td>${summary.totalSampleQty}</td></tr>
        <tr><th>总时长</th><td>${summary.totalDurationHours} h</td></tr>
        <tr><th>总费用</th><td>${escapeHtml(formatCurrency(summary.totalCost))}</td></tr>
      </tbody>
    </table>
  </section>`;
}

function buildPdfDocument(state: ExportState): string {
  return `<!doctype html>
  <html lang="zh-CN">
    <head>
      <meta charset="utf-8" />
      <title>测试结果导出</title>
      <style>
        :root { color-scheme: light; }
        body { font-family: Arial, "PingFang SC", "Microsoft YaHei", sans-serif; margin: 24px; color: #1f2937; }
        h1, h2 { margin: 0 0 12px; }
        .meta { margin-bottom: 20px; color: #4b5563; }
        .card { border: 1px solid #d1d5db; border-radius: 12px; padding: 16px; margin-bottom: 16px; break-inside: avoid; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; vertical-align: top; }
        thead th { background: #f9fafb; }
        @media print {
          body { margin: 12mm; }
          .card { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <h1>测试结果导出</h1>
      <div class="meta">
        <div>项目编号: ${escapeHtml(state.projectSetup.projectCode)}</div>
        <div>平台: ${escapeHtml(state.projectSetup.platform)}</div>
        <div>驾驶方向: ${escapeHtml(formatSteeringSides(state.projectSetup.steeringSides))}</div>
      </div>
      ${renderSummary(state)}
      ${renderDomainSection("环境费用", state.domainItems.environment)}
      ${renderDomainSection("材料费用", state.domainItems.material)}
      ${renderDomainSection("EMC费用", state.domainItems.emc)}
    </body>
  </html>`;
}

function openPrintWindow(state: ExportState): void {
  if (typeof window === "undefined") {
    return;
  }

  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1200,height=900");

  if (!printWindow) {
    return;
  }

  const html = buildPdfDocument(state);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  const triggerPrint = () => printWindow.print();

  if (printWindow.document.readyState === "complete") {
    triggerPrint();
    return;
  }

  printWindow.onload = triggerPrint;
}

export function exportResultsPdf(state: ExportState): void {
  openPrintWindow(state);
}
