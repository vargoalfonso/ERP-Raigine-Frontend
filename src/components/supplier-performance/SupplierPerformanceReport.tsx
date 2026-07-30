"use client";

import { useMemo, useRef } from "react";
import { Button, Modal, message } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import type { SupplierPerformanceRow } from "@/lib/api/suppliers/performance";

// Ganti dua konstanta ini sesuai kop surat perusahaan Anda.
const COMPANY_NAME = "PT. MATRA RODA PIRANTI";
const COMPANY_DEPT = "Departemen Logistik (PPIC)";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

const idn = (v: number, digits = 0): string =>
  v.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });

const pct = (v: number): string => `${Math.round(v)}%`;

const escapeHtml = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const fmtDateId = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")} ${MONTHS_ID[d.getMonth()]} ${d.getFullYear()}`;

// Mengubah evaluation_period_value menjadi rentang tanggal yang bisa dibaca,
// mengikuti format acuan: "01 Juni 2026 s/d 30 Juni 2026".
const periodRangeLabel = (type?: string, value?: string): string => {
  const v = (value ?? "").trim();
  if (!v) return "-";

  const monthly = v.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    const y = Number(monthly[1]);
    const m = Number(monthly[2]) - 1;
    return `${fmtDateId(new Date(y, m, 1))} s/d ${fmtDateId(new Date(y, m + 1, 0))}`;
  }

  const quarterly = v.match(/^(\d{4})-Q([1-4])$/i);
  if (quarterly) {
    const y = Number(quarterly[1]);
    const startMonth = (Number(quarterly[2]) - 1) * 3;
    return `${fmtDateId(new Date(y, startMonth, 1))} s/d ${fmtDateId(new Date(y, startMonth + 3, 0))}`;
  }

  const yearly = v.match(/^(\d{4})$/);
  if (yearly) {
    const y = Number(yearly[1]);
    return `${fmtDateId(new Date(y, 0, 1))} s/d ${fmtDateId(new Date(y, 11, 31))}`;
  }

  const specific = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (specific) {
    return fmtDateId(new Date(Number(specific[1]), Number(specific[2]) - 1, Number(specific[3])));
  }

  return `${v}${type ? ` (${type})` : ""}`;
};

const kpiCard = (label: string, value: string, note?: string): string => `
  <div class="kpi">
    <div class="kpi-label">${escapeHtml(label)}</div>
    <div class="kpi-value">${escapeHtml(value)}</div>
    ${note ? `<div class="kpi-note">${escapeHtml(note)}</div>` : ""}
  </div>`;

const countCard = (label: string, value: string, tone: string): string => `
  <div class="count count-${tone}">
    <div class="count-label">${escapeHtml(label)}</div>
    <div class="count-value">${escapeHtml(value)}</div>
  </div>`;

const bar = (label: string, value: number, color: string): string => {
  const width = Math.max(0, Math.min(100, value));
  return `
  <div class="bar-row">
    <div class="bar-head">
      <span>${escapeHtml(label)}</span>
      <span class="bar-val">${pct(value)}</span>
    </div>
    <div class="bar-track">
      <div class="bar-fill" style="width:${width}%;background:${color}"></div>
    </div>
  </div>`;
};

const summaryCell = (label: string, value: string, tone: string): string => `
  <div class="sum sum-${tone}">
    <div class="sum-label">${escapeHtml(label)}</div>
    <div class="sum-value">${escapeHtml(value)}</div>
  </div>`;

export type BuildReportArgs = {
  row: SupplierPerformanceRow;
  periodType?: string;
  periodValue?: string;
};

export const buildSupplierReportHtml = ({ row, periodType, periodValue }: BuildReportArgs): string => {
  const otd = num(row.otd_percentage);
  const quality = num(row.quality_percentage);
  const accepted = num(row.accepted_quantity);
  const rejected = num(row.rejected_quantity);
  const inspected = num(row.inspected_quantity);
  const totalDeliveries = num(row.total_deliveries);
  const onTime = num(row.on_time_deliveries);
  const late = num(row.late_deliveries);
  const avgDelay = num(row.average_delay_days);
  const inspectionCount = num(row.quality_inspection_count);
  const purchaseValue = num(row.total_purchase_value);

  // Skor komposit memakai formula yang sama dengan backend:
  // (quality_percentage * 0.5) + (otd_percentage * 0.5)
  const score = quality * 0.5 + otd * 0.5;

  // Fulfillment memakai accepted/inspected karena snapshot TIDAK menyimpan
  // ordered_qty. Ini bukan fulfillment terhadap PO, melainkan terhadap qty
  // yang diperiksa. Labelnya dibuat eksplisit supaya tidak menyesatkan.
  const fulfillment = inspected > 0 ? (accepted / inspected) * 100 : 0;

  const stars = Math.max(0, Math.min(5, Math.round(score / 20)));
  const starText = `${"\u2605".repeat(stars)}${"\u2606".repeat(5 - stars)}`;

  const gradeTone = score >= 90 ? "good" : score >= 80 ? "mid" : "bad";
  const periodText = periodRangeLabel(periodType ?? row.evaluation_period_type, periodValue ?? row.evaluation_period_value);
  const printedAt = fmtDateId(new Date());

  const flags = Array.isArray(row.flags) ? row.flags.filter(Boolean) : [];

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Laporan Rekap Supplier - ${escapeHtml(row.supplier_name)}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 18px;
    background: #f8fafc;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
    color: #0f172a;
    font-size: 12px;
  }
  .sheet { background: #fff; border-radius: 10px; padding: 20px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #0f172a; padding-bottom: 10px; }
  .co-name { font-size: 14px; font-weight: 700; letter-spacing: .2px; }
  .co-dept { font-size: 11px; color: #64748b; margin-top: 2px; }
  .doc-title { font-size: 15px; font-weight: 800; color: #1e3a8a; text-align: right; }
  .doc-meta { font-size: 10px; color: #64748b; text-align: right; margin-top: 3px; }
  h2.section { font-size: 13px; margin: 18px 0 10px; display: flex; align-items: center; gap: 6px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .kpi { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; }
  .kpi-label { font-size: 8.5px; letter-spacing: .6px; color: #64748b; text-transform: uppercase; }
  .kpi-value { font-size: 17px; font-weight: 700; margin-top: 4px; }
  .kpi-note { font-size: 8.5px; color: #94a3b8; margin-top: 2px; }
  .panel { border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; margin-top: 14px; }
  .sup-head { display: flex; justify-content: space-between; align-items: flex-start; }
  .sup-name { font-size: 13px; font-weight: 700; }
  .sup-sub { font-size: 10px; color: #64748b; margin-top: 2px; }
  .chip { display: inline-block; font-size: 8.5px; letter-spacing: .5px; text-transform: uppercase;
          background: #eef2ff; color: #3730a3; border-radius: 4px; padding: 2px 6px; margin-left: 6px; }
  .rating { border-radius: 999px; padding: 5px 12px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .rating.good { background: #dcfce7; color: #166534; }
  .rating.mid  { background: #dbeafe; color: #1e40af; }
  .rating.bad  { background: #fee2e2; color: #991b1b; }
  .count-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
  .count { border-radius: 8px; padding: 10px; text-align: center; border: 1px solid transparent; }
  .count-label { font-size: 8.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
  .count-value { font-size: 17px; font-weight: 700; margin-top: 4px; color: #0f172a; }
  .count-blue   { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  .count-green  { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  .count-red    { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  .count-amber  { background: #fffbeb; border-color: #fde68a; color: #b45309; }
  .count-violet { background: #f5f3ff; border-color: #ddd6fe; color: #6d28d9; }
  .count-slate  { background: #f8fafc; border-color: #e2e8f0; color: #475569; }
  .sub { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin-top: 12px; }
  .sub-title { font-size: 11.5px; font-weight: 700; margin-bottom: 10px; }
  .bar-row { margin-bottom: 9px; }
  .bar-head { display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 3px; }
  .bar-val { font-weight: 700; }
  .bar-track { height: 7px; background: #eef2f7; border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 999px; }
  .sum-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .sum { border-radius: 8px; padding: 10px 12px; border: 1px solid transparent; }
  .sum-label { font-size: 8.5px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; }
  .sum-value { font-size: 16px; font-weight: 700; margin-top: 3px; color: #0f172a; }
  .sum-blue  { background: #eff6ff; border-color: #bfdbfe; color: #1d4ed8; }
  .sum-green { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
  .sum-amber { background: #fffbeb; border-color: #fde68a; color: #b45309; }
  .sum-red   { background: #fef2f2; border-color: #fecaca; color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 8px; font-size: 10.5px; }
  th { background: #f1f5f9; text-align: left; font-weight: 700; }
  td.right { text-align: right; }
  .note { border: 1px dashed #cbd5e1; background: #f8fafc; border-radius: 8px;
          padding: 12px; margin-top: 12px; font-size: 10.5px; color: #475569; }
  .note b { color: #0f172a; }
  .note ul { margin: 6px 0 0 16px; padding: 0; }
  .flags { margin-top: 10px; font-size: 10px; color: #b45309; }
  .foot { margin-top: 14px; border-top: 1px solid #e2e8f0; padding-top: 8px;
          font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5px; }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { border-radius: 0; padding: 0; }
    .panel, .sub, .kpi, .count, .sum { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="sheet">

  <div class="head">
    <div>
      <div class="co-name">${escapeHtml(COMPANY_NAME)}</div>
      <div class="co-dept">${escapeHtml(COMPANY_DEPT)}</div>
    </div>
    <div>
      <div class="doc-title">LAPORAN REKAP SUPPLIER/PO</div>
      <div class="doc-meta">Periode: ${escapeHtml(periodText)}</div>
      <div class="doc-meta">Print Date: ${escapeHtml(printedAt)}</div>
    </div>
  </div>

  <h2 class="section">Report Rekap Supplier/PO</h2>

  <div class="kpi-grid">
    ${kpiCard("Total Score", pct(score), "quality 50% + OTD 50%")}
    ${kpiCard("Ketepatan Waktu", pct(otd), `${idn(onTime)} dari ${idn(totalDeliveries)} kirim`)}
    ${kpiCard("Qty Diterima / Diperiksa", pct(fulfillment), `${idn(accepted)} dari ${idn(inspected)}`)}
    ${kpiCard("QC + Line Claim", pct(quality), `reject ${idn(rejected)}`)}
  </div>

  <div class="panel">
    <div class="sup-head">
      <div>
        <div class="sup-name">${escapeHtml(row.supplier_name)}<span class="chip">${escapeHtml(
          row.evaluation_period_type ?? periodType ?? "-"
        )}</span></div>
        <div class="sup-sub">${escapeHtml(row.supplier_code)} &middot; Periode ${escapeHtml(periodText)}</div>
      </div>
      <div class="rating ${gradeTone}">${starText} &nbsp;${escapeHtml(row.status_label ?? row.performance_grade ?? "-")}</div>
    </div>

    <div class="count-grid">
      ${countCard("Total Delivery", idn(totalDeliveries), "blue")}
      ${countCard("On Time", idn(onTime), "green")}
      ${countCard("Late", idn(late), "red")}
      ${countCard("Avg Delay (hari)", idn(avgDelay, 1), "amber")}
      ${countCard("QC Inspection", idn(inspectionCount), "violet")}
      ${countCard("Accepted Qty", idn(accepted), "green")}
      ${countCard("Rejected Qty", idn(rejected), "red")}
      ${countCard("Grade", escapeHtml(row.performance_grade ?? "-"), "slate")}
    </div>

    <div class="sub">
      <div class="sub-title">Ringkasan Skor Periode ${escapeHtml(
        periodValue ?? row.evaluation_period_value ?? "-"
      )}</div>
      ${bar("Score", score, "#6366f1")}
      ${bar("Tepat Waktu", otd, "#22c55e")}
      ${bar("Qty Diterima / Diperiksa", fulfillment, "#3b82f6")}
      ${bar("Quality (QC)", quality, "#0ea5e9")}
    </div>

    <div class="sub">
      <div class="sub-title">Ringkasan Pengiriman &amp; QC</div>
      <div class="sum-grid">
        ${summaryCell("Total Delivery", idn(totalDeliveries), "blue")}
        ${summaryCell("On Time", idn(onTime), "green")}
        ${summaryCell("Late", idn(late), "amber")}
        ${summaryCell("Rejected / Selisih", idn(rejected), "red")}
        ${summaryCell("Qty Diperiksa", idn(inspected), "blue")}
        ${summaryCell("Qty Diterima", idn(accepted), "green")}
      </div>
    </div>

    <div class="sub">
      <div class="sub-title">Detail Evaluasi</div>
      <table>
        <tbody>
          <tr><th style="width:38%">Supplier Code</th><td>${escapeHtml(row.supplier_code)}</td></tr>
          <tr><th>Supplier Name</th><td>${escapeHtml(row.supplier_name)}</td></tr>
          <tr><th>Evaluation Period</th><td>${escapeHtml(
            row.evaluation_period_type ?? "-"
          )} &middot; ${escapeHtml(row.evaluation_period_value ?? "-")}</td></tr>
          <tr><th>Evaluation Date</th><td>${escapeHtml(row.evaluation_date ?? "-")}</td></tr>
          <tr><th>Total Purchase Value</th><td class="right">${idn(purchaseValue, 2)}</td></tr>
          <tr><th>OTD %</th><td class="right">${pct(otd)}</td></tr>
          <tr><th>Quality %</th><td class="right">${pct(quality)}</td></tr>
          <tr><th>Total Score</th><td class="right">${pct(score)}</td></tr>
          <tr><th>Performance Grade</th><td>${escapeHtml(row.performance_grade ?? "-")}${
            row.is_grade_overridden ? " (manual override)" : ""
          }</td></tr>
          <tr><th>Review Required</th><td>${row.supplier_review_required ? "Ya" : "Tidak"}</td></tr>
          <tr><th>Logic Version</th><td>${escapeHtml(row.logic_version ?? "-")}</td></tr>
        </tbody>
      </table>
      ${flags.length ? `<div class="flags">Flags: ${escapeHtml(flags.join(", "))}</div>` : ""}
    </div>

    <div class="sub">
      <div class="sub-title">Formula Perhitungan</div>
      <table>
        <tbody>
          <tr><th style="width:38%">OTD</th><td class="mono">${escapeHtml(row.formula_otd ?? "-")}</td></tr>
          <tr><th>Quality</th><td class="mono">${escapeHtml(row.formula_quality ?? "-")}</td></tr>
          <tr><th>Grade</th><td class="mono">${escapeHtml(row.formula_grade ?? "-")}</td></tr>
          ${row.formula_notes ? `<tr><th>Notes</th><td>${escapeHtml(row.formula_notes)}</td></tr>` : ""}
        </tbody>
      </table>
    </div>

    <div class="note">
      <b>Belum tersedia: Detail Jadwal Performa dan Detail DN/SJ per baris.</b>
      <ul>
        <li>Kolom <b>Tgl Rencana</b> dan status On Time / Late / Late Completion / Partial /
            Too Early butuh jadwal kedatangan per PO + item. Tabel jadwal sisi supplier belum ada
            di database (yang ada hanya delivery_schedules_customer, arah keluar ke customer),
            dan purchase_order_items tidak punya kolom tanggal.</li>
        <li>Kolom <b>expected_delivery_date</b> pada purchase_orders sudah dihapus oleh
            migration 0028, jadi tidak bisa dipakai sebagai tanggal rencana.</li>
        <li>Angka di laporan ini diambil dari supplier_performance_snapshots, yaitu hasil
            agregat per periode. Rincian per PO dan per DN belum masuk ke snapshot.</li>
      </ul>
    </div>
  </div>

  <div class="foot">
    <span>${escapeHtml(COMPANY_NAME)} &middot; ${escapeHtml(COMPANY_DEPT)}</span>
    <span>Dicetak ${escapeHtml(printedAt)}</span>
  </div>

</div>
</body>
</html>`;
};

export type SupplierPerformanceReportModalProps = {
  open: boolean;
  row: SupplierPerformanceRow | null;
  periodType?: string;
  periodValue?: string;
  onClose: () => void;
};

export default function SupplierPerformanceReportModal({
  open,
  row,
  periodType,
  periodValue,
  onClose,
}: SupplierPerformanceReportModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const html = useMemo(
    () => (row ? buildSupplierReportHtml({ row, periodType, periodValue }) : ""),
    [row, periodType, periodValue]
  );

  // Laporan dirender di dalam iframe srcDoc (same-origin), jadi contentWindow.print()
  // bisa dipanggil langsung dan hasil cetaknya identik dengan yang tampil di layar.
  // Ini juga menghindari window.open(..., "noopener") yang mengembalikan null.
  const handlePrint = () => {
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) {
      message.error("Preview laporan belum siap. Coba lagi sesaat.");
      return;
    }

    try {
      frameWindow.focus();
      frameWindow.print();
    } catch {
      message.error("Gagal membuka dialog print.");
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={980}
      title={
        <div>
          <div className="font-semibold">Detail Performa Supplier</div>
          <div className="text-xs text-gray-500">
            {row ? `${row.supplier_name} (${row.supplier_code})` : "-"}
          </div>
        </div>
      }
      footer={[
        <Button key="close" onClick={onClose}>
          Tutup
        </Button>,
        <Button key="print" type="primary" icon={<PrinterOutlined />} onClick={handlePrint}>
          Print / Simpan PDF
        </Button>,
      ]}
    >
      {row ? (
        <iframe
          ref={iframeRef}
          title="Laporan Rekap Supplier"
          srcDoc={html}
          style={{
            width: "100%",
            height: "68vh",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#fff",
          }}
        />
      ) : null}
    </Modal>
  );
}
