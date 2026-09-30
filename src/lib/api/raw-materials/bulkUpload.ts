/**
 * Helpers for Raw Material Inventory bulk upload (CSV / Excel).
 * Pure functions, no React / no API calls, so they can be tested in isolation.
 */

export type Cell = string | number | null | undefined;

export type UploadRow = {
  key: string;
  /** Row number in the source file (header = row 1). */
  line: number;
  uniq: string;
  part_number: string;
  part_name: string;
  model: string;
  /** null = empty/invalid, see `stock_raw`. */
  stock: number | null;
  stock_raw: string;
  wo_number: string;
  warehouse: string;
  errors: string[];
};

export type DuplicateMode = "sum" | "max";

export const REQUIRED_COLUMNS = ["uniq", "stock", "warehouse"] as const;

const HEADER_ALIASES: Record<string, string> = {
  uniq: "uniq",
  uniq_code: "uniq",
  "uniq code": "uniq",
  part_number: "part_number",
  "part number": "part_number",
  part_no: "part_number",
  "part no": "part_number",
  part_name: "part_name",
  "part name": "part_name",
  model: "model",
  stock: "stock",
  stock_qty: "stock",
  qty: "stock",
  wo_number: "wo_number",
  "wo number": "wo_number",
  wo: "wo_number",
  warehouse: "warehouse",
  warehouse_location: "warehouse",
  "warehouse name": "warehouse",
};

/** Database limits (raw_materials table). */
const MAX_UNIQ = 64;
const MAX_PART_NUMBER = 128;
const MAX_PART_NAME = 255;

// ---------------------------------------------------------------------------
// Decoding & CSV parsing
// ---------------------------------------------------------------------------

/**
 * Excel on Windows saves CSV as Windows-1252 (not UTF-8), which turns "Ø" into
 * garbage if it is read as UTF-8. Try strict UTF-8 first, then fall back.
 */
export function decodeCsvBuffer(buf: ArrayBuffer): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }
  return text.replace(/^\uFEFF/, "");
}

export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== "") ?? "";
  const counts: Array<[string, number]> = [
    [";", firstLine.split(";").length - 1],
    ["\t", firstLine.split("\t").length - 1],
    [",", firstLine.split(",").length - 1],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

/** Minimal RFC-4180 style parser (quotes, escaped quotes, CRLF). Keeps blank rows so row numbers stay accurate. */
export function parseDelimited(
  text: string,
  delimiter: string = detectDelimiter(text),
): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === "\n") {
      pushRow();
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

// ---------------------------------------------------------------------------
// Value normalisation
// ---------------------------------------------------------------------------

/**
 * Parses numbers written in Indonesian/European style as well as plain ones:
 *   "1.535,6" -> 1535.6   "1.778" -> 1778   "1,5" -> 1.5   "12.5" -> 12.5   "120" -> 120
 * Returns null when the value cannot be read as a non-negative number.
 * Blank is NOT handled here (caller decides).
 */
export function parseLocaleNumber(raw: Cell): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 ? raw : null;
  const s = String(raw ?? "").replace(/\s+/g, "");
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return Number(s.replace(/,/g, ""));
  if (/^\d+,\d+$/.test(s)) return Number(s.replace(",", "."));
  if (/^\d+\.\d+$/.test(s)) return Number(s);
  return null;
}

const text = (v: Cell): string => (v === null || v === undefined ? "" : String(v).trim());

/** "0" in part_number / model columns means "empty" in the source sheets. */
const zeroAsEmpty = (v: Cell): string => {
  const t = text(v);
  return t === "0" ? "" : t;
};

const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export function validateRow(
  r: Pick<UploadRow, "uniq" | "part_number" | "part_name" | "stock" | "stock_raw" | "warehouse">,
): string[] {
  const errors: string[] = [];
  if (!r.uniq) errors.push("Uniq is empty");
  else if (r.uniq.length > MAX_UNIQ) errors.push(`Uniq longer than ${MAX_UNIQ} characters`);
  if (r.stock === null) {
    errors.push(r.stock_raw ? `Invalid stock "${r.stock_raw}"` : "Stock is empty");
  }
  if (!r.warehouse) errors.push("Warehouse is empty");
  if (r.part_number.length > MAX_PART_NUMBER) errors.push(`Part number longer than ${MAX_PART_NUMBER} characters`);
  if (r.part_name.length > MAX_PART_NAME) errors.push(`Part name longer than ${MAX_PART_NAME} characters`);
  return errors;
}

export type BuildResult = {
  rows: UploadRow[];
  missingColumns: string[];
};

/** matrix[0] must be the header row. Blank rows are skipped. */
export function buildRows(matrix: Cell[][]): BuildResult {
  if (!matrix.length) return { rows: [], missingColumns: [...REQUIRED_COLUMNS] };

  const colIndex: Record<string, number> = {};
  matrix[0].forEach((h, i) => {
    const canonical = HEADER_ALIASES[text(h).toLowerCase()];
    if (canonical && !(canonical in colIndex)) colIndex[canonical] = i;
  });

  const missingColumns = REQUIRED_COLUMNS.filter((c) => !(c in colIndex));
  if (missingColumns.length) return { rows: [], missingColumns };

  const get = (cells: Cell[], name: string): Cell =>
    name in colIndex ? cells[colIndex[name]] : "";

  const rows: UploadRow[] = [];
  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i];
    if (!cells.some((c) => text(c) !== "")) continue;

    const stockCell = get(cells, "stock");
    const stock_raw = text(stockCell);
    const stock = stock_raw === "" ? null : parseLocaleNumber(stockCell);

    const base = {
      uniq: text(get(cells, "uniq")),
      part_number: zeroAsEmpty(get(cells, "part_number")),
      part_name: text(get(cells, "part_name")),
      stock,
      stock_raw,
      warehouse: text(get(cells, "warehouse")),
    };
    rows.push({
      key: `r${i + 1}`,
      line: i + 1,
      ...base,
      model: zeroAsEmpty(get(cells, "model")),
      wo_number: text(get(cells, "wo_number")),
      errors: validateRow(base),
    });
  }
  return { rows, missingColumns: [] };
}

// ---------------------------------------------------------------------------
// Duplicates (same uniq more than once inside the file)
// ---------------------------------------------------------------------------

/** uniq -> rows, only for uniq that appears more than once. */
export function findDuplicateGroups(rows: UploadRow[]): Map<string, UploadRow[]> {
  const all = new Map<string, UploadRow[]>();
  for (const r of rows) {
    if (!r.uniq) continue;
    const list = all.get(r.uniq);
    if (list) list.push(r);
    else all.set(r.uniq, [r]);
  }
  for (const [k, v] of all) if (v.length < 2) all.delete(k);
  return all;
}

/**
 * The database keeps ONE row per uniq_code, so repeated uniq must be merged
 * before sending (otherwise Postgres rejects the batch).
 */
export function mergeDuplicates(rows: UploadRow[], mode: DuplicateMode): UploadRow[] {
  const merged = new Map<string, UploadRow>();
  for (const r of rows) {
    const existing = merged.get(r.uniq);
    if (!existing) {
      merged.set(r.uniq, { ...r });
      continue;
    }
    const a = existing.stock ?? 0;
    const b = r.stock ?? 0;
    existing.stock = round4(mode === "sum" ? a + b : Math.max(a, b));
    existing.part_number ||= r.part_number;
    existing.part_name ||= r.part_name;
    existing.warehouse ||= r.warehouse;
  }
  return Array.from(merged.values());
}
