import dayjs, { type Dayjs } from "dayjs";
import * as XLSX from "xlsx";

/** Nilai filter tanggal: [dari, sampai] atau null kalau tidak ada filter. */
export type DateRangeValue = [Dayjs, Dayjs] | null;

/** Normalisasi nilai dari antd RangePicker (bisa berisi null) menjadi DateRangeValue. */
export const normalizeDateRange = (
  value: [Dayjs | null, Dayjs | null] | null | undefined,
): DateRangeValue => {
  if (!value || !value[0] || !value[1]) return null;
  return [value[0], value[1]];
};

/** Ambil nilai tanggal pertama yang terisi dari beberapa kandidat key. */
export const pickDateValue = (
  record: unknown,
  keys: readonly string[],
): string | undefined => {
  if (typeof record !== "object" || record === null) return undefined;
  const rec = record as Record<string, unknown>;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "string" && v.trim() && v.trim() !== "-") return v.trim();
    if (v instanceof Date) return v.toISOString();
  }
  return undefined;
};

/**
 * Cek apakah `value` berada dalam range (inklusif, per hari).
 * - Tidak ada range  -> selalu true.
 * - Ada range tapi tanggal kosong / tidak valid -> false.
 */
export const isWithinDateRange = (
  value: unknown,
  range: DateRangeValue,
): boolean => {
  if (!range) return true;
  if (value == null || value === "" || value === "-") return false;
  const d = dayjs(value as string | Date);
  if (!d.isValid()) return false;
  return (
    !d.isBefore(range[0].startOf("day")) && !d.isAfter(range[1].endOf("day"))
  );
};

/** Filter array berdasarkan range tanggal. `getDate` mengembalikan tanggal tiap item. */
export const filterByDateRange = <T,>(
  items: readonly T[],
  range: DateRangeValue,
  getDate: (item: T) => unknown,
): T[] => {
  if (!range) return [...items];
  return items.filter((item) => isWithinDateRange(getDate(item), range));
};

/** Label range untuk nama file / UI, contoh "2025-01-01_to_2025-01-31". */
export const formatRangeForFileName = (range: DateRangeValue): string => {
  if (!range) return dayjs().format("YYYY-MM-DD");
  return `${range[0].format("YYYY-MM-DD")}_to_${range[1].format("YYYY-MM-DD")}`;
};

export type ExportExcelOptions = {
  sheetName: string;
  /** Awalan nama file, contoh "finished-goods". */
  fileNamePrefix: string;
  range?: DateRangeValue;
};

/**
 * Tulis baris ke file .xlsx dan trigger download.
 * Mengembalikan jumlah baris yang diekspor (0 = tidak ada data, file tidak dibuat).
 */
export const exportRowsToExcel = (
  rows: Array<Record<string, string | number | null | undefined>>,
  { sheetName, fileNamePrefix, range = null }: ExportExcelOptions,
): number => {
  if (rows.length === 0) return 0;

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0]);
  worksheet["!cols"] = headers.map((h) => {
    const longest = rows.reduce(
      (max, r) => Math.max(max, String(r[h] ?? "").length),
      h.length,
    );
    return { wch: Math.min(Math.max(longest + 2, 10), 40) };
  });

  const workbook = XLSX.utils.book_new();
  // Excel membatasi nama sheet maksimal 31 karakter.
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(
    workbook,
    `${fileNamePrefix}-${formatRangeForFileName(range)}.xlsx`,
  );
  return rows.length;
};

/** Format tanggal-jam untuk kolom export; kosong kalau tidak valid. */
export const formatDateTimeForExport = (value: unknown): string => {
  if (value == null || value === "" || value === "-") return "";
  const d = dayjs(value as string | Date);
  return d.isValid() ? d.format("YYYY-MM-DD HH:mm") : "";
};
