"use client";

/**
 * WORK ORDER PRODUKSI PER LINE
 *
 * Laporan cetak work order dikelompokkan per production line + tanggal +
 * plant/location (1 sheet per grup), mengikuti format PDF acuan.
 *
 * Laporan dibangun sebagai satu dokumen HTML utuh (CSS inline) lalu dirender
 * di dalam <iframe srcDoc>. Alasannya:
 *  1. CSS-nya mandiri, tidak bergantung Tailwind, sehingga hasil cetak tidak rusak.
 *  2. Menghindari window.open(..., "noopener") yang mengembalikan null.
 *  3. Yang tampil di layar dan yang tercetak berasal dari string HTML yang sama.
 *
 * Sumber data: BOM tree yang sudah dimuat halaman work-orders (process_routes
 * untuk machine/cycle time, children + quantity untuk daftar material).
 * Tidak ada endpoint backend baru.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Modal, Table, Tag, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { PrinterOutlined } from "@ant-design/icons";

/* Ganti dua konstanta ini sesuai kop surat perusahaan Anda. */
const COMPANY_NAME = "PT. MATRA RODA PIRANTI";
const COMPANY_DEPT = "Production Planning & Control";
const DOC_TITLE = "WORK ORDER PRODUKSI PER LINE";
const INSTRUCTION_TEXT =
  "Issue material by FIFO lot according to system recommendation.";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null;

const pickString = (...values: unknown[]): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
};

const pickNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/** Format angka gaya id-ID (1.000 / 135,20) seperti di PDF acuan. */
const idn = (value: number): string => {
  if (!Number.isFinite(value)) return "-";
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

/** Cycle time detik -> "22,20 s". */
const secText = (value: number): string => `${idn(value)} s`;

/** Total detik -> "44m 40s" / "1j 51m" / "-". */
const durationText = (totalSeconds: number): string => {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "-";
  const total = Math.round(totalSeconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}j ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
};

/* ------------------------------------------------------------------ *
 * Index detail dari BOM tree
 * ------------------------------------------------------------------ */

export type BomMaterialLine = {
  code: string;
  name: string;
  qtyPerUniq: number;
  uom: string;
};

export type BomRouteLine = {
  processName: string;
  machineName: string;
  cycleTimeSec: number;
};

export type BomDetailIndex = {
  materialsByUniq: Record<string, BomMaterialLine[]>;
  routesByUniq: Record<string, BomRouteLine[]>;
  uomByUniq: Record<string, string>;
  snpByUniq: Record<string, number>;
};

/**
 * Membangun index detail dari BOM tree yang SAMA dengan yang sudah dimuat
 * halaman work-orders (useGetBomTreeQuery). buildBomUniqIndex yang lama
 * membuang quantity dan process_routes, jadi di sini keduanya diambil.
 */
export const buildBomDetailIndex = (tree: unknown): BomDetailIndex => {
  const materialsByUniq: Record<string, BomMaterialLine[]> = {};
  const routesByUniq: Record<string, BomRouteLine[]> = {};
  const uomByUniq: Record<string, string> = {};
  const snpByUniq: Record<string, number> = {};

  const readRoutes = (raw: unknown): BomRouteLine[] => {
    const list = Array.isArray(raw) ? raw : [];
    const routes: BomRouteLine[] = [];
    for (const entry of list) {
      if (!isRecord(entry)) continue;
      routes.push({
        processName: pickString(entry.process_name, entry.processName),
        machineName: pickString(entry.machine_name, entry.machineName),
        cycleTimeSec: pickNumber(entry.cycle_time_sec, entry.cycleTimeSec) ?? 0,
      });
    }
    return routes;
  };

  const visit = (node: unknown) => {
    if (!isRecord(node)) return;

    const uniq = pickString(node.uniq, node.uniq_code);
    if (uniq) {
      const uom = pickString(node.uom, node.unit_measurement, node.unit);
      if (uom && !uomByUniq[uniq]) uomByUniq[uniq] = uom;

      const snp = pickNumber(
        node.pcs_per_kanban,
        node.pcsPerKanban,
        node.snp,
        node.packing_number,
        node.packingNumber,
      );
      if (typeof snp === "number" && snp > 0 && !(uniq in snpByUniq)) {
        snpByUniq[uniq] = snp;
      }

      const routes = readRoutes(node.process_routes ?? node.processRoutes);
      if (routes.length && !routesByUniq[uniq]) routesByUniq[uniq] = routes;
    }

    const children = node.children;
    if (Array.isArray(children)) {
      if (uniq && !materialsByUniq[uniq]) {
        const materials: BomMaterialLine[] = [];
        for (const child of children) {
          if (!isRecord(child)) continue;
          const childUniq = pickString(child.uniq, child.uniq_code);
          const code = pickString(child.material_code, childUniq);
          if (!code) continue;
          materials.push({
            code,
            name:
              pickString(child.part_name, child.description, child.part_number) ||
              code,
            qtyPerUniq:
              pickNumber(child.quantity, child.qty_per_uniq, child.qpu) ?? 0,
            uom: pickString(child.uom, child.unit_measurement, child.unit) || "PCS",
          });
        }
        if (materials.length) {
          materials.sort((a, b) => a.code.localeCompare(b.code));
          materialsByUniq[uniq] = materials;
        }
      }
      for (const child of children) visit(child);
    }
  };

  const toNodeArray = (input: unknown): unknown[] => {
    if (Array.isArray(input)) return input;
    if (isRecord(input)) {
      if (Array.isArray(input.items)) return input.items;
      const data = input.data;
      if (Array.isArray(data)) return data;
      if (isRecord(data) && Array.isArray(data.items)) return data.items;
      return [input];
    }
    return [];
  };

  for (const node of toNodeArray(tree)) visit(node);

  return { materialsByUniq, routesByUniq, uomByUniq, snpByUniq };
};

/* ------------------------------------------------------------------ *
 * Model laporan
 * ------------------------------------------------------------------ */

export type ReportMaterial = {
  code: string;
  name: string;
  reqQty: number;
  uom: string;
  position: string;
};

export type ReportItem = {
  key: string;
  woNumber: string;
  requestCode: string;
  fgCode: string;
  partNo: string;
  itemName: string;
  woQty: number;
  actualQty: number;
  line: string;
  machine: string;
  cycleSec: number;
  labelCount: number;
  snp: number;
  productionDate: string;
  location: string;
  materials: ReportMaterial[];
};

export type ReportGroup = {
  line: string;
  productionDate: string;
  location: string;
  items: ReportItem[];
};

/** Kelompokkan per line + tanggal + location, 1 sheet per grup. */
export const groupReportItems = (items: ReportItem[]): ReportGroup[] => {
  const map = new Map<string, ReportGroup>();
  for (const item of items) {
    const key = `${item.line}||${item.productionDate}||${item.location}`;
    const existing = map.get(key);
    if (existing) {
      existing.items.push(item);
      continue;
    }
    map.set(key, {
      line: item.line,
      productionDate: item.productionDate,
      location: item.location,
      items: [item],
    });
  }
  return Array.from(map.values()).sort(
    (a, b) =>
      a.productionDate.localeCompare(b.productionDate) ||
      a.line.localeCompare(b.line) ||
      a.location.localeCompare(b.location),
  );
};

/* ------------------------------------------------------------------ *
 * Pembangun HTML
 * ------------------------------------------------------------------ */

const metaCell = (label: string, value: string): string => `
  <div class="meta">
    <div class="meta-label">${escapeHtml(label)}</div>
    <div class="meta-value">${escapeHtml(value || "-")}</div>
  </div>`;

const signBox = (label: string): string => `
  <div class="sign">
    <div class="sign-label">${escapeHtml(label)}</div>
    <div class="sign-space"></div>
  </div>`;

const itemRowsHtml = (item: ReportItem, index: number): string => {
  const materials = item.materials.length
    ? item.materials
    : [{ code: "-", name: "-", reqQty: 0, uom: "-", position: "-" }];
  const span = materials.length;
  const estText = durationText(item.cycleSec * item.woQty);

  return materials
    .map((material, materialIndex) => {
      const head =
        materialIndex === 0
          ? `
        <td class="c" rowspan="${span}">${index + 1}</td>
        <td rowspan="${span}"><strong>${escapeHtml(item.woNumber)}</strong><div class="sub">${escapeHtml(item.requestCode)}</div></td>
        <td rowspan="${span}"><strong>${escapeHtml(item.fgCode)}</strong><div class="sub">${escapeHtml(item.partNo)}</div></td>
        <td rowspan="${span}">${escapeHtml(item.itemName)}</td>
        <td class="r b" rowspan="${span}">${idn(item.woQty)}</td>
        <td class="r b" rowspan="${span}">${idn(item.actualQty)}</td>
        <td rowspan="${span}">${escapeHtml(item.line)}<div class="sub">Mesin: ${escapeHtml(item.machine || "-")}</div></td>
        <td class="r" rowspan="${span}">${escapeHtml(secText(item.cycleSec))}<div class="sub">${escapeHtml(estText)}</div></td>
        <td class="c" rowspan="${span}">${idn(item.labelCount)}<div class="sub">SNP ${idn(item.snp)}</div></td>`
          : "";

      return `<tr>${head}
        <td>${escapeHtml(material.code)}</td>
        <td>${escapeHtml(material.name)}</td>
        <td class="r">${material.reqQty > 0 ? idn(material.reqQty) : "-"}</td>
        <td class="c">${escapeHtml(material.uom)}</td>
        <td class="c">${escapeHtml(material.position || "-")}</td>
      </tr>`;
    })
    .join("");
};

const sheetHtml = (group: ReportGroup, printedAt: string): string => {
  const woNumbers = group.items.map((item) => item.woNumber).join(", ");

  return `
  <section class="sheet">
    <div class="head">
      <div>
        <div class="co-name">${escapeHtml(COMPANY_NAME)}</div>
        <div class="co-dept">${escapeHtml(COMPANY_DEPT)}</div>
      </div>
      <div class="head-right">
        <div class="doc-title">${escapeHtml(DOC_TITLE)}</div>
        <div class="doc-line">${escapeHtml(group.line)}</div>
      </div>
    </div>

    <div class="meta-grid">
      ${metaCell("PRODUCTION DATE", group.productionDate)}
      ${metaCell("PRODUCTION LINE", group.line)}
      ${metaCell("PLANT / LOCATION", group.location)}
      ${metaCell("TOTAL WO", String(group.items.length))}
    </div>

    <div class="meta-grid two">
      ${metaCell("WO NUMBER", woNumbers)}
      ${metaCell("INSTRUCTION", INSTRUCTION_TEXT)}
    </div>

    <table class="tbl">
      <thead>
        <tr>
          <th class="c">No</th>
          <th>WO / Request</th>
          <th>FG Code / Part No</th>
          <th>Item Name</th>
          <th class="r">WO Qty</th>
          <th class="r">Actual Qty</th>
          <th>Line / Machine</th>
          <th class="r">Cycle / Est Time</th>
          <th class="c">Labels</th>
          <th>Material Code</th>
          <th>Material Name</th>
          <th class="r">Req Qty</th>
          <th class="c">UOM</th>
          <th class="c">Position</th>
        </tr>
      </thead>
      <tbody>
        ${group.items.map((item, index) => itemRowsHtml(item, index)).join("")}
      </tbody>
    </table>

    <div class="sign-grid">
      ${signBox("PREPARED BY")}
      ${signBox("LINE LEADER")}
      ${signBox("PRODUCTION")}
      ${signBox("WAREHOUSE")}
    </div>

    <div class="foot">Printed ${escapeHtml(printedAt)}. Format compact: 1 sheet per production line/date/location.</div>
  </section>`;
};

export const buildWorkOrderLineReportHtml = (groups: ReportGroup[]): string => {
  const printedAt = new Date().toLocaleString("id-ID");
  const body = groups.length
    ? groups.map((group) => sheetHtml(group, printedAt)).join("")
    : '<section class="sheet"><div class="empty">Tidak ada work order yang dipilih.</div></section>';

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(DOC_TITLE)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: #f3f4f6;
    font-family: Arial, Helvetica, sans-serif;
    color: #111827;
    font-size: 9px;
  }
  .sheet {
    background: #ffffff;
    padding: 10mm;
    margin: 0 auto 8mm;
    width: 297mm;
    min-height: 210mm;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #1f2937;
    padding-bottom: 6px;
  }
  .co-name { font-size: 15px; font-weight: bold; }
  .co-dept { font-size: 9px; color: #4b5563; margin-top: 2px; }
  .head-right { text-align: right; }
  .doc-title { font-size: 15px; font-weight: bold; letter-spacing: 0.3px; }
  .doc-line { font-size: 11px; font-weight: bold; margin-top: 2px; }
  .meta-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0;
    margin-top: 8px;
    border: 1px solid #d1d5db;
  }
  .meta-grid.two { grid-template-columns: 1fr 1fr; margin-top: 6px; }
  .meta { padding: 5px 8px; border-right: 1px solid #d1d5db; }
  .meta:last-child { border-right: 0; }
  .meta-label { font-size: 7.5px; color: #6b7280; text-transform: uppercase; }
  .meta-value { font-size: 10px; font-weight: bold; margin-top: 2px; }
  .tbl {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  .tbl th, .tbl td {
    border: 1px solid #d1d5db;
    padding: 3px 5px;
    vertical-align: top;
    text-align: left;
  }
  .tbl th {
    background: #f9fafb;
    font-size: 8px;
    font-weight: bold;
  }
  .tbl .c { text-align: center; }
  .tbl .r { text-align: right; }
  .tbl .b { font-weight: bold; }
  .sub { color: #6b7280; font-size: 7.5px; margin-top: 1px; }
  .sign-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
    margin-top: 10px;
  }
  .sign { border: 1px solid #d1d5db; padding: 5px 8px; }
  .sign-label { font-size: 7.5px; color: #6b7280; text-transform: uppercase; }
  .sign-space { height: 34px; }
  .foot { margin-top: 8px; font-size: 7.5px; color: #6b7280; }
  .empty { padding: 20px; text-align: center; color: #6b7280; }
  @page { size: A4 landscape; margin: 8mm; }
  @media print {
    body { background: #ffffff; }
    .sheet {
      width: auto;
      min-height: 0;
      margin: 0;
      padding: 0;
      page-break-after: always;
      break-after: page;
    }
    .sheet:last-child { page-break-after: auto; break-after: auto; }
    .tbl tr { break-inside: avoid; }
    .sign-grid { break-inside: avoid; }
  }
</style>
</head>
<body>${body}</body>
</html>`;
};

/* ------------------------------------------------------------------ *
 * Modal export
 * ------------------------------------------------------------------ */

export type WorkOrderLineExportModalProps = {
  open: boolean;
  items: ReportItem[];
  onClose: () => void;
};

export default function WorkOrderLineExportModal({
  open,
  items,
  onClose,
}: WorkOrderLineExportModalProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);

  /* Default: semua WO yang dibawa dari tabel ikut tercentang. */
  useEffect(() => {
    if (!open) return;
    setCheckedKeys(items.map((item) => item.key));
  }, [open, items]);

  const selectedItems = useMemo(
    () => items.filter((item) => checkedKeys.includes(item.key)),
    [items, checkedKeys],
  );

  const groups = useMemo(() => groupReportItems(selectedItems), [selectedItems]);

  const html = useMemo(() => buildWorkOrderLineReportHtml(groups), [groups]);

  const handlePrint = () => {
    if (!selectedItems.length) {
      message.warning("Pilih minimal satu work order dulu.");
      return;
    }
    const frameWindow = iframeRef.current?.contentWindow;
    if (!frameWindow) {
      message.error("Preview belum siap. Coba lagi sebentar.");
      return;
    }
    frameWindow.focus();
    frameWindow.print();
  };

  const columns: ColumnsType<ReportItem> = [
    {
      title: "WO Number",
      dataIndex: "woNumber",
      key: "woNumber",
      render: (value: string, row) => (
        <div>
          <div className="font-semibold text-gray-900">{value}</div>
          <div className="text-xs text-gray-500">{row.requestCode}</div>
        </div>
      ),
    },
    {
      title: "FG Code / Part No",
      key: "fg",
      render: (_: unknown, row) => (
        <div>
          <div className="font-semibold text-gray-900">{row.fgCode}</div>
          <div className="text-xs text-gray-500">{row.partNo || "-"}</div>
        </div>
      ),
    },
    { title: "Item Name", dataIndex: "itemName", key: "itemName" },
    {
      title: "Line",
      dataIndex: "line",
      key: "line",
      render: (value: string) => <Tag color="blue">{value}</Tag>,
    },
    {
      title: "WO Qty",
      dataIndex: "woQty",
      key: "woQty",
      align: "right",
      render: (value: number) => idn(value),
    },
    {
      title: "Material",
      key: "materials",
      align: "right",
      render: (_: unknown, row) =>
        row.materials.length ? (
          `${row.materials.length} item`
        ) : (
          <span className="text-amber-600">BOM kosong</span>
        ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={1100}
      title="Export Work Order per Line"
      footer={[
        <Button key="close" onClick={onClose}>
          Tutup
        </Button>,
        <Button
          key="print"
          type="primary"
          icon={<PrinterOutlined />}
          onClick={handlePrint}
          disabled={!selectedItems.length}
        >
          Print / Simpan PDF
        </Button>,
      ]}
    >
      <div className="text-xs text-gray-500">
        Centang work order yang mau di-download. Laporan otomatis dipecah 1 sheet
        per production line + tanggal + plant/location.
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
        <Table<ReportItem>
          columns={columns}
          dataSource={items}
          rowKey="key"
          size="small"
          pagination={false}
          scroll={{ y: 220 }}
          rowSelection={{
            selectedRowKeys: checkedKeys,
            onChange: (keys) => setCheckedKeys(keys as string[]),
          }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
        <span>
          {selectedItems.length} work order terpilih, menghasilkan {groups.length}{" "}
          sheet.
        </span>
      </div>

      <div className="mt-2">
        <iframe
          ref={iframeRef}
          title="Preview Work Order per Line"
          srcDoc={html}
          style={{
            width: "100%",
            height: "52vh",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            background: "#ffffff",
          }}
        />
      </div>
    </Modal>
  );
}
