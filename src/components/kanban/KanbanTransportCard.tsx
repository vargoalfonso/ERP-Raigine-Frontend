"use client";

/**
 * Kanban Transport card renderer (PT MRP).
 *
 * One shared builder used by:
 *  - DN Management (Raw Material + Indirect tabs)
 *  - Work Orders (Child Parts, or Sub-assy when a routing step is flagged
 *    is_assembly in System Settings > Process)
 *
 * The layout mirrors the reference PDFs: a left identity block, a middle part
 * block with the part QR, a bottom store/next-process strip, and a right block
 * carrying the kanban id + kanban QR.
 */

export type KanbanCategory = "RM" | "IRM" | "CP" | "ASSY";

export type KanbanCardData = {
  /** Stable react/render key. */
  key: string;
  category: KanbanCategory;
  /** Label printed in the KATEGORI cell. */
  categoryLabel: string;
  partNumber: string;
  partName: string;
  qtyPerKanban: string;
  totalPlan: string;
  /** 1-based card index and the total number of cards for this part. */
  cardNo: number;
  cardTotal: number;
  kanbanId: string;
  supplier: string;
  /** Only printed when present (the assy reference card shows it). */
  customer?: string;
  plant: string;
  batchLot: string;
  /** "Max qty", "PRL aktif", "DN incoming", ... */
  basis: string;
  areaStore: string;
  partLocation: string;
  nextProcess: string;
  dock: string;
  lineStore: string;
  /** Data URL / http URL of the part QR image. Empty renders a placeholder. */
  partQr: string;
  /** Data URL / http URL of the kanban-id QR image. */
  kanbanQr: string;
  /** Print timestamp, e.g. "29/07/2026, 13.54". */
  printedAt: string;
};

const COMPANY_NAME = "PT MRP";
const DASH = "-";

/**
 * Header tint per category. Applied to BOTH the "KANBAN TRANSPORT" cell and
 * the "IDENTITAS INTERNAL" cell: Raw Material green, Indirect blue.
 */
const CATEGORY_COLOR: Record<KanbanCategory, string> = {
  RM: "#86efac",
  IRM: "#93c5fd",
  CP: "#fdba74",
  ASSY: "#67e8f9",
};

/** Kanban id prefix per category. */
const CATEGORY_PREFIX: Record<KanbanCategory, string> = {
  RM: "KB-RM",
  IRM: "KB-IRM",
  CP: "KB-CP",
  ASSY: "KB-ASSY",
};

export const kanbanCategoryColor = (category: KanbanCategory): string =>
  CATEGORY_COLOR[category] ?? CATEGORY_COLOR.RM;

export const kanbanCategoryPrefix = (category: KanbanCategory): string =>
  CATEGORY_PREFIX[category] ?? CATEGORY_PREFIX.RM;

export const escapeHtml = (value: unknown): string =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

/** id-ID thousands formatting, matching "8.100 PCS" in the reference. */
export const kanbanQty = (value: number, uom = "PCS"): string => {
  if (!Number.isFinite(value)) return DASH;
  const text = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
  return uom ? `${text} ${uom}` : text;
};

/** "29/07/2026, 13.54" */
export const kanbanPrintStamp = (date = new Date()): string =>
  date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Zero-padded card sequence, e.g. 01 / 4. */
export const kanbanCardLabel = (index: number, total: number): string =>
  `${String(index).padStart(2, "0")} / ${total}`;

/**
 * Builds a kanban id like KB-CP-BC10-A-04-01:
 * prefix - part - total cards - this card.
 */
export const buildKanbanId = (
  category: KanbanCategory,
  partNumber: string,
  cardNo: number,
  cardTotal: number
): string => {
  const part = String(partNumber ?? "").trim() || "NA";
  return [
    kanbanCategoryPrefix(category),
    part,
    String(cardTotal).padStart(2, "0"),
    String(cardNo).padStart(2, "0"),
  ].join("-");
};

/**
 * Expands one part into N kanban cards, where N = ceil(totalPlan / qtyPerKanban).
 * Always returns at least one card so a part is never silently dropped.
 */
export const kanbanCardCount = (totalPlan: number, qtyPerKanban: number): number => {
  const total = Number(totalPlan);
  const per = Number(qtyPerKanban);
  if (!Number.isFinite(total) || !Number.isFinite(per) || per <= 0 || total <= 0) return 1;
  return Math.max(1, Math.ceil(total / per));
};

// ---------------------------------------------------------------------------
// process_flow_json helpers
//
// work_order_items.process_flow_json is a snapshot of the routing, written at
// WO creation time. Each step carries the sub_con / is_assembly checkboxes as
// configured in System Settings > Process (process_parameters.is_assembly,
// migration 0065). Detection is by FLAG, never by matching the process name.
// ---------------------------------------------------------------------------

export type KanbanFlowStep = {
  opSeq: number;
  processName: string;
  machineName: string;
  isAssembly: boolean;
};

const safeJsonParse = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const parseKanbanProcessFlow = (value: unknown): KanbanFlowStep[] => {
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((step): step is Record<string, unknown> => typeof step === "object" && step !== null)
    .map((step) => ({
      opSeq: Number(step.op_seq ?? step.opSeq ?? 0) || 0,
      processName: String(step.process_name ?? step.processName ?? "").trim(),
      machineName: String(step.machine_name ?? step.machineName ?? "").trim(),
      isAssembly: step.is_assembly === true || step.isAssembly === true,
    }))
    .sort((a, b) => a.opSeq - b.opSeq);
};

/** True when ANY routing step is flagged is_assembly in System Settings. */
export const hasAssemblyStep = (processFlowJson: unknown): boolean =>
  parseKanbanProcessFlow(processFlowJson).some((step) => step.isAssembly);

/**
 * A child part normally prints as CP, but as soon as one of its processes is
 * an assembly process (is_assembly checked in System Settings) the card must
 * print in the Sub-assy layout instead.
 */
export const resolveWorkOrderKanbanCategory = (
  processFlowJson: unknown
): { category: KanbanCategory; label: string } =>
  hasAssemblyStep(processFlowJson)
    ? { category: "ASSY", label: "Sub-assy" }
    : { category: "CP", label: "Child Parts" };

/** "LOC-PR-002 / PIERCING" style label built from the first routing step. */
export const kanbanNextProcessLabel = (processFlowJson: unknown, fallback = ""): string => {
  const steps = parseKanbanProcessFlow(processFlowJson);
  if (steps.length === 0) return String(fallback ?? "").trim() || DASH;
  const first = steps[0];
  const parts = [first.machineName, first.processName].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : DASH;
};

const field = (label: string, value: unknown, extraClass = ""): string => `
  <div class="f ${extraClass}">
    <div class="fl">${escapeHtml(label)}</div>
    <div class="fv">${escapeHtml(value || DASH)}</div>
  </div>`;

const qrBox = (src: string, caption: string, cls: string): string => {
  const img = src
    ? `<img src="${escapeHtml(src)}" alt="QR" />`
    : `<div class="qr-missing">No QR</div>`;
  return `
    <div class="${cls}">
      ${img}
      <div class="qr-cap">${escapeHtml(caption)}</div>
    </div>`;
};

const cardHtml = (card: KanbanCardData): string => {
  const tint = kanbanCategoryColor(card.category);

  // The reference assy card adds a CUSTOMER cell; the others do not.
  const identityRow = card.customer
    ? `<div class="row r3">
         ${field("SUPPLIER", card.supplier)}
         ${field("CUSTOMER", card.customer)}
         ${field("PENERIMA / PLANT", card.plant)}
       </div>`
    : `<div class="row r2">
         ${field("SUPPLIER", card.supplier)}
         ${field("PENERIMA / PLANT", card.plant)}
       </div>`;

  return `
  <div class="card">
    <div class="left">
      <div class="row top">
        <div class="brand" style="background:${tint};border-bottom:4px solid ${tint}">KANBAN TRANSPORT</div>
        <div class="f ident" style="background:${tint};border-bottom:4px solid ${tint}">
          <div class="fl">IDENTITAS INTERNAL</div>
          <div class="fv">${escapeHtml(COMPANY_NAME)}</div>
        </div>
        <div class="noimg">No Img</div>
      </div>
      <div class="row r3">
        ${field("PART NUMBER / UNIQUE", card.partNumber, "big")}
        ${field("QTY / KANBAN", card.qtyPerKanban, "big")}
        ${field("NO KARTU", kanbanCardLabel(card.cardNo, card.cardTotal), "big")}
      </div>
      <div class="mid">
        <div class="qr-part-wrap">
          <div class="fl">QR PART</div>
          ${qrBox(card.partQr, card.partNumber, "qr-part")}
        </div>
        <div class="mid-rows">
          <div class="row r2">
            ${field("NAMA PART", card.partName)}
            ${field("KATEGORI", card.categoryLabel)}
          </div>
          ${identityRow}
          <div class="row r3">
            ${field("TOTAL PLAN", card.totalPlan)}
            ${field("BATCH / LOT", card.batchLot)}
            ${field("DASAR HITUNG", card.basis)}
          </div>
        </div>
      </div>
      <div class="row bottom">
        ${field("AREA STORE", card.areaStore)}
        ${field("LOKASI PART", card.partLocation)}
        ${field("NEXT PROSES", card.nextProcess, "wide")}
        ${field("TANGGAL CETAK", card.printedAt)}
      </div>
    </div>
    <div class="right">
      ${field("KANBAN ID", card.kanbanId, "kid")}
      <div class="qr-kanban-wrap">
        <div class="fl">QR KANBAN ID</div>
        ${qrBox(card.kanbanQr, card.kanbanId, "qr-kanban")}
      </div>
      <div class="row r2">
        ${field("DOCK", card.dock)}
        ${field("LINE / STORE", card.lineStore)}
      </div>
    </div>
  </div>`;
};

const STYLES = `
  :root { --line: #cbd5e1; --frame: #94a3b8; --muted: #64748b; --text: #0f172a; }
  /*
   * Chrome/Edge/Safari drop every background-color when printing unless the
   * document opts in. Without this the KANBAN TRANSPORT / IDENTITAS INTERNAL
   * blocks print plain white even though they look coloured on screen.
   */
  * {
    box-sizing: border-box;
    -webkit-print-color-adjust: exact !important;
    color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  body {
    margin: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial;
    color: var(--text);
    font-size: 10px;
  }
  .wrap { padding: 8mm; }
  .card {
    display: grid;
    grid-template-columns: 1fr 210px;
    border: 2px solid var(--frame);
    margin-bottom: 6mm;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .left { border-right: 2px solid var(--frame); }
  .row { display: grid; border-top: 1px solid var(--line); }
  .left > .row:first-child, .right > .f:first-child { border-top: 0; }
  .r2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .r3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .top { grid-template-columns: 1.15fr 1.2fr 0.85fr; }
  .bottom { grid-template-columns: 0.75fr 0.75fr 1.7fr 1fr; }
  .f { padding: 3px 6px; border-left: 1px solid var(--line); min-height: 30px; }
  .row > .f:first-child, .mid-rows .row > .f:first-child { border-left: 0; }
  .fl { font-size: 6.5px; letter-spacing: 0.03em; color: var(--muted); text-transform: uppercase; }
  .fv { font-weight: 700; font-size: 9px; line-height: 1.25; word-break: break-word; }
  .big .fv { font-size: 13px; }
  .brand {
    display: flex; align-items: center;
    padding: 4px 8px;
    font-weight: 800; font-size: 13px; letter-spacing: 0.02em;
  }
  .ident { border-left: 1px solid var(--line); }
  .noimg {
    display: flex; align-items: center; justify-content: center;
    border-left: 1px solid var(--line);
    color: #94a3b8; font-size: 7px;
  }
  .mid { display: grid; grid-template-columns: 96px 1fr; border-top: 1px solid var(--line); }
  .mid-rows { border-left: 1px solid var(--line); }
  .mid-rows > .row:first-child { border-top: 0; }
  .qr-part-wrap, .qr-kanban-wrap { padding: 3px 6px; }
  .qr-part, .qr-kanban { display: flex; flex-direction: column; align-items: center; }
  .qr-part img { width: 52px; height: 52px; object-fit: contain; }
  .qr-kanban img { width: 78px; height: 78px; object-fit: contain; }
  .qr-cap { margin-top: 2px; font-size: 6.5px; font-weight: 700; text-align: center; word-break: break-all; }
  .qr-missing {
    display: flex; align-items: center; justify-content: center;
    width: 52px; height: 52px;
    border: 1px dashed var(--line); color: #94a3b8; font-size: 6px;
  }
  .qr-kanban .qr-missing { width: 78px; height: 78px; }
  .kid { border-top: 0; }
  .kid .fv { font-size: 13px; }
  .wide .fv { font-size: 8.5px; }
  .right > .row { border-top: 1px solid var(--line); }
  .empty { padding: 20px; text-align: center; color: var(--muted); }
  @page { size: A4 portrait; margin: 8mm; }
  @media print {
    .wrap { padding: 0; }
    html, body, .brand, .ident {
      -webkit-print-color-adjust: exact !important;
      color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

/**
 * Wraps the cards in a standalone printable document. Rendered into an iframe
 * via srcDoc so printing never navigates away from the app.
 */
export const buildKanbanCardsHtml = (
  cards: KanbanCardData[],
  title = "Kanban Transport"
): string => {
  const body =
    cards.length === 0
      ? `<div class="empty">Tidak ada kanban yang dipilih.</div>`
      : cards.map((card) => cardHtml(card)).join("\n");

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${STYLES}</style>
  </head>
  <body>
    <div class="wrap">${body}</div>
  </body>
</html>`;
};

export default buildKanbanCardsHtml;
