import dayjs from "dayjs";
import type { ProcurementDnItem, ProcurementDnRecord } from "@/lib/api/procurement-dn/api";
import { resolveSubconSupplierName } from "@/lib/utils/subconSupplier";

/** Data pendukung dokumen DN yang tidak dibawa oleh record DN. */
export type DnDocumentContext = {
  /** Nomor part per uniq (dari BOM) */
  partNumberByUniq: Record<string, string>;
  /** Nama part per uniq (dari BOM) */
  partNameByUniq: Record<string, string>;
  /** Master Supplier Item, dipakai untuk nama SubCon pada DN Subcon */
  supplierItems: Parameters<typeof resolveSubconSupplierName>[0]["supplierItems"];
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Formatter angka gaya Indonesia (ribuan pakai titik, desimal koma).
export const formatIdNumber = (
  value: number | undefined | null,
  fractionDigits = 0,
) => {
  if (value == null || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
};

export const formatIdDate = (value: string | undefined | null) => {
  if (!value) return "-";
  const d = dayjs(value);
  if (!d.isValid()) return String(value);
  const months = [
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
  return `${d.date()} ${months[d.month()]} ${d.year()}`;
};

// QR generator (public API, tanpa dependency baru).
const buildQrSrc = (payload: string) => {
  const base = 'https://' + 'api.qrserver.com/v1/create-qr-code/';
  const q = encodeURIComponent(payload || '-');
  return `${base}?size=140x140&margin=0&data=${q}`;
}

// Logo PT. Matra Roda Piranti (public/logo-matra-roda-piranti.png).
const logoSrc = () =>
  (typeof window !== "undefined" ? window.location.origin : "") +
  "/logo-matra-roda-piranti.png";

const buildDnPageHtml = (
  dn: ProcurementDnRecord,
  printedAtLabel: string,
  ctx: DnDocumentContext,
): string => {
  const dnNumber = String(dn.dn_number ?? "-").trim() || "-";
  const storedSupplierName =
    dn.supplier?.supplier_name ?? dn.supplier_name ?? "-";
  // DN Subcon: nama SubCon sama dengan yang tampil di list (Master Supplier Item subcon).
  const supplierName =
    String(dn.type ?? "").toUpperCase() === "SC"
      ? resolveSubconSupplierName({
          storedName: storedSupplierName,
          uniqCodes: (dn.items ?? []).map((item) => item.item_uniq_code),
          supplierItems: ctx.supplierItems,
        })
      : storedSupplierName;
  const supplierAddress = dn.supplier?.full_address ?? "-";
  const dnDate = formatIdDate(dn.created_at);
  const deliveryDate = formatIdDate(dn.incoming_date);
  const cycleText =
    dn.supplier?.delivery_lead_time_days != null
      ? String(dn.supplier.delivery_lead_time_days)
      : "-";
  const rit =
    dn.delivery_to != null && dn.delivery_total != null
      ? `${dn.delivery_to} / ${dn.delivery_total}`
      : dn.delivery_to != null
        ? String(dn.delivery_to)
        : "-";
  const dnType = (dn.type ?? "-").toString().toUpperCase();
  const status = (dn.status ?? "-").toString().toUpperCase();

  let totalKbn = 0;
  let totalUnit = 0;
  const rowsHtml = (dn.items ?? [])
    .map((it: ProcurementDnItem, index: number) => {
      const uniq = it.item_uniq_code ?? "-";
      const partNumber = ctx.partNumberByUniq[uniq] ?? "-";
      const partName = ctx.partNameByUniq[uniq] ?? "-";
      const packing = it.packing_number ?? "-";
      const uom = (it.uom ?? "PCS").toString().toUpperCase();
      const snp = it.pcs_per_kanban ?? 0;
      const orderUnit = it.order_qty ?? 0;
      const orderKbn = snp > 0 ? orderUnit / snp : 0;
      totalKbn += orderKbn;
      totalUnit += orderUnit;
      return `
        <tr>
          <td class="c">${index + 1}</td>
          <td class="c b">${escapeHtml(uniq)}</td>
          <td>
            <div class="b">${escapeHtml(partNumber)}</div>
            <div class="muted">${escapeHtml(partName)}</div>
          </td>
          <td class="c pack">${escapeHtml(packing).toUpperCase()}</td>
          <td class="c">-</td>
          <td class="c">${escapeHtml(uom)}</td>
          <td class="r">${snp > 0 ? formatIdNumber(snp) : "-"}</td>
          <td class="r">${snp > 0 ? formatIdNumber(orderKbn, orderKbn % 1 === 0 ? 0 : 2) : "-"}</td>
          <td class="r">${formatIdNumber(orderUnit)}</td>
        </tr>`;
    })
    .join("");

  return `
    <section class="page">
      <div class="frame">
        <div class="top">
          <div class="brand">
            <div class="logo">
              <img src="${escapeHtml(logoSrc())}" alt="PT. Matra Roda Piranti" />
            </div>
            <div>
              <div class="brand-name">PT. MATRA RODA PIRANTI</div>
              <div class="brand-sub">Department Logistics (PPIC)</div>
            </div>
          </div>
          <div class="top-right">
            <div class="dn-title">DELIVERY NOTE</div>
            <div class="dn-number">${escapeHtml(dnNumber)}</div>
            <div class="dn-print-date">PRINT DATE : ${escapeHtml(printedAtLabel)}</div>
            <div class="dn-status"><span>STATUS : ${escapeHtml(status)}</span></div>
          </div>
        </div>

        <div class="info">
          <div class="info-col">
            <div class="info-row"><span class="label">SUPPLIER</span><span class="sep">:</span><span class="value b">${escapeHtml(supplierName)}</span></div>
            <div class="info-row"><span class="label">DATE</span><span class="sep">:</span><span class="value b">${escapeHtml(dnDate)}</span></div>
            <div class="info-row info-row-multi"><span class="label">DEL. TO</span><span class="sep">:</span><span class="value">${escapeHtml(supplierAddress)}</span></div>
            <div class="info-row"><span class="label">RECIPIENT</span><span class="sep">:</span><span class="value">PPIC / Receiving Warehouse</span></div>
          </div>
          <div class="info-qr">
            <img src="${escapeHtml(buildQrSrc(dnNumber))}" alt="DN QR" />
          </div>
          <div class="info-col">
            <div class="info-row"><span class="label">CYCLE</span><span class="sep">:</span><span class="value b">${escapeHtml(cycleText)}</span></div>
            <div class="info-row"><span class="label">DELIVERY</span><span class="sep">:</span><span class="value b">${escapeHtml(deliveryDate)}</span></div>
            <div class="info-row"><span class="label">RIT/TIME</span><span class="sep">:</span><span class="value b">${escapeHtml(rit)}</span></div>
            <div class="info-row"><span class="label">AREA</span><span class="sep">:</span><span class="value">-</span></div>
            <div class="info-row"><span class="label">TYPE</span><span class="sep">:</span><span class="value b">${escapeHtml(dnType === "RM" ? "NORMAL" : dnType)}</span></div>
          </div>
        </div>

        <table class="items">
          <thead>
            <tr>
              <th style="width:36px">NO.</th>
              <th style="width:70px">UNIQ</th>
              <th>PART NUMBER /<br/>PART NAME</th>
              <th style="width:96px">PACKING</th>
              <th style="width:70px">DROP<br/>ZONE</th>
              <th style="width:50px">UNIT</th>
              <th style="width:60px">SNP</th>
              <th style="width:70px">ORDER<br/>KBN</th>
              <th style="width:70px">ORDER<br/>UNIT</th>
            </tr>
          </thead>
          <tbody>${rowsHtml || `<tr><td colspan="9" class="c muted">Tidak ada item.</td></tr>`}</tbody>
          <tfoot>
            <tr>
              <td colspan="6"></td>
              <td class="r b">Total</td>
              <td class="r b">${formatIdNumber(totalKbn, totalKbn % 1 === 0 ? 0 : 2)}</td>
              <td class="r b">${formatIdNumber(totalUnit)}</td>
            </tr>
          </tfoot>
        </table>

        <div class="remarks">
          <div class="remarks-label">Remarks :</div>
          <div class="remarks-body">&nbsp;</div>
        </div>

        <div class="spacer"></div>

        <div class="plant-tag">MRP PLANT 2</div>

        <div class="sig-grid">
          <div class="sig-box">
            <div class="sig-title">SECURITY</div>
            <div class="sig-area"></div>
            <div class="sig-date">Date:</div>
          </div>
          <div class="sig-box sig-box-double">
            <div class="sig-titles">
              <div>CONTROL MAN</div>
              <div>RECEIVED</div>
            </div>
            <div class="sig-areas">
              <div class="sig-area"></div>
              <div class="sig-area"></div>
            </div>
            <div class="sig-dates">
              <div>Date:</div>
              <div>Date:</div>
            </div>
          </div>
          <div class="sig-box sig-box-supplier">
            <div class="sig-title">SUPPLIER</div>
            <div class="sig-titles">
              <div>APPROVED</div>
              <div>PREPARED</div>
            </div>
            <div class="sig-areas">
              <div class="sig-area"></div>
              <div class="sig-area"></div>
            </div>
            <div class="sig-dates">
              <div>Date:</div>
              <div>Date:</div>
            </div>
          </div>
        </div>

        <div class="page-number">Page 1</div>
      </div>
    </section>`;
};

/**
 * Dokumen Delivery Note (A4: header, info supplier, tabel item, remarks, kotak tanda tangan
 * di dasar halaman). Dipakai oleh list DN (export per hari, Print DN) dan halaman detail DN.
 */
export const buildDnDocumentHtml = (
  dnList: ProcurementDnRecord[],
  ctx: DnDocumentContext,
  dateLabel: string,
): string => {
  // PRINT DATE = tanggal dokumen dicetak (hari ini), mis. "18 November 2026".
  const printedAtLabel = formatIdDate(dayjs().format("YYYY-MM-DD"));
  const body = dnList
    .map((dn) => buildDnPageHtml(dn, printedAtLabel, ctx))
    .join("\n");
  return `<!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Delivery Notes - ${escapeHtml(dateLabel)}</title>
        <style>
          * { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; background: #eef2f7; color: #111827; font-family: Arial, Helvetica, sans-serif; }
          .page { padding: 18px; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .frame { background: #fff; border: 2px solid #111827; border-radius: 4px; padding: 12px 14px; margin-right: 2px; }
          .top { display: grid; grid-template-columns: 1fr auto; gap: 16px; align-items: flex-start; }
          .brand { display: flex; align-items: center; gap: 10px; }
          .logo { width: 46px; height: 46px; display: flex; align-items: center; justify-content: center; }
          .logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
          .brand-name { font-size: 15px; font-weight: 800; color: #111827; }
          .brand-sub { font-size: 10px; color: #4b5563; margin-top: 2px; }
          .top-right { text-align: right; }
          .dn-title { font-size: 18px; font-weight: 800; letter-spacing: 0.02em; }
          .dn-number { font-size: 12px; margin-top: 4px; font-weight: 700; }
          .dn-print-date { font-size: 10px; color: #4b5563; margin-top: 2px; }
          .dn-status { margin-top: 4px; }
          .dn-status > span { border: 1px solid #111827; padding: 2px 8px; font-size: 10px; font-weight: 700; display: inline-block; }
          .info { display: grid; grid-template-columns: 1fr 130px 1fr; gap: 12px; margin-top: 10px; padding: 8px 4px; border-top: 1px solid #111827; }
          .info-col { display: flex; flex-direction: column; gap: 4px; font-size: 10.5px; }
          .info-row { display: grid; grid-template-columns: 68px 8px 1fr; align-items: baseline; }
          .info-row-multi .value { white-space: normal; }
          .info-row .label { color: #4b5563; font-weight: 600; letter-spacing: 0.03em; }
          .info-row .sep { color: #4b5563; }
          .info-row .value { color: #111827; }
          .info-qr { display: flex; align-items: center; justify-content: center; }
          .info-qr img { width: 112px; height: 112px; border: 1px solid #111827; padding: 3px; background: #fff; }
          .b { font-weight: 700; }
          .muted { color: #4b5563; font-size: 10px; margin-top: 1px; }
          .items { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 10px; }
          .items th, .items td { border: 1px solid #111827; padding: 2px 5px; vertical-align: middle; }
          .items thead { display: table-header-group; }
          .items tfoot { display: table-row-group; }
          .items tr { page-break-inside: avoid; }
          .items thead th { background: #eef2f9; text-align: center; font-weight: 700; padding: 4px 5px; }
          .items td.pack { font-size: 8px; word-break: break-all; }
          .items td .b { font-size: 9px; line-height: 1.15; }
          .items td .muted { font-size: 8px; line-height: 1.15; margin-top: 0; }
          .items td.c { text-align: center; }
          .items td.r { text-align: right; }
          .items tfoot td { background: #fff; }
          .remarks { border: 1px solid #111827; border-top: none; padding: 6px 8px; min-height: 34px; }
          .remarks-label { font-size: 10px; color: #4b5563; }
          .plant-tag { text-align: center; font-size: 10px; color: #4b5563; margin: 8px 0 5px; }
          .sig-grid { display: grid; grid-template-columns: 1fr 1.5fr 1.4fr; gap: 8px; }
          .sig-box { border: 1px solid #111827; padding: 6px 8px; display: flex; flex-direction: column; font-size: 10px; min-height: 92px; }
          .sig-title { text-align: center; font-weight: 700; letter-spacing: 0.04em; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
          .sig-area { flex: 1; }
          .sig-date { border-top: 1px solid #d1d5db; padding-top: 4px; }
          .sig-titles { display: grid; grid-template-columns: 1fr 1fr; text-align: center; font-weight: 700; letter-spacing: 0.04em; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; }
          .sig-titles > div + div { border-left: 1px solid #d1d5db; }
          .sig-areas { display: grid; grid-template-columns: 1fr 1fr; flex: 1; }
          .sig-areas > div + div { border-left: 1px solid #d1d5db; }
          .sig-dates { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid #d1d5db; padding-top: 4px; }
          .sig-dates > div + div { border-left: 1px solid #d1d5db; padding-left: 6px; }
          .sig-box-supplier .sig-title { margin-bottom: 4px; }
          .page-number { text-align: right; font-size: 10px; color: #4b5563; margin-top: 6px; }
          @page { size: A4; margin: 8mm; }
          @media print {
            html, body { background: #fff; }
            /* Bingkai mengisi tinggi halaman A4; spacer mendorong blok tanda tangan ke dasar halaman. */
            .page { padding: 0; min-height: 276mm; display: flex; flex-direction: column; }
            .frame { border-width: 1.5px; flex: 1 1 auto; display: flex; flex-direction: column; }
            .spacer { flex: 1 1 auto; min-height: 8px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${body}
        <div class="no-print" style="position:fixed; bottom:12px; right:12px;">
          <button onclick="window.print()" style="padding:8px 14px; border-radius:6px; border:1px solid #111827; background:#111827; color:#fff; cursor:pointer;">Print / Save as PDF</button>
        </div>
      </body>
    </html>`;
};
