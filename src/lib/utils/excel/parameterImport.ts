// Import helpers for System Settings -> Safety Stock Parameters / Stockdays Parameters.
//
// File format (CSV with `;` or `,`, or Excel). Header row is required:
//   Safety stock : inventory_type;item_uniq_code;calculation_type;constanta;status
//   Stockdays    : inventory_type;item_code;calculation_type;constanta;status
//
// Rows are validated here; the page then creates a record when the
// (inventory_type, item) pair does not exist yet and updates it when it does.

import { buildCsv } from "./csv";

export type ParameterImportKind = "safety-stock" | "stockdays";

export type ParameterImportRow = {
  /** 1-based line number in the file (header = line 1). */
  line: number;
  /** Original cells in template order, used to build the "failed rows" file. */
  cells: string[];
  inventory_type: string;
  item_code: string;
  calculation_type: string;
  constanta: number;
  status?: "active" | "inactive";
};

export type ParameterImportInvalid = {
  line: number;
  reason: string;
  cells: string[];
};

export type ParameterImportParseResult = {
  rows: ParameterImportRow[];
  invalid: ParameterImportInvalid[];
  missingColumns: string[];
  /** Rows dropped because the same (inventory_type, item) appears again later in the file. */
  duplicates: number;
};

type KindConfig = {
  filename: string;
  /** Header written to the template / failed-rows file (template order). */
  headers: string[];
  calculationTypes: string[];
  integerConstanta: boolean;
  templateRows: string[][];
};

export const PARAMETER_IMPORT_CONFIG: Record<ParameterImportKind, KindConfig> = {
  "safety-stock": {
    filename: "safety_stock_template.csv",
    headers: ["inventory_type", "item_uniq_code", "calculation_type", "constanta", "status"],
    calculationTypes: ["days", "percentage", "forecast"],
    integerConstanta: false,
    templateRows: [
      ["raw_material", "RM-0001", "days", "7", "Active"],
      ["indirect_material", "IM-0001", "percentage", "20", "Active"],
      ["finished_goods", "FG-0001", "forecast", "0", "Active"],
    ],
  },
  stockdays: {
    filename: "stockdays_template.csv",
    headers: ["inventory_type", "item_code", "calculation_type", "constanta", "status"],
    calculationTypes: ["days", "percentage"],
    integerConstanta: true,
    templateRows: [
      ["raw_material", "RM-0001", "days", "14", "Active"],
      ["finished_goods", "FG-0001", "percentage", "10", "Active"],
    ],
  },
};

export const buildParameterTemplateCsv = (kind: ParameterImportKind): string => {
  const cfg = PARAMETER_IMPORT_CONFIG[kind];
  return buildCsv([cfg.headers, ...cfg.templateRows]);
};

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const HEADER_ALIASES: Record<string, string> = {
  inventory: "inventory_type",
  type: "inventory_type",
  item_uniq_code: "item",
  item_code: "item",
  uniq_code: "item",
  uniq: "item",
  calculation: "calculation_type",
  parameter: "calculation_type",
  constant: "constanta",
  constanta: "constanta",
};

const normalizeHeader = (value: string): string => {
  const h = String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return HEADER_ALIASES[h] ?? h;
};

const INVENTORY_TYPES = ["raw_material", "indirect_material", "subcon", "finished_goods"];

const INVENTORY_ALIASES: Record<string, string> = {
  raw_materials: "raw_material",
  indirect: "indirect_material",
  indirect_materials: "indirect_material",
  indirect_raw_material: "indirect_material",
  sub_con: "subcon",
  subcon_material: "subcon",
  subcon_materials: "subcon",
  finished_good: "finished_goods",
  finished_goods_materials: "finished_goods",
  fg: "finished_goods",
};

/** Returns the canonical inventory type ("raw_material", ...) or undefined if unknown. */
export const normalizeInventoryType = (value: string): string | undefined => {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  const canonical = INVENTORY_ALIASES[key] ?? key;
  return INVENTORY_TYPES.includes(canonical) ? canonical : undefined;
};

const normalizeCalculationType = (value: string): string => {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw.includes("forecast")) return "forecast";
  if (raw.includes("percent")) return "percentage";
  if (raw === "day" || /\bdays?\b/.test(raw)) return "days";
  return raw;
};

/** Key used to match an imported row with an existing record. */
export const parameterKey = (inventoryType: string, itemCode: string): string =>
  `${normalizeInventoryType(inventoryType) ?? String(inventoryType).trim().toLowerCase()}|${String(itemCode)
    .trim()
    .toLowerCase()}`;

// ---------------------------------------------------------------------------
// Parsing / validation
// ---------------------------------------------------------------------------

export const parseParameterImport = (
  kind: ParameterImportKind,
  matrix: string[][],
): ParameterImportParseResult => {
  const cfg = PARAMETER_IMPORT_CONFIG[kind];
  const result: ParameterImportParseResult = {
    rows: [],
    invalid: [],
    missingColumns: [],
    duplicates: 0,
  };

  const required = ["inventory_type", "item", "calculation_type"];
  const headers = (matrix[0] ?? []).map(normalizeHeader);
  const indexOf = (name: string) => headers.indexOf(name);
  result.missingColumns = required
    .filter((c) => indexOf(c) === -1)
    .map((c) => (c === "item" ? cfg.headers[1] : c));
  if (result.missingColumns.length) return result;

  const cell = (cols: string[], name: string): string => {
    const i = indexOf(name);
    return i === -1 ? "" : String(cols[i] ?? "").trim();
  };

  const byKey = new Map<string, ParameterImportRow>();

  matrix.slice(1).forEach((cols, idx) => {
    const line = idx + 2;
    const cells = [
      cell(cols, "inventory_type"),
      cell(cols, "item"),
      cell(cols, "calculation_type"),
      cell(cols, "constanta"),
      cell(cols, "status"),
    ];
    const fail = (reason: string) => result.invalid.push({ line, reason, cells });

    const inventoryType = normalizeInventoryType(cells[0]);
    if (!inventoryType) {
      return fail(`inventory_type "${cells[0]}" is not valid (use ${INVENTORY_TYPES.join(", ")})`);
    }

    const item = cells[1];
    if (!item) return fail(`${cfg.headers[1]} is required`);

    const calc = normalizeCalculationType(cells[2]);
    if (!cfg.calculationTypes.includes(calc)) {
      return fail(
        `calculation_type "${cells[2]}" is not valid (use ${cfg.calculationTypes.join(", ")})`,
      );
    }

    let constanta = 0;
    if (cells[3] !== "") {
      constanta = Number(cells[3].replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(constanta) || constanta < 0) {
        return fail(`constanta "${cells[3]}" must be a number >= 0`);
      }
      if (cfg.integerConstanta && !Number.isInteger(constanta)) {
        return fail(`constanta "${cells[3]}" must be a whole number`);
      }
    } else if (calc !== "forecast") {
      return fail("constanta is required");
    }

    let status: ParameterImportRow["status"];
    if (cells[4] !== "") {
      const s = cells[4].toLowerCase();
      if (s === "active") status = "active";
      else if (s === "inactive") status = "inactive";
      else return fail(`status "${cells[4]}" must be Active or Inactive`);
    }

    const key = parameterKey(inventoryType, item);
    if (byKey.has(key)) result.duplicates += 1; // last occurrence wins
    byKey.set(key, {
      line,
      cells,
      inventory_type: inventoryType,
      item_code: item,
      calculation_type: calc,
      constanta,
      status,
    });
  });

  result.rows = [...byKey.values()].sort((a, b) => a.line - b.line);
  return result;
};

// ---------------------------------------------------------------------------
// Execution helpers
// ---------------------------------------------------------------------------

/** Run `worker` over `items` with at most `limit` in flight. */
export const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
};

/** Retry a request a few times when the API answers 429 (rate limited). */
export const withRateLimitRetry = async <T>(fn: () => Promise<T>, retries = 3): Promise<T> => {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = (error as { status?: unknown } | null)?.status;
      if (status !== 429 || attempt >= retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
};

/** CSV of rows that could not be imported: template columns + an `error` column. */
export const buildFailedRowsCsv = (
  kind: ParameterImportKind,
  failed: { cells: string[]; error: string }[],
): string => {
  const cfg = PARAMETER_IMPORT_CONFIG[kind];
  return buildCsv([[...cfg.headers, "error"], ...failed.map((f) => [...f.cells, f.error])]);
};
