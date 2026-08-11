"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  BugOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useRouter } from "next/navigation";

import StatsCard from "@/components/StatsCard";
import { getApiErrorMessage } from "@/lib/api/error";
import { apiBaseUrl } from "@/lib/api/instance";
import {
  type CreateQcDashboardReportRequest,
  type ManualReferenceOptionItem,
  type QcReportLookupType,
  type QcDashboardBySource,
  type QcDashboardDefectItem,
  type QcDashboardIncomingQcItem,
  type QcDashboardProductReturnQcItem,
  type QcDashboardProductionQcItem,
  type QcDashboardProductionQcIssue,
  type QcDashboardTopIssue,
  useCreateQcDashboardReportMutation,
  useGetQcDashboardDefectsQuery,
  useGetQcDashboardIncomingQcQuery,
  useGetQcDashboardOverviewQuery,
  useGetQcDashboardProductReturnQcQuery,
  useGetQcDashboardProductionQcQuery,
  useLazyGetQcDashboardProductionQcQuery,
  useGetQcDashboardProductionQcDetailQuery,
  useGetManualReferenceOptionsQuery,
} from "@/lib/api/qc-dashboard/api";

type QcTabId = "production" | "incoming" | "product_return" | "defects";

type UiTabId = QcTabId;

type PaginationState = Record<QcTabId, { page: number; limit: number }>;

type ManualReportFormValues = {
  qc_type: "production" | "incoming" | "product_return";
  report_date: Dayjs;
  reference_number: string;
  uniq_code: string;
  number_of_item_check: number;
  issue_reason_code?: string;
  issue_reason_text?: string;
  number_of_defect?: number;
  number_of_scrap?: number;
  status: string;
};

const getReferenceLabel = (
  qcType: ManualReportFormValues["qc_type"] | undefined,
) => {
  if (qcType === "production") return "WO Number";
  if (qcType === "incoming") return "DN / PO Number";
  if (qcType === "product_return") return "PR / DN Number";
  return "WO/PO/DN Number";
};

const getReferencePlaceholder = (
  qcType: ManualReportFormValues["qc_type"] | undefined,
) => {
  if (qcType === "production") return "Search WO Number...";
  if (qcType === "incoming") return "Search DN / PO Number...";
  if (qcType === "product_return") return "Search PR / DN Number...";
  return "Search...";
};

const formatNumber = (value: unknown) => {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(value ?? 0);
  if (!Number.isFinite(numeric)) return "0";
  return new Intl.NumberFormat("en-US").format(numeric);
};

const formatDate = (value?: string | null) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "-";
  if (raw.length >= 10 && raw[4] === "-" && raw[7] === "-")
    return raw.slice(0, 10);
  return raw;
};

const statusColor = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized.includes("pass")) return "green";
  if (
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("not_pass")
  )
    return "red";
  return "gold";
};

const toCsvValue = (value: unknown) => {
  const text = String(value ?? "");
  const escaped = text.replaceAll('"', '""');
  return `"${escaped}"`;
};

const downloadCsv = (
  filename: string,
  headers: string[],
  rows: Array<Record<string, unknown>>,
) => {
  const lines: string[] = [];
  lines.push(headers.map(toCsvValue).join(","));
  for (const row of rows) {
    lines.push(headers.map((key) => toCsvValue(row[key])).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

/**
 * Bangun HTML laporan Quality Check List untuk satu fase (semua uniq yang
 * berbagi WO Number yang sama). Layout meniru formulir MRP-FM-QC-01-01:
 * kop dokumen, blok info (PLANT/TANGGAL/SHIFT/PIC QC/WO NUMBER) beserta
 * kotak Note, tabel data dua baris header (Check Methode / Qty / Hasil
 * Check), dan tiga baris per uniq (Check Ke I / II / III). Ukuran halaman
 * A4 landscape.
 */
const buildQcLineReportHtml = (
  faseRows: QcDashboardProductionQcItem[],
  meta: {
    plant?: string;
    tanggal: string;
    shift?: string;
    picQc?: string;
    woNumber: string;
  },
) => {
  const bodyRows =
    faseRows.length === 0
      ? `<tr><td colspan="16" class="empty">Tidak ada uniq untuk fase ini.</td></tr>`
      : faseRows
          .map((uniq, idx) => {
            const totalNg = (uniq.qty_defect ?? 0) + (uniq.qty_scrap ?? 0);
            const totalOk = Math.max(
              0,
              (uniq.items_checked ?? 0) - totalNg,
            );
            const status = String(uniq.status ?? "").toLowerCase();
            const isPass =
              status.includes("pass") && !status.includes("not");
            const hasilOk = isPass ? "OK" : "";
            const hasilNg = isPass ? "" : "NG";
            const issueText =
              (uniq.issues ?? [])
                .map((it) => {
                  const label =
                    it.reason_text || it.reason_code || it.source || "-";
                  const qty =
                    it.qty || it.qty_defect || it.qty_scrap || 0;
                  return qty > 0 ? `${label} (Qty: ${qty})` : label;
                })
                .join(" | ") ||
              (uniq.issue_label ?? "") ||
              "";
            const uniqCell = escapeHtml(uniq.uniq_code || "");
            const problem = escapeHtml(issueText);
            const itemsChecked = escapeHtml(String(uniq.items_checked ?? 0));
            return `
        <tr>
          <td rowspan="3">${idx + 1}</td>
          <td rowspan="3"></td>
          <td rowspan="3">${uniqCell}</td>
          <td rowspan="3"></td>
          <td>I</td>
          <td></td>
          <td rowspan="3">${itemsChecked}</td>
          <td></td><td></td><td></td>
          <td>${totalOk}</td>
          <td>${totalNg}</td>
          <td>${hasilOk}</td>
          <td>${hasilNg}</td>
          <td rowspan="3" class="left">${problem}</td>
          <td rowspan="3"></td>
        </tr>
        <tr>
          <td>II</td><td></td>
          <td></td><td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
        </tr>
        <tr>
          <td>III</td><td></td>
          <td></td><td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
        </tr>`;
          })
          .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Quality Check List ${escapeHtml(meta.woNumber)}</title>
<style>
  @page { size: A4 landscape; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9px; color: #000; }
  .doc { padding: 4px; }
  table { border-collapse: collapse; width: 100%; }
  .hdr-tbl td { border: 1px solid #000; padding: 3px 6px; vertical-align: middle; }
  .hdr-tbl .company { text-align: center; font-weight: bold; font-size: 13px; }
  .hdr-tbl .subtitle { font-size: 10px; font-weight: bold; }
  .hdr-tbl .meta-l { width: 90px; }
  .hdr-tbl .meta-r { width: 170px; }
  .info-wrap { margin-top: 4px; display: flex; align-items: stretch; gap: 8px; }
  .info-tbl { border-collapse: collapse; }
  .info-tbl td { padding: 1px 4px; border: none; }
  .info-tbl .lbl { width: 90px; font-weight: bold; }
  .info-tbl .sep { width: 8px; text-align: center; }
  .note-box { border: 1px solid #000; padding: 4px 8px; margin-left: auto; max-width: 380px; font-size: 8.5px; }
  .data-tbl { margin-top: 4px; table-layout: fixed; }
  .data-tbl th, .data-tbl td { border: 1px solid #000; padding: 2px 3px; text-align: center; font-size: 9px; word-wrap: break-word; }
  .data-tbl th { background: #f2f2f2; font-weight: bold; }
  .data-tbl td.left { text-align: left; }
  .data-tbl td.empty { padding: 12px; color: #666; font-style: italic; }
  .footer-note { margin-top: 4px; font-size: 8.5px; color: #444; }
</style>
</head>
<body>
  <div class="doc">
    <table class="hdr-tbl">
      <tr>
        <td rowspan="4" class="company" style="width: 90px;">MRP</td>
        <td rowspan="4" class="company">
          PT.MATRA RODA PIRANTI
          <div class="subtitle">FORMULIR</div>
          <div class="subtitle">QUALITY CHECK LIST</div>
        </td>
        <td class="meta-l">Nomor</td>
        <td class="meta-r">: MRP-FM-QC-01-01</td>
      </tr>
      <tr><td>Revisi</td><td>: 01</td></tr>
      <tr><td>Berlaku</td><td>: 25 Juli 2017</td></tr>
      <tr><td>Halaman</td><td>: 1 Dari 1</td></tr>
    </table>

    <div class="info-wrap">
      <table class="info-tbl">
        <tr><td class="lbl">PLANT</td><td class="sep">:</td><td>${escapeHtml(meta.plant ?? "")}</td></tr>
        <tr><td class="lbl">TANGGAL</td><td class="sep">:</td><td>${escapeHtml(meta.tanggal)}</td></tr>
        <tr><td class="lbl">SHIFT</td><td class="sep">:</td><td>${escapeHtml(meta.shift ?? "")}</td></tr>
        <tr><td class="lbl">PIC QC</td><td class="sep">:</td><td>${escapeHtml(meta.picQc ?? "")}</td></tr>
        <tr><td class="lbl">WO NUMBER</td><td class="sep">:</td><td>${escapeHtml(meta.woNumber)}</td></tr>
      </table>
      <div class="note-box">
        <b>Note :</b><br />
        Bila Proses 1 ( Mesin O ) tdk Bisa Di konfirmasi menggunakan CF/CG, Alat Ukur,
        Maka Konfirmasinya By Visual ( yg di Contreng - adalah Visual pada Methode Cek nya )
      </div>
    </div>

    <table class="data-tbl">
      <colgroup>
        <col style="width: 3%" />
        <col style="width: 8%" />
        <col style="width: 8%" />
        <col style="width: 4%" />
        <col style="width: 5%" />
        <col style="width: 4%" />
        <col style="width: 7%" />
        <col style="width: 3.5%" />
        <col style="width: 6%" />
        <col style="width: 4%" />
        <col style="width: 3.5%" />
        <col style="width: 3.5%" />
        <col style="width: 3.5%" />
        <col style="width: 3.5%" />
        <col style="width: 17%" />
        <col style="width: 14%" />
      </colgroup>
      <thead>
        <tr>
          <th rowspan="2">NO</th>
          <th rowspan="2">LINE / No.Mesin</th>
          <th rowspan="2">Uniq No<br />Part No</th>
          <th rowspan="2">DH</th>
          <th rowspan="2">Check Ke</th>
          <th rowspan="2">Jam</th>
          <th rowspan="2">Qty Check (PCS) n / pn</th>
          <th colspan="3">Check Methode</th>
          <th colspan="2">Qty ( PCS )</th>
          <th colspan="2">Hasil Check</th>
          <th rowspan="2">Problem</th>
          <th rowspan="2">Action ( Product/Produksi )</th>
        </tr>
        <tr>
          <th>C/F</th>
          <th>Alat Ukur</th>
          <th>Visual</th>
          <th>OK</th>
          <th>NG</th>
          <th>OK</th>
          <th>NG</th>
        </tr>
      </thead>
      <tbody>${bodyRows}</tbody>
    </table>

    <div class="footer-note">
      Report ini dibuat otomatis dari QC Dashboard — ${escapeHtml(dayjs().format("YYYY-MM-DD HH:mm"))}
    </div>
  </div>
</body>
</html>`;
};

/**
 * Render HTML report ke hidden iframe lalu panggil window.print(). Pengguna
 * memilih "Save as PDF" (atau "Microsoft Print to PDF") pada dialog print
 * bawaan browser untuk menyimpan sebagai file PDF.
 */
/* ============================================================
 * MONTHLY REPORT (RECORDING OF DATA DEFECT IN Q-GATE) helpers
 * Layout mengikuti form FM-QA-029: header, monthly tendency +
 * table 12 bulan, weekly tendency + pareto, tabel weekly / defect
 * list / reject-scrap, dan tabel Problem-Action.
 * ============================================================ */

type MonthlyReportMeta = {
  line: string;
  customer: string;
  period: Dayjs; // month + year
  targetDefectPercent: number;
  approvedBy?: string;
  checkedBy?: string;
  preparedBy?: string;
};

type MonthAggregate = {
  totalCheck: number;
  totalDefect: number;
  totalScrap: number;
  defectPercent: number;
  ppm: number;
};

type WeekAggregate = {
  totalCheck: number;
  totalDefect: number;
  defectRatio: number;
};

type DefectListEntry = {
  code: string;
  label: string;
  count: number;
  paretoPercent: number;
};

const aggregateMonthly = (
  rows: QcDashboardProductionQcItem[],
  year: number,
): MonthAggregate[] => {
  const arr: MonthAggregate[] = Array.from({ length: 12 }, () => ({
    totalCheck: 0,
    totalDefect: 0,
    totalScrap: 0,
    defectPercent: 0,
    ppm: 0,
  }));
  for (const r of rows) {
    const d = dayjs(r.report_date);
    if (!d.isValid() || d.year() !== year) continue;
    const m = d.month();
    arr[m].totalCheck += Number(r.items_checked ?? 0);
    arr[m].totalDefect += Number(r.qty_defect ?? 0);
    arr[m].totalScrap += Number(r.qty_scrap ?? 0);
  }
  for (const a of arr) {
    a.defectPercent =
      a.totalCheck > 0 ? (a.totalDefect / a.totalCheck) * 100 : 0;
    a.ppm =
      a.totalCheck > 0 ? (a.totalDefect / a.totalCheck) * 1_000_000 : 0;
  }
  return arr;
};

const aggregateWeekly = (
  rows: QcDashboardProductionQcItem[],
  year: number,
  month: number,
): WeekAggregate[] => {
  const arr: WeekAggregate[] = Array.from({ length: 4 }, () => ({
    totalCheck: 0,
    totalDefect: 0,
    defectRatio: 0,
  }));
  for (const r of rows) {
    const d = dayjs(r.report_date);
    if (!d.isValid() || d.year() !== year || d.month() !== month) continue;
    const dom = d.date();
    const w = dom <= 7 ? 0 : dom <= 14 ? 1 : dom <= 21 ? 2 : 3;
    arr[w].totalCheck += Number(r.items_checked ?? 0);
    arr[w].totalDefect += Number(r.qty_defect ?? 0);
  }
  for (const a of arr) {
    a.defectRatio =
      a.totalCheck > 0 ? (a.totalDefect / a.totalCheck) * 100 : 0;
  }
  return arr;
};

const aggregateDefectList = (
  rows: QcDashboardProductionQcItem[],
  year: number,
  month: number,
): DefectListEntry[] => {
  const map = new Map<string, DefectListEntry>();
  let total = 0;
  for (const r of rows) {
    const d = dayjs(r.report_date);
    if (!d.isValid() || d.year() !== year || d.month() !== month) continue;
    const issues = r.issues ?? [];
    if (issues.length === 0) {
      const qty = Number(r.qty_defect ?? 0);
      if (qty > 0) {
        const key = r.issue_label || "OTHER";
        const entry = map.get(key) ?? {
          code: "",
          label: key,
          count: 0,
          paretoPercent: 0,
        };
        entry.count += qty;
        map.set(key, entry);
        total += qty;
      }
      continue;
    }
    for (const it of issues) {
      const key = it.reason_code || it.reason_text || "OTHER";
      const qty = Number(it.qty_defect || it.qty || 0);
      if (qty <= 0) continue;
      const entry = map.get(key) ?? {
        code: it.reason_code || "",
        label: it.reason_text || it.reason_code || "OTHER",
        count: 0,
        paretoPercent: 0,
      };
      entry.count += qty;
      map.set(key, entry);
      total += qty;
    }
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => b.count - a.count);
  for (const e of arr) {
    e.paretoPercent = total > 0 ? (e.count / total) * 100 : 0;
  }
  return arr;
};

const aggregateScrap = (
  rows: QcDashboardProductionQcItem[],
  year: number,
  month: number,
) => {
  let totalCheck = 0;
  let totalScrap = 0;
  for (const r of rows) {
    const d = dayjs(r.report_date);
    if (!d.isValid() || d.year() !== year || d.month() !== month) continue;
    totalCheck += Number(r.items_checked ?? 0);
    totalScrap += Number(r.qty_scrap ?? 0);
  }
  return {
    totalCheck,
    totalScrap,
    scrapPercent: totalCheck > 0 ? (totalScrap / totalCheck) * 100 : 0,
  };
};

/** SVG bar + line chart dengan Y-axis kiri (bar) & kanan (line %). */
const buildBarLineSvg = (args: {
  width: number;
  height: number;
  bars: number[];
  lineValues: number[];
  labels: string[];
  barMax?: number;
  lineMax?: number;
  targetLineValue?: number | null;
  barColor?: string;
  lineColor?: string;
  showLineLabel?: (v: number) => string;
}) => {
  const {
    width,
    height,
    bars,
    lineValues,
    labels,
    targetLineValue = null,
    barColor = "#2f5fb5",
    lineColor = "#000",
    showLineLabel = (v: number) => (v > 0 ? v.toFixed(2) + "%" : ""),
  } = args;
  const paddingL = 34;
  const paddingR = 42;
  const paddingT = 12;
  const paddingB = 22;
  const chartW = Math.max(0, width - paddingL - paddingR);
  const chartH = Math.max(0, height - paddingT - paddingB);
  const n = Math.max(1, bars.length);
  const slotW = chartW / n;
  const barW = slotW * 0.6;
  const bMax = Math.max(args.barMax ?? 0, ...bars, 1);
  const lMax = Math.max(args.lineMax ?? 0, ...lineValues, 1);

  const barsSvg = bars
    .map((v, i) => {
      const x = paddingL + i * slotW + (slotW - barW) / 2;
      const h = bMax > 0 ? (v / bMax) * chartH : 0;
      const y = paddingT + chartH - h;
      const lbl = v > 0 ? String(Math.round(v)) : "";
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="${barColor}" stroke="#1e3a8a" stroke-width="0.4" /><text x="${(x + barW / 2).toFixed(1)}" y="${(y - 2).toFixed(1)}" font-size="6" text-anchor="middle" fill="#000">${lbl}</text>`;
    })
    .join("");

  const linePoints = lineValues
    .map((v, i) => {
      const x = paddingL + i * slotW + slotW / 2;
      const y =
        paddingT + chartH - (lMax > 0 ? (v / lMax) * chartH : 0);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const lineDots = lineValues
    .map((v, i) => {
      const x = paddingL + i * slotW + slotW / 2;
      const y =
        paddingT + chartH - (lMax > 0 ? (v / lMax) * chartH : 0);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.6" fill="${lineColor}" /><text x="${(x + 3).toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="6" fill="${lineColor}">${escapeHtml(showLineLabel(v))}</text>`;
    })
    .join("");

  const targetSvg =
    targetLineValue != null && lMax > 0
      ? (() => {
          const y =
            paddingT + chartH - (targetLineValue / lMax) * chartH;
          return `<line x1="${paddingL}" y1="${y.toFixed(1)}" x2="${(paddingL + chartW).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#0ea5e9" stroke-width="0.7" stroke-dasharray="3,2" /><text x="${(paddingL + chartW - 2).toFixed(1)}" y="${(y - 2).toFixed(1)}" font-size="6" text-anchor="end" fill="#0ea5e9">TARGET ${targetLineValue}%</text>`;
        })()
      : "";

  const labelsSvg = labels
    .map((lb, i) => {
      const x = paddingL + i * slotW + slotW / 2;
      const y = paddingT + chartH + 10;
      return `<text x="${x.toFixed(1)}" y="${y}" font-size="6" text-anchor="middle" fill="#000">${escapeHtml(lb)}</text>`;
    })
    .join("");

  const yTicksL = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => {
      const v = bMax * t;
      const y = paddingT + chartH - t * chartH;
      return `<line x1="${paddingL - 2}" y1="${y}" x2="${paddingL}" y2="${y}" stroke="#000" stroke-width="0.4" /><text x="${paddingL - 3}" y="${y + 2}" font-size="5" text-anchor="end" fill="#000">${Math.round(v)}</text>`;
    })
    .join("");
  const yTicksR = [0, 0.25, 0.5, 0.75, 1]
    .map((t) => {
      const v = lMax * t;
      const y = paddingT + chartH - t * chartH;
      return `<line x1="${paddingL + chartW}" y1="${y}" x2="${paddingL + chartW + 2}" y2="${y}" stroke="#000" stroke-width="0.4" /><text x="${paddingL + chartW + 3}" y="${y + 2}" font-size="5" text-anchor="start" fill="#000">${v.toFixed(2)}%</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect x="${paddingL}" y="${paddingT}" width="${chartW}" height="${chartH}" fill="#fff" stroke="#000" stroke-width="0.5" />
    ${barsSvg}
    ${targetSvg}
    <polyline points="${linePoints}" fill="none" stroke="${lineColor}" stroke-width="1" />
    ${lineDots}
    ${labelsSvg}
    ${yTicksL}
    ${yTicksR}
  </svg>`;
};

const MONTH_LABELS = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const buildMonthlyReportHtml = (
  rows: QcDashboardProductionQcItem[],
  meta: MonthlyReportMeta,
) => {
  const year = meta.period.year();
  const monthIdx = meta.period.month();
  const monthly = aggregateMonthly(rows, year);
  const weekly = aggregateWeekly(rows, year, monthIdx);
  const defectList = aggregateDefectList(rows, year, monthIdx);
  const scrap = aggregateScrap(rows, year, monthIdx);

  const totalYearCheck = monthly.reduce((s, m) => s + m.totalCheck, 0);
  const totalYearDefect = monthly.reduce((s, m) => s + m.totalDefect, 0);
  const yearAvgPercent =
    totalYearCheck > 0 ? (totalYearDefect / totalYearCheck) * 100 : 0;

  const currentMonthDefectPercent = monthly[monthIdx]?.defectPercent ?? 0;
  const achieved = currentMonthDefectPercent <= meta.targetDefectPercent;
  const resultText = achieved ? "ACHIEVED" : "NOT ACHIEVED";
  const resultColor = achieved ? "#22c55e" : "#ef4444";

  const monthlyChart = buildBarLineSvg({
    width: 760,
    height: 190,
    bars: monthly.map((m) => m.totalDefect),
    lineValues: monthly.map((m) => m.defectPercent),
    labels: MONTH_LABELS,
    lineMax: Math.max(4, meta.targetDefectPercent * 4),
    targetLineValue: meta.targetDefectPercent,
  });

  const weeklyChart = buildBarLineSvg({
    width: 380,
    height: 170,
    bars: weekly.map((w) => w.totalDefect),
    lineValues: weekly.map((w) => w.defectRatio),
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    lineMax: Math.max(4, meta.targetDefectPercent * 4),
  });

  const paretoTop = defectList.slice(0, 12);
  const paretoCum: number[] = [];
  {
    let cum = 0;
    for (const e of paretoTop) {
      cum += e.paretoPercent;
      paretoCum.push(cum);
    }
  }
  const paretoChart = buildBarLineSvg({
    width: 500,
    height: 170,
    bars: paretoTop.map((e) => e.count),
    lineValues: paretoCum,
    labels: paretoTop.map((_, i) => `D${i + 1}`),
    lineMax: 100,
    showLineLabel: (v) => (v > 0 ? Math.round(v) + "%" : ""),
  });

  const monthCell = (idx: number, s: string, highlight: boolean) =>
    highlight
      ? `<td style="background:#fde68a;font-weight:bold;">${escapeHtml(s)}</td>`
      : `<td>${escapeHtml(s)}</td>`;

  const monthlyTableRows = (
    [
      ["TOTAL CHECK", monthly.map((m) => formatNumber(m.totalCheck))],
      ["TOTAL DEFECT", monthly.map((m) => formatNumber(m.totalDefect))],
      [
        "% DEFECT",
        monthly.map((m) =>
          m.totalCheck > 0 ? m.defectPercent.toFixed(2) + "%" : "0,00%",
        ),
      ],
      ["% AVERAGE", monthly.map(() => yearAvgPercent.toFixed(2) + "%")],
      [
        "Ppm DEFECT",
        monthly.map((m) => (m.totalCheck > 0 ? m.ppm.toFixed(2) : "0.00")),
      ],
    ] as Array<[string, string[]]>
  )
    .map(
      ([label, cells]) =>
        `<tr><td class="lbl">${escapeHtml(label)}</td>${cells
          .map((c, i) => monthCell(i, c, i === monthIdx))
          .join("")}</tr>`,
    )
    .join("");

  const weeklyTotalCheck = weekly.reduce((s, w) => s + w.totalCheck, 0);
  const weeklyTotalDefect = weekly.reduce((s, w) => s + w.totalDefect, 0);
  const weeklyTotalRatio =
    weeklyTotalCheck > 0
      ? (weeklyTotalDefect / weeklyTotalCheck) * 100
      : 0;
  const weeklyTableRows = (
    [
      [
        "TOTAL CHECK",
        [
          ...weekly.map((w) => formatNumber(w.totalCheck)),
          formatNumber(weeklyTotalCheck),
        ],
      ],
      [
        "TOTAL DEFECT",
        [
          ...weekly.map((w) => formatNumber(w.totalDefect)),
          formatNumber(weeklyTotalDefect),
        ],
      ],
      [
        "DEFECT RATIO ( % )",
        [
          ...weekly.map((w) => w.defectRatio.toFixed(2) + "%"),
          weeklyTotalRatio.toFixed(2) + "%",
        ],
      ],
    ] as Array<[string, string[]]>
  )
    .map(
      ([label, cells]) =>
        `<tr><td class="lbl">${escapeHtml(label)}</td>${cells
          .map((c) => `<td>${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const defectListHeaderCols =
    paretoTop.length === 0
      ? '<th colspan="1" style="font-style:italic;color:#666;">No defect data</th>'
      : paretoTop
          .map(
            (e) =>
              `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:60px;font-size:7px;">${escapeHtml(e.label)}</th>`,
          )
          .join("");
  const totalDefectListSum = paretoTop.reduce((s, e) => s + e.count, 0);
  const defectListRows = (
    [
      [
        "TOTAL DEFECT ( Pcs )",
        [
          ...paretoTop.map((e) => String(e.count)),
          String(totalDefectListSum),
        ],
      ],
      [
        "PARETO DEFECT ( % )",
        [
          ...paretoTop.map((e) => Math.round(e.paretoPercent) + "%"),
          "100%",
        ],
      ],
    ] as Array<[string, string[]]>
  )
    .map(
      ([label, cells]) =>
        `<tr><td class="lbl">${escapeHtml(label)}</td>${cells
          .map((c) => `<td>${escapeHtml(c)}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const emptyActionRows = Array.from({ length: 4 })
    .map(
      () =>
        `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Monthly Report ${escapeHtml(meta.period.format("MMMM YYYY"))}</title>
<style>
  @page { size: A4 landscape; margin: 5mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 8px; color: #000; }
  .doc { padding: 2px; }
  table { border-collapse: collapse; width: 100%; }
  .hdr-tbl td { border: 1px solid #000; padding: 3px 6px; vertical-align: middle; }
  .hdr-tbl .company { font-weight: bold; font-size: 10px; }
  .hdr-tbl .title { text-align: center; font-weight: bold; font-size: 15px; }
  .hdr-tbl .subtitle { text-align: center; font-size: 10px; font-weight: bold; }
  .info-box { border: 1px solid #000; padding: 4px 6px; text-align: center; font-weight: bold; font-size: 9px; }
  .info-box small { display:block; font-weight: normal; font-size: 7px; }
  .result-box { border: 1px solid #000; padding: 6px 10px; text-align: center; font-weight: bold; color: #fff; font-size: 10px; }
  .section-lbl { border: 1px solid #000; padding: 4px 2px; font-weight: bold; text-align: center; font-size: 9px; writing-mode: vertical-rl; transform: rotate(180deg); }
  .chart-box { border: 1px solid #000; padding: 2px; background:#fff; }
  .data-tbl { border-collapse: collapse; width: 100%; }
  .data-tbl td, .data-tbl th { border: 1px solid #000; padding: 2px 3px; text-align: center; font-size: 7.5px; }
  .data-tbl .lbl { text-align: left; font-weight: bold; background: #f5f5f5; }
  .action-tbl td, .action-tbl th { border: 1px solid #000; padding: 4px 6px; font-size: 9px; height: 42px; vertical-align: top; }
  .action-tbl th { background: #f0f0f0; font-weight: bold; text-align: center; }
  .approve-tbl { width: 100%; border-collapse: collapse; }
  .approve-tbl td { border: 1px solid #000; text-align: center; font-size: 8px; padding: 2px 4px; }
  .approve-tbl .h { font-weight: bold; background: #f0f0f0; }
  .signature { height: 30px; }
  .flex { display: flex; }
  .gap-1 { gap: 3px; }
  .mt-1 { margin-top: 3px; }
</style>
</head>
<body>
  <div class="doc">
    <!-- HEADER TITLE ROW -->
    <table class="hdr-tbl">
      <tr>
        <td rowspan="3" style="width: 110px; text-align: center;">
          <div style="font-size:18px; font-weight:bold; color:#dc2626; letter-spacing:1px;">BT</div>
          <div class="company">PT. BONECOM TRICOM</div>
          <div style="font-size:7px; font-style: italic;">Quality Assurance Departement</div>
        </td>
        <td class="title">MONTHLY REPORT</td>
        <td rowspan="3" style="width: 260px; padding: 0;">
          <table class="approve-tbl">
            <tr><td style="font-weight:bold;" colspan="3">NO. DOKUMEN : FM - QA - 029</td></tr>
            <tr><td style="font-weight:bold;" colspan="3">REVISI : 00 / 01-12-21</td></tr>
            <tr>
              <td class="h" style="width:33%;">APPROVED</td>
              <td class="h" style="width:33%;">CHECKED</td>
              <td class="h">PREPARED</td>
            </tr>
            <tr>
              <td class="signature">${escapeHtml(meta.approvedBy || "")}</td>
              <td class="signature">${escapeHtml(meta.checkedBy || "")}</td>
              <td class="signature">${escapeHtml(meta.preparedBy || "")}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="subtitle">( RECORDING OF DATA DEFECT IN Q - GATE )</td>
      </tr>
      <tr>
        <td style="text-align: center; font-weight: bold;">LINE : ${escapeHtml(meta.line)}</td>
      </tr>
    </table>

    <!-- Monthly Tendency label + chart + info panel -->
    <div class="flex gap-1 mt-1">
      <div style="width: 30px; display:flex;">
        <div class="section-lbl" style="flex:1;">MONTHLY TENDENCY</div>
      </div>
      <div class="chart-box" style="flex: 1;">
        ${monthlyChart}
      </div>
      <div style="width: 200px; display:flex; flex-direction:column; gap:3px;">
        <div class="info-box">PERIODE : ${escapeHtml(meta.period.format("MMMM YYYY"))}</div>
        <div class="info-box"><small>CUSTOMER</small>${escapeHtml(meta.customer)}</div>
        <div class="result-box" style="background: ${resultColor};">
          <small style="display:block;font-size:7px;font-weight:normal;">RESULT</small>${resultText}
        </div>
        <div class="info-box">TARGET DEFECT &le; ${meta.targetDefectPercent}%</div>
      </div>
    </div>

    <!-- Monthly data table 12 cols -->
    <table class="data-tbl mt-1">
      <tr>
        <th style="width: 90px;">MONTH</th>
        ${MONTH_LABELS.map((m, i) => (i === monthIdx ? `<th style="background:#fde68a;">${m}</th>` : `<th>${m}</th>`)).join("")}
      </tr>
      ${monthlyTableRows}
    </table>

    <!-- Weekly Tendency + Pareto -->
    <div class="flex gap-1 mt-1">
      <div style="width: 30px; display:flex;">
        <div class="section-lbl" style="flex:1;">WEEKLY TENDENCY</div>
      </div>
      <div class="chart-box" style="flex: 1;">
        <div style="text-align:center;font-weight:bold;font-size:8px;">RECAPITULATION DATA DEFECT</div>
        ${weeklyChart}
      </div>
      <div class="chart-box" style="flex: 1.3;">
        <div style="text-align:center;font-weight:bold;font-size:8px;">PARETO DEFECT</div>
        ${paretoChart}
      </div>
    </div>

    <!-- Weekly + Defect List + Reject/Scrap tables -->
    <div class="flex gap-1 mt-1">
      <div style="flex: 1;">
        <table class="data-tbl">
          <tr>
            <th style="width: 100px;">DATE</th>
            <th>WEEK 1</th><th>WEEK 2</th><th>WEEK 3</th><th>WEEK 4</th><th>TOTAL</th>
          </tr>
          ${weeklyTableRows}
        </table>
      </div>
      <div style="flex: 1.3;">
        <table class="data-tbl">
          <tr>
            <th style="width: 100px;">DEFECT LIST</th>
            ${defectListHeaderCols}
            <th>TOTAL</th>
          </tr>
          ${defectListRows}
        </table>
      </div>
      <div style="width: 170px;">
        <table class="data-tbl">
          <tr><th colspan="2">REJECT/SCRAP PART</th></tr>
          <tr><td class="lbl">TOTAL CHECK</td><td>${formatNumber(scrap.totalCheck)}</td></tr>
          <tr><td class="lbl">TOTAL REJECT/SCRAP PART</td><td>${formatNumber(scrap.totalScrap)}</td></tr>
          <tr><td class="lbl">% SCRAP</td><td>${scrap.scrapPercent.toFixed(2)}%</td></tr>
        </table>
      </div>
    </div>

    <!-- Problem / Action Table -->
    <table class="action-tbl mt-1">
      <tr>
        <th style="width: 15%;">PROBLEM DEFECT</th>
        <th style="width: 15%;">CAUSE</th>
        <th style="width: 20%;">CORECTIVE ACTION</th>
        <th style="width: 20%;">PREVENTIVE ACTION</th>
        <th style="width: 10%;">DATE</th>
        <th style="width: 8%;">PIC</th>
        <th style="width: 12%;">EVALUATION</th>
      </tr>
      ${emptyActionRows}
    </table>

    <div style="margin-top:4px; font-size:7px; color:#666; text-align:right;">
      Generated ${escapeHtml(dayjs().format("YYYY-MM-DD HH:mm"))} from QC Dashboard
    </div>
  </div>
</body>
</html>`;
};

/**
 * Membuat satu HTML multi-halaman untuk seluruh bulan yang memiliki data
 * pada `rows`. Tiap bulan dirender sebagai satu "sheet" (page) FM-QA-029
 * yang dipisah dengan CSS `page-break-after: always`, sehingga saat
 * print/Save as PDF akan muncul sebagai halaman terpisah per bulan.
 */
const buildMonthlyReportsHtml = (
  rows: QcDashboardProductionQcItem[],
  metaBase: Omit<MonthlyReportMeta, "period">,
) => {
  // 1) Tentukan bucket (year, monthIdx) unik dari report_date.
  const buckets: Array<{ year: number; monthIdx: number }> = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!r.report_date) continue;
    const d = dayjs(r.report_date);
    if (!d.isValid()) continue;
    const y = d.year();
    const m = d.month();
    const key = `${y}-${m}`;
    if (seen.has(key)) continue;
    seen.add(key);
    buckets.push({ year: y, monthIdx: m });
  }
  buckets.sort((a, b) => a.year - b.year || a.monthIdx - b.monthIdx);
  if (buckets.length === 0) {
    const now = dayjs();
    buckets.push({ year: now.year(), monthIdx: now.month() });
  }

  // 2) Render per-bucket dan extract .doc block dari HTML utuh yang
  //    dikembalikan `buildMonthlyReportHtml` (single-month builder).
  const startTag = '<div class="doc">';
  const bodyEndTag = "</body>";
  const docBlocks: string[] = [];
  let headPart = "";
  buckets.forEach(({ year, monthIdx }, idx) => {
    const period = dayjs(new Date(year, monthIdx, 1));
    const singleHtml = buildMonthlyReportHtml(rows, {
      ...metaBase,
      period,
    });
    if (idx === 0) {
      const bodyOpen = singleHtml.indexOf("<body>");
      if (bodyOpen >= 0) {
        headPart = singleHtml.slice(0, bodyOpen + "<body>".length);
      }
    }
    const start = singleHtml.indexOf(startTag);
    const end = singleHtml.lastIndexOf(bodyEndTag);
    if (start >= 0 && end > start) {
      docBlocks.push(singleHtml.slice(start, end).trim());
    }
  });

  // 3) Gabung semua page dengan page-break di antaranya.
  const pageBreak =
    '<div style="page-break-after: always; height:0; overflow:hidden;"></div>';
  return `${headPart}
${docBlocks.join("\n" + pageBreak + "\n")}
</body>
</html>`;
};

const printHtmlReport = (html: string) => {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    window.setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {}
    }, 500);
  };

  const cw = iframe.contentWindow;
  if (!cw) {
    cleanup();
    return;
  }
  cw.onafterprint = cleanup;
  // Beri jeda kecil supaya konten & style ter-render sebelum print dialog
  // dibuka; kalau tidak, sebagian browser mencetak halaman kosong.
  window.setTimeout(() => {
    try {
      cw.focus();
      cw.print();
    } catch {
      cleanup();
    }
  }, 300);
};

export default function QcDashboardPage() {
  const [manualForm] = Form.useForm<ManualReportFormValues>();
  const apiEnabled = Boolean(apiBaseUrl);

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<UiTabId>("production");
  const [pagination, setPagination] = useState<PaginationState>({
    production: { page: 1, limit: 20 },
    incoming: { page: 1, limit: 20 },
    product_return: { page: 1, limit: 20 },
    defects: { page: 1, limit: 20 },
  });
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const overviewQuery = useGetQcDashboardOverviewQuery(undefined, {
    skip: !apiEnabled,
  });
  const productionQuery = useGetQcDashboardProductionQcQuery(
    pagination.production,
    {
      skip: !apiEnabled || activeTab !== "production",
    },
  );
  const incomingQuery = useGetQcDashboardIncomingQcQuery(pagination.incoming, {
    skip: !apiEnabled || activeTab !== "incoming",
  });
  const defectsQuery = useGetQcDashboardDefectsQuery(pagination.defects, {
    skip: !apiEnabled || activeTab !== "defects",
  });
  const productReturnQuery = useGetQcDashboardProductReturnQcQuery(
    pagination.product_return,
    {
      skip: !apiEnabled || activeTab !== "product_return",
    },
  );

  const [createQcReport, createQcReportState] =
    useCreateQcDashboardReportMutation();
  const [triggerFetchAllProductionQc, fetchAllProductionQcState] =
    useLazyGetQcDashboardProductionQcQuery();

  /**
   * Download laporan Quality Check List per fase.
   * "Fase" di sini didefinisikan sebagai satu WO Number — semua uniq yang
   * berbagi WO Number yang sama akan muncul di satu file report bersama
   * detail dan issue-nya (I/II/III check ke).
   */
  const handleDownloadFaseReport = React.useCallback(
    async (row: QcDashboardProductionQcItem) => {
      const woNumber = (row.wo_number || "").trim();
      if (!woNumber) {
        message.warning("WO Number tidak tersedia untuk baris ini.");
        return;
      }
      try {
        const response = await triggerFetchAllProductionQc({
          limit: 1000,
          page: 1,
        }).unwrap();
        const allRows = (response?.data ?? []) as QcDashboardProductionQcItem[];
        const faseRows = allRows.filter((r) => r.wo_number === woNumber);
        const uniqSet = new Map<string, QcDashboardProductionQcItem>();
        faseRows.forEach((r) => {
          const key = r.uniq_code || String(r.qc_log_id);
          if (!uniqSet.has(key)) uniqSet.set(key, r);
        });
        // Fallback: kalau lazy fetch tidak mengembalikan baris untuk WO ini
        // (misal data belum ter-index), tetap generate untuk baris terpilih.
        const finalRows =
          uniqSet.size > 0 ? Array.from(uniqSet.values()) : [row];

        const html = buildQcLineReportHtml(finalRows, {
          tanggal: formatDate(row.report_date),
          woNumber,
        });
        printHtmlReport(html);
        message.success(
          `Report fase ${woNumber} (${finalRows.length} uniq) siap dicetak / Save as PDF.`,
        );
      } catch (error) {
        message.error(
          getApiErrorMessage(error, "Gagal generate report fase"),
        );
      }
    },
    [triggerFetchAllProductionQc],
  );
  // ---- Monthly Report (FM-QA-029) — langsung print semua bulan ----
  // Klik tombol Monthly Report akan langsung fetch seluruh data Production QC
  // lalu men-generate satu file PDF multi-halaman: 1 sheet per bulan yang
  // memiliki data (dipisah dengan CSS page-break-after: always).
  const handleGenerateMonthlyReport = React.useCallback(async () => {
    try {
      const response = await triggerFetchAllProductionQc({
        limit: 1000,
        page: 1,
      }).unwrap();
      const allRows =
        (response?.data ?? []) as QcDashboardProductionQcItem[];
      if (allRows.length === 0) {
        message.warning(
          "Belum ada data Production QC untuk di-generate ke monthly report.",
        );
        return;
      }
      const html = buildMonthlyReportsHtml(allRows, {
        line: "-",
        customer: "-",
        targetDefectPercent: 1,
        approvedBy: "",
        checkedBy: "",
        preparedBy: "",
      });
      printHtmlReport(html);
      message.success(
        "Monthly report per bulan siap dicetak / Save as PDF.",
      );
    } catch (error) {
      message.error(
        getApiErrorMessage(error, "Gagal generate monthly report"),
      );
    }
  }, [triggerFetchAllProductionQc]);

  const selectedQcType = Form.useWatch("qc_type", manualForm);
  const selectedReferenceNumber = Form.useWatch("reference_number", manualForm);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchKeyword);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchKeyword]);

  const formOptionsQuery = useGetManualReferenceOptionsQuery(
    {
      qc_type: selectedQcType ?? "production",
      q: debouncedSearch,
      limit: 20,
    },
    { skip: !apiEnabled || !isManualOpen },
  );

  const selectedItem = useMemo(() => {
    const items = formOptionsQuery.data?.data?.items ?? [];
    const selected = String(selectedReferenceNumber ?? "").trim();
    if (!selected) return undefined;
    return items.find((item) =>
      [item.reference_number, item.secondary_reference, item.uniq_code]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .includes(selected),
    );
  }, [formOptionsQuery.data?.data?.items, selectedReferenceNumber]);

  useEffect(() => {
    if (!isManualOpen) return;
    manualForm.setFieldsValue({
      reference_number: undefined,
      uniq_code: undefined,
      number_of_item_check: 0,
      number_of_defect: 0,
      number_of_scrap: 0,
      issue_reason_code: undefined,
      issue_reason_text: undefined,
    });
  }, [manualForm, isManualOpen, selectedQcType]);

  useEffect(() => {
    if (!selectedItem) return;
    manualForm.setFieldsValue({
      uniq_code: selectedItem.uniq_code || undefined,
    });
  }, [manualForm, selectedItem]);

  const overview = overviewQuery.data?.data;
  const cards = overview?.cards;
  const implementationNote = String(overview?.implementation_note ?? "").trim();

  const bySourceRows = useMemo((): Array<
    QcDashboardBySource & { key: string }
  > => {
    const rows = overview?.by_source ?? [];
    return rows.map((row, index) => ({
      ...row,
      key: `${row.defect_source}-${index}`,
    }));
  }, [overview?.by_source]);

  const topIssueRows = useMemo((): Array<
    QcDashboardTopIssue & { key: string }
  > => {
    const rows = overview?.top_issues ?? [];
    return rows.map((row, index) => ({
      ...row,
      key: `${row.reason_code}-${index}`,
    }));
  }, [overview?.top_issues]);

  const activeTable = useMemo(() => {
    if (activeTab === "incoming") return incomingQuery;
    if (activeTab === "product_return") return productReturnQuery;
    if (activeTab === "defects") return defectsQuery;
    if (activeTab === "production") return productionQuery;
    return null;
  }, [
    activeTab,
    defectsQuery,
    incomingQuery,
    productReturnQuery,
    productionQuery,
  ]);

  const tableLoading = Boolean(activeTable?.isFetching);
  const tableError = activeTable?.error;
  const tableRows = (activeTable?.data?.data as unknown[]) ?? [];
  const tablePagination = activeTable?.data?.pagination;

  const openManual = () => {
    manualForm.setFieldsValue({
      qc_type:
        activeTab === "incoming"
          ? "incoming"
          : activeTab === "product_return"
            ? "product_return"
            : "production",
      report_date: dayjs(),
      status: "failed",
      number_of_item_check: 0,
      number_of_defect: 0,
      number_of_scrap: 0,
    });
    setIsManualOpen(true);
  };

  const closeManual = () => {
    setIsManualOpen(false);
    manualForm.resetFields();
  };

  const submitManual = async () => {
    let values: ManualReportFormValues;
    try {
      values = await manualForm.validateFields();
    } catch {
      return;
    }

    if (!selectedItem && !values.reference_number) {
      message.error("Please select a reference number from the list");
      return;
    }

    const payload: CreateQcDashboardReportRequest = {
      qc_type: values.qc_type,
      report_date: values.report_date.format("YYYY-MM-DD"),
      reference_number: values.reference_number || "",
      uniq_code: values.uniq_code || "",
      number_of_item_check: values.number_of_item_check,
      issue_reason_code: values.issue_reason_code || undefined,
      issue_reason_text: values.issue_reason_text || undefined,
      number_of_defect: values.number_of_defect ?? undefined,
      number_of_scrap: values.number_of_scrap ?? undefined,
      status: values.status,
    };

    try {
      await createQcReport(payload).unwrap();
      message.success("QC report created successfully");
      closeManual();
      overviewQuery.refetch();
      if (activeTab === "production") productionQuery.refetch();
      if (activeTab === "incoming") incomingQuery.refetch();
      if (activeTab === "product_return") productReturnQuery.refetch();
      if (activeTab === "defects") defectsQuery.refetch();
    } catch (error) {
      message.error(getApiErrorMessage(error, "Failed to create QC report"));
    }
  };

  const productionColumns = useMemo<ColumnsType<QcDashboardProductionQcItem>>(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      { title: "WO Number", dataIndex: "wo_number", key: "wo_number" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      { title: "Kanban", dataIndex: "kanban_number", key: "kanban_number" },
      {
        title: "Checked",
        dataIndex: "items_checked",
        key: "items_checked",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Issue",
        dataIndex: "issue_label",
        key: "issue_label",
        render: (v, record) => {
          const issues =
            (record as { issues?: QcDashboardProductionQcIssue[] }).issues ?? [];
          const label = v
            ? String(v)
            : issues.length > 0
              ? issues[0].reason_text
              : "-";
          if (issues.length === 0) return label || "-";
          return (
            <Tooltip
              title={
                <div className="space-y-1">
                  {issues.map((it, i) => (
                    <div key={i}>
                      {it.reason_code || it.source || "issue"}
                      {it.reason_text ? `: ${it.reason_text}` : ""} (Qty:{" "}
                      {it.qty || it.qty_defect || it.qty_scrap})
                    </div>
                  ))}
                </div>
              }
            >
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {label || "-"}
                {issues.length > 1 ? ` +${issues.length - 1}` : ""}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Quality %",
        dataIndex: "quality_rate_percent",
        key: "quality_rate_percent",
        align: "right",
        render: (v) => `${formatNumber(v)}%`,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        fixed: "right",
        render: (v) => (
          <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>
        ),
      },
      {
        title: "Detail",
        key: "detail",
        fixed: "right",
        width: 90,
        render: (_v, record) => (
          <Button
            type="link"
            size="small"
            className="!px-0"
            onClick={() =>
              router.push(`/qc-dashboard/production/${record.qc_log_id}`)
            }
          >
            Detail
          </Button>
        ),
      },
      {
        title: "Report",
        key: "report",
        fixed: "right",
        width: 110,
        render: (_v, record) => (
          <Tooltip title="Print / Save as PDF: Quality Check List per fase (semua uniq dengan WO Number yang sama)">
            <Button
              type="link"
              size="small"
              className="!px-0"
              icon={<DownloadOutlined />}
              loading={fetchAllProductionQcState.isFetching}
              onClick={() => handleDownloadFaseReport(record)}
            >
              PDF
            </Button>
          </Tooltip>
        ),
      },
    ],
    [
      router,
      handleDownloadFaseReport,
      fetchAllProductionQcState.isFetching,
    ],
  );

  const incomingColumns = useMemo<ColumnsType<QcDashboardIncomingQcItem>>(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      { title: "DN Number", dataIndex: "dn_number", key: "dn_number" },
      { title: "PO Number", dataIndex: "po_number", key: "po_number" },
      { title: "Supplier", dataIndex: "supplier_name", key: "supplier_name" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      {
        title: "Checked",
        dataIndex: "items_checked",
        key: "items_checked",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Issue",
        dataIndex: "issue_label",
        key: "issue_label",
        render: (v, record) => {
          const issues =
            (record as { issues?: QcDashboardProductionQcIssue[] }).issues ?? [];
          const label = v
            ? String(v)
            : issues.length > 0
              ? issues[0].reason_text
              : "-";
          if (issues.length === 0) return label || "-";
          return (
            <Tooltip
              title={
                <div className="space-y-1">
                  {issues.map((it, i) => (
                    <div key={i}>
                      {it.reason_code || it.source || "issue"}
                      {it.reason_text ? `: ${it.reason_text}` : ""} (Qty:{" "}
                      {it.qty || it.qty_defect || it.qty_scrap})
                    </div>
                  ))}
                </div>
              }
            >
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {label || "-"}
                {issues.length > 1 ? ` +${issues.length - 1}` : ""}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Quality %",
        dataIndex: "quality_rate_percent",
        key: "quality_rate_percent",
        align: "right",
        render: (v) => `${formatNumber(v)}%`,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        fixed: "right",
        render: (v) => (
          <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>
        ),
      },
    ],
    [],
  );

  const productReturnColumns = useMemo<
    ColumnsType<QcDashboardProductReturnQcItem>
  >(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      {
        title: "Product Return",
        dataIndex: "product_return_number",
        key: "product_return_number",
      },
      { title: "DN Number", dataIndex: "dn_number", key: "dn_number" },
      {
        title: "Partner Type",
        dataIndex: "partner_type",
        key: "partner_type",
        render: (v) => (v ? String(v) : "-"),
      },
      { title: "Partner", dataIndex: "partner_name", key: "partner_name" },
      {
        title: "Checked",
        dataIndex: "items_checked",
        key: "items_checked",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Issue",
        dataIndex: "issue_label",
        key: "issue_label",
        render: (v, record) => {
          const issues =
            (record as { issues?: QcDashboardProductionQcIssue[] }).issues ?? [];
          const label = v
            ? String(v)
            : issues.length > 0
              ? issues[0].reason_text
              : "-";
          if (issues.length === 0) return label || "-";
          return (
            <Tooltip
              title={
                <div className="space-y-1">
                  {issues.map((it, i) => (
                    <div key={i}>
                      {it.reason_code || it.source || "issue"}
                      {it.reason_text ? `: ${it.reason_text}` : ""} (Qty:{" "}
                      {it.qty || it.qty_defect || it.qty_scrap})
                    </div>
                  ))}
                </div>
              }
            >
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                {label || "-"}
                {issues.length > 1 ? ` +${issues.length - 1}` : ""}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: "Rework",
        dataIndex: "qty_rework",
        key: "qty_rework",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Quality %",
        dataIndex: "quality_rate_percent",
        key: "quality_rate_percent",
        align: "right",
        render: (v) => `${formatNumber(v)}%`,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        fixed: "right",
        render: (v) => (
          <Tag color={statusColor(String(v ?? ""))}>{String(v ?? "-")}</Tag>
        ),
      },
    ],
    [],
  );

  const defectColumns = useMemo<ColumnsType<QcDashboardDefectItem>>(
    () => [
      {
        title: "Report Date",
        dataIndex: "report_date",
        key: "report_date",
        render: (v) => formatDate(String(v ?? "")),
      },
      { title: "Source", dataIndex: "defect_source", key: "defect_source" },
      { title: "Kanban/PL", dataIndex: "kanban_pl", key: "kanban_pl" },
      { title: "UNIQ", dataIndex: "uniq_code", key: "uniq_code" },
      { title: "Product", dataIndex: "product_name", key: "product_name" },
      { title: "Reason", dataIndex: "reason_text", key: "reason_text" },
      {
        title: "Defect",
        dataIndex: "qty_defect",
        key: "qty_defect",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Scrap",
        dataIndex: "qty_scrap",
        key: "qty_scrap",
        align: "right",
        render: (v) => formatNumber(v),
      },
      {
        title: "Repairable",
        dataIndex: "is_repairable",
        key: "is_repairable",
        render: (v) => (
          <Tag color={v ? "blue" : "default"}>{v ? "Yes" : "No"}</Tag>
        ),
      },
      {
        title: "Rework Status",
        dataIndex: "wo_rework_status",
        key: "wo_rework_status",
      },
    ],
    [],
  );

  const columns = useMemo(() => {
    if (activeTab === "incoming") return incomingColumns as ColumnsType<object>;
    if (activeTab === "product_return")
      return productReturnColumns as ColumnsType<object>;
    if (activeTab === "defects") return defectColumns as ColumnsType<object>;
    return productionColumns as ColumnsType<object>;
  }, [
    activeTab,
    defectColumns,
    incomingColumns,
    productReturnColumns,
    productionColumns,
  ]);

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    const matchesKeyword = (row: any) => {
      if (!keyword) return true;
      if (activeTab === "production") {
        return [
          row.wo_number,
          row.uniq_code,
          row.kanban_number,
          row.issue_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "incoming") {
        return [
          row.dn_number,
          row.po_number,
          row.supplier_name,
          row.uniq_code,
          row.issue_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "product_return") {
        return [
          row.product_return_number,
          row.dn_number,
          row.partner_type,
          row.partner_name,
          row.issue_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      if (activeTab === "defects") {
        return [
          row.defect_source,
          row.kanban_pl,
          row.uniq_code,
          row.product_name,
          row.reason_text,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      }
      return true;
    };

    const matchesStatus = (row: any) => {
      if (statusFilter === "all") return true;
      const status = String(row.status ?? "").toLowerCase();
      return status.includes(statusFilter);
    };

    return (tableRows as any[]).filter(
      (row) => matchesKeyword(row) && matchesStatus(row),
    );
  }, [activeTab, searchText, statusFilter, tableRows]);

  const onExport = () => {
    const timestamp = dayjs().format("YYYYMMDD-HHmmss");

    if (activeTab === "production") {
      const headers = [
        "report_date",
        "wo_number",
        "uniq_code",
        "kanban_number",
        "items_checked",
        "issue_label",
        "qty_defect",
        "qty_scrap",
        "quality_rate_percent",
        "status",
      ];
      downloadCsv(
        `production-qc-${timestamp}.csv`,
        headers,
        filteredRows as any,
      );
      return;
    }
    if (activeTab === "incoming") {
      const headers = [
        "report_date",
        "dn_number",
        "po_number",
        "supplier_name",
        "uniq_code",
        "items_checked",
        "issue_label",
        "qty_defect",
        "qty_scrap",
        "quality_rate_percent",
        "status",
      ];
      downloadCsv(`incoming-qc-${timestamp}.csv`, headers, filteredRows as any);
      return;
    }
    if (activeTab === "product_return") {
      const headers = [
        "report_date",
        "product_return_number",
        "dn_number",
        "partner_type",
        "partner_name",
        "items_checked",
        "issue_label",
        "qty_rework",
        "qty_defect",
        "qty_scrap",
        "quality_rate_percent",
        "status",
      ];
      downloadCsv(
        `product-return-qc-${timestamp}.csv`,
        headers,
        filteredRows as any,
      );
      return;
    }
    const headers = [
      "report_date",
      "defect_source",
      "kanban_pl",
      "uniq_code",
      "product_name",
      "reason_text",
      "qty_defect",
      "qty_scrap",
      "is_repairable",
      "wo_rework_status",
    ];
    downloadCsv(`defects-${timestamp}.csv`, headers, filteredRows as any);
  };

  return (
    <div className="min-h-full bg-[#f5f7fb] p-6">
      <div className="mb-5">
        <div className="text-xl font-semibold text-gray-900">QC Dashboard</div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
          <span>{dayjs().format("dddd, MMMM D, YYYY")}</span>
          <span className="mx-1">•</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span>System Online</span>
          </span>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-gray-900">
              QC Dashboard
            </div>
            <div className="text-sm text-gray-500">
              Quality Control monitoring for production, incoming materials,
              product returns, and defect tracking
            </div>
          </div>

          <Space>
            <Button
              icon={<FileTextOutlined />}
              onClick={handleGenerateMonthlyReport}
              loading={fetchAllProductionQcState.isFetching}
            >
              Monthly Report
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openManual}>
              Add QC Report
            </Button>
          </Space>
        </div>

        {!apiEnabled ? (
          <Alert
            type="warning"
            showIcon
            message="QC Dashboard API is not configured (NEXT_PUBLIC_API_URL)."
            className="mt-4"
          />
        ) : null}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Reports"
          value={cards?.total_reports ?? 0}
          icon={<FileTextOutlined className="text-xl" />}
          bgColor="bg-blue-50"
          textColor="text-blue-600"
          subtitle={
            overview?.as_of ? `As of ${formatDate(overview.as_of)}` : undefined
          }
        />
        <StatsCard
          title="Total Defects"
          value={cards?.total_defects ?? 0}
          icon={<BugOutlined className="text-xl" />}
          bgColor="bg-red-50"
          textColor="text-red-600"
        />
        <StatsCard
          title="Total Scrap"
          value={cards?.total_scrap ?? 0}
          icon={<DeleteOutlined className="text-xl" />}
          bgColor="bg-orange-50"
          textColor="text-orange-600"
        />
        <StatsCard
          title="Pending Rework"
          value={cards?.pending_rework ?? 0}
          icon={<ClockCircleOutlined className="text-xl" />}
          bgColor="bg-yellow-50"
          textColor="text-yellow-700"
        />
      </div>

      {implementationNote ? (
        <Alert
          type="info"
          showIcon
          icon={<ExclamationCircleOutlined />}
          message={implementationNote}
          className="mb-6"
        />
      ) : null}

      {/* <div className="mb-6">
        <Collapse
          size="small"
          items={[
            {
              key: "analytics",
              label: "Analytics",
              children: (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-gray-900">By Source</div>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={bySourceRows}
                      rowKey="key"
                      columns={[
                        { title: "Source", dataIndex: "defect_source", key: "defect_source" },
                        {
                          title: "Defect",
                          dataIndex: "qty_defect",
                          key: "qty_defect",
                          align: "right",
                          render: (v) => formatNumber(v),
                        },
                        {
                          title: "Scrap",
                          dataIndex: "qty_scrap",
                          key: "qty_scrap",
                          align: "right",
                          render: (v) => formatNumber(v),
                        },
                      ]}
                      loading={overviewQuery.isFetching}
                      locale={{ emptyText: "No data" }}
                    />
                  </div>

                  <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-3 text-sm font-semibold text-gray-900">Top Issues</div>
                    <Table
                      size="small"
                      pagination={false}
                      dataSource={topIssueRows}
                      rowKey="key"
                      columns={[
                        { title: "Code", dataIndex: "reason_code", key: "reason_code" },
                        { title: "Reason", dataIndex: "reason_text", key: "reason_text" },
                        {
                          title: "Defect",
                          dataIndex: "qty_defect",
                          key: "qty_defect",
                          align: "right",
                          render: (v) => formatNumber(v),
                        },
                      ]}
                      loading={overviewQuery.isFetching}
                      locale={{ emptyText: "No data" }}
                    />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </div> */}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="px-5 pt-5">
          <div className="mb-4 rounded-xl bg-gray-50 p-1">
            <Segmented
              block
              value={activeTab}
              onChange={(v) => {
                setActiveTab(v as UiTabId);
                setSearchText("");
                setStatusFilter("all");
              }}
              options={[
                { label: "Production QC", value: "production" },
                { label: "Incoming QC", value: "incoming" },
                { label: "Product Return", value: "product_return" },
                { label: "Defect Report", value: "defects" },
              ]}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
            <Input
              allowClear
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Search by WO, PO, Uniq, or Supplier..."
              className="max-w-lg"
            />

            <Space size={10}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 140 }}
                options={[
                  { label: "All Status", value: "all" },
                  { label: "Passed", value: "pass" },
                  { label: "Not Passed", value: "not_pass" },
                  { label: "Failed", value: "fail" },
                  { label: "Pending", value: "pending" },
                ]}
                disabled={activeTab === "defects"}
              />
              <Button icon={<DownloadOutlined />} onClick={onExport}>
                Export
              </Button>
            </Space>
          </div>
        </div>

        <div className="px-5 pb-5">
          {tableError ? (
            <Alert
              type="error"
              showIcon
              message={getApiErrorMessage(
                tableError,
                "Failed to load QC reports",
              )}
              className="mb-4"
            />
          ) : null}

          <Table
            columns={columns}
            dataSource={filteredRows as object[]}
            loading={tableLoading}
            rowKey={(row) => {
              const r = row as any;
              return String(
                r.qc_log_id ??
                  r.product_return_id ??
                  r.defect_id ??
                  r.id ??
                  "row",
              );
            }}
            scroll={{ x: 1200 }}
            pagination={{
              current: tablePagination?.page ?? pagination[activeTab].page,
              pageSize: tablePagination?.perPage ?? pagination[activeTab].limit,
              total: tablePagination?.total ?? 0,
              showSizeChanger: true,
              pageSizeOptions: ["10", "20", "50", "100"],
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} items`,
              onChange: (page, pageSize) => {
                const tab = activeTab;
                setPagination((prev) => ({
                  ...prev,
                  [tab]: { page, limit: pageSize ?? prev[tab].limit },
                }));
              },
              onShowSizeChange: (_current, size) => {
                const tab = activeTab;
                setPagination((prev) => ({
                  ...prev,
                  [tab]: { page: 1, limit: size },
                }));
              },
            }}
            locale={{ emptyText: "No records" }}
            className="overflow-hidden rounded-xl"
          />

          <div className="mt-2 text-xs text-gray-500">
            Window: {overview?.window_hours ?? 0} hours
          </div>
        </div>
      </div>

      <Modal
        open={isManualOpen}
        onCancel={closeManual}
        onOk={submitManual}
        okText="Submit"
        confirmLoading={createQcReportState.isLoading}
        width={720}
        destroyOnHidden
        title={
          <div className="text-lg font-semibold text-gray-900">
            Create QC Report
          </div>
        }>
        <Form<ManualReportFormValues>
          form={manualForm}
          layout="vertical"
          requiredMark={false}
          preserve={false}
          className="pt-2">
          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item
              label="QC Type"
              name="qc_type"
              initialValue="production"
              rules={[{ required: true, message: "Select QC type" }]}>
              <Segmented
                options={[
                  { label: "Production", value: "production" },
                  { label: "Incoming", value: "incoming" },
                  { label: "Product Return", value: "product_return" },
                ]}
              />
            </Form.Item>

            <Form.Item
              label="Report Date"
              name="report_date"
              rules={[{ required: true, message: "Select report date" }]}>
              <DatePicker className="w-full" format="YYYY-MM-DD" />
            </Form.Item>

            <Form.Item
              label={getReferenceLabel(selectedQcType)}
              name="reference_number"
              rules={[
                {
                  required: true,
                  message: "Select or search reference number",
                },
              ]}
              className="md:col-span-2">
              <Select
                showSearch
                placeholder={getReferencePlaceholder(selectedQcType)}
                onSearch={(value) => {
                  setSearchKeyword(value);
                }}
                onChange={(value, option) => {
                  const item = (option as any)?.record;
                  if (item) {
                    manualForm.setFieldsValue({
                      reference_number: value,
                      uniq_code: item.uniq_code || "",
                    });
                  }
                }}
                onClear={() => {
                  setSearchKeyword("");
                  manualForm.setFieldsValue({
                    reference_number: undefined,
                    uniq_code: undefined,
                  });
                }}
                loading={formOptionsQuery.isFetching}
                filterOption={(input, option) => {
                  const item = (option as any)?.record;
                  const searchText = input.toLowerCase();
                  return (
                    (item?.reference_number?.toLowerCase() ?? "").includes(
                      searchText,
                    ) ||
                    (item?.uniq_code?.toLowerCase() ?? "").includes(
                      searchText,
                    ) ||
                    (item?.part_name?.toLowerCase() ?? "").includes(searchText)
                  );
                }}
                notFoundContent={
                  formOptionsQuery.isFetching
                    ? "Loading..."
                    : "No results found"
                }
                allowClear
                options={formOptionsQuery.data?.data?.items?.map(
                  (item: ManualReferenceOptionItem) => ({
                    value: item.reference_number,
                    label: item.reference_number,
                    record: item,
                  }),
                )}
              />
            </Form.Item>

            <Form.Item
              label="UNIQ Code"
              name="uniq_code"
              rules={[
                {
                  required: true,
                  message: "UNIQ will be filled automatically",
                },
              ]}>
              <Input
                placeholder="Auto-filled from selected reference"
                disabled
              />
            </Form.Item>

            <Form.Item
              label="Items Checked"
              name="number_of_item_check"
              rules={[{ required: true, message: "Enter items checked" }]}>
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item
              label="Status"
              name="status"
              rules={[{ required: true, message: "Select status" }]}>
              <Segmented
                options={[
                  { label: "Passed", value: "passed" },
                  { label: "Not Passed", value: "not_passed" },
                  { label: "Failed", value: "failed" },
                ]}
              />
            </Form.Item>

            <Form.Item label="Issue Reason Code" name="issue_reason_code">
              <Input placeholder="e.g., SURFACE_DEFECT" />
            </Form.Item>

            <Form.Item label="Issue Reason Text" name="issue_reason_text">
              <Input placeholder="e.g., Scratch, Dent, etc." />
            </Form.Item>

            <Form.Item label="Number of Defect" name="number_of_defect">
              <InputNumber className="w-full" min={0} />
            </Form.Item>

            <Form.Item label="Number of Scrap" name="number_of_scrap">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
