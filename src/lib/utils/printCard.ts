export type PrintCardField = {
  label: string;
  value: string | number | null | undefined;
  /** When true the field spans both grid columns (useful for long text). */
  full?: boolean;
};

export type DeliveryNotePrint = {
  dn_number: string;
  packing_number: string;
  quantity: number;
  check: string;
};

export type PrintCardOptions = {
  /** Browser tab title + small top-left title on the card. */
  documentTitle: string;
  /** Centered, bold heading (e.g. "PACKING LIST"). */
  heading: string;
  /** Centered code/subtitle under the heading (e.g. "PL-RM-001"). */
  subheading?: string;
  /** Two-column field grid. */
  fields: PrintCardField[];

  deliveryNotes?: DeliveryNotePrint[];
  /** QR image source (canvas data URL or https URL). Optional. */
  qrDataUrl?: string;
  /** Centered code shown under the QR. Optional. */
  bottomCode?: string;
  /** Deprecated (kept for compatibility). No longer used with iframe printing. */
  width?: number;
  /** Deprecated (kept for compatibility). No longer used with iframe printing. */
  height?: number;
  /** Called when printing could not be started. */
  onError?: (reason: string) => void;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const formatValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
};

const buildCardHtml = (opts: PrintCardOptions) => {
  const {
    documentTitle,
    heading,
    subheading,
    fields,
    deliveryNotes,
    qrDataUrl,
    bottomCode,
  } = opts;
  
  const fieldsHtml = fields
    .map(
      (f) => `
        <div class="cell${f.full ? " cell-full" : ""}">
          <div class="label">${escapeHtml(f.label)}</div>
          <div class="value">${escapeHtml(formatValue(f.value))}</div>
        </div>`,
    )
    .join("");

  const deliveryNotesHtml =
    deliveryNotes && deliveryNotes.length
      ? `
      <div class="divider"></div>

      <table class="dn-table">
        <thead>
          <tr>
            <th>DN Number</th>
            <th>Packing List</th>
            <th>Qty</th>
          </tr>
        </thead>

        <tbody>
          ${deliveryNotes
            .map(
              (x) => `
              <tr>
                <td>${escapeHtml(x.dn_number)}</td>
                <td>${escapeHtml(x.packing_number)}</td>
                <td>${escapeHtml(x.quantity)}</td>
              </tr>
            `,
            )
            .join("")}
        </tbody>
      </table>
    `
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(documentTitle)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; padding: 24px; color: #111827; }
      .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px 18px 20px; max-width: 520px; margin: 0 auto; }
      .top-title { font-size: 14px; font-weight: 600; margin: 0 0 14px; }
      .center-title { text-align: center; font-weight: 800; letter-spacing: 0.02em; font-size: 18px; margin: 6px 0 2px; }
      .center-sub { text-align: center; font-size: 12px; color: #6b7280; margin: 0 0 14px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 10px 0 14px; }
      .cell-full { grid-column: 1 / -1; }
      .label { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
      .value { font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
      .divider { height: 1px; background: #e5e7eb; margin: 12px 0; }
      .qr { display: flex; justify-content: center; align-items: center; padding: 12px 0 6px; }
      .qr img { width: 180px; height: 180px; image-rendering: pixelated; object-fit: contain; }
      .bottom-code { text-align: center; font-size: 12px; color: #111827; margin-top: 6px; font-weight: 600; }
      .dn-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
      .dn-table th { background: #f3f4f6; border: 1px solid #d1d5db; padding: 6px; text-align: left; }
      .dn-table td { border: 1px solid #d1d5db; padding: 6px; }
      @media print {
        body { padding: 0; }
        .card { border: none; }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="top-title">${escapeHtml(documentTitle)}</div>
      <div class="center-title">${escapeHtml(heading)}</div>
      ${subheading ? `<div class="center-sub">${escapeHtml(subheading)}</div>` : ""}
      <div class="grid">${fieldsHtml}</div>
      ${deliveryNotesHtml}
      ${
        qrDataUrl
          ? `<div class="divider"></div>
      <div class="qr"><img src="${escapeHtml(qrDataUrl)}" alt="QR" /></div>`
          : ""
      }
      ${bottomCode ? `<div class="bottom-code">${escapeHtml(bottomCode)}</div>` : ""}
    </div>
  </body>
</html>`;
};

/**
 * Renders a standardized card in a hidden iframe and triggers the print dialog.
 * Uses an iframe (not window.open) so it is never blocked by popup blockers.
 * Returns true when printing was started, false otherwise.
 */
export function openPrintCard(opts: PrintCardOptions): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    opts.onError?.("Printing is only available in the browser.");
    return false;
  }

  try {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.visibility = "hidden";

    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      // Delay removal so the print dialog can finish reading the document.
      window.setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }, 1000);
    };

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;
      const frameDoc = iframe.contentDocument || frameWindow?.document;
      if (!frameWindow || !frameDoc) {
        opts.onError?.("Unable to prepare the print document.");
        cleanup();
        return;
      }

      const triggerPrint = () => {
        try {
          frameWindow.focus();
          frameWindow.print();
        } catch {
          opts.onError?.("Unable to open the print dialog.");
        } finally {
          cleanup();
        }
      };

      if (frameWindow.matchMedia) {
        const mql = frameWindow.matchMedia("print");
        mql.addEventListener?.("change", (e) => {
          if (!e.matches) cleanup();
        });
      }

      // Wait for the QR image (if any) to load before printing.
      const img = frameDoc.querySelector("img");
      if (img && !img.complete) {
        img.addEventListener("load", () => window.setTimeout(triggerPrint, 50));
        img.addEventListener("error", () =>
          window.setTimeout(triggerPrint, 50),
        );
        // Safety fallback in case the image never fires an event.
        window.setTimeout(triggerPrint, 1500);
      } else {
        window.setTimeout(triggerPrint, 100);
      }
    };

    document.body.appendChild(iframe);

    const frameDoc =
      iframe.contentDocument || iframe.contentWindow?.document || null;
    if (!frameDoc) {
      opts.onError?.("Unable to prepare the print document.");
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      return false;
    }

    frameDoc.open();
    frameDoc.write(buildCardHtml(opts));
    frameDoc.close();
    return true;
  } catch {
    opts.onError?.("Unable to start printing.");
    return false;
  }
}
