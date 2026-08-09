import * as XLSX from "xlsx";

/**
 * Shared Excel (xlsx) helpers for master-data Import / Export features.
 *
 * A generated template always contains 3 sheets:
 *  1. "Data"              -> the sheet the user fills in (only the header row).
 *  2. "Contoh"            -> example rows so the user knows how to fill it.
 *  3. "Petunjuk Pengisian"-> per-column instructions (guide).
 *
 * When importing we always read the "Data" sheet (falling back to the first
 * sheet) and ignore the "Contoh" / "Petunjuk Pengisian" helper sheets.
 */

export type ExcelColumn = {
  /** Internal key used in the parsed row object. */
  key: string;
  /** Column header shown in the "Data" / "Contoh" sheets. */
  header: string;
  /** Whether the column is mandatory (only used for the guide text). */
  required?: boolean;
  /** Example value shown in the "Contoh" sheet. */
  example?: string;
  /** Human readable filling instruction shown in "Petunjuk Pengisian". */
  instruction?: string;
};

export const DATA_SHEET_NAME = "Data";
export const EXAMPLE_SHEET_NAME = "Contoh";
export const GUIDE_SHEET_NAME = "Petunjuk Pengisian";

const HELPER_SHEET_NAMES = new Set<string>([
  EXAMPLE_SHEET_NAME.toLowerCase(),
  GUIDE_SHEET_NAME.toLowerCase(),
]);

const timestamp = (): string => {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
};

const autoFitColumns = (rows: Array<Array<string>>): Array<{ wch: number }> => {
  const widths: number[] = [];
  rows.forEach((row) => {
    row.forEach((cell, index) => {
      const length = String(cell ?? "").length;
      widths[index] = Math.max(widths[index] ?? 10, length + 2);
    });
  });
  return widths.map((wch) => ({ wch: Math.min(Math.max(wch, 12), 60) }));
};

/**
 * Build and trigger download of an import template workbook.
 */
export const downloadTemplate = (opts: {
  fileName: string;
  title: string;
  columns: ExcelColumn[];
  exampleRows?: Array<Record<string, string | number | undefined>>;
}): void => {
  const { fileName, title, columns, exampleRows = [] } = opts;
  const workbook = XLSX.utils.book_new();

  // 1) Data sheet: header only (this is where the user fills data).
  const headers = columns.map((column) => column.header);
  const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
  dataSheet["!cols"] = autoFitColumns([headers]);
  dataSheet["!freeze"] = { xSplit: 0, ySplit: 1 } as unknown as never;
  XLSX.utils.book_append_sheet(workbook, dataSheet, DATA_SHEET_NAME);

  // 2) Contoh (example) sheet.
  const exampleMatrix: Array<Array<string>> = [headers];
  const effectiveExamples =
    exampleRows.length > 0
      ? exampleRows
      : [
          columns.reduce<Record<string, string>>((acc, column) => {
            acc[column.key] = column.example ?? "";
            return acc;
          }, {}),
        ];
  effectiveExamples.forEach((row) => {
    exampleMatrix.push(
      columns.map((column) => String(row[column.key] ?? ""))
    );
  });
  const exampleSheet = XLSX.utils.aoa_to_sheet(exampleMatrix);
  exampleSheet["!cols"] = autoFitColumns(exampleMatrix);
  XLSX.utils.book_append_sheet(workbook, exampleSheet, EXAMPLE_SHEET_NAME);

  // 3) Petunjuk Pengisian (guide) sheet.
  const guideMatrix: Array<Array<string>> = [];
  guideMatrix.push([title]);
  guideMatrix.push([
    "Isi data pada sheet \"" +
      DATA_SHEET_NAME +
      "\". Baris pertama (header) jangan diubah / dihapus.",
  ]);
  guideMatrix.push([
    "Lihat sheet \"" + EXAMPLE_SHEET_NAME + "\" untuk contoh pengisian.",
  ]);
  guideMatrix.push([""]);
  guideMatrix.push(["Kolom", "Wajib", "Petunjuk Pengisian"]);
  columns.forEach((column) => {
    guideMatrix.push([
      column.header,
      column.required ? "Ya" : "Tidak",
      column.instruction ?? "",
    ]);
  });
  const guideSheet = XLSX.utils.aoa_to_sheet(guideMatrix);
  guideSheet["!cols"] = [{ wch: 28 }, { wch: 10 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(workbook, guideSheet, GUIDE_SHEET_NAME);

  XLSX.writeFile(workbook, fileName);
};

/**
 * Export data rows into a single-sheet workbook and trigger the download.
 */
export const exportRows = (opts: {
  fileNamePrefix: string;
  columns: ExcelColumn[];
  rows: Array<Record<string, unknown>>;
}): void => {
  const { fileNamePrefix, columns, rows } = opts;
  const headers = columns.map((column) => column.header);
  const matrix: Array<Array<string>> = [headers];

  rows.forEach((row) => {
    matrix.push(
      columns.map((column) => {
        const value = row[column.key];
        if (value == null) return "";
        if (Array.isArray(value)) return value.join(", ");
        return String(value);
      })
    );
  });

  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!cols"] = autoFitColumns(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, DATA_SHEET_NAME);
  XLSX.writeFile(workbook, `${fileNamePrefix}-${timestamp()}.xlsx`);
};

export type ParsedRow = Record<string, string>;

/**
 * Read an uploaded spreadsheet file and return parsed rows keyed by column key.
 * Reads the "Data" sheet (falls back to the first non-helper sheet).
 * Rows that are completely empty are skipped.
 */
export const parseSpreadsheetFile = async (
  file: File,
  columns: ExcelColumn[]
): Promise<ParsedRow[]> => {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });

  let sheetName = workbook.SheetNames.find(
    (name) => name.toLowerCase() === DATA_SHEET_NAME.toLowerCase()
  );
  if (!sheetName) {
    sheetName = workbook.SheetNames.find(
      (name) => !HELPER_SHEET_NAMES.has(name.toLowerCase())
    );
  }
  if (!sheetName) sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
  });

  // Map possibly-varied header labels to our internal keys.
  const headerToKey = new Map<string, string>();
  columns.forEach((column) => {
    headerToKey.set(normalizeHeader(column.header), column.key);
    headerToKey.set(normalizeHeader(column.key), column.key);
  });

  const parsed: ParsedRow[] = [];
  raw.forEach((rawRow) => {
    const mapped: ParsedRow = {};
    let hasValue = false;
    Object.entries(rawRow).forEach(([header, value]) => {
      const key = headerToKey.get(normalizeHeader(header));
      if (!key) return;
      const text = String(value ?? "").trim();
      mapped[key] = text;
      if (text) hasValue = true;
    });
    if (hasValue) parsed.push(mapped);
  });

  return parsed;
};

const normalizeHeader = (value: string): string =>
  String(value ?? "")
    .replace(/\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
