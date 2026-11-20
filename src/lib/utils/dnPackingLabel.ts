/**
 * Label packing Delivery Note: QR + PO, UNIQ, Packing, Nama Supplier, Qty, Packing No.
 * Markup dan gaya sama dengan label di modal "Print Barcode Labels" (dn-management).
 */

export type PackingLabel = {
  qr: string;
  uniq: string;
  /** Nomor packing, mis. DN-0014-PKG-0001 */
  packing: string;
  po: string;
  supplier: string;
  /** Qty + satuan, mis. "120 PCS" */
  qty: string;
  /** Urutan packing, mis. "1 dari 6" */
  packingNo: string;
};

export type PackingLabelOptions = {
  title?: string;
  columns?: 2 | 3;
  includePo?: boolean;
  includeUniq?: boolean;
};

const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const normalizeQrSrc = (value: unknown): string => {
  const qr = String(value ?? "").trim();
  if (!qr || qr === "-") return "";
  if (qr.startsWith("data:image/")) return qr;
  if (qr.startsWith("http://") || qr.startsWith("https://")) return qr;

  const looksLikeBase64 = qr.length > 80 && /^[A-Za-z0-9+/=]+$/.test(qr);
  return looksLikeBase64 ? `data:image/png;base64,${qr}` : qr;
};

export const formatLabelQty = (qty: number | undefined | null, uom?: string): string => {
  const n = Number(qty);
  if (!Number.isFinite(n)) return "-";
  const value = new Intl.NumberFormat("id-ID").format(n);
  const unit = String(uom ?? "").trim();
  return unit && unit !== "-" ? `${value} ${unit}` : value;
};

export function buildPackingLabelsHtml(
  labels: PackingLabel[],
  options: PackingLabelOptions = {},
): string {
  const { title = "Packing Labels", columns = 3, includePo = true, includeUniq = true } = options;

  const cards = labels
    .map(
      (it) => `
        <div class="card">
          <div class="qr">
            <img src="${escapeHtml(it.qr)}" alt="QR" />
          </div>
          <div class="meta">
            ${includePo ? `<div class="line">PO: <span>${escapeHtml(it.po)}</span></div>` : ""}
            ${includeUniq ? `<div class="line">UNIQ: <span>${escapeHtml(it.uniq)}</span></div>` : ""}
            <div class="line">Packing: <span>${escapeHtml(it.packing)}</span></div>
            <div class="line">Nama Supplier: <span>${escapeHtml(it.supplier)}</span></div>
            <div class="line">Qty: <span>${escapeHtml(it.qty)}</span></div>
            <div class="line">Packing No: <span>${escapeHtml(it.packingNo)}</span></div>
          </div>
        </div>`,
    )
    .join("\n");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline';" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root { --border: #e5e7eb; --muted: #6b7280; --text: #111827; }
          * { box-sizing: border-box; }
          body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color: var(--text); }
          .wrap { padding: 16px; }
          .grid { display: grid; grid-template-columns: repeat(${columns}, minmax(0, 1fr)); gap: 12px; }
          .card { border: 1px solid var(--border); border-radius: 12px; padding: 12px; page-break-inside: avoid; }
          .qr { display: flex; align-items: center; justify-content: center; background: #f9fafb; border: 1px solid var(--border); border-radius: 10px; padding: 10px; }
          .qr img { width: 160px; height: 160px; object-fit: contain; }
          .meta { margin-top: 10px; font-size: 12px; color: var(--muted); }
          .line { margin-top: 4px; }
          .line span { color: var(--text); font-weight: 600; }
          @media print {
            .wrap { padding: 0; }
            .card { break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="grid">
            ${cards}
          </div>
        </div>
      </body>
    </html>
  `;
}

/** Mencetak lewat iframe tersembunyi sehingga halaman aplikasi tidak berpindah. */
export function printHtmlViaIframe(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.srcdoc = html;

  iframe.onload = () => {
    const frameWindow = iframe.contentWindow;
    if (!frameWindow) return;
    frameWindow.focus();
    frameWindow.print();
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch {
        // already detached
      }
    }, 1000);
  };

  document.body.appendChild(iframe);
}
